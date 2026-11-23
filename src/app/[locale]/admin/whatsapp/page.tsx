import { notFound } from "next/navigation";
import { CheckCircle2, CircleAlert, RefreshCw } from "lucide-react";
import { isLocale } from "@/lib/i18n/config";
import { adminT } from "@/lib/admin-i18n";
import { createClient } from "@/lib/supabase/server";
import { requireStaff } from "@/lib/auth";
import { publicEnv } from "@/lib/env";
import { PageHeader, Card, Pill, Empty } from "@/components/admin/ui";
import { AdminForm, Input, Textarea, Checkbox, Select, Submit } from "@/components/admin/form";
import { saveWhatsAppSettings, resendWhatsApp, processWhatsAppQueueNow, sendTestWhatsAppAction } from "@/lib/actions/admin/whatsapp";
import { getWaSettings, processWhatsAppQueue } from "@/lib/notifications/whatsapp-queue";
import { renderWa, WA_STATUSES, WA_STATUS_LABEL } from "@/lib/whatsapp-templates";
import { formatDate } from "@/lib/format";

export const dynamic = "force-dynamic";

type Log = { id: string; event: string; recipient: string | null; title: string; body: string | null; status: string; provider_status: string | null; attempts: number; error: string | null; created_at: string; next_attempt_at: string | null; order_id: string | null };

