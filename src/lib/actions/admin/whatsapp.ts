"use server";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { assertAdmin, assertStaff } from "@/lib/auth";
import { bool, str, dbError, logActivity, type ActionState } from "./common";
import { validTemplateName, WA_STATUSES, type WaSettings, type WaStatus } from "@/lib/whatsapp-templates";
import { enqueueOrderWhatsApp, processWhatsAppQueue, resendNotification, sendTestWhatsApp } from "@/lib/notifications/whatsapp-queue";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const REASON: Record<string, string> = {
  disabled: "إشعارات الواتساب متوقفة من الإعدادات",
  status_off: "رسالة هذه الحالة متوقفة",
  no_opt_in: "الزبون ما وافق على رسائل الواتساب",
  invalid_phone: "رقم الهاتف مو رقم عراقي صحيح",
  duplicate: "انرسلت رسالة لهذه الحالة سابقاً",
  not_found: "الطلب غير موجود",
  error: "صار خطأ — تأكد من تشغيل add-business-features.sql",
};

export async function saveWhatsAppSettings(_prev: ActionState, form: FormData): Promise<ActionState> {
  const session = await assertAdmin();
  const statuses = {} as WaSettings["statuses"];
  const fields: Record<string, string> = {};
  for (const s of WA_STATUSES) {
    const template = str(form.get(`${s}_template`)).trim();
    const text = str(form.get(`${s}_text`)).trim().slice(0, 1000);
    if (!validTemplateName(template)) fields[`${s}_template`] = "template";
    if (!text) fields[`${s}_text`] = "required";
    statuses[s] = { enabled: bool(form.get(`${s}_enabled`)), template, text };
  }
  const default_template = str(form.get("default_template")).trim();
  if (!validTemplateName(default_template)) fields.default_template = "template";
  const language = str(form.get("language")).trim() || "ar";
  if (!/^[a-z]{2}(_[A-Z]{2})?$/.test(language)) fields.language = "language";
  if (Object.keys(fields).length) return { ok: false, error: "اسم القالب بالحروف الإنجليزية الصغيرة والأرقام و _ فقط", fields };
  const value: WaSettings = { enabled: bool(form.get("enabled")), language, default_template, statuses };
  const supabase = await createClient();
  const { error } = await supabase.from("website_settings").upsert({ key: "whatsapp", value, updated_by: session.userId }, { onConflict: "key" });
  if (error) return dbError(error);
  await logActivity("whatsapp.settings_saved", "settings", "whatsapp", { enabled: value.enabled });
  revalidatePath("/[locale]/admin/whatsapp", "page");
  return { ok: true };
}

export async function resendWhatsApp(_prev: ActionState, form: FormData): Promise<ActionState> {
  await assertStaff();
  const id = str(form.get("id"));
  if (!UUID.test(id)) return { ok: false, error: "validation" };
  const r = await resendNotification(id);
  await logActivity("whatsapp.resent", "notification", id, { status: r.status });
  revalidatePath("/[locale]/admin", "layout");
  return r.ok ? { ok: true, message: r.status === "sent" ? "انرسلت ✅" : r.status === "pending" ? "بالانتظار — راح تنعاد المحاولة تلقائياً" : "ما انرسلت — شوف السبب بالسجل" } : { ok: false, error: "تعذّرت إعادة الإرسال" };
}

export async function processWhatsAppQueueNow(_prev: ActionState): Promise<ActionState> {
  void _prev;
  await assertStaff();
  const r = await processWhatsAppQueue(50);
  revalidatePath("/[locale]/admin/whatsapp", "page");
  return { ok: true, message: `تمت معالجة ${r.processed} رسالة بالانتظار` };
}

export async function sendTestWhatsAppAction(_prev: ActionState, form: FormData): Promise<ActionState> {
  await assertAdmin();
  const status = str(form.get("status")) as WaStatus;
  if (!WA_STATUSES.includes(status)) return { ok: false, error: "validation" };
  const r = await sendTestWhatsApp(str(form.get("phone")), status);
  revalidatePath("/[locale]/admin/whatsapp", "page");
  if (r.error === "invalid_phone") return { ok: false, error: REASON.invalid_phone! };
  return r.ok ? { ok: true, message: r.status === "sent" ? "انرسلت رسالة التجربة ✅" : "بالانتظار — راح تنعاد المحاولة" } : { ok: false, error: r.error ?? "ما انرسلت" };
}

/** Order page: record that the customer agreed (or no longer agrees) to WhatsApp updates. */
export async function setOrderWhatsAppOptIn(_prev: ActionState, form: FormData): Promise<ActionState> {
  await assertStaff();
  const id = str(form.get("order_id"));
  if (!UUID.test(id)) return { ok: false, error: "validation" };
  const value = bool(form.get("whatsapp_opt_in"));
  const supabase = await createClient();
  const { error } = await supabase.from("orders").update({ whatsapp_opt_in: value }).eq("id", id);
  if (error) return dbError(error);
  await logActivity("order.whatsapp_opt_in", "order", id, { value });
  revalidatePath(`/[locale]/admin/orders/${id}`, "page");
  return { ok: true };
}

/** Order page: send (again) the message for the order's current status. */
export async function sendOrderWhatsApp(_prev: ActionState, form: FormData): Promise<ActionState> {
  await assertStaff();
  const id = str(form.get("order_id"));
  if (!UUID.test(id)) return { ok: false, error: "validation" };
  const supabase = await createClient();
  const { data: o } = await supabase.from("orders").select("status").eq("id", id).maybeSingle();
  if (!o) return { ok: false, error: REASON.not_found! };
  const r = await enqueueOrderWhatsApp(id, o.status, { resend: true });
  await logActivity("whatsapp.order_sent", "order", id, { status: o.status, result: r.ok ? r.status : r.reason });
  revalidatePath(`/[locale]/admin/orders/${id}`, "page");
  if (!r.ok) return { ok: false, error: REASON[r.reason] ?? r.reason };
  return { ok: true, message: r.status === "sent" ? "انرسلت ✅" : r.status === "skipped" ? "ما انرسلت: الواتساب غير مربوط بعد (مفاتيح Meta ناقصة)" : r.status === "pending" ? "بالانتظار — راح تنعاد المحاولة تلقائياً" : "ما انرسلت — شوف السبب بالسجل" };
}
