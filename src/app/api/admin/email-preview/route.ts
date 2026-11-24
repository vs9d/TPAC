import { NextResponse, type NextRequest } from "next/server";
import { getSession, isStaffRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { publicEnv } from "@/lib/env";
import { whatsappNumber } from "@/lib/whatsapp";
import { adminNewOrderEmail, customerOrderEmail, type EmailItem } from "@/lib/notifications/email-templates";
import type { Order } from "@/lib/types";

const STATUSES = ["received", "confirmed", "preparing", "printing", "ready_to_ship", "shipped", "delivered", "cancelled"];

/** Staff only: how the order emails look, filled with the latest order (or a sample). */
export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session || !isStaffRole(session.profile?.role)) return NextResponse.json({ error: "not_authorized" }, { status: 403 });
  const p = req.nextUrl.searchParams;
  const status = STATUSES.includes(p.get("status") ?? "") ? p.get("status")! : "confirmed";
  const locale = p.get("locale") === "en" ? "en" : "ar";
  const supabase = await createClient();
  const [{ data: last }, { data: settings }] = await Promise.all([
    supabase.from("orders").select("*").order("created_at", { ascending: false }).limit(1).maybeSingle(),
    supabase.from("website_settings").select("key, value").in("key", ["contact", "social"]),
  ]);
  const sample: Order = {
    id: "00000000-0000-0000-0000-000000000000", order_number: "TP100123", user_id: null, customer_name: "سارة محمد", phone: "9647712345678", email: null,
    governorate: "baghdad", city: "الكرادة", address_line: "شارع ٦٢", delivery_notes: null, delivery_method: "standard", payment_method: "cod", payment_status: "unpaid",
    status: "received", subtotal: 65000, discount_total: 5000, delivery_fee: 5000, total: 65000, discount_code: "TPAC10", locale, source: "web", has_custom_items: false,
    created_at: new Date().toISOString(), updated_at: new Date().toISOString(),
  };
  const order = { ...((last as Order | null) ?? sample), status, locale } as Order;
  let items: EmailItem[] = [];
  if (last) items = ((await supabase.from("order_items").select("name_ar, name_en, size_code, color_name_ar, color_name_en, quantity, unit_price, line_total, image_url").eq("order_id", (last as Order).id)).data as EmailItem[] | null) ?? [];
  if (!items.length) items = [{ name_ar: "هودي TPAC", name_en: "TPAC hoodie", size_code: "L", color_name_ar: "أسود", color_name_en: "Black", quantity: 1, unit_price: 40000, line_total: 40000, image_url: "/mockups/hoodie-black-front.webp" }, { name_ar: "تيشيرت TPAC", name_en: "TPAC tee", size_code: "M", color_name_ar: "أبيض", color_name_en: "White", quantity: 1, unit_price: 25000, line_total: 25000, image_url: null }];
  const get = (k: string) => (settings ?? []).find((r) => r.key === k)?.value as Record<string, string> | undefined;
  const ctx = { siteUrl: publicEnv.siteUrl, whatsapp: whatsappNumber(get("contact")?.whatsapp), instagram: get("social")?.instagram || null };
  const mail = p.get("kind") === "admin" ? adminNewOrderEmail(order, items, ctx) : customerOrderEmail(order, items, ctx);
  return new NextResponse(mail.html, { headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" } });
}
