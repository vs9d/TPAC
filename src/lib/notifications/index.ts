import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { formatIQD } from "@/lib/format";
import { publicEnv } from "@/lib/env";
import { sendEmail, emailConfigured } from "./email";
import { sendWhatsAppTemplate, whatsappConfigured } from "./whatsapp";
import type { Order, SiteSettings } from "@/lib/types";

type Channel = "email" | "whatsapp";
type Audience = "customer" | "admin";

interface Message {
  audience: Audience;
  channel: Channel;
  event: string;
  recipient: string;
  title: string;
  body: string;
  link?: string;
  orderId?: string;
  userId?: string | null;
  /** template parameters for WhatsApp */
  params?: string[];
}

const STATUS_TEXT: Record<string, { ar: string; en: string }> = {
  received: { ar: "تم استلام طلبك", en: "We received your order" },
  confirmed: { ar: "تم تأكيد طلبك", en: "Your order is confirmed" },
  preparing: { ar: "طلبك قيد التجهيز", en: "Your order is being prepared" },
  printing: { ar: "طلبك قيد الطباعة", en: "Your order is being printed" },
  quality_check: { ar: "طلبك في مرحلة فحص الجودة", en: "Your order is in quality inspection" },
  ready_to_ship: { ar: "طلبك جاهز للشحن", en: "Your order is ready to ship" },
  shipped: { ar: "تم شحن طلبك", en: "Your order has shipped" },
  delivered: { ar: "تم تسليم طلبك", en: "Your order was delivered" },
  cancelled: { ar: "تم إلغاء طلبك", en: "Your order was cancelled" },
};

/**
 * Records a notification and attempts delivery. If the provider is not
 * configured the row is stored with status "skipped" — we never pretend a
 * message was delivered.
 */
async function dispatch(msg: Message): Promise<void> {
  const db = createAdminClient();
  const configured = msg.channel === "email" ? emailConfigured() : whatsappConfigured();
  const { data: row } = await db
    .from("notifications")
    .insert({
      audience: msg.audience,
      channel: msg.channel,
      event: msg.event,
      recipient: msg.recipient,
      title: msg.title,
      body: msg.body,
      link: msg.link ?? null,
      order_id: msg.orderId ?? null,
      user_id: msg.userId ?? null,
      status: configured ? "pending" : "skipped",
      error: configured ? null : "provider_not_configured",
    })
    .select("id")
    .single();
  if (!configured || !row) return;

  try {
    if (msg.channel === "email") {
      await sendEmail({ to: msg.recipient, subject: msg.title, text: `${msg.body}${msg.link ? `\n\n${msg.link}` : ""}` });
    } else {
      await sendWhatsAppTemplate({ to: msg.recipient, params: msg.params ?? [msg.title, msg.body] });
    }
    await db.from("notifications").update({ status: "sent", sent_at: new Date().toISOString() }).eq("id", row.id);
  } catch (e) {
    await db
      .from("notifications")
      .update({ status: "failed", error: e instanceof Error ? e.message.slice(0, 500) : "unknown" })
      .eq("id", row.id);
  }
}

async function getNotificationSettings(): Promise<SiteSettings["notifications"]> {
  const { data } = await createAdminClient().from("website_settings").select("value").eq("key", "notifications").maybeSingle();
  return {
    admin_email: "",
    admin_whatsapp: "",
    customer_email: true,
    customer_whatsapp: true,
    admin_new_order: true,
    admin_low_stock: true,
    admin_bulk_request: true,
    ...((data?.value as Partial<SiteSettings["notifications"]>) ?? {}),
  };
}

function adminRecipients(s: SiteSettings["notifications"]) {
  return {
    email: s.admin_email || process.env.ADMIN_NOTIFICATION_EMAIL || "",
    whatsapp: s.admin_whatsapp || process.env.ADMIN_NOTIFICATION_WHATSAPP || "",
  };
}

