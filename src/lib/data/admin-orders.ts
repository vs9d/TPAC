import "server-only";
import { createClient } from "@/lib/supabase/server";
import { normalizeIraqiPhone } from "@/lib/phone";
import { isOrderStatus } from "@/lib/order-status";

export interface OrderFilters { q?: string; status?: string; from?: string; to?: string; page?: number; pageSize?: number }

/** Shared by the orders table and the CSV export (RLS: staff only). */
export async function queryOrders(f: OrderFilters, columns = "id, order_number, customer_name, phone, governorate, total, status, payment_status, has_custom_items, created_at") {
  const supabase = await createClient();
  let q = supabase.from("orders").select(columns, { count: "exact" }).order("created_at", { ascending: false });
  if (f.status && isOrderStatus(f.status)) q = q.eq("status", f.status);
  if (f.from && /^\d{4}-\d{2}-\d{2}$/.test(f.from)) q = q.gte("created_at", `${f.from}T00:00:00+03:00`);
  if (f.to && /^\d{4}-\d{2}-\d{2}$/.test(f.to)) q = q.lte("created_at", `${f.to}T23:59:59+03:00`);
  const term = f.q?.trim();
  if (term) {
    const phone = normalizeIraqiPhone(term);
    if (/^tp\d+$/i.test(term)) q = q.eq("order_number", term.toUpperCase());
    else if (phone) q = q.eq("phone", phone);
    else q = q.ilike("customer_name", `%${term.replace(/[%_,()]/g, "")}%`);
  }
  if (f.pageSize) {
    const page = Math.max(1, f.page ?? 1);
    q = q.range((page - 1) * f.pageSize, page * f.pageSize - 1);
  } else q = q.limit(10000);
  return q;
}
