"use server";
import { randomBytes } from "node:crypto";
import { after } from "next/server";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { getSession } from "@/lib/auth";
import { rateLimit } from "@/lib/rate-limit";
import { phoneSchema, fieldErrors, uuid, BULK_PRODUCT_TYPES, BULK_SIZES } from "@/lib/validation";
import { notifyAdmin } from "@/lib/notifications";
import { sniffMime } from "@/lib/storage";
import { groupTemplateSchema, PLACEMENT_LABEL, type GroupTemplate } from "@/lib/group-template";

type Fail = { ok: false; error: string; fields?: Record<string, string> };
const text = (min: number, max: number) => z.string().trim().min(min, "required").max(max, "max");
const tokenRe = /^[A-Za-z0-9_-]{20,64}$/;
const codeRe = /^[a-z0-9]{6,16}$/;
const MAX_MEMBERS = 500;

const createSchema = z.object({
  title: text(2, 120),
  organizer_name: text(2, 80),
  organizer_phone: phoneSchema,
  product_slug: z.string().regex(/^[a-z0-9-]{1,160}$/).optional(),
  product_type: z.enum(BULK_PRODUCT_TYPES),
  idea: z.string().trim().max(1000).optional(),
  allow_names: z.boolean(),
  deadline: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  // the piece itself (own design): garment, colour, the organiser's fixed design(s), what members add
  garment: z.enum(["hoodie", "tshirt", "sweatshirt", "oversized"]).optional(),
  color_id: uuid.optional(),
  template: groupTemplateSchema.optional(),
});

/** Images uploaded through the studio uploader in the last day, by this same person, not used elsewhere yet. */
async function freshArtwork(ids: string[], userId: string | null): Promise<boolean> {
  if (!ids.length) return true;
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const { data } = await createAdminClient().from("uploaded_artwork").select("id, uploaded_by, storage_path, bulk_request_id").in("id", ids).gte("created_at", since);
  const ok = ((data ?? []) as { id: string; uploaded_by: string | null; storage_path: string; bulk_request_id: string | null }[])
    .filter((a) => a.storage_path.startsWith("uploads/design/") && !a.bulk_request_id && (a.uploaded_by ?? null) === userId);
  return ok.length === new Set(ids).size;
}

/** An organiser opens a group order: returns the members' link code and the organiser's own token. */
export async function createGroupOrder(input: unknown): Promise<{ ok: true; code: string; token: string } | Fail> {
  const parsed = createSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "validation", fields: fieldErrors(parsed.error) };
  if (!(await rateLimit("group"))) return { ok: false, error: "rate_limited" };
  const d = parsed.data;
  if (d.deadline && new Date(`${d.deadline}T23:59:59`) < new Date()) return { ok: false, error: "validation", fields: { deadline: "past" } };
  const db = createAdminClient();
  let productId: string | null = null;
  if (d.product_slug) {
    const { data: p } = await db.from("products").select("id").eq("slug", d.product_slug).eq("is_published", true).maybeSingle();
    productId = (p?.id as string | undefined) ?? null;
  }
  const session = await getSession();
  // a store product brings its own design; otherwise the organiser's template describes the piece
  const template: GroupTemplate = d.template ?? groupTemplateSchema.parse({ member: { kind: d.allow_names ? "name" : "none" } });
  if (productId) template.fixed = {};
  if (template.member.kind !== "none" && template.fixed[template.member.placement]) return { ok: false, error: "validation", fields: { placement: "taken" } };
  if (!(await freshArtwork(Object.values(template.fixed).filter(Boolean) as string[], session?.userId ?? null))) return { ok: false, error: "artwork" };
  const token = randomBytes(18).toString("base64url");
  for (let i = 0; i < 4; i++) {
    const code = randomBytes(6).toString("base64url").toLowerCase().replace(/[^a-z0-9]/g, "").padEnd(8, "x").slice(0, 8);
    const { error } = await db.from("group_orders").insert({
      code, admin_token: token, title: d.title, organizer_name: d.organizer_name, organizer_phone: d.organizer_phone,
      product_id: productId, product_type: productId ? d.product_type : d.garment ?? d.product_type, idea: d.idea || null, allow_names: template.member.kind === "name",
      garment: productId ? null : d.garment ?? null, color_id: productId ? null : d.color_id ?? null, template,
      deadline: d.deadline ?? null, user_id: session?.userId ?? null,
    });
    if (!error) return { ok: true, code, token };
    if (error.code !== "23505") {
      console.error("createGroupOrder", error);
      return { ok: false, error: "generic" };
    }
  }
  return { ok: false, error: "generic" };
}

const joinSchema = z.object({
  name: text(2, 80),
  size_code: z.enum(BULK_SIZES),
  quantity: z.coerce.number().int().min(1).max(20),
  print_name: z.string().trim().max(30).optional(),
  note: z.string().trim().max(200).optional(),
  artwork_id: uuid.optional(),
  // designed in the studio: the member's layout and previews of both sides
  design: z.object({
    fabric: z.array(z.record(z.string(), z.unknown())).max(40),
    preview_front: z.string().regex(/^data:image\/(jpeg|png);base64,[A-Za-z0-9+/=]+$/).max(2_500_000),
    preview_back: z.string().regex(/^data:image\/(jpeg|png);base64,[A-Za-z0-9+/=]+$/).max(2_500_000),
  }).optional(),
});

