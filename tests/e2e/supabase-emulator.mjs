// =====================================================================
// TEST-ONLY local emulator of the Supabase HTTP APIs used by TPAC
// (a PostgREST subset, GoTrue email/password auth, and Storage), backed by
// the real PostgreSQL database from scripts/local-db.sh.
//
// Every REST request runs inside a transaction with `SET LOCAL ROLE` and
// the JWT `sub` claim — exactly like PostgREST — so Row Level Security,
// grants and SECURITY DEFINER functions behave as in production.
//
// This is NOT production code and is never imported by the app. It exists
// so the Next.js app can be exercised end-to-end in an environment where
// the official Supabase containers are unavailable.
//
// Usage: node tests/e2e/supabase-emulator.mjs   (port 54321)
// =====================================================================
import http from "node:http";
import { createHmac, randomUUID, scryptSync, randomBytes, timingSafeEqual } from "node:crypto";
import { mkdirSync, writeFileSync, readFileSync, existsSync, rmSync } from "node:fs";
import path from "node:path";
import pg from "pg";

const PORT = Number(process.env.EMULATOR_PORT ?? 54321);
export const JWT_SECRET = "tpac-local-emulator-secret-do-not-use-in-production";
const STORAGE_DIR = process.env.EMULATOR_STORAGE ?? "/tmp/tpac-emulator-storage";
mkdirSync(STORAGE_DIR, { recursive: true });

const pool = new pg.Pool({ host: "/tmp", port: Number(process.env.TPAC_PGPORT ?? 54329), user: "postgres", database: "tpac", max: 10 });

// ---------------------------------------------------------------- JWT
const b64u = (b) => Buffer.from(b).toString("base64url");
export function signJwt(payload) {
  const h = b64u(JSON.stringify({ alg: "HS256", typ: "JWT" }));
  const p = b64u(JSON.stringify(payload));
  return `${h}.${p}.${createHmac("sha256", JWT_SECRET).update(`${h}.${p}`).digest("base64url")}`;
}
function verifyJwt(token) {
  const [h, p, s] = String(token ?? "").split(".");
  if (!h || !p || !s) return null;
  const expected = createHmac("sha256", JWT_SECRET).update(`${h}.${p}`).digest("base64url");
  if (expected.length !== s.length || !timingSafeEqual(Buffer.from(expected), Buffer.from(s))) return null;
  const payload = JSON.parse(Buffer.from(p, "base64url").toString());
  if (payload.exp && payload.exp < Date.now() / 1000) return null;
  return payload;
}
export const ANON_KEY = signJwt({ role: "anon", iss: "tpac-emulator", iat: 1700000000, exp: 4102444800 });
export const SERVICE_KEY = signJwt({ role: "service_role", iss: "tpac-emulator", iat: 1700000000, exp: 4102444800 });

// --------------------------------------------------------- introspection
let FKS = [];
let UNIQUE = new Map(); // table -> Set of single-column unique/pk columns
let PK = new Map();
let FUNCS = new Map();
async function introspect() {
  const fks = await pool.query(`
    select c.conname, cl.relname as tbl, a.attname as col, fcl.relname as ftbl, fa.attname as fcol
      from pg_constraint c
      join pg_class cl on cl.oid = c.conrelid join pg_namespace n on n.oid = cl.relnamespace
      join pg_class fcl on fcl.oid = c.confrelid join pg_namespace fn on fn.oid = fcl.relnamespace
      join pg_attribute a on a.attrelid = c.conrelid and a.attnum = c.conkey[1]
      join pg_attribute fa on fa.attrelid = c.confrelid and fa.attnum = c.confkey[1]
     where c.contype = 'f' and n.nspname = 'public' and fn.nspname = 'public' and array_length(c.conkey, 1) = 1`);
  FKS = fks.rows;
  const uq = await pool.query(`
    select cl.relname as tbl, a.attname as col, c.contype
      from pg_constraint c join pg_class cl on cl.oid = c.conrelid join pg_namespace n on n.oid = cl.relnamespace
      join pg_attribute a on a.attrelid = c.conrelid and a.attnum = c.conkey[1]
     where c.contype in ('p','u') and n.nspname = 'public' and array_length(c.conkey, 1) = 1`);
  UNIQUE = new Map();
  PK = new Map();
  for (const r of uq.rows) {
    if (!UNIQUE.has(r.tbl)) UNIQUE.set(r.tbl, new Set());
    UNIQUE.get(r.tbl).add(r.col);
    if (r.contype === "p") PK.set(r.tbl, r.col);
  }
  const fns = await pool.query(`
    select p.proname, p.proargnames, array(select format_type(t, null) from unnest(p.proargtypes) t) as types,
           format_type(p.prorettype, null) as rettype, p.proretset
      from pg_proc p where p.pronamespace = 'public'::regnamespace`);
  FUNCS = new Map(fns.rows.map((r) => [r.proname, r]));
}

