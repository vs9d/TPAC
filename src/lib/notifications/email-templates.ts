/**
 * Branded order emails (customer status updates + the admin's new-order alert).
 * Table layout with inline styles so they render the same in Gmail, Outlook and Apple Mail,
 * right-to-left for Arabic, with a plain-text version for clients that don't show HTML.
 */
import { formatIQD } from "@/lib/format";
import { governorateName } from "@/lib/iraq";
import { formatIraqiPhone } from "@/lib/phone";
import type { Order } from "@/lib/types";

export interface EmailItem { name_ar: string; name_en: string; size_code: string | null; color_name_ar: string | null; color_name_en: string | null; quantity: number; unit_price: number; line_total: number; image_url: string | null }
export interface EmailContext { siteUrl: string; whatsapp?: string | null; instagram?: string | null }
type L = "ar" | "en";

const C = { ink: "#111111", pine: "#376352", amber: "#E3963C", paper: "#F7F5F0", line: "#E6E1D6", mute: "#6B6B66" };
export const esc = (s: unknown) => String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");

const STATUS: Record<string, { ar: string; en: string; lead_ar: string; lead_en: string }> = {
  received: { ar: "وصلنا طلبك", en: "We received your order", lead_ar: "شكراً لطلبك من TPAC! راح نراجعه ونأكده وياك قريباً.", lead_en: "Thank you for ordering from TPAC! We'll review and confirm it shortly." },
  confirmed: { ar: "تم تأكيد طلبك", en: "Your order is confirmed", lead_ar: "طلبك تأكد بنجاح وراح نبدي نجهزه.", lead_en: "Your order is confirmed and we're getting it ready." },
  preparing: { ar: "طلبك قيد التجهيز", en: "Your order is being prepared", lead_ar: "فريقنا يجهز طلبك هسه.", lead_en: "Our team is preparing your order now." },
  printing: { ar: "طلبك قيد الطباعة", en: "Your order is being printed", lead_ar: "قطعتك بالطباعة حالياً — راح نبلغك بكل جديد.", lead_en: "Your piece is being printed — we'll keep you posted." },
  quality_check: { ar: "طلبك بفحص الجودة", en: "Quality check", lead_ar: "نفحص كل قطعة قبل لا تطلع إلك.", lead_en: "We check every piece before it leaves." },
  ready_to_ship: { ar: "طلبك جاهز", en: "Your order is ready", lead_ar: "طلبك صار جاهز وراح يطلع للتوصيل قريباً.", lead_en: "Your order is ready and will be on its way soon." },
  shipped: { ar: "طلبك بالطريق إلك 🚚", en: "Your order is on its way 🚚", lead_ar: "طلبك طلع للتوصيل. خلي تلفونك قريب حتى يتواصل وياك المندوب.", lead_en: "Your order is out for delivery. Keep your phone close for the courier." },
  delivered: { ar: "تم تسليم طلبك ❤️", en: "Delivered ❤️", lead_ar: "نتمنى تكون تجربتك ويانه حلوة. شكراً لأنك جزء من عائلة TPAC.", lead_en: "We hope you love it. Thank you for being part of the TPAC family." },
  cancelled: { ar: "تم إلغاء طلبك", en: "Your order was cancelled", lead_ar: "تم إلغاء طلبك. إذا عندك أي سؤال راسلنا على الواتساب.", lead_en: "Your order was cancelled. Message us on WhatsApp if you have any questions." },
};
const STEPS = ["received", "confirmed", "printing", "shipped", "delivered"] as const;
const STEP_LABEL: Record<(typeof STEPS)[number], [string, string]> = { received: ["استلام", "Received"], confirmed: ["تأكيد", "Confirmed"], printing: ["تجهيز", "Preparing"], shipped: ["شحن", "Shipped"], delivered: ["تسليم", "Delivered"] };
const stepIndex = (s: string) => ({ received: 0, confirmed: 1, preparing: 2, printing: 2, quality_check: 2, ready_to_ship: 2, shipped: 3, delivered: 4 } as Record<string, number>)[s] ?? 0;

