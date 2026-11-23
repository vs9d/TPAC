import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { formatIQD } from "@/lib/format";
import { publicEnv } from "@/lib/env";
import { normalizeIraqiPhone } from "@/lib/phone";
import { renderWa, waParam, waSettingsFrom, WA_STATUSES, type WaSettings, type WaStatus } from "@/lib/whatsapp-templates";
import { sendWhatsAppTemplate, whatsappConfigured, WhatsAppError } from "./whatsapp";

/** waits before the 2nd, 3rd, 4th and 5th try */
const BACKOFF_MIN = [1, 5, 30, 120];
export const MAX_ATTEMPTS = BACKOFF_MIN.length + 1;

export async function getWaSettings(): Promise<WaSettings> {
  const { data } = await createAdminClient().from("website_settings").select("value").eq("key", "whatsapp").maybeSingle();
  return waSettingsFrom(data?.value);
}

type Row = { id: string; recipient: string | null; attempts: number; payload: { template?: string; language?: string; params?: string[] } | null };

/** One delivery attempt; schedules a retry for temporary failures. Never throws. */
export async function deliver(row: Row): Promise<"sent" | "pending" | "failed" | "skipped"> {
  const db = createAdminClient();
  const attempts = row.attempts + 1;
  if (!whatsappConfigured()) {
    await db.from("notifications").update({ status: "skipped", error: "provider_not_configured: add WHATSAPP_ACCESS_TOKEN and WHATSAPP_PHONE_NUMBER_ID", next_attempt_at: null }).eq("id", row.id);
    return "skipped";
  }
  try {
    const id = await sendWhatsAppTemplate({ to: row.recipient ?? "", params: row.payload?.params ?? [], template: row.payload?.template, language: row.payload?.language });
    await db.from("notifications").update({ status: "sent", provider_status: "accepted", provider_message_id: id, sent_at: new Date().toISOString(), attempts, error: null, next_attempt_at: null }).eq("id", row.id);
    return "sent";
  } catch (e) {
    const err = e instanceof WhatsAppError ? e : new WhatsAppError(e instanceof Error ? e.message : "unknown", true);
    const retry = err.retryable && attempts < MAX_ATTEMPTS;
    await db.from("notifications").update({
      status: retry ? "pending" : "failed",
      provider_status: retry ? null : "failed",
      attempts,
      error: err.message.slice(0, 500),
      next_attempt_at: retry ? new Date(Date.now() + BACKOFF_MIN[attempts - 1]! * 60_000).toISOString() : null,
    }).eq("id", row.id);
    return retry ? "pending" : "failed";
  }
}

export type EnqueueResult = { ok: true; id: string; status: string } | { ok: false; reason: "disabled" | "status_off" | "no_opt_in" | "invalid_phone" | "duplicate" | "not_found" | "error" };

/**
 * Queues (and tries right away) the WhatsApp update for an order's status. One message per order + status
 * (a second call is a no-op) unless `resend` is set by an admin. Needs the customer's opt-in.
 */
export async function enqueueOrderWhatsApp(orderId: string, status: string, opts: { resend?: boolean } = {}): Promise<EnqueueResult> {
  try {
    if (!WA_STATUSES.includes(status as WaStatus)) return { ok: false, reason: "status_off" };
    const db = createAdminClient();
    const settings = await getWaSettings();
    const cfg = settings.statuses[status as WaStatus];
    if (!settings.enabled) return { ok: false, reason: "disabled" };
    if (!cfg.enabled && !opts.resend) return { ok: false, reason: "status_off" };
    const { data: order } = await db.from("orders").select("id, order_number, customer_name, phone, total, locale, user_id, whatsapp_opt_in").eq("id", orderId).maybeSingle();
    if (!order) return { ok: false, reason: "not_found" };
    if (!order.whatsapp_opt_in) return { ok: false, reason: "no_opt_in" };
    const phone = normalizeIraqiPhone(order.phone);
    if (!phone) return { ok: false, reason: "invalid_phone" };
    const tracking_url = `${publicEnv.siteUrl}/${order.locale}/track?order=${order.order_number}`;
    const vars = { customer_name: order.customer_name, order_number: order.order_number, total: formatIQD(order.total, "ar"), tracking_url };
    const text = renderWa(cfg.text, vars);
    // own template per status: {{1}} name, {{2}} order number, {{3}} link — general template: {{3}} carries the message
    const template = cfg.template || settings.default_template || undefined;
    const params = cfg.template ? [vars.customer_name, vars.order_number, tracking_url].map(waParam) : [vars.customer_name, vars.order_number, text].map(waParam);
    const { data: row, error } = await db.from("notifications").insert({
      audience: "customer", channel: "whatsapp", event: `order.${status}`, recipient: `+${phone}`, title: `${order.order_number} — ${status}`,
      body: text, order_id: order.id, user_id: order.user_id, status: "pending", dedupe_key: opts.resend ? null : `order:${order.id}:${status}`,
      payload: { template, language: settings.language, params }, attempts: 0, next_attempt_at: new Date().toISOString(),
    }).select("id, recipient, attempts, payload").single();
    if (error?.code === "23505") return { ok: false, reason: "duplicate" };
    if (error || !row) { console.error("whatsapp enqueue", error); return { ok: false, reason: "error" }; }
    const result = await deliver(row as Row);
    return { ok: true, id: row.id, status: result };
  } catch (e) {
    console.error("enqueueOrderWhatsApp", e);
    return { ok: false, reason: "error" };
  }
}

