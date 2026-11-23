"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { assertStaff } from "@/lib/auth";
import { quotationSchema, bulkPricingRuleSchema, fieldErrors } from "@/lib/validation";
import { bool, str, dbError, logActivity, type ActionState } from "./common";

const STATUSES = ["new", "contacted", "quoted", "approved", "rejected"];

export async function updateBulkRequest(_prev: ActionState, form: FormData): Promise<ActionState> {
  await assertStaff();
  const id = str(form.get("id"));
  const status = str(form.get("status"));
  if (!STATUSES.includes(status)) return { ok: false, error: "validation" };
  const supabase = await createClient();
  const money = (k: string) => {
    const v = str(form.get(k)).trim();
    if (!v) return null;
    const n = Math.round(Number(v));
    return Number.isFinite(n) && n >= 0 && n <= 100_000_000 ? n : NaN;
  };
  const unit = money("quoted_unit_price");
  const qty = money("quoted_quantity");
  if (Number.isNaN(unit) || Number.isNaN(qty) || qty === 0) return { ok: false, error: "validation" };
  const patch: Record<string, unknown> = { status, admin_notes: str(form.get("admin_notes")).slice(0, 4000) || null };
  if (form.has("quoted_unit_price")) Object.assign(patch, { quoted_unit_price: unit, quoted_quantity: qty });
  const { error } = await supabase.from("bulk_order_requests").update(patch).eq("id", id).neq("status", "converted");
  if (error) return dbError(error);
  await logActivity("bulk_request.updated", "bulk_request", id, { status });
  revalidatePath(`/[locale]/admin/bulk/${id}`, "page");
  return { ok: true };
}

export async function saveQuotation(_prev: ActionState, form: FormData): Promise<ActionState> {
  const session = await assertStaff();
  const descriptions = form.getAll("item_description").map(String);
  const items = descriptions
    .map((description, i) => ({ description, size: str(form.getAll("item_size")[i] ?? null) || undefined, quantity: form.getAll("item_quantity")[i], unit_price: form.getAll("item_unit_price")[i] }))
    .filter((it) => it.description.trim());
  const parsed = quotationSchema.safeParse({
    id: str(form.get("id")) || undefined,
    bulk_request_id: form.get("bulk_request_id"),
    items,
    discount: form.get("discount") || 0,
    delivery_fee: form.get("delivery_fee") || 0,
    valid_until: str(form.get("valid_until")),
    notes: str(form.get("notes")),
    status: form.get("status"),
  });
  if (!parsed.success) return { ok: false, error: "validation", fields: fieldErrors(parsed.error) };
  const d = parsed.data;
  const subtotal = d.items.reduce((n, it) => n + it.quantity * it.unit_price, 0);
  const total = Math.max(0, subtotal - d.discount) + d.delivery_fee;
  const row = { bulk_request_id: d.bulk_request_id, items: d.items, subtotal, discount: Math.min(d.discount, subtotal), delivery_fee: d.delivery_fee, total, valid_until: d.valid_until, notes: d.notes, status: d.status };
  const supabase = await createClient();
  const { data, error } = d.id
    ? await supabase.from("quotations").update(row).eq("id", d.id).neq("status", "converted").select("id").single()
    : await supabase.from("quotations").insert({ ...row, created_by: session.userId }).select("id").single();
  if (error) return dbError(error);
  if (d.status === "sent" || d.status === "approved") {
    await supabase.from("bulk_order_requests").update({ status: d.status === "approved" ? "approved" : "quoted" }).eq("id", d.bulk_request_id).in("status", ["new", "contacted", "quoted"]);
  }
  await logActivity(d.id ? "quotation.updated" : "quotation.created", "quotation", data.id, { total, status: d.status });
  revalidatePath(`/[locale]/admin/bulk/${d.bulk_request_id}`, "page");
  return { ok: true };
}

