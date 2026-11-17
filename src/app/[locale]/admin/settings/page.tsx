import { notFound, redirect } from "next/navigation";
import { isLocale } from "@/lib/i18n/config";
import { adminT } from "@/lib/admin-i18n";
import { getSession } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { getSettings } from "@/lib/data/content";
import { PageHeader, Card, Pill } from "@/components/admin/ui";
import { AdminForm, Input, Select, Checkbox, Submit, Textarea } from "@/components/admin/form";
import { saveSettings, saveDeliveryZone, savePageContent } from "@/lib/actions/admin/settings";
import { integrationStatus } from "@/lib/notifications";
import { onlinePaymentAvailable } from "@/lib/payments";
import { DEFAULT_PAGES, PAGE_SLUGS } from "@/lib/content/pages";
import { formatIraqiPhone } from "@/lib/phone";
import type { DeliveryZone } from "@/lib/types";

export default async function AdminSettings({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const session = await getSession();
  if (session?.profile?.role !== "admin") redirect(`/${locale}/admin`);
  const t = adminT(locale);
  const s = await getSettings();
  const supabase = await createClient();
  const [{ data: zones }, { data: pagesRow }] = await Promise.all([
    supabase.from("delivery_zones").select("*").order("sort_order"),
    supabase.from("website_settings").select("value").eq("key", "pages").maybeSingle(),
  ]);
  const pageOverrides = (pagesRow?.value as Record<string, Record<string, string>>) ?? {};
  const integ = integrationStatus();
  const status = (ok: boolean) => ok ? <Pill tone="good">{t("مُفعّل", "Configured")}</Pill> : <Pill tone="warn">{t("بانتظار الإعداد", "Pending configuration")}</Pill>;
  return (
    <div className="space-y-6">
      <PageHeader title={t("إعدادات الموقع", "Website settings")} />
      <Card title={t("التكاملات الخارجية", "External integrations")}>
        <ul className="space-y-2 text-sm">
          <li className="flex items-center justify-between"><span>{t("البريد الإلكتروني (Resend)", "Email (Resend)")} — RESEND_API_KEY, EMAIL_FROM</span>{status(integ.email)}</li>
          <li className="flex items-center justify-between"><span>WhatsApp Business Cloud API — WHATSAPP_ACCESS_TOKEN, WHATSAPP_PHONE_NUMBER_ID, WHATSAPP_TEMPLATE_ORDER_UPDATE</span>{status(integ.whatsapp)}</li>
          <li className="flex items-center justify-between"><span>{t("الدفع الإلكتروني", "Online payments")} — PAYMENT_PROVIDER</span>{status(onlinePaymentAvailable())}</li>
        </ul>
        <p className="mt-3 text-xs text-mute">{t("المفاتيح السرية تُضبط كمتغيرات بيئة على الخادم ولا تُخزن في قاعدة البيانات. الرسائل غير المرسلة تُسجّل بحالة «تم التخطي».", "Secrets are set as server environment variables and never stored in the database. Undelivered messages are logged as “skipped”.")}</p>
      </Card>
      <div className="grid gap-6 xl:grid-cols-2">
        <Card title={t("العلامة التجارية", "Brand")}>
          <AdminForm action={saveSettings} className="grid gap-3">
            <input type="hidden" name="key" value="brand" />
            <Input name="name" label={t("الاسم", "Name")} defaultValue={s.brand.name} />
            <Input name="tagline_ar" label={t("الشعار النصي (عربي)", "Tagline (AR)")} defaultValue={s.brand.tagline_ar} />
            <Input name="tagline_en" label={t("الشعار النصي (إنجليزي)", "Tagline (EN)")} defaultValue={s.brand.tagline_en} dir="ltr" />
            <Input name="logo_url" label={t("رابط الشعار", "Logo URL")} defaultValue={s.brand.logo_url} dir="ltr" />
            <Submit className="w-fit">{t("حفظ", "Save")}</Submit>
          </AdminForm>
        </Card>
        <Card title={t("معلومات التواصل", "Contact information")}>
          <AdminForm action={saveSettings} className="grid gap-3 sm:grid-cols-2">
            <input type="hidden" name="key" value="contact" />
            <Input name="phone" label={t("الهاتف", "Phone")} defaultValue={formatIraqiPhone(s.contact.phone)} dir="ltr" />
            <Input name="whatsapp" label="WhatsApp" defaultValue={formatIraqiPhone(s.contact.whatsapp)} dir="ltr" />
            <Input name="email" label="Email" defaultValue={s.contact.email} dir="ltr" className="sm:col-span-2" />
            <Input name="address_ar" label={t("العنوان (عربي)", "Address (AR)")} defaultValue={s.contact.address_ar} />
            <Input name="address_en" label={t("العنوان (إنجليزي)", "Address (EN)")} defaultValue={s.contact.address_en} dir="ltr" />
            <Input name="hours_ar" label={t("ساعات العمل (عربي)", "Hours (AR)")} defaultValue={s.contact.hours_ar} />
            <Input name="hours_en" label={t("ساعات العمل (إنجليزي)", "Hours (EN)")} defaultValue={s.contact.hours_en} dir="ltr" />
            <Submit className="w-fit">{t("حفظ", "Save")}</Submit>
          </AdminForm>
        </Card>
        <Card title={t("التواصل الاجتماعي", "Social media")}>
          <AdminForm action={saveSettings} className="grid gap-3">
            <input type="hidden" name="key" value="social" />
            {(["instagram", "tiktok", "facebook", "snapchat"] as const).map((k) => <Input key={k} name={k} label={k} defaultValue={s.social[k]} dir="ltr" placeholder="https://" />)}
            <Submit className="w-fit">{t("حفظ", "Save")}</Submit>
          </AdminForm>
        </Card>
        <Card title={t("الطلب والعملة واللغة", "Checkout, currency & language")}>
          <AdminForm action={saveSettings} className="grid gap-3">
            <input type="hidden" name="key" value="checkout" />
            <Input name="min_order_total" type="number" min={0} step={250} label={t("الحد الأدنى للطلب (د.ع)", "Minimum order (IQD)")} defaultValue={s.checkout.min_order_total} />
            <Checkbox name="allow_guest_checkout" label={t("السماح بالطلب بدون حساب", "Allow guest checkout")} defaultChecked={s.checkout.allow_guest_checkout} />
            <p className="text-xs text-mute">{t("العملة: الدينار العراقي (IQD) — كل المبالغ أعداد صحيحة.", "Currency: Iraqi dinar (IQD) — all amounts are whole numbers.")}</p>
            <Submit className="w-fit">{t("حفظ", "Save")}</Submit>
          </AdminForm>
          <AdminForm action={saveSettings} className="mt-5 grid gap-3 border-t border-line pt-5">
            <input type="hidden" name="key" value="languages" />
            <Select name="default" label={t("اللغة الافتراضية للزوار الجدد", "Default language for new visitors")} defaultValue={s.languages.default} options={[{ value: "ar", label: "العربية" }, { value: "en", label: "English" }]} />
            <p className="text-xs text-mute">{t("ملاحظة: التوجيه الافتراضي حالياً للعربية (/ar).", "Note: the root URL currently redirects to Arabic (/ar).")}</p>
            <Submit className="w-fit" variant="outline">{t("حفظ", "Save")}</Submit>
          </AdminForm>
        </Card>
        <Card title={t("إشعارات الطلبات", "Order notifications")} className="xl:col-span-2">
          <AdminForm action={saveSettings} className="grid gap-3 sm:grid-cols-2">
            <input type="hidden" name="key" value="notifications" />
            <Input name="admin_email" label={t("بريد الإدارة", "Admin email")} defaultValue={s.notifications.admin_email} dir="ltr" />
            <Input name="admin_whatsapp" label={t("واتساب الإدارة", "Admin WhatsApp")} defaultValue={formatIraqiPhone(s.notifications.admin_whatsapp)} dir="ltr" />
            <Checkbox name="customer_email" label={t("إشعار العميل بالبريد", "Email customers")} defaultChecked={s.notifications.customer_email} />
            <Checkbox name="customer_whatsapp" label={t("إشعار العميل بواتساب", "WhatsApp customers")} defaultChecked={s.notifications.customer_whatsapp} />
            <Checkbox name="admin_new_order" label={t("تنبيه الإدارة بالطلبات الجديدة", "Alert admins on new orders")} defaultChecked={s.notifications.admin_new_order} />
            <Checkbox name="admin_low_stock" label={t("تنبيه المخزون المنخفض", "Low-stock alerts")} defaultChecked={s.notifications.admin_low_stock} />
            <Checkbox name="admin_bulk_request" label={t("تنبيه طلبات الجملة", "Bulk request alerts")} defaultChecked={s.notifications.admin_bulk_request} />
            <Submit className="w-fit sm:col-span-2">{t("حفظ", "Save")}</Submit>
          </AdminForm>
        </Card>
      </div>
      <Card title={t("رسوم التوصيل حسب المحافظة", "Delivery fees by governorate")}>
        <div className="mb-2 hidden grid-cols-[1.2fr_1fr_1fr_.6fr_.6fr_1fr_.5fr_.5fr_auto] gap-2 text-xs font-semibold text-mute lg:grid">
          <span>{t("المحافظة", "Governorate")}</span><span>{t("عادي", "Standard")}</span><span>{t("سريع (فارغ = غير متاح)", "Express (empty = n/a)")}</span><span>{t("أيام من", "Days min")}</span><span>{t("إلى", "max")}</span><span>{t("مجاني فوق", "Free over")}</span><span>{t("استلام", "Pickup")}</span><span>{t("فعال", "On")}</span><span />
        </div>
        <div className="space-y-2">
          {((zones as DeliveryZone[]) ?? []).map((z) => (
            <AdminForm key={z.id} action={saveDeliveryZone} className="grid grid-cols-2 items-center gap-2 border-b border-line pb-2 lg:grid-cols-[1.2fr_1fr_1fr_.6fr_.6fr_1fr_.5fr_.5fr_auto] lg:border-0 lg:pb-0">
              <input type="hidden" name="id" value={z.id} />
              <span className="col-span-2 text-sm font-semibold lg:col-span-1">{locale === "ar" ? z.name_ar : z.name_en}</span>
              <input name="standard_fee" type="number" min={0} step={250} defaultValue={z.standard_fee} className="field h-9 px-2 text-sm" aria-label="standard" />
              <input name="express_fee" type="number" min={0} step={250} defaultValue={z.express_fee ?? ""} className="field h-9 px-2 text-sm" aria-label="express" />
              <input name="estimated_days_min" type="number" min={0} defaultValue={z.estimated_days_min} className="field h-9 px-2 text-sm" aria-label="min days" />
              <input name="estimated_days_max" type="number" min={0} defaultValue={z.estimated_days_max} className="field h-9 px-2 text-sm" aria-label="max days" />
              <input name="free_shipping_threshold" type="number" min={0} step={1000} defaultValue={z.free_shipping_threshold ?? ""} className="field h-9 px-2 text-sm" aria-label="free over" />
              <input type="checkbox" name="pickup_available" defaultChecked={z.pickup_available} className="size-4 accent-ink" aria-label="pickup" />
              <input type="checkbox" name="is_active" defaultChecked={z.is_active} className="size-4 accent-ink" aria-label="active" />
              <Submit variant="outline" className="h-9">✓</Submit>
            </AdminForm>
          ))}
        </div>
      </Card>
      <Card title={t("صفحات المعلومات", "Information pages")}>
        <div className="space-y-3">
          {PAGE_SLUGS.map((slug) => {
            const p = { ...DEFAULT_PAGES[slug], ...(pageOverrides[slug] ?? {}) };
            return (
              <details key={slug} className="border border-line">
                <summary className="cursor-pointer px-4 py-3 text-sm font-semibold">{locale === "ar" ? p.title_ar : p.title_en} <span className="text-xs font-normal text-mute" dir="ltr">/pages/{slug}</span></summary>
                <AdminForm action={savePageContent} className="grid gap-3 border-t border-line p-4 sm:grid-cols-2">
                  <input type="hidden" name="slug" value={slug} />
                  <Input name="title_ar" label={t("العنوان (عربي)", "Title (AR)")} defaultValue={p.title_ar} />
                  <Input name="title_en" label={t("العنوان (إنجليزي)", "Title (EN)")} defaultValue={p.title_en} dir="ltr" />
                  <Textarea name="body_ar" label={t("المحتوى (عربي)", "Content (AR)")} defaultValue={p.body_ar} rows={10} />
                  <Textarea name="body_en" label={t("المحتوى (إنجليزي)", "Content (EN)")} defaultValue={p.body_en} rows={10} dir="ltr" />
                  <Submit className="w-fit">{t("حفظ", "Save")}</Submit>
                </AdminForm>
              </details>
            );
          })}
        </div>
      </Card>
    </div>
  );
}