/** Retries due messages (called by the cron endpoint, after new messages and when the dashboard opens). */
export async function processWhatsAppQueue(limit = 20): Promise<{ processed: number }> {
  const db = createAdminClient();
  const { data } = await db.from("notifications").select("id, recipient, attempts, payload")
    .eq("channel", "whatsapp").eq("status", "pending").lte("next_attempt_at", new Date().toISOString())
    .order("next_attempt_at").limit(limit);
  for (const row of (data ?? []) as Row[]) await deliver(row);
  return { processed: data?.length ?? 0 };
}

/** Admin "send again" of an existing message (a new log row, same content). */
export async function resendNotification(id: string): Promise<{ ok: boolean; status?: string }> {
  const db = createAdminClient();
  const { data: n } = await db.from("notifications").select("*").eq("id", id).eq("channel", "whatsapp").maybeSingle();
  if (!n) return { ok: false };
  const { data: row } = await db.from("notifications").insert({
    audience: n.audience, channel: "whatsapp", event: n.event, recipient: n.recipient, title: n.title, body: n.body, order_id: n.order_id,
    user_id: n.user_id, status: "pending", payload: n.payload, attempts: 0, next_attempt_at: new Date().toISOString(),
  }).select("id, recipient, attempts, payload").single();
  if (!row) return { ok: false };
  return { ok: true, status: await deliver(row as Row) };
}

/** Delivery receipts from Meta's webhook. */
export async function applyStatusUpdate(messageId: string, status: string, error?: string): Promise<void> {
  const db = createAdminClient();
  const patch: Record<string, unknown> = { provider_status: status };
  if (status === "delivered" || status === "read") patch.delivered_at = new Date().toISOString();
  if (status === "failed") Object.assign(patch, { status: "failed", error: (error ?? "failed").slice(0, 500) });
  const q = db.from("notifications").update(patch).eq("provider_message_id", messageId);
  // a late "sent" never overwrites "delivered" / "read"
  if (status === "sent") await q.in("provider_status", ["accepted"]);
  else if (status === "delivered") await q.in("provider_status", ["accepted", "sent"]);
  else await q;
}

/** Dashboard test: sends one status message with sample data to the admin's own number. */
export async function sendTestWhatsApp(phoneInput: string, status: WaStatus): Promise<{ ok: boolean; status?: string; error?: string }> {
  const phone = normalizeIraqiPhone(phoneInput);
  if (!phone) return { ok: false, error: "invalid_phone" };
  const settings = await getWaSettings();
  const cfg = settings.statuses[status];
  const vars = { customer_name: "TPAC", order_number: "TP100000", total: formatIQD(25000, "ar"), tracking_url: `${publicEnv.siteUrl}/ar/track` };
  const text = renderWa(cfg.text, vars);
  const params = cfg.template ? [vars.customer_name, vars.order_number, vars.tracking_url].map(waParam) : [vars.customer_name, vars.order_number, text].map(waParam);
  const db = createAdminClient();
  const { data: row } = await db.from("notifications").insert({
    audience: "admin", channel: "whatsapp", event: `test.${status}`, recipient: `+${phone}`, title: `Test — ${status}`, body: text, status: "pending",
    payload: { template: cfg.template || settings.default_template || undefined, language: settings.language, params }, attempts: 0, next_attempt_at: new Date().toISOString(),
  }).select("id, recipient, attempts, payload").single();
  if (!row) return { ok: false, error: "error" };
  const r = await deliver(row as Row);
  const { data: after } = await db.from("notifications").select("error").eq("id", row.id).single();
  return { ok: r === "sent" || r === "pending", status: r, error: after?.error ?? undefined };
}
