/**
 * WhatsApp order-update messages (editable from the dashboard).
 *
 * Business-initiated WhatsApp messages must use templates approved in Meta's WhatsApp Manager. Two ways:
 *  • a template per status (name set on that status): body variables {{1}} customer name, {{2}} order number,
 *    {{3}} tracking link;
 *  • one general template (WHATSAPP_TEMPLATE_ORDER_UPDATE or the name set in the dashboard) whose body is e.g.
 *    "مرحباً {{1}} ❤️ — {{3}} — رقم الطلب: #{{2}}": {{3}} carries the status message written here (on one line).
 */
export const WA_STATUSES = ["received", "confirmed", "preparing", "printing", "ready_to_ship", "shipped", "delivered", "cancelled"] as const;
export type WaStatus = (typeof WA_STATUSES)[number];

export interface WaStatusConfig { enabled: boolean; text: string; template: string }
export interface WaSettings { enabled: boolean; language: string; default_template: string; statuses: Record<WaStatus, WaStatusConfig> }

export const WA_STATUS_LABEL: Record<WaStatus, { ar: string; en: string }> = {
  received: { ar: "تم استلام الطلب", en: "Order received" },
  confirmed: { ar: "تم تأكيد الطلب", en: "Order confirmed" },
  preparing: { ar: "قيد التجهيز", en: "Being prepared" },
  printing: { ar: "قيد الإنتاج والطباعة", en: "In production" },
  ready_to_ship: { ar: "جاهز", en: "Ready" },
  shipped: { ar: "تم الشحن", en: "Shipped" },
  delivered: { ar: "تم التسليم", en: "Delivered" },
  cancelled: { ar: "تم الإلغاء", en: "Cancelled" },
};

export const DEFAULT_WA: WaSettings = {
  enabled: true,
  language: "ar",
  default_template: "",
  statuses: {
    received: { enabled: false, template: "", text: "مرحباً {customer_name} ❤️\nوصلنا طلبك من TPAC.\nرقم الطلب: #{order_number}" },
    confirmed: { enabled: true, template: "", text: "مرحباً {customer_name} ❤️\nتم تأكيد طلبك من TPAC بنجاح.\nرقم الطلب: #{order_number}\nشكراً لثقتك بينا!" },
    preparing: { enabled: true, template: "", text: "مرحباً {customer_name} ❤️\nطلبك من TPAC قيد التجهيز.\nرقم الطلب: #{order_number}" },
    printing: { enabled: true, template: "", text: "مرحباً {customer_name} ❤️\nطلبك من TPAC حالياً قيد التجهيز والطباعة.\nراح نبلغك بكل تحديث جديد." },
    ready_to_ship: { enabled: true, template: "", text: "مرحباً {customer_name} ❤️\nطلبك #{order_number} صار جاهز وراح يطلع إلك قريباً." },
    shipped: { enabled: true, template: "", text: "طلبك صار بالطريق إلك! 🚚\nرقم الطلب: #{order_number}\nشكراً لاختيارك TPAC." },
    delivered: { enabled: true, template: "", text: "نتمنى تكون تجربتك ويانه حلوة ❤️\nتم تسليم طلبك بنجاح.\nشكراً لأنك جزء من عائلة TPAC." },
    cancelled: { enabled: true, template: "", text: "مرحباً {customer_name}،\nتم إلغاء طلبك #{order_number}. إذا عندك أي سؤال راسلنا." },
  },
};

/** Saved settings merged over the defaults (missing statuses / fields fall back). */
export function waSettingsFrom(value: unknown): WaSettings {
  const v = (value && typeof value === "object" ? value : {}) as Partial<WaSettings>;
  const statuses = { ...DEFAULT_WA.statuses };
  for (const s of WA_STATUSES) {
    const x = (v.statuses as Partial<Record<WaStatus, Partial<WaStatusConfig>>> | undefined)?.[s];
    if (x) statuses[s] = { enabled: x.enabled ?? statuses[s].enabled, text: typeof x.text === "string" && x.text.trim() ? x.text : statuses[s].text, template: typeof x.template === "string" ? x.template : "" };
  }
  return { enabled: v.enabled ?? DEFAULT_WA.enabled, language: v.language || DEFAULT_WA.language, default_template: v.default_template ?? "", statuses };
}

export interface WaVars { customer_name: string; order_number: string; total?: string; tracking_url?: string }
/** Fills {customer_name}, {order_number}, {total}, {tracking_url}. Unknown placeholders stay as written. */
export function renderWa(text: string, vars: WaVars): string {
  return text.replace(/\{(customer_name|order_number|total|tracking_url)\}/g, (m, k: keyof WaVars) => vars[k] ?? m);
}

/** Template variables cannot contain new lines, tabs or more than 4 spaces in a row (Meta's rule). */
export const waParam = (s: string) => s.replace(/[\t\r]+/g, " ").replace(/\n+/g, " — ").replace(/ {4,}/g, "   ").trim().slice(0, 1024);

/** Template names in WhatsApp Manager: lowercase letters, digits and underscores. */
export const validTemplateName = (s: string) => s === "" || /^[a-z0-9_]{1,512}$/.test(s);