export const statusText = (status: string, l: L) => (STATUS[status] ?? STATUS.received!)[l];

function shell(l: L, ctx: EmailContext, preheader: string, body: string) {
  const dir = l === "ar" ? "rtl" : "ltr";
  const align = l === "ar" ? "right" : "left";
  const wa = ctx.whatsapp ? `https://wa.me/${esc(ctx.whatsapp)}` : null;
  return `<!doctype html><html lang="${l}" dir="${dir}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="light"><title>TPAC</title></head>
<body style="margin:0;padding:0;background:${C.paper};">
<div style="display:none;max-height:0;overflow:hidden;opacity:0">${esc(preheader)}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${C.paper};"><tr><td align="center" style="padding:24px 12px;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;background:#ffffff;border-radius:18px;overflow:hidden;border:1px solid ${C.line};font-family:Tahoma,'Segoe UI',Arial,sans-serif;color:${C.ink};direction:${dir};text-align:${align};">
<tr><td style="background:${C.ink};padding:22px 28px;" align="${align}"><a href="${esc(ctx.siteUrl)}/${l}" style="text-decoration:none"><img src="${esc(ctx.siteUrl)}/brand/tpac-logo-white.png" alt="TPAC" height="34" style="height:34px;border:0;display:inline-block"></a></td></tr>
${body}
<tr><td style="padding:22px 28px;border-top:1px solid ${C.line};font-size:13px;line-height:1.7;color:${C.mute};" align="center">
${wa ? `<a href="${wa}" style="display:inline-block;background:#25D366;color:#ffffff;text-decoration:none;font-weight:bold;padding:10px 20px;border-radius:999px;margin-bottom:10px">${l === "ar" ? "راسلنا على الواتساب" : "Message us on WhatsApp"}</a><br>` : ""}
${ctx.instagram ? `<a href="${esc(ctx.instagram)}" style="color:${C.mute}">Instagram</a> · ` : ""}<a href="${esc(ctx.siteUrl)}/${l}" style="color:${C.mute}">thetpac.com</a><br>
<span style="font-size:12px">TPAC — ${l === "ar" ? "الحلو يلبس حلو" : "الحلو يلبس حلو"}</span>
</td></tr></table></td></tr></table></body></html>`;
}