function decodeImage(dataUrl: string): { buf: Buffer; mime: string } | null {
  const m = /^data:(image\/(?:jpeg|png));base64,(.+)$/.exec(dataUrl);
  if (!m) return null;
  const buf = Buffer.from(m[2]!, "base64");
  return sniffMime(buf) === m[1] ? { buf, mime: m[1]! } : null;
}

/** A member adds their name and size through the group link. */
export async function joinGroupOrder(code: string, input: unknown): Promise<{ ok: true; id: string } | Fail> {
  if (typeof code !== "string" || !codeRe.test(code)) return { ok: false, error: "not_found" };
  const parsed = joinSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "validation", fields: fieldErrors(parsed.error) };
  if (!(await rateLimit("groupJoin"))) return { ok: false, error: "rate_limited" };
  const db = createAdminClient();
  const { data: g } = await db.from("group_orders").select("id, status, deadline, allow_names, template").eq("code", code).maybeSingle();
  if (!g) return { ok: false, error: "not_found" };
  if (g.status !== "open" || (g.deadline && new Date(`${g.deadline}T23:59:59`) < new Date())) return { ok: false, error: "closed" };
  const { count } = await db.from("group_order_members").select("id", { count: "exact", head: true }).eq("group_id", g.id);
  if ((count ?? 0) >= MAX_MEMBERS) return { ok: false, error: "full" };
  const d = parsed.data;
  const kind = (g.template as GroupTemplate | null)?.member?.kind ?? (g.allow_names ? "name" : "none");
  // what the organiser asked each member to add is required
  if (kind === "name" && !d.print_name) return { ok: false, error: "validation", fields: { print_name: "required" } };
  const session = await getSession();
  // images in the member's studio layout: only their own fresh uploads
  const artIds = [...new Set((d.design?.fabric ?? []).map((o) => o.tpacArtworkId).filter((x): x is string => typeof x === "string" && /^[0-9a-f-]{36}$/.test(x)))];
  if (kind === "design" && !d.artwork_id && !d.design?.fabric.length) return { ok: false, error: "validation", fields: { artwork: "required" } };
  const own = [...artIds, ...(d.artwork_id ? [d.artwork_id] : [])];
  if (own.length && !(await freshArtwork(own, session?.userId ?? null))) return { ok: false, error: "artwork" };
  if (d.design && JSON.stringify(d.design.fabric).length > 300_000) return { ok: false, error: "too_large" };
  const id = crypto.randomUUID();
  let front: string | null = null;
  let back: string | null = null;
  if (d.design) {
    const f = decodeImage(d.design.preview_front);
    const b = decodeImage(d.design.preview_back);
    if (!f || !b) return { ok: false, error: "validation" };
    const ext = (m: string) => (m === "image/png" ? "png" : "jpg");
    front = `groups/${g.id}/${id}/front.${ext(f.mime)}`;
    back = `groups/${g.id}/${id}/back.${ext(b.mime)}`;
    const bucket = db.storage.from("design-uploads");
    const [u1, u2] = await Promise.all([
      bucket.upload(front, f.buf, { contentType: f.mime, upsert: false }),
      bucket.upload(back, b.buf, { contentType: b.mime, upsert: false }),
    ]);
    if (u1.error || u2.error) return { ok: false, error: "storage_failed" };
  }
  const fabric = d.design?.fabric.map((o) => (typeof o.tpacArtworkId === "string" ? { ...o, src: "" } : o)) ?? null;
  const { data, error } = await db.from("group_order_members").insert({
    id, group_id: g.id, name: d.name, size_code: d.size_code, quantity: d.quantity,
    print_name: kind === "name" ? d.print_name || null : null, note: d.note || null,
    artwork_id: d.artwork_id ?? null, design: fabric, artwork_ids: artIds,
    preview_front_path: front, preview_back_path: back,
  }).select("id").single();
  if (error || !data) return { ok: false, error: "generic" };
  return { ok: true, id: data.id as string };
}

async function groupByToken(token: string) {
  if (typeof token !== "string" || !tokenRe.test(token)) return null;
  const { data } = await createAdminClient().from("group_orders").select("*").eq("admin_token", token).maybeSingle();
  return data;
}

/** The organiser removes a line someone added by mistake. */
export async function removeGroupMember(token: string, memberId: string): Promise<{ ok: true } | Fail> {
  const g = await groupByToken(token);
  if (!g) return { ok: false, error: "not_found" };
  if (g.status === "submitted") return { ok: false, error: "closed" };
  if (!/^[0-9a-f-]{36}$/.test(memberId)) return { ok: false, error: "validation" };
  await createAdminClient().from("group_order_members").delete().eq("id", memberId).eq("group_id", g.id);
  return { ok: true };
}