const ident = (s) => {
  if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(s)) throw httpError(400, "PGRST100", `invalid identifier ${s}`);
  return `"${s}"`;
};
function httpError(status, code, message) {
  const e = new Error(message);
  e.status = status;
  e.body = { code, message, details: null, hint: null };
  return e;
}

// --------------------------------------------------------- select parser
function splitTop(s) {
  const out = [];
  let depth = 0, cur = "", quote = false;
  for (const ch of s) {
    if (ch === '"') quote = !quote;
    if (!quote && ch === "(") depth++;
    if (!quote && ch === ")") depth--;
    if (!quote && ch === "," && depth === 0) {
      out.push(cur);
      cur = "";
    } else cur += ch;
  }
  if (cur.trim()) out.push(cur);
  return out.map((x) => x.trim()).filter(Boolean);
}
function parseSelect(s) {
  return splitTop(s || "*").map((item) => {
    if (item === "*") return { kind: "star" };
    const m = /^(?:([a-zA-Z_][\w]*):)?([a-zA-Z_][\w]*)(?:!([\w]+))?(?:!([\w]+))?\((.*)\)$/s.exec(item);
    if (m) {
      const hints = [m[3], m[4]].filter(Boolean);
      return { kind: "embed", alias: m[1] ?? m[2], table: m[2], inner: hints.includes("inner"), fk: hints.find((h) => h !== "inner" && h !== "left"), items: parseSelect(m[5]) };
    }
    const c = /^(?:([a-zA-Z_][\w]*):)?([a-zA-Z_][\w]*)(?:::\w+)?$/.exec(item);
    if (!c) throw httpError(400, "PGRST100", `bad select item ${item}`);
    return { kind: "col", alias: c[1] ?? c[2], name: c[2] };
  });
}

function relation(parent, child, fk) {
  const m2o = FKS.filter((f) => f.tbl === parent && f.ftbl === child && (!fk || f.conname === fk || f.col === fk));
  if (m2o.length) return { type: "m2o", local: m2o[0].col, remote: m2o[0].fcol };
  const o2m = FKS.filter((f) => f.tbl === child && f.ftbl === parent && (!fk || f.conname === fk || f.col === fk));
  if (o2m.length) {
    const unique = UNIQUE.get(child)?.has(o2m[0].col);
    return { type: unique ? "o2o" : "o2m", local: o2m[0].fcol, remote: o2m[0].col };
  }
  throw httpError(400, "PGRST200", `Could not find a relationship between '${parent}' and '${child}'`);
}

// ------------------------------------------------------------- filters
function parseValueList(v) {
  const inner = v.replace(/^\(/, "").replace(/\)$/, "");
  return splitTop(inner).map((x) => x.replace(/^"(.*)"$/, "$1"));
}
function condition(alias, col, opExpr, params) {
  let neg = false;
  let expr = opExpr;
  if (expr.startsWith("not.")) {
    neg = true;
    expr = expr.slice(4);
  }
  const dot = expr.indexOf(".");
  const op = expr.slice(0, dot);
  const val = expr.slice(dot + 1);
  const c = `${alias}.${ident(col)}`;
  const p = (v) => {
    params.push(v);
    return `$${params.length}`;
  };
  let sql;
  switch (op) {
    case "eq": sql = `${c} = ${p(val)}`; break;
    case "neq": sql = `${c} <> ${p(val)}`; break;
    case "gt": sql = `${c} > ${p(val)}`; break;
    case "gte": sql = `${c} >= ${p(val)}`; break;
    case "lt": sql = `${c} < ${p(val)}`; break;
    case "lte": sql = `${c} <= ${p(val)}`; break;
    case "like": sql = `${c}::text like ${p(val.replace(/\*/g, "%"))}`; break;
    case "ilike": sql = `${c}::text ilike ${p(val.replace(/\*/g, "%"))}`; break;
    case "is": sql = `${c} is ${val === "null" ? "null" : val === "true" ? "true" : val === "false" ? "false" : "unknown"}`; break;
    case "in": sql = `${c}::text = any(${p(parseValueList(val))}::text[])`; break;
    case "cs": sql = `${c} @> ${p(val)}`; break;
    default: throw httpError(400, "PGRST100", `unsupported operator ${op}`);
  }
  return neg ? `not (${sql})` : sql;
}
function orGroup(alias, value, params, negate = false) {
  const parts = splitTop(value.replace(/^\(/, "").replace(/\)$/, ""));
  const sqls = parts.map((part) => {
    if (part.startsWith("and(")) return `(${andGroup(alias, part.slice(3), params)})`;
    if (part.startsWith("or(")) return `(${orGroup(alias, part.slice(2), params)})`;
    const d = part.indexOf(".");
    return condition(alias, part.slice(0, d), part.slice(d + 1), params);
  });
  const s = sqls.join(" or ");
  return negate ? `not (${s})` : s;
}
function andGroup(alias, value, params) {
  const parts = splitTop(value.replace(/^\(/, "").replace(/\)$/, ""));
  return parts.map((part) => { const d = part.indexOf("."); return condition(alias, part.slice(0, d), part.slice(d + 1), params); }).join(" and ");
}