export default async function AdminWhatsApp({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const session = await requireStaff(locale);
  const t = adminT(locale);
  const isAdmin = session.profile?.role === "admin";
  // due retries go out whenever this page opens
  await processWhatsAppQueue(20).catch(() => undefined);
  const supabase = await createClient();
  const [settings, { data, error }] = await Promise.all([
    getWaSettings(),
    supabase.from("notifications").select("id, event, recipient, title, body, status, provider_status, attempts, error, created_at, next_attempt_at, order_id").eq("channel", "whatsapp").order("created_at", { ascending: false }).limit(100),
  ]);
  const logs = (data as Log[]) ?? [];
  const env = (k: string) => Boolean(process.env[k]);
  const checks: [string, boolean, string][] = [
    ["WHATSAPP_ACCESS_TOKEN", env("WHATSAPP_ACCESS_TOKEN"), t("مفتاح الوصول (System User token)", "Access token (system user)")],
    ["WHATSAPP_PHONE_NUMBER_ID", env("WHATSAPP_PHONE_NUMBER_ID"), t("معرّف رقم الإرسال", "Sending phone number ID")],
    ["WHATSAPP_TEMPLATE_ORDER_UPDATE", env("WHATSAPP_TEMPLATE_ORDER_UPDATE") || !!settings.default_template, t("القالب العام (أو اكتبه هنا تحت)", "General template (or set it below)")],
    ["WHATSAPP_APP_SECRET", env("WHATSAPP_APP_SECRET"), t("سر التطبيق — لحالة التسليم", "App secret — for delivery receipts")],
    ["WHATSAPP_VERIFY_TOKEN", env("WHATSAPP_VERIFY_TOKEN"), t("رمز التحقق للـ Webhook", "Webhook verify token")],
    ["CRON_SECRET", env("CRON_SECRET"), t("لإعادة المحاولة التلقائية (اختياري)", "For automatic retries (optional)")],
  ];
  const sample = { customer_name: "سارة", order_number: "TP100123", total: "45,000 د.ع", tracking_url: `${publicEnv.siteUrl}/ar/track?order=TP100123` };
  const tone = (l: Log) => (l.status === "failed" ? "bad" : l.status === "skipped" ? "neutral" : l.status === "pending" ? "warn" : "good");
  const statusText = (l: Log) =>
    l.status === "pending" ? t("بالانتظار", "Pending")
    : l.status === "failed" ? t("فشل", "Failed")
    : l.status === "skipped" ? t("ما انرسل", "Not sent")
    : l.provider_status === "read" ? t("مقروءة", "Read")
    : l.provider_status === "delivered" ? t("وصلت", "Delivered")
    : t("انرسلت", "Sent");

  if (error) return (
    <div className="space-y-6">
      <PageHeader title={t("إشعارات الواتساب", "WhatsApp notifications")} />
      <Card><p className="text-sm">{t("شغّل ملف supabase/add-business-features.sql بـ SQL Editor حتى يشتغل هذا القسم.", "Run supabase/add-business-features.sql in the SQL Editor to enable this section.")}</p></Card>
    </div>
  );

  return (
    <div className="space-y-6">
      <PageHeader title={t("إشعارات الواتساب", "WhatsApp notifications")} subtitle={t("رسائل تلقائية للزبون بكل تغيير بحالة طلبه — عبر WhatsApp Cloud API الرسمي، وبس للزبائن اللي وافقوا.", "Automatic messages to customers on every order status change — via the official WhatsApp Cloud API, only to customers who opted in.")} />

      <Card title={t("الربط ويا Meta", "Meta connection")}>
        <ul className="grid gap-2 sm:grid-cols-2">
          {checks.map(([k, ok, label]) => (
            <li key={k} className="flex items-start gap-2 rounded-2xl border border-line p-3 text-sm">
              {ok ? <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-pine" /> : <CircleAlert className="mt-0.5 size-4 shrink-0 text-amber-deep" />}
              <span><span className="block font-semibold">{label}</span><code className="text-[11px] text-mute" dir="ltr">{k}</code></span>
            </li>
          ))}
        </ul>
        <div className="mt-4 space-y-1 rounded-2xl bg-bone p-4 text-xs leading-relaxed">
          <p className="font-bold">{t("رابط الـ Webhook (لحالة التسليم):", "Webhook URL (delivery receipts):")}</p>
          <code dir="ltr" className="block break-all">{publicEnv.siteUrl}/api/whatsapp/webhook</code>
          <p className="pt-2 font-bold">{t("رابط إعادة المحاولة التلقائية (كل ٥ دقايق، بالهيدر Authorization: Bearer CRON_SECRET):", "Retry URL (every 5 minutes, header Authorization: Bearer CRON_SECRET):")}</p>
          <code dir="ltr" className="block break-all">{publicEnv.siteUrl}/api/cron/notifications</code>
          <p className="pt-2 text-mute">{t("المفاتيح تنحط بـ Vercel ← Settings ← Environment Variables فقط — ما تنكتب بالموقع ولا تنرسل بالمحادثة.", "Keys go only in Vercel → Settings → Environment Variables — never in the site or in chats.")}</p>
        </div>
      </Card>

      {isAdmin && (
        <Card title={t("الرسائل والقوالب", "Messages & templates")}>
          <AdminForm action={saveWhatsAppSettings} className="space-y-5">
            <div className="grid gap-3 sm:grid-cols-3">
              <Checkbox name="enabled" label={t("الإشعارات شغّالة", "Notifications on")} defaultChecked={settings.enabled} className="self-end pb-2" />
              <Input name="language" label={t("لغة القوالب", "Template language")} defaultValue={settings.language} dir="ltr" />
              <Input name="default_template" label={t("القالب العام (اسمه بـ Meta)", "General template (name in Meta)")} defaultValue={settings.default_template} dir="ltr" placeholder="order_update" />
            </div>
            <p className="rounded-2xl border border-line p-3 text-xs leading-relaxed text-mute">
              {t("الرسائل اللي تبدي منكم لازم تكون قالب موافَق عليه بـ Meta. طريقتين: (١) قالب عام واحد نصه مثلاً «مرحباً {{1}} ❤️ — {{3}} — رقم الطلب: #{{2}}» والرسالة اللي تكتبها هنا تروح بمكان {{3}}. (٢) قالب خاص لكل حالة: {{1}} الاسم، {{2}} رقم الطلب، {{3}} رابط التتبع. المتغيرات بالنص: {customer_name} {order_number} {total} {tracking_url}.", "Business-initiated messages must be Meta-approved templates. Either (1) one general template, e.g. “Hi {{1}} ❤️ — {{3}} — order #{{2}}”, where the message written here fills {{3}}; or (2) a template per status: {{1}} name, {{2}} order number, {{3}} tracking link. Placeholders: {customer_name} {order_number} {total} {tracking_url}.")}
            </p>
            {WA_STATUSES.map((s) => {
              const c = settings.statuses[s];
              return (
                <fieldset key={s} className="space-y-3 rounded-2xl border border-line p-4">
                  <legend className="px-1 text-sm font-bold">{locale === "ar" ? WA_STATUS_LABEL[s].ar : WA_STATUS_LABEL[s].en}</legend>
                  <div className="grid gap-3 sm:grid-cols-3">
                    <Checkbox name={`${s}_enabled`} label={t("ترسل تلقائياً", "Send automatically")} defaultChecked={c.enabled} className="self-end pb-2" />
                    <Input name={`${s}_template`} id={`wa-${s}-template`} label={t("قالب خاص (اختياري)", "Own template (optional)")} defaultValue={c.template} dir="ltr" className="sm:col-span-2" />
                  </div>
                  <div className="grid gap-3 md:grid-cols-2">
                    <Textarea name={`${s}_text`} id={`wa-${s}-text`} label={t("نص الرسالة", "Message text")} defaultValue={c.text} rows={4} />
                    <div>
                      <p className="mb-1 text-xs font-semibold text-mute">{t("معاينة", "Preview")}</p>
                      <p className="whitespace-pre-line rounded-2xl rounded-ss-sm bg-[#dcf8c6] p-3 text-sm text-[#111]" dir="rtl">{renderWa(c.text, sample)}</p>
                    </div>
                  </div>
                </fieldset>
              );
            })}
            <Submit>{t("حفظ", "Save")}</Submit>
          </AdminForm>
        </Card>
      )}

      {isAdmin && (
        <Card title={t("رسالة تجربة", "Test message")}>
          <AdminForm action={sendTestWhatsAppAction} className="grid gap-3 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
            <Input name="phone" id="wa-test-phone" label={t("رقمك", "Your number")} placeholder="07xx xxx xxxx" dir="ltr" required />
            <Select name="status" id="wa-test-status" label={t("الحالة", "Status")} defaultValue="confirmed" options={WA_STATUSES.map((s) => ({ value: s, label: locale === "ar" ? WA_STATUS_LABEL[s].ar : WA_STATUS_LABEL[s].en }))} />
            <Submit>{t("أرسل تجربة", "Send test")}</Submit>
          </AdminForm>
        </Card>
      )}

      <Card title={t("سجل الرسائل", "Message log")} actions={<AdminForm action={processWhatsAppQueueNow}><button className="btn btn-outline btn-sm"><RefreshCw className="size-4" /> {t("أعد محاولة المعلّقة", "Retry pending")}</button></AdminForm>}>
        {!logs.length ? <Empty>{t("ما انرسلت رسائل بعد.", "No messages yet.")}</Empty> : (
          <div className="overflow-x-auto">
            <table className="table-admin">
              <thead><tr><th>{t("الرسالة", "Message")}</th><th>{t("الحالة", "Status")}</th><th>{t("المحاولات", "Tries")}</th><th>{t("التاريخ", "Date")}</th><th /></tr></thead>
              <tbody>
                {logs.map((l) => (
                  <tr key={l.id}>
                    <td className="max-w-[22rem]">
                      <span className="block text-xs font-semibold">{l.order_id ? <a href={`/${locale}/admin/orders/${l.order_id}`} className="underline">{l.title}</a> : l.title} · <span dir="ltr">{l.recipient}</span></span>
                      <span className="line-clamp-2 text-xs text-mute">{l.body}</span>
                      {l.error && <span className="block text-[11px] text-danger" dir="ltr">{l.error}</span>}
                    </td>
                    <td><Pill tone={tone(l)}>{statusText(l)}</Pill>{l.status === "pending" && l.next_attempt_at && <span className="block text-[11px] text-mute">{t("المحاولة الجاية", "Next try")} {formatDate(l.next_attempt_at, locale, true)}</span>}</td>
                    <td className="tabular-nums">{l.attempts}</td>
                    <td className="text-xs text-mute">{formatDate(l.created_at, locale, true)}</td>
                    <td>{l.status !== "pending" && <AdminForm action={resendWhatsApp}><input type="hidden" name="id" value={l.id} /><button className="btn btn-outline btn-sm">{t("إعادة إرسال", "Resend")}</button></AdminForm>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
