import { execFileSync } from "node:child_process";
import pg from "pg";
import path from "node:path";

const ROOT = path.resolve(import.meta.dirname, "../..");
let pool: pg.Pool | null = null;

/** Creates a fresh Postgres cluster with the Supabase shim + all migrations + seed. */
export function setupDatabase(): pg.Pool {
  if (pool) return pool;
  execFileSync("bash", [path.join(ROOT, "scripts/local-db.sh")], { stdio: "pipe" });
  pool = new pg.Pool({ host: "/tmp", port: Number(process.env.TPAC_PGPORT ?? 54329), user: "postgres", database: "tpac", max: 6 });
  return pool;
}

export async function teardown() {
  await pool?.end();
  pool = null;
}

export type Who = { role: "anon" } | { role: "authenticated"; uid: string } | { role: "service_role" } | { role: "postgres" };

/**
 * Runs `fn` inside a transaction impersonating a Supabase role, exactly like
 * PostgREST does (SET LOCAL ROLE + request.jwt.claim.sub). Rolled back unless commit=true.
 */
export async function as<T>(who: Who, fn: (c: pg.PoolClient) => Promise<T>, commit = false): Promise<T> {
  const c = await pool!.connect();
  try {
    await c.query("begin");
    if (who.role !== "postgres") await c.query(`set local role ${who.role}`);
    await c.query("select set_config('request.jwt.claim.sub', $1, true)", [who.role === "authenticated" ? who.uid : ""]);
    const out = await fn(c);
    await c.query(commit ? "commit" : "rollback");
    return out;
  } catch (e) {
    await c.query("rollback").catch(() => undefined);
    throw e;
  } finally {
    c.release();
  }
}

export async function q<T = Record<string, unknown>>(sql: string, params: unknown[] = []): Promise<T[]> {
  const r = await pool!.query(sql, params);
  return r.rows as T[];
}

/** Creates an auth user (the trigger creates the profile). Optional role. */
export async function createUser(email: string, opts: { phone?: string; role?: "customer" | "staff" | "admin"; name?: string } = {}): Promise<string> {
  const [{ id }] = await q<{ id: string }>(
    "insert into auth.users (email, raw_user_meta_data) values ($1, $2) returning id",
    [email, JSON.stringify({ full_name: opts.name ?? email.split("@")[0], phone: opts.phone ?? null, locale: "ar" })],
  );
  if (opts.role && opts.role !== "customer") await q("update customer_profiles set role = $1 where id = $2", [opts.role, id]);
  return id;
}

/** Picks an in-stock variant (and its price) with at least `min` units. */
export async function variantWithStock(min = 5, skip: string[] = []) {
  const [row] = await q<{ id: string; sku: string; price: number; quantity: number; product_id: string }>(
    `select v.id, v.sku, coalesce(v.price_override, p.base_price) as price, i.quantity, p.id as product_id
       from product_variants v join products p on p.id = v.product_id join inventory i on i.variant_id = v.id
      where i.quantity >= $1 and v.is_active and p.is_published and not (v.id = any($2::uuid[]))
      order by v.sku limit 1`,
    [min, skip],
  );
  return row!;
}

export const stockOf = async (variantId: string) => (await q<{ quantity: number }>("select quantity from inventory where variant_id = $1", [variantId]))[0]!.quantity;

export function orderPayload(items: unknown[], extra: Record<string, unknown> = {}) {
  return {
    items,
    customer_name: "Test Customer",
    phone: "07701234567",
    governorate: "baghdad",
    city: "Karrada",
    address_line: "Street 1",
    delivery_method: "standard",
    payment_method: "cod",
    locale: "ar",
    ...extra,
  };
}
