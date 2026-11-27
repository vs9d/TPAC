"use server";
import { randomBytes } from "node:crypto";
import { after } from "next/server";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { getSession } from "@/lib/auth";
import { rateLimit } from "@/lib/rate-limit";
import { phoneSchema, fieldErrors, BULK_PRODUCT_TYPES, BULK_SIZES } from "@/lib/validation";
import { notifyAdmin } from "@/lib/notifications";

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
});

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
  const token = randomBytes(18).toString("base64url");
  for (let i = 0; i < 4; i++) {
    const code = randomBytes(6).toString("base64url").toLowerCase().replace(/[^a-z0-9]/g, "").padEnd(8, "x").slice(0, 8);
    const { error } = await db.from("group_orders").insert({
      code, admin_token: token, title: d.title, organizer_name: d.organizer_name, organizer_phone: d.organizer_phone,
      product_id: productId, product_type: d.product_type, idea: d.idea || null, allow_names: d.allow_names,
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
});

/** A member adds their name and size through the group link. */
export async function joinGroupOrder(code: string, input: unknown): Promise<{ ok: true; id: string } | Fail> {
  if (typeof code !== "string" || !codeRe.test(code)) return { ok: false, error: "not_found" };
  const parsed = joinSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "validation", fields: fieldErrors(parsed.error) };
  if (!(await rateLimit("groupJoin"))) return { ok: false, error: "rate_limited" };
  const db = createAdminClient();
  const { data: g } = await db.from("group_orders").select("id, status, deadline, allow_names").eq("code", code).maybeSingle();
  if (!g) return { ok: false, error: "not_found" };
  if (g.status !== "open" || (g.deadline && new Date(`${g.deadline}T23:59:59`) < new Date())) return { ok: false, error: "closed" };
  const { count } = await db.from("group_order_members").select("id", { count: "exact", head: true }).eq("group_id", g.id);
  if ((count ?? 0) >= MAX_MEMBERS) return { ok: false, error: "full" };
  const d = parsed.data;
  const { data, error } = await db.from("group_order_members").insert({
    group_id: g.id, name: d.name, size_code: d.size_code, quantity: d.quantity,
    print_name: g.allow_names ? d.print_name || null : null, note: d.note || null,
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
  const { data: members } = await db.from("group_order_members").select("name, size_code, quantity, print_name, note").eq("group_id", g.id).order("created_at");
  const list = (members ?? []) as { name: string; size_code: string; quantity: number; print_name: string | null; note: string | null }[];
  if (!list.length) return { ok: false, error: "empty" };
  const sizes: Record<string, number> = {};
  for (const m of list) sizes[m.size_code] = (sizes[m.size_code] ?? 0) + m.quantity;
  const total = list.reduce((n, m) => n + m.quantity, 0);
  let product = "";
  if (g.product_id) {
    const { data: p } = await db.from("products").select("name_ar, slug").eq("id", g.product_id).maybeSingle();
    if (p) product = `المنتج: ${p.name_ar} — /ar/product/${p.slug}\n`;
  }
  const names = list.map((m, i) => `${i + 1}. ${m.name} — ${m.size_code}${m.quantity > 1 ? ` × ${m.quantity}` : ""}${m.print_name ? ` — يُطبع: «${m.print_name}»` : ""}${m.note ? ` (${m.note})` : ""}`).join("\n");
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
    notes: `${product}طلب جماعي برابط (${list.length} شخص).${g.idea ? `\nالفكرة: ${g.idea}` : ""}`,
    group_order_id: g.id,
    user_id: g.user_id,
  }).select("id, request_number").single();
  if (error || !req) {
    console.error("submitGroupOrder", error);
    return { ok: false, error: "generic" };
  }
  await db.from("group_orders").update({ status: "submitted", bulk_request_id: req.id, updated_at: new Date().toISOString() }).eq("id", g.id);
  after(() => notifyAdmin("bulk_request.created", `طلب جماعي جديد ${req.request_number}`, `${g.title} — ${g.organizer_name} — ${total} قطعة`, `/ar/admin/bulk/${req.id}`));
  return { ok: true, request_number: req.request_number as string };
}