/** The organiser stops or reopens new entries. */
export async function setGroupOpen(token: string, open: boolean): Promise<{ ok: true } | Fail> {
  const g = await groupByToken(token);
  if (!g) return { ok: false, error: "not_found" };
  if (g.status === "submitted") return { ok: false, error: "closed" };
  await createAdminClient().from("group_orders").update({ status: open ? "open" : "closed", updated_at: new Date().toISOString() }).eq("id", g.id);
  return { ok: true };
}

/**
 * The organiser sends the list to TPAC: it becomes a quotation request with the size totals,
 * every member's name / name to print, and a link back to the group.
 */
export async function submitGroupOrder(token: string): Promise<{ ok: true; request_number: string } | Fail> {
  const g = await groupByToken(token);
  if (!g) return { ok: false, error: "not_found" };
  if (g.status === "submitted") return { ok: false, error: "already" };
  const db = createAdminClient();
  const { data: members } = await db.from("group_order_members").select("name, size_code, quantity, print_name, note, artwork_id, artwork_ids, preview_front_path").eq("group_id", g.id).order("created_at");
  const list = (members ?? []) as { name: string; size_code: string; quantity: number; print_name: string | null; note: string | null; artwork_id: string | null; artwork_ids: string[] | null; preview_front_path: string | null }[];
  const tpl = (g.template ?? {}) as Partial<GroupTemplate>;
  if (!list.length) return { ok: false, error: "empty" };
  const sizes: Record<string, number> = {};
  for (const m of list) sizes[m.size_code] = (sizes[m.size_code] ?? 0) + m.quantity;
  const total = list.reduce((n, m) => n + m.quantity, 0);
  let product = "";
  if (g.product_id) {
    const { data: p } = await db.from("products").select("name_ar, slug").eq("id", g.product_id).maybeSingle();
    if (p) product = `المنتج: ${p.name_ar} — /ar/product/${p.slug}\n`;
  }
  const where = tpl.member ? PLACEMENT_LABEL[tpl.member.placement][0] : "";
  const names = list.map((m, i) => `${i + 1}. ${m.name} — ${m.size_code}${m.quantity > 1 ? ` × ${m.quantity}` : ""}${m.print_name ? ` — يُطبع على ${where}: «${m.print_name}»` : ""}${m.artwork_id || m.artwork_ids?.length ? ` — صوره بالملفات المرفقة` : ""}${m.preview_front_path ? " — صمّم قطعته (المعاينة بصفحة الطلب الجماعي)" : ""}${m.note ? ` (${m.note})` : ""}`).join("\n");
  let piece = "";
  if (g.garment) {
    const { data: col } = g.color_id ? await db.from("colors").select("name_ar").eq("id", g.color_id).maybeSingle() : { data: null };
    const fixedAt = Object.entries(tpl.fixed ?? {}).filter(([, v]) => v).map(([k]) => PLACEMENT_LABEL[k as keyof typeof PLACEMENT_LABEL][0]);
    piece = `القطعة: ${g.garment}${col ? ` — ${col.name_ar}` : ""}\n${fixedAt.length ? `تصميم المنظّم (ملفات مرفقة): ${fixedAt.join("، ")}\n` : ""}${tpl.member && tpl.member.kind !== "none" ? `كل شخص يضيف ${tpl.member.kind === "name" ? `اسمه (${tpl.member.font}، ${tpl.member.color})` : "تصميمه"} على ${where}\n` : ""}`;
  }
  const { data: req, error } = await db.from("bulk_order_requests").insert({
    organization_name: g.title,
    contact_name: g.organizer_name,
    phone: g.organizer_phone,
    product_type: g.product_type,
    estimated_quantity: total,
    quantity_min: total,
    quantity_max: total,
    size_breakdown: sizes,
    printing_requirements: names.slice(0, 20000),
    notes: `${product}${piece}طلب جماعي برابط (${list.length} شخص).${g.idea ? `\nالفكرة: ${g.idea}` : ""}`,
    group_order_id: g.id,
    user_id: g.user_id,
  }).select("id, request_number").single();
  if (error || !req) {
    console.error("submitGroupOrder", error);
    return { ok: false, error: "generic" };
  }
  await db.from("group_orders").update({ status: "submitted", bulk_request_id: req.id, updated_at: new Date().toISOString() }).eq("id", g.id);
  // the organiser's design and every member's design go with the request (files for production)
  const files = [...Object.values(tpl.fixed ?? {}), ...list.flatMap((m) => [m.artwork_id, ...(m.artwork_ids ?? [])])].filter((x): x is string => !!x);
  if (files.length) await db.from("uploaded_artwork").update({ bulk_request_id: req.id }).in("id", files).is("bulk_request_id", null);
  after(() => notifyAdmin("bulk_request.created", `طلب جماعي جديد ${req.request_number}`, `${g.title} — ${g.organizer_name} — ${total} قطعة`, `/ar/admin/bulk/${req.id}`));
  return { ok: true, request_number: req.request_number as string };
}