export async function convertQuotation(_prev: ActionState, form: FormData): Promise<ActionState> {
  await assertStaff();
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("convert_quotation_to_order", { p_quotation_id: str(form.get("id")) });
  if (error) return error.message?.includes("not_approved") ? { ok: false, error: "quotation_not_approved" } : dbError(error);
  revalidatePath("/[locale]/admin", "layout");
  // Redirect from the server: the converted quotation's form disappears on re-render.
  const locale = str(form.get("locale")) === "en" ? "en" : "ar";
  redirect(`/${locale}/admin/orders/${(data as { order_id: string }).order_id}`);
}

export async function savePricingRule(_prev: ActionState, form: FormData): Promise<ActionState> {
  await assertStaff();
  const parsed = bulkPricingRuleSchema.safeParse({
    id: str(form.get("id")) || undefined,
    product_type: form.get("product_type"),
    min_quantity: form.get("min_quantity"),
    max_quantity: str(form.get("max_quantity")),
    unit_price: form.get("unit_price"),
    is_active: bool(form.get("is_active")),
  });
  if (!parsed.success) return { ok: false, error: "validation", fields: fieldErrors(parsed.error) };
  const { id, ...row } = parsed.data;
  if (row.max_quantity !== null && row.max_quantity < row.min_quantity) return { ok: false, error: "validation", fields: { max_quantity: "min" } };
  const supabase = await createClient();
  const { error } = id ? await supabase.from("bulk_pricing_rules").update(row).eq("id", id) : await supabase.from("bulk_pricing_rules").insert(row);
  if (error) return dbError(error);
  await logActivity("bulk_pricing.saved", "bulk_pricing_rule", id ?? null, row);
  revalidatePath("/[locale]/bulk", "page");
  return { ok: true };
}

export async function deletePricingRule(_prev: ActionState, form: FormData): Promise<ActionState> {
  await assertStaff();
  const supabase = await createClient();
  const { error } = await supabase.from("bulk_pricing_rules").delete().eq("id", str(form.get("id")));
  return error ? dbError(error) : { ok: true };
}

/**
 * Approved request with a quoted price → a real order: an approved quotation (one line: product × quantity at the
 * quoted price per piece) is created and converted by the same database function as itemised quotations.
 */
export async function convertRequestToOrder(_prev: ActionState, form: FormData): Promise<ActionState> {
  const session = await assertStaff();
  const id = str(form.get("id"));
  const supabase = await createClient();
  const { data: r } = await supabase.from("bulk_order_requests").select("id, status, product_type, organization_name, preferred_color, quoted_unit_price, quoted_quantity, quantity_max, estimated_quantity").eq("id", id).maybeSingle();
  if (!r) return { ok: false, error: "not_found" };
  if (r.status !== "approved") return { ok: false, error: "quotation_not_approved" };
  const qty = (r.quoted_quantity ?? r.quantity_max ?? r.estimated_quantity) as number;
  if (r.quoted_unit_price == null || !qty) return { ok: false, error: "سجّل سعر القطعة والكمية أولاً" };
  const names: Record<string, string> = { hoodie: "هودي", tshirt: "تيشيرت", sweatshirt: "سويتر", oversized: "تيشيرت أوفرسايز", longsleeve: "تيشيرت أكمام طويلة", polo: "بولو", other: "منتج" };
  const description = `${names[r.product_type] ?? r.product_type} — ${r.organization_name}${r.preferred_color ? ` — ${r.preferred_color}` : ""}`.slice(0, 300);
  const total = r.quoted_unit_price * qty;
  const { data: q, error } = await supabase.from("quotations").insert({
    bulk_request_id: id, items: [{ description, quantity: qty, unit_price: r.quoted_unit_price }],
    subtotal: total, discount: 0, delivery_fee: 0, total, status: "approved", created_by: session.userId,
  }).select("id").single();
  if (error || !q) return dbError(error);
  const { data, error: cErr } = await supabase.rpc("convert_quotation_to_order", { p_quotation_id: q.id });
  if (cErr) return dbError(cErr);
  await logActivity("bulk_request.converted", "bulk_request", id, { order_id: (data as { order_id: string }).order_id, total });
  revalidatePath("/[locale]/admin", "layout");
  const locale = str(form.get("locale")) === "en" ? "en" : "ar";
  redirect(`/${locale}/admin/orders/${(data as { order_id: string }).order_id}`);
}