const RESERVED = new Set(["select", "order", "limit", "offset", "on_conflict", "columns"]);
function collectFilters(searchParams) {
  // returns Map<path("" for root), Array<[key, value]>>
  const m = new Map();
  for (const [k, v] of searchParams) {
    const segs = k.split(".");
    const last = segs[segs.length - 1];
    if (RESERVED.has(last)) continue;
    const pathKey = segs.slice(0, -1).join(".");
    if (!m.has(pathKey)) m.set(pathKey, []);
    m.get(pathKey).push([last, v]);
  }
  return m;
}
function whereFor(alias, filters, params) {
  return (filters ?? []).map(([k, v]) => (k === "or" ? `(${orGroup(alias, v, params)})` : k === "and" ? `(${andGroup(alias, v, params)})` : condition(alias, k, v, params)));
}
function orderFor(alias, spec) {
  if (!spec) return "";
  return " order by " + spec.split(",").map((s) => {
    const [col, ...mods] = s.split(".");
    return `${alias}.${ident(col)} ${mods.includes("desc") ? "desc" : "asc"}${mods.includes("nullsfirst") ? " nulls first" : mods.includes("nullslast") ? " nulls last" : ""}`;
  }).join(", ");
}

let aliasSeq = 0;
/** jsonb expression for a row of `table` aliased `a`, honouring embeds/filters/order on sub-paths. */
function objectExpr(table, a, items, filters, sp, pathKey, params, innerConds) {
  const star = items.some((i) => i.kind === "star");
  const cols = items.filter((i) => i.kind === "col");
  let base = star ? `to_jsonb(${a}.*)` : cols.length ? `jsonb_build_object(${cols.map((c) => `'${c.alias}', ${a}.${ident(c.name)}`).join(", ")})` : `'{}'::jsonb`;
  for (const e of items.filter((i) => i.kind === "embed")) {
    const rel = relation(table, e.table, e.fk);
    const b = `e${++aliasSeq}`;
    const sub = pathKey ? `${pathKey}.${e.alias}` : e.alias;
    const subFilters = whereFor(b, filters.get(sub), params);
    const join = `${b}.${ident(rel.remote)} = ${a}.${ident(rel.local)}`;
    const inner = objectExpr(e.table, b, e.items, filters, sp, sub, params, null);
    const where = [join, ...subFilters].join(" and ");
    let expr;
    if (rel.type === "o2m") {
      const ord = orderFor(b, sp.get(`${sub}.order`));
      const lim = sp.get(`${sub}.limit`) ? ` limit ${Number(sp.get(`${sub}.limit`))}` : "";
      expr = lim
        ? `(select coalesce(jsonb_agg(x.j), '[]'::jsonb) from (select ${inner} as j from public.${ident(e.table)} ${b} where ${where}${ord}${lim}) x)`
        : `(select coalesce(jsonb_agg(${inner}${ord}), '[]'::jsonb) from public.${ident(e.table)} ${b} where ${where})`;
    } else {
      expr = `(select ${inner} from public.${ident(e.table)} ${b} where ${where} limit 1)`;
    }
    base = `${base} || jsonb_build_object('${e.alias}', ${expr})`;
    if (e.inner && innerConds) innerConds.push(`exists (select 1 from public.${ident(e.table)} ${b}x where ${where.replaceAll(`${b}.`, `${b}x.`)})`);
  }
  return base;
}