function itemsTable(items: EmailItem[], order: Order, l: L, siteUrl = "") {
  const align = l === "ar" ? "right" : "left";
  const end = l === "ar" ? "left" : "right";
  const rows = items.map((it) => {
    const name = l === "ar" ? it.name_ar : it.name_en;
    const opts = [it.size_code, l === "ar" ? it.color_name_ar : it.color_name_en].filter(Boolean).join(" · ");
    return `<tr>
<td width="64" style="padding:10px 0;vertical-align:top">${it.image_url && /^(https?:\/\/|\/[^/])/.test(it.image_url) ? `<img src="${esc(it.image_url.startsWith("/") ? siteUrl + it.image_url : it.image_url)}" width="56" height="56" alt="" style="width:56px;height:56px;object-fit:cover;border-radius:10px;background:${C.paper};display:block">` : `<div style="width:56px;height:56px;border-radius:10px;background:${C.paper}"></div>`}</td>
<td style="padding:10px 10px;vertical-align:top;font-size:14px;line-height:1.5" align="${align}"><b>${esc(name)}</b><br><span style="color:${C.mute};font-size:13px">${esc(opts)}${opts ? " · " : ""}×${it.quantity}</span></td>
<td style="padding:10px 0;vertical-align:top;font-size:14px;white-space:nowrap" align="${end}">${formatIQD(it.line_total, l)}</td></tr>`;
  }).join("");
  const line = (k: string, v: string, bold = false) => `<tr><td colspan="2" style="padding:4px 0;font-size:14px;color:${bold ? C.ink : C.mute};${bold ? "font-weight:bold;font-size:16px;" : ""}" align="${align}">${k}</td><td style="padding:4px 0;font-size:14px;white-space:nowrap;${bold ? "font-weight:bold;font-size:16px;" : ""}" align="${end}">${v}</td></tr>`;
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-top:1px solid ${C.line};border-bottom:1px solid ${C.line};margin:6px 0 4px">${rows}</table>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-top:8px">
${line(l === "ar" ? "المجموع" : "Subtotal", formatIQD(order.subtotal, l))}
${order.discount_total > 0 ? line(`${l === "ar" ? "الخصم" : "Discount"}${order.discount_code ? ` (${esc(order.discount_code)})` : ""}`, `−${formatIQD(order.discount_total, l)}`) : ""}
${line(l === "ar" ? "التوصيل" : "Delivery", order.delivery_fee ? formatIQD(order.delivery_fee, l) : l === "ar" ? "مجاني" : "Free")}
${line(l === "ar" ? "الإجمالي" : "Total", formatIQD(order.total, l), true)}
</table>`;
}

function progress(status: string, l: L) {
  if (status === "cancelled") return "";
  const at = stepIndex(status);
  const cells = STEPS.map((s, i) => {
    const done = i <= at;
    return `<td align="center" style="padding:0 2px;font-size:11px;color:${done ? C.pine : C.mute};${i === at ? "font-weight:bold;" : ""}">
<div style="height:6px;border-radius:6px;background:${done ? C.pine : C.line};margin-bottom:6px"></div>${STEP_LABEL[s][l === "ar" ? 0 : 1]}</td>`;
  }).join("");
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:18px 0 6px;direction:${l === "ar" ? "rtl" : "ltr"}"><tr>${cells}</tr></table>`;
}

/** The customer's email for an order event (new order or a status change). */
export function customerOrderEmail(order: Order, items: EmailItem[], ctx: EmailContext) {
  const l: L = order.locale === "en" ? "en" : "ar";
  const s = STATUS[order.status] ?? STATUS.received!;
  const title = l === "ar" ? s.ar : s.en;
  const lead = l === "ar" ? s.lead_ar : s.lead_en;
  const track = `${ctx.siteUrl}/${l}/track?order=${encodeURIComponent(order.order_number)}`;
  const hello = l === "ar" ? `مرحباً ${esc(order.customer_name)} 👋` : `Hi ${esc(order.customer_name)} 👋`;
  const address = [governorateName(order.governorate, l), order.city, order.address_line].filter(Boolean).map(esc).join("، ");
  const body = `<tr><td style="padding:28px 28px 8px">
<p style="margin:0 0 6px;font-size:13px;color:${C.amber};font-weight:bold">${l === "ar" ? "طلب رقم" : "Order"} #${esc(order.order_number)}</p>
<h1 style="margin:0 0 10px;font-size:26px;line-height:1.3">${title}</h1>
<p style="margin:0;font-size:15px;line-height:1.8;color:#333">${hello}<br>${lead}</p>
${progress(order.status, l)}
<p style="margin:18px 0 22px" align="center"><a href="${esc(track)}" style="display:inline-block;background:${C.ink};color:#ffffff;text-decoration:none;font-weight:bold;font-size:15px;padding:13px 30px;border-radius:999px">${l === "ar" ? "تتبّع طلبك" : "Track your order"}</a></p>
</td></tr>
<tr><td style="padding:0 28px 8px">${itemsTable(items, order, l, ctx.siteUrl)}</td></tr>
<tr><td style="padding:14px 28px 24px;font-size:14px;line-height:1.8;color:#333">
<b>${l === "ar" ? "التوصيل إلى" : "Delivering to"}</b><br>${esc(order.customer_name)} · <span dir="ltr">${esc(formatIraqiPhone(order.phone))}</span><br>${address}
<br><b>${l === "ar" ? "الدفع" : "Payment"}:</b> ${order.payment_method === "cod" ? (l === "ar" ? "عند الاستلام" : "Cash on delivery") : (l === "ar" ? "إلكتروني" : "Online")}
</td></tr>`;
  const subject = `${title} — #${order.order_number}`;
  const text = [`${l === "ar" ? "مرحباً" : "Hi"} ${order.customer_name}`, title, lead, "", ...items.map((it) => `• ${l === "ar" ? it.name_ar : it.name_en} ${[it.size_code, l === "ar" ? it.color_name_ar : it.color_name_en].filter(Boolean).join(" ")} ×${it.quantity} — ${formatIQD(it.line_total, l)}`), `${l === "ar" ? "الإجمالي" : "Total"}: ${formatIQD(order.total, l)}`, "", `${l === "ar" ? "تتبّع طلبك" : "Track"}: ${track}`, "TPAC"].join("\n");
  return { subject, html: shell(l, ctx, `${title} — ${lead}`, body), text };
}