/** Customer + admin notifications for an order event. Never throws. */
export async function notifyOrder(orderId: string, event: "created" | "status_changed"): Promise<void> {
  try {
    const db = createAdminClient();
    const { data } = await db.from("orders").select("*").eq("id", orderId).single();
    if (!data) return;
    const order = data as Order;
    const settings = await getNotificationSettings();
    const l = order.locale;
    const status = STATUS_TEXT[order.status] ?? STATUS_TEXT.received;
    const trackUrl = `${publicEnv.siteUrl}/${l}/track?order=${order.order_number}`;
    const title = `${status[l]} — ${order.order_number}`;
    const body =
      l === "ar"
        ? `مرحباً ${order.customer_name}، ${status.ar}. المبلغ: ${formatIQD(order.total, "ar")}. تتبّع طلبك: ${trackUrl}`
        : `Hi ${order.customer_name}, ${status.en.toLowerCase()}. Total: ${formatIQD(order.total, "en")}. Track: ${trackUrl}`;
    const tasks: Promise<void>[] = [];

    // Customers are notified on: received, confirmed, shipped, delivered, cancelled (+ any status via in-app).
    const customerEvents = ["received", "confirmed", "shipped", "delivered", "cancelled"];
    if (customerEvents.includes(order.status)) {
      const ev = event === "created" ? "order.created" : `order.${order.status}`;
      if (settings.customer_email && order.email) {
        tasks.push(dispatch({ audience: "customer", channel: "email", event: ev, recipient: order.email, title, body, link: trackUrl, orderId, userId: order.user_id }));
      }
      if (settings.customer_whatsapp) {
        tasks.push(dispatch({ audience: "customer", channel: "whatsapp", event: ev, recipient: order.phone, title, body, orderId, userId: order.user_id, params: [order.customer_name, order.order_number, status[l]] }));
      }
    }

    if (event === "created" && settings.admin_new_order) {
      const admin = adminRecipients(settings);
      const adminTitle = `طلب جديد ${order.order_number}${order.has_custom_items ? " (تصميم خاص)" : ""}`;
      const adminBody = `${order.customer_name} — ${order.phone} — ${formatIQD(order.total, "ar")} — ${order.governorate}`;
      const link = `${publicEnv.siteUrl}/ar/admin/orders/${order.id}`;
      if (admin.email) tasks.push(dispatch({ audience: "admin", channel: "email", event: "order.created", recipient: admin.email, title: adminTitle, body: adminBody, link, orderId }));
      if (admin.whatsapp) tasks.push(dispatch({ audience: "admin", channel: "whatsapp", event: "order.created", recipient: admin.whatsapp, title: adminTitle, body: adminBody, orderId, params: ["TPAC", order.order_number, adminBody] }));
    }
    await Promise.all(tasks);

    if (event === "created" && settings.admin_low_stock) await notifyLowStockForOrder(orderId, settings);
  } catch (e) {
    console.error("notifyOrder failed", e);
  }
}

async function notifyLowStockForOrder(orderId: string, settings: SiteSettings["notifications"]) {
  const db = createAdminClient();
  const { data: items } = await db.from("order_items").select("variant_id").eq("order_id", orderId).not("variant_id", "is", null);
  const ids = (items ?? []).map((i) => i.variant_id as string);
  if (!ids.length) return;
  const { data: low } = await db
    .from("inventory")
    .select("quantity, low_stock_threshold, product_variants(sku)")
    .in("variant_id", ids);
  const lowRows = (low ?? []).filter((r) => r.quantity <= r.low_stock_threshold);
  if (!lowRows.length) return;
  const admin = adminRecipients(settings);
  const body = lowRows
    .map((r) => `${(r.product_variants as unknown as { sku: string } | null)?.sku ?? "?"}: ${r.quantity}`)
    .join("\n");
  if (admin.email)
    await dispatch({ audience: "admin", channel: "email", event: "inventory.low_stock", recipient: admin.email, title: "تنبيه مخزون منخفض", body, link: `${publicEnv.siteUrl}/ar/admin/inventory?low=1` });
}

/** Admin notification for bulk requests / inquiries (in-app rows are created by DB triggers). */
export async function notifyAdmin(event: "bulk_request.created" | "inquiry.created", title: string, body: string, link: string): Promise<void> {
  try {
    const settings = await getNotificationSettings();
    if (event === "bulk_request.created" && !settings.admin_bulk_request) return;
    const admin = adminRecipients(settings);
    const tasks: Promise<void>[] = [];
    if (admin.email) tasks.push(dispatch({ audience: "admin", channel: "email", event, recipient: admin.email, title, body, link: `${publicEnv.siteUrl}${link}` }));
    if (admin.whatsapp) tasks.push(dispatch({ audience: "admin", channel: "whatsapp", event, recipient: admin.whatsapp, title, body, params: ["TPAC", title, body] }));
    await Promise.all(tasks);
  } catch (e) {
    console.error("notifyAdmin failed", e);
  }
}

export function integrationStatus() {
  return {
    email: emailConfigured(),
    whatsapp: whatsappConfigured(),
  };
}
