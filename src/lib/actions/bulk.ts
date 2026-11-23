"use server";
import { after } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getSession } from "@/lib/auth";
import { rateLimit } from "@/lib/rate-limit";
import { bulkRequestSchema, fieldErrors } from "@/lib/validation";
import { notifyAdmin } from "@/lib/notifications";

export type BulkResult = { ok: true; request_number: string } | { ok: false; error: string; fields?: Record<string, string> };

export async function submitBulkRequest(input: unknown): Promise<BulkResult> {
  const parsed = bulkRequestSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "validation", fields: fieldErrors(parsed.error) };
  if (!(await rateLimit("bulk"))) return { ok: false, error: "rate_limited" };
  const d = parsed.data;
  const session = await getSession();
  const db = createAdminClient();
  const sizes = Object.fromEntries(Object.entries(d.size_breakdown).filter(([, v]) => (v ?? 0) > 0));
  const { data, error } = await db
    .from("bulk_order_requests")
    .insert({
      user_id: session?.userId ?? null,
      organization_name: d.organization_name,
      contact_name: d.contact_name,
      phone: d.phone,
      email: d.email ?? null,
      product_type: d.product_type,
      estimated_quantity: d.quantity_max,
      quantity_min: d.quantity_min,
      quantity_max: d.quantity_max,
      preferred_color: d.preferred_color,
      size_breakdown: sizes,
      printing_requirements: d.printing_requirements ?? null,
      notes: d.notes ?? null,
    })
    .select("id, request_number")
    .single();
  if (error || !data) {
    console.error("bulk request", error);
    return { ok: false, error: "generic" };
  }
  if (d.artwork_ids.length) {
    // only attach freshly uploaded, unattached bulk artwork
    await db.from("uploaded_artwork").update({ bulk_request_id: data.id }).in("id", d.artwork_ids).is("bulk_request_id", null).is("custom_design_id", null).like("storage_path", "uploads/bulk/%");
  }
  after(() => notifyAdmin("bulk_request.created", `طلب جملة جديد ${data.request_number}`, `${d.organization_name} — ${d.contact_name} — ${d.quantity_min}–${d.quantity_max}`, `/ar/admin/bulk/${data.id}`));
  return { ok: true, request_number: data.request_number };
}