/** The admin's alert for a new order (always Arabic, with a link to the order in the dashboard). */
export function adminNewOrderEmail(order: Order, items: EmailItem[], ctx: EmailContext) {
  const l: L = "ar";
  const link = `${ctx.siteUrl}/ar/admin/orders/${order.id}`;
  const wa = `https://wa.me/${esc(order.phone.replace(/\D/g, ""))}`;
  const pieces = items.reduce((n, it) => n + it.quantity, 0);
  const address = [governorateName(order.governorate, l), order.city, order.address_line].filter(Boolean).map(esc).join("، ");
  const body = `<tr><td style="padding:28px 28px 8px">
<p style="margin:0 0 6px;font-size:13px;color:${C.amber};font-weight:bold">🛍️ طلب جديد #${esc(order.order_number)}${order.has_custom_items ? " · تصميم خاص" : ""}</p>
<h1 style="margin:0 0 6px;font-size:28px">${formatIQD(order.total, l)}</h1>
<p style="margin:0;font-size:14px;color:${C.mute}">${pieces} قطعة · ${order.payment_method === "cod" ? "دفع عند الاستلام" : "دفع إلكتروني"}${order.discount_code ? ` · كود ${esc(order.discount_code)}` : ""}</p>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:18px 0;background:${C.paper};border-radius:14px"><tr><td style="padding:14px 16px;font-size:14px;line-height:1.8">
<b>${esc(order.customer_name)}</b> · <span dir="ltr">${esc(formatIraqiPhone(order.phone))}</span><br>${address}${order.delivery_notes ? `<br><span style="color:${C.mute}">ملاحظة: ${esc(order.delivery_notes)}</span>` : ""}
</td></tr></table>
<p style="margin:0 0 18px" align="center">
<a href="${esc(link)}" style="display:inline-block;background:${C.ink};color:#ffffff;text-decoration:none;font-weight:bold;font-size:15px;padding:12px 26px;border-radius:999px;margin:4px">افتح الطلب</a>
<a href="${wa}" style="display:inline-block;background:#25D366;color:#ffffff;text-decoration:none;font-weight:bold;font-size:15px;padding:12px 26px;border-radius:999px;margin:4px">واتساب الزبون</a>
</p></td></tr>
<tr><td style="padding:0 28px 24px">${itemsTable(items, order, l, ctx.siteUrl)}</td></tr>`;
  const subject = `🛍️ طلب جديد ${order.order_number} — ${formatIQD(order.total, l)}${order.has_custom_items ? " (تصميم خاص)" : ""}`;
  const text = [`طلب جديد ${order.order_number}`, `${order.customer_name} — ${formatIraqiPhone(order.phone)}`, address.replace(/&[a-z#0-9]+;/g, ""), ...items.map((it) => `• ${it.name_ar} ${it.size_code ?? ""} ×${it.quantity}`), `الإجمالي: ${formatIQD(order.total, l)}`, link].join("\n");
  return { subject, html: shell(l, { ...ctx, whatsapp: null }, `${order.customer_name} — ${formatIQD(order.total, l)}`, body), text };
}