// --------------------------------------------------------------- REST
async function withRole(claims, fn) {
  const c = await pool.connect();
  try {
    await c.query("begin");
    await c.query(`set local role ${claims.role === "service_role" ? "service_role" : claims.role === "authenticated" ? "authenticated" : "anon"}`);
    await c.query("select set_config('request.jwt.claim.sub', $1, true), set_config('request.jwt.claims', $2, true)", [claims.sub ?? "", JSON.stringify(claims)]);
    const out = await fn(c);
    await c.query("commit");
    return out;
  } catch (e) {
    await c.query("rollback").catch(() => {});
    throw e;
  } finally {
    c.release();
  }
}

function pgToHttp(e) {
  if (e.status) return e;
  const status = e.code === "42501" ? 403 : e.code === "23505" || e.code === "23503" ? 409 : e.code === "P0002" ? 404 : 400;
  const err = new Error(e.message);
  err.status = status;
  err.body = { code: e.code ?? "PGRST000", message: e.message, details: e.detail ?? null, hint: e.hint ?? null };
  return err;
}

async function rest(req, res, url, claims, body) {
  const rel = url.pathname.replace(/^\/rest\/v1\//, "");
  const sp = url.searchParams;
  const prefer = String(req.headers["prefer"] ?? "");
  const accept = String(req.headers["accept"] ?? "");
  const single = accept.includes("vnd.pgrst.object+json");

  if (rel.startsWith("rpc/")) {
    const name = rel.slice(4);
    const fn = FUNCS.get(name);
    if (!fn) throw httpError(404, "PGRST202", `function ${name} not found`);
    const args = req.method === "GET" ? Object.fromEntries(sp) : body ?? {};
    const names = fn.proargnames ?? [];
    const params = [];
    const parts = Object.entries(args).map(([k, v]) => {
      const idx = names.indexOf(k);
      if (idx < 0) throw httpError(404, "PGRST202", `function ${name}(${k}) not found`);
      params.push(v !== null && typeof v === "object" ? JSON.stringify(v) : v);
      return `${ident(k)} => $${params.length}::${fn.types[idx]}`;
    });
    const r = await withRole(claims, (c) => c.query(`select ${fn.proretset ? "*" : "public." + ident(name) + "(" + parts.join(", ") + ") as r"}${fn.proretset ? ` from public.${ident(name)}(${parts.join(", ")}) r` : ""}`, params));
    const value = fn.proretset ? r.rows.map((x) => x.r ?? x) : r.rows[0]?.r ?? null;
    return send(res, 200, fn.rettype === "void" ? null : value);
  }

  const table = rel;
  ident(table);
  const filters = collectFilters(sp);
  const params = [];
  const items = parseSelect(sp.get("select") ?? "*");
  const a = "t";

  if (req.method === "GET" || req.method === "HEAD") {
    const innerConds = [];
    const obj = objectExpr(table, a, items, filters, sp, "", params, innerConds);
    const where = [...whereFor(a, filters.get(""), params), ...innerConds];
    const whereSql = where.length ? ` where ${where.join(" and ")}` : "";
    const ord = orderFor(a, sp.get("order"));
    const limit = sp.get("limit") ? ` limit ${Number(sp.get("limit"))}` : "";
    const offset = sp.get("offset") ? ` offset ${Number(sp.get("offset"))}` : "";
    const wantCount = /count=(exact|planned|estimated)/.test(prefer);
    const { rows, total } = await withRole(claims, async (c) => {
      const r = req.method === "HEAD" ? { rows: [] } : await c.query(`select ${obj} as j from public.${ident(table)} ${a}${whereSql}${ord}${limit}${offset}`, params);
      const t = wantCount ? Number((await c.query(`select count(*) n from public.${ident(table)} ${a}${whereSql}`, params)).rows[0].n) : null;
      return { rows: r.rows.map((x) => x.j), total: t };
    });
    const headers = {};
    if (total !== null) {
      const from = Number(sp.get("offset") ?? 0);
      headers["content-range"] = rows.length ? `${from}-${from + rows.length - 1}/${total}` : `*/${total}`;
    }
    if (single) {
      if (rows.length !== 1) return send(res, 406, { code: "PGRST116", message: "JSON object requested, multiple (or no) rows returned", details: `Results contain ${rows.length} rows`, hint: null });
      return send(res, 200, rows[0], headers);
    }
    return send(res, 200, req.method === "HEAD" ? undefined : rows, headers);
  }

  const returning = prefer.includes("return=representation");
  const wrap = (cte) => `with w as (${cte}) select ${objectExpr(table, a, items, filters, sp, "", params, null)} as j from w ${a}`;

  if (req.method === "POST") {
    const rowsIn = Array.isArray(body) ? body : [body];
    if (!rowsIn.length) return send(res, 201, []);
    const cols = [...new Set(rowsIn.flatMap((r) => Object.keys(r)))];
    params.push(JSON.stringify(rowsIn.map((r) => Object.fromEntries(cols.map((c) => [c, r[c] ?? null])))));
    const pidx = params.length;
    let sql = `insert into public.${ident(table)} (${cols.map(ident).join(", ")}) select ${cols.map(ident).join(", ")} from jsonb_populate_recordset(null::public.${ident(table)}, $${pidx}::jsonb)`;
    const merge = /resolution=merge-duplicates/.test(prefer);
    const ignore = /resolution=ignore-duplicates/.test(prefer);
    if (merge || ignore) {
      const target = (sp.get("on_conflict") ?? PK.get(table)).split(",").map(ident).join(", ");
      sql += ignore ? ` on conflict (${target}) do nothing` : ` on conflict (${target}) do update set ${cols.map((c) => `${ident(c)} = excluded.${ident(c)}`).join(", ")}`;
    }
    sql += " returning *";
    const out = await withRole(claims, (c) => c.query(returning ? wrap(sql) : sql, params));
    const rows = returning ? out.rows.map((x) => x.j) : [];
    if (single) return rows.length === 1 ? send(res, 201, rows[0]) : send(res, 406, { code: "PGRST116", message: "JSON object requested, multiple (or no) rows returned" });
    return send(res, 201, returning ? rows : null);
  }

  if (req.method === "PATCH" || req.method === "DELETE") {
    const where = whereFor(a, filters.get(""), params);
    const whereSql = where.length ? ` where ${where.join(" and ")}` : "";
    let sql;
    if (req.method === "PATCH") {
      const cols = Object.keys(body ?? {});
      if (!cols.length) return send(res, 204, null);
      params.push(JSON.stringify(body));
      const pidx = params.length;
      sql = `update public.${ident(table)} ${a} set ${cols.map((c) => `${ident(c)} = (jsonb_populate_record(null::public.${ident(table)}, $${pidx}::jsonb)).${ident(c)}`).join(", ")}${whereSql} returning ${a}.*`;
    } else {
      sql = `delete from public.${ident(table)} ${a}${whereSql} returning ${a}.*`;
    }
    const out = await withRole(claims, (c) => c.query(returning ? wrap(sql) : sql, params));
    const rows = returning ? out.rows.map((x) => x.j) : [];
    const headers = /count=exact/.test(prefer) ? { "content-range": `*/${out.rowCount}` } : {};
    if (single) return rows.length === 1 ? send(res, 200, rows[0], headers) : send(res, 406, { code: "PGRST116", message: "JSON object requested, multiple (or no) rows returned" });
    return send(res, returning ? 200 : 204, returning ? rows : null, headers);
  }
  throw httpError(405, "PGRST000", "method not allowed");
}

// --------------------------------------------------------------- auth
const hashPw = (pw) => {
  const salt = randomBytes(16).toString("hex");
  return `${salt}:${scryptSync(pw, salt, 32).toString("hex")}`;
};
const checkPw = (pw, stored) => {
  if (!stored) return false;
  const [salt, h] = stored.split(":");
  return timingSafeEqual(Buffer.from(h, "hex"), scryptSync(pw, salt, 32));
};
const refreshTokens = new Map();
function userJson(u) {
  return { id: u.id, aud: "authenticated", role: "authenticated", email: u.email, email_confirmed_at: u.created_at, phone: "", app_metadata: { provider: "email", providers: ["email"] }, user_metadata: u.raw_user_meta_data ?? {}, identities: [], created_at: u.created_at, updated_at: u.created_at, is_anonymous: false };
}
function session(u) {
  const now = Math.floor(Date.now() / 1000);
  const access_token = signJwt({ sub: u.id, role: "authenticated", aud: "authenticated", email: u.email, iat: now, exp: now + 3600, session_id: randomUUID() });
  const refresh_token = randomBytes(24).toString("hex");
  refreshTokens.set(refresh_token, u.id);
  return { access_token, token_type: "bearer", expires_in: 3600, expires_at: now + 3600, refresh_token, user: userJson(u) };
}
const authErr = (status, error_code, msg) => {
  const e = new Error(msg);
  e.status = status;
  e.body = { code: status, error_code, msg };
  return e;
};
async function auth(req, res, url, body) {
  const route = url.pathname.replace(/^\/auth\/v1/, "");
  const bearer = String(req.headers.authorization ?? "").replace(/^Bearer /, "");
  if (route === "/signup" && req.method === "POST") {
    const email = String(body.email ?? "").toLowerCase();
    if (String(body.password ?? "").length < 8) throw authErr(422, "weak_password", "Password should be at least 8 characters");
    const exists = await pool.query("select 1 from auth.users where email = $1", [email]);
    if (exists.rowCount) throw authErr(422, "user_already_exists", "User already registered");
    const r = await pool.query("insert into auth.users (email, raw_user_meta_data, encrypted_password) values ($1, $2, $3) returning *", [email, JSON.stringify(body.data ?? {}), hashPw(body.password)]);
    return send(res, 200, session(r.rows[0]));
  }
  if (route === "/token" && req.method === "POST") {
    const grant = url.searchParams.get("grant_type");
    if (grant === "password") {
      const r = await pool.query("select * from auth.users where email = $1", [String(body.email ?? "").toLowerCase()]);
      if (!r.rowCount || !checkPw(String(body.password ?? ""), r.rows[0].encrypted_password)) throw authErr(400, "invalid_credentials", "Invalid login credentials");
      return send(res, 200, session(r.rows[0]));
    }
    if (grant === "refresh_token") {
      const uid = refreshTokens.get(body.refresh_token);
      if (!uid) throw authErr(400, "refresh_token_not_found", "Invalid Refresh Token");
      const r = await pool.query("select * from auth.users where id = $1", [uid]);
      return send(res, 200, session(r.rows[0]));
    }
  }
  if (route === "/user") {
    const claims = verifyJwt(bearer);
    if (!claims?.sub) throw authErr(401, "bad_jwt", "invalid JWT");
    if (req.method === "PUT" && body?.password) await pool.query("update auth.users set encrypted_password = $1 where id = $2", [hashPw(body.password), claims.sub]);
    const r = await pool.query("select * from auth.users where id = $1", [claims.sub]);
    if (!r.rowCount) throw authErr(404, "user_not_found", "User not found");
    return send(res, 200, userJson(r.rows[0]));
  }
  if (route === "/logout") return send(res, 204, null);
  if (route === "/recover") return send(res, 200, {});
  throw authErr(404, "not_found", `auth route ${route} not emulated`);
}

// ------------------------------------------------------------- storage
const fileOf = (bucket, key) => path.join(STORAGE_DIR, bucket, key);
const objectTokens = new Map(); // token -> {bucket, key, kind, exp}
async function readMultipartOrRaw(req, raw) {
  const ct = String(req.headers["content-type"] ?? "");
  if (ct.startsWith("multipart/form-data")) {
    const form = await new Request("http://x", { method: "POST", headers: { "content-type": ct }, body: raw }).formData();
    for (const [, v] of form) if (typeof v !== "string") return { buf: Buffer.from(await v.arrayBuffer()), type: v.type || "application/octet-stream" };
  }
  return { buf: raw, type: ct || "application/octet-stream" };
}
async function putObject(claims, bucket, key, data) {
  const b = (await pool.query("select * from storage.buckets where id = $1", [bucket])).rows[0];
  if (!b) throw httpError(404, "404", "Bucket not found");
  if (b.file_size_limit && data.buf.length > Number(b.file_size_limit)) throw httpError(413, "413", "The object exceeded the maximum allowed size");
  if (b.allowed_mime_types?.length && !b.allowed_mime_types.includes(data.type.split(";")[0])) throw httpError(415, "415", `mime type ${data.type} is not supported`);
  // RLS check exactly like Supabase Storage: the row insert runs as the caller.
  await withRole(claims, (c) => c.query("insert into storage.objects (bucket_id, name) values ($1, $2)", [bucket, key]));
  mkdirSync(path.dirname(fileOf(bucket, key)), { recursive: true });
  writeFileSync(fileOf(bucket, key), data.buf);
  writeFileSync(fileOf(bucket, key) + ".__type", data.type);
}
function serveFile(res, bucket, key) {
  const f = fileOf(bucket, key);
  if (!existsSync(f)) return send(res, 404, { statusCode: "404", error: "not_found", message: "Object not found" });
  const type = existsSync(f + ".__type") ? readFileSync(f + ".__type", "utf8") : "application/octet-stream";
  res.writeHead(200, { "content-type": type, "cache-control": "max-age=60", "access-control-allow-origin": "*" });
  res.end(readFileSync(f));
}
async function storage(req, res, url, claims, raw) {
  const route = decodeURIComponent(url.pathname.replace(/^\/storage\/v1/, ""));
  let m;
  if ((m = /^\/object\/public\/([^/]+)\/(.+)$/.exec(route)) && req.method === "GET") {
    const b = (await pool.query("select public from storage.buckets where id = $1", [m[1]])).rows[0];
    if (!b?.public) return send(res, 400, { error: "not public" });
    return serveFile(res, m[1], m[2]);
  }
  if ((m = /^\/object\/upload\/sign\/([^/]+)\/(.+)$/.exec(route))) {
    if (req.method === "POST") {
      if (claims.role !== "service_role") throw httpError(403, "403", "only service role may sign uploads here");
      const token = randomBytes(16).toString("hex");
      objectTokens.set(token, { bucket: m[1], key: m[2], kind: "upload", exp: Date.now() + 7200e3 });
      return send(res, 200, { url: `/object/upload/sign/${m[1]}/${m[2]}?token=${token}` });
    }
    if (req.method === "PUT") {
      const t = objectTokens.get(url.searchParams.get("token"));
      if (!t || t.kind !== "upload" || t.bucket !== m[1] || t.key !== m[2] || t.exp < Date.now()) throw httpError(400, "400", "invalid signature");
      objectTokens.delete(url.searchParams.get("token"));
      await putObject({ role: "service_role" }, m[1], m[2], await readMultipartOrRaw(req, raw));
      return send(res, 200, { Key: `${m[1]}/${m[2]}` });
    }
  }
  if ((m = /^\/object\/sign\/([^/]+)\/(.+)$/.exec(route))) {
    if (req.method === "POST") {
      const ok = await withRole(claims, async (c) => (await c.query("select 1 from storage.objects where bucket_id = $1 and name = $2", [m[1], m[2]])).rowCount);
      if (!ok) return send(res, 400, { statusCode: "404", error: "not_found", message: "Object not found" });
      const token = randomBytes(16).toString("hex");
      objectTokens.set(token, { bucket: m[1], key: m[2], kind: "read", exp: Date.now() + (Number(JSON.parse(raw.toString() || "{}").expiresIn) || 60) * 1000 });
      return send(res, 200, { signedURL: `/object/sign/${m[1]}/${m[2]}?token=${token}` });
    }
    if (req.method === "GET") {
      const t = objectTokens.get(url.searchParams.get("token"));
      if (!t || t.kind !== "read" || t.bucket !== m[1] || t.key !== m[2] || t.exp < Date.now()) return send(res, 400, { error: "InvalidJWT", message: "invalid signature" });
      return serveFile(res, m[1], m[2]);
    }
  }
  if ((m = /^\/object\/sign\/([^/]+)$/.exec(route)) && req.method === "POST") {
    const { paths, expiresIn } = JSON.parse(raw.toString() || "{}");
    const out = [];
    for (const p of paths ?? []) {
      const ok = await withRole(claims, async (c) => (await c.query("select 1 from storage.objects where bucket_id = $1 and name = $2", [m[1], p])).rowCount);
      if (!ok) { out.push({ path: p, signedURL: null, error: "Either the object does not exist or you do not have access to it" }); continue; }
      const token = randomBytes(16).toString("hex");
      objectTokens.set(token, { bucket: m[1], key: p, kind: "read", exp: Date.now() + (Number(expiresIn) || 60) * 1000 });
      out.push({ path: p, signedURL: `/object/sign/${m[1]}/${p}?token=${token}`, error: null });
    }
    return send(res, 200, out);
  }
  if (route === "/object/copy" && req.method === "POST") {
    const { bucketId, sourceKey, destinationKey } = JSON.parse(raw.toString() || "{}");
    const ok = await withRole(claims, async (c) => (await c.query("select 1 from storage.objects where bucket_id = $1 and name = $2", [bucketId, sourceKey])).rowCount);
    if (!ok || !existsSync(fileOf(bucketId, sourceKey))) return send(res, 404, { statusCode: "404", error: "not_found", message: "Object not found" });
    await withRole(claims, (c) => c.query("insert into storage.objects (bucket_id, name) values ($1, $2)", [bucketId, destinationKey]));
    mkdirSync(path.dirname(fileOf(bucketId, destinationKey)), { recursive: true });
    writeFileSync(fileOf(bucketId, destinationKey), readFileSync(fileOf(bucketId, sourceKey)));
    if (existsSync(fileOf(bucketId, sourceKey) + ".__type")) writeFileSync(fileOf(bucketId, destinationKey) + ".__type", readFileSync(fileOf(bucketId, sourceKey) + ".__type"));
    return send(res, 200, { Key: `${bucketId}/${destinationKey}` });
  }
  if ((m = /^\/object\/(?:authenticated\/)?([^/]+)\/(.+)$/.exec(route))) {
    if (req.method === "GET") {
      const ok = await withRole(claims, async (c) => (await c.query("select 1 from storage.objects where bucket_id = $1 and name = $2", [m[1], m[2]])).rowCount);
      return ok ? serveFile(res, m[1], m[2]) : send(res, 400, { statusCode: "404", error: "not_found", message: "Object not found" });
    }
    if (req.method === "POST" || req.method === "PUT") {
      await putObject(claims, m[1], m[2], await readMultipartOrRaw(req, raw));
      return send(res, 200, { Key: `${m[1]}/${m[2]}`, Id: randomUUID() });
    }
  }
  if ((m = /^\/object\/([^/]+)$/.exec(route)) && req.method === "DELETE") {
    const { prefixes } = JSON.parse(raw.toString() || "{}");
    const removed = await withRole(claims, async (c) => (await c.query("delete from storage.objects where bucket_id = $1 and name = any($2) returning name", [m[1], prefixes ?? []])).rows);
    for (const r of removed) rmSync(fileOf(m[1], r.name), { force: true });
    return send(res, 200, removed.map((r) => ({ name: r.name })));
  }
  throw httpError(404, "404", `storage route ${req.method} ${route} not emulated`);
}

// -------------------------------------------------------------- server
function send(res, status, body, headers = {}) {
  res.writeHead(status, { "content-type": "application/json", "access-control-allow-origin": "*", "access-control-expose-headers": "content-range", ...headers });
  res.end(body === null || body === undefined ? "" : JSON.stringify(body));
}

const server = http.createServer(async (req, res) => {
  if (req.method === "OPTIONS") {
    res.writeHead(204, { "access-control-allow-origin": "*", "access-control-allow-methods": "*", "access-control-allow-headers": "*", "access-control-expose-headers": "content-range" });
    return res.end();
  }
  const chunks = [];
  for await (const c of req) chunks.push(c);
  const raw = Buffer.concat(chunks);
  const url = new URL(req.url, `http://localhost:${PORT}`);
  try {
    const bearer = String(req.headers.authorization ?? "").replace(/^Bearer /, "") || String(req.headers.apikey ?? "");
    const claims = verifyJwt(bearer) ?? { role: "anon" };
    if (url.pathname.startsWith("/rest/v1/")) {
      const body = raw.length && String(req.headers["content-type"] ?? "").includes("json") ? JSON.parse(raw.toString()) : null;
      return await rest(req, res, url, claims, body);
    }
    if (url.pathname.startsWith("/auth/v1/")) return await auth(req, res, url, raw.length ? JSON.parse(raw.toString()) : {});
    if (url.pathname.startsWith("/storage/v1/")) return await storage(req, res, url, claims, raw);
    send(res, 404, { message: "not found" });
  } catch (e) {
    const err = pgToHttp(e);
    if (process.env.EMULATOR_DEBUG) console.error(req.method, req.url, err.body);
    send(res, err.status ?? 500, err.body ?? { message: String(e) });
  }
});

await pool.query("alter table auth.users add column if not exists encrypted_password text");
await introspect();
server.listen(PORT, () => {
  console.log(`supabase emulator on http://localhost:${PORT}`);
  console.log(`ANON_KEY=${ANON_KEY}`);
  console.log(`SERVICE_KEY=${SERVICE_KEY}`);
});
