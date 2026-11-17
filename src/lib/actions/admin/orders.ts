"use server";
import { after } from "next/server";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { assertStaff } from "@/lib/auth";
import { orderStatusUpdateSchema, fieldErrors } from "@/lib/validation";
import { notifyOrder } from "@/lib/notifications";
import { str, dbError, type ActionState } from "./common";

export async function updateOrderStatus(_prev: ActionState, form: FormData): Promise<ActionState> {
  await assertStaff();
  const parsed = orderStatusUpdateSchema.safeParse({ order_id: form.get("order_id"), status: form.get("status"), note: str(form.get("note")) || undefined });
  if (!parsed.success) return { ok: false, error: "validation", fields: fieldErrors(parsed.error) };
  const supabase = await createClient();
  // update_order_status() enforces staff role, valid transitions and stock restoration atomically.
  const { error } = await supabase.rpc("update_order_status", { p_order_id: parsed.data.order_id, p_status: parsed.data.status, p_note: parsed.data.note ?? null });
  if (error) return error.message?.startsWith("invalid_transition") ? { ok: false, error: "invalid_transition" } : dbError(error);
  after(() => notifyOrder(parsed.data.order_id, "status_changed"));
  revalidatePath(`/[locale]/admin/orders/${parsed.data.order_id}`, "page");
  return { ok: true };
}

export async function addOrderNote(_prev: ActionState, form: FormData): Promise<ActionState> {
  const session = await assertStaff();
  const body = str(form.get("body")).trim();
  const orderId = str(form.get("order_id"));
  if (!body || body.length > 4000) return { ok: false, error: "validation", fields: { body: "required" } };
  const supabase = await createClient();
  const { error } = await supabase.from("order_notes").insert({ order_id: orderId, body, author_id: session.userId });
  if (error) return dbError(error);
  return { ok: true };
}

export async function updateOrderDetails(_prev: ActionState, form: FormData): Promise<ActionState> {
  await assertStaff();
  const orderId = str(form.get("order_id"));
  const payment = str(form.get("payment_status"));
  if (!["unpaid", "pending", "paid", "refunded", "failed"].includes(payment)) return { ok: false, error: "validation" };
  const supabase = await createClient();
  const { error } = await supabase
    .from("orders")
    .update({
      payment_status: payment,
      city: str(form.get("city")).trim().slice(0, 120) || undefined,
      address_line: str(form.get("address_line")).trim().slice(0, 500) || undefined,
      delivery_notes: str(form.get("delivery_notes")).trim().slice(0, 500) || null,
    })
    .eq("id", orderId);
  if (error) return dbError(error);
  await supabase.rpc("log_admin_activity", { p_action: "order.updated", p_entity_type: "order", p_entity_id: orderId, p_details: { payment_status: payment } });
  return { ok: true };
}
