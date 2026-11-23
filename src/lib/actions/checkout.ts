"use server";
import { after } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { getSession } from "@/lib/auth";
import { checkoutSchema, fieldErrors } from "@/lib/validation";
import { rateLimit } from "@/lib/rate-limit";
import { onlinePaymentAvailable } from "@/lib/payments";
import { notifyOrder } from "@/lib/notifications";
import { isSupabaseConfigured } from "@/lib/env";

export type CheckoutResult =
  | { ok: true; order_number: string; order_id: string }
  | { ok: false; error: string; fields?: Record<string, string>; details?: unknown };

export async function placeOrder(input: unknown): Promise<CheckoutResult> {
  if (!isSupabaseConfigured()) return { ok: false, error: "generic" };
  const parsed = checkoutSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "validation", fields: fieldErrors(parsed.error) };
  const data = parsed.data;
  if (!(await rateLimit("checkout")) || !(await rateLimit("checkout", data.phone))) return { ok: false, error: "rate_limited" };
  if (data.payment_method === "online" && !onlinePaymentAvailable()) return { ok: false, error: "payment_unavailable" };

  const session = await getSession();
  const payload = {
    items: data.items,
    discount_code: data.discount_code || null,
    governorate: data.governorate,
    delivery_method: data.delivery_method,
    user_id: session?.userId ?? null,
    customer_name: data.customer_name,
    phone: data.phone,
    email: data.email ?? session?.email ?? null,
    city: data.city,
    address_line: data.address_line,
    delivery_notes: data.delivery_notes ?? null,
    payment_method: data.payment_method,
    locale: data.locale,
  };

  const { data: result, error } = await createAdminClient().rpc("place_order", { payload });
  if (error) {
    const msg = error.message ?? "";
    const code = msg.startsWith("cart_invalid")
      ? "cart_invalid"
      : msg.startsWith("discount_invalid")
      ? "discount_invalid"
      : msg.startsWith("invalid_phone")
      ? "invalid_phone"
      : msg.startsWith("empty_cart")
      ? "empty_cart"
      : "generic";
    if (code === "generic") console.error("place_order failed", error);
    return { ok: false, error: code, details: code === "cart_invalid" ? msg.replace(/^cart_invalid:\s*/, "") : undefined };
  }
  const order = result as { order_id: string; order_number: string };
  // consent is recorded on the order before any notification is queued
  if (data.whatsapp_opt_in) await createAdminClient().from("orders").update({ whatsapp_opt_in: true }).eq("id", order.order_id);

  if (session && data.save_address) {
    const supabase = await createClient();
    const { count } = await supabase.from("addresses").select("id", { count: "exact", head: true }).eq("user_id", session.userId);
    await supabase.from("addresses").insert({
      user_id: session.userId,
      full_name: data.customer_name,
      phone: data.phone,
      governorate: data.governorate,
      city: data.city,
      address_line: data.address_line,
      notes: data.delivery_notes ?? null,
      is_default: (count ?? 0) === 0,
    });
  }
  if (session) {
    // the account cart has been converted into an order
    const supabase = await createClient();
    const { data: cart } = await supabase.from("carts").select("id").eq("user_id", session.userId).maybeSingle();
    if (cart) await supabase.from("cart_items").delete().eq("cart_id", cart.id);
  }

  after(() => notifyOrder(order.order_id, "created"));
  return { ok: true, order_number: order.order_number, order_id: order.order_id };
}
