import { notFound } from "next/navigation";
import { isLocale } from "@/lib/i18n/config";
import { adminT } from "@/lib/admin-i18n";
import { createAdminClient } from "@/lib/supabase/admin";
import { PageHeader, Card } from "@/components/admin/ui";
import { AdminForm, Checkbox, Input, Select, Submit, Textarea } from "@/components/admin/form";
import { CreatorsTabs } from "@/components/admin/creators-tabs";
import { broadcastToCreators, saveCreatorSettings, saveCreatorTypeOptions } from "@/lib/actions/admin/creators";
import { getCreatorSettings } from "@/lib/creators";
import { creatorQueueCounts } from "@/lib/data/creators-admin";
import { formatIQD } from "@/lib/format";

export default async function AdminCreatorSettings({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const t = adminT(locale);
  const [s, { data: types }, counts] = await Promise.all([
    getCreatorSettings(),
    createAdminClient().from("product_types").select("id, name_ar, name_en, default_price, creator_base_price, is_active, creator_enabled, creator_max_markup, creator_commission_mode, creator_commission_value").order("sort_order"),
    creatorQueueCounts().catch(() => undefined),
  ]);
  const today = new Date().toISOString().slice(0, 10);
  const monthStart = today.slice(0, 8) + "01";
  type T = { id: string; name_ar: string; name_en: string; default_price: number; creator_base_price: number | null; is_active: boolean; creator_enabled: boolean; creator_max_markup: number | null; creator_commission_mode: string | null; creator_commission_value: number | null };
  return (
    <div className="space-y-6">
      <PageHeader title={t("إعدادات TPAC Creators", "TPAC Creators settings")} subtitle={t("سعر الأساس لكل قطعة هو «السعر الافتراضي» بأنواع المنتجات. ربح المبدع يُحفظ مع كل بيعة، فتغيير النسب ما يغيّر الأرباح السابقة.", "The garment base price is the product type's default price. Each sale stores the rule it used, so changes never rewrite past earnings.")} />
      <CreatorsTabs locale={locale} active="settings" counts={counts} />
      <div className="grid gap-6 xl:grid-cols-2">
        <Card title={t("الأرباح والسحب", "Earnings and payouts")}>
          <AdminForm action={saveCreatorSettings} className="space-y-3">
            <div className="grid gap-3 sm:grid-cols-2">
              <Select name="commission_mode" label={t("طريقة ربح المبدع (عامة)", "Creator earning (platform)")} defaultValue={s.commission_mode} options={[{ value: "percent", label: t("نسبة % من إضافة المبدع", "% of the creator's markup") }, { value: "fixed", label: t("مبلغ ثابت لكل قطعة", "Fixed per piece") }]} />
              <Input name="commission_value" type="number" min={0} label={t("القيمة (% أو د.ع)", "Value (% or IQD)")} defaultValue={s.commission_value} />
              <Input name="max_markup" type="number" min={0} step={250} label={t("أعلى إضافة يحددها المبدع (د.ع) — 0 = بدون حد", "Max creator markup (IQD) — 0 = no limit")} defaultValue={s.max_markup} />
              <Input name="min_withdrawal" type="number" min={0} step={250} label={t("الحد الأدنى للسحب (د.ع)", "Minimum withdrawal (IQD)")} defaultValue={s.min_withdrawal} />
              <Input name="hold_days" type="number" min={0} max={90} label={t("فترة الإرجاع بعد التوصيل (أيام)", "Return window after delivery (days)")} defaultValue={s.hold_days} />
            </div>
            <Textarea name="payout_methods" label={t("طرق السحب (وحدة بكل سطر)", "Payout methods (one per line)")} defaultValue={s.payout_methods.join("\n")} rows={3} />
            <Checkbox name="review_required" label={t("كل تصميم لازم ينراجع قبل النشر", "Every design is reviewed before publishing")} defaultChecked={s.review_required} />
            <Submit>{t("حفظ", "Save")}</Submit>
          </AdminForm>
        </Card>
        <Card title={t("التقارير المالية", "Financial reports")}>
          <form action="/api/admin/creators/earnings" method="get" className="space-y-3">
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="block text-sm"><span className="mb-1 block font-semibold">{t("من", "From")}</span><input type="date" name="from" defaultValue={monthStart} className="field w-full" /></label>
              <label className="block text-sm"><span className="mb-1 block font-semibold">{t("إلى", "To")}</span><input type="date" name="to" defaultValue={today} className="field w-full" /></label>
            </div>
            <button type="submit" className="btn btn-outline btn-sm">{t("تنزيل CSV للأرباح", "Download earnings CSV")}</button>
          </form>
          <form action="/api/admin/creators/earnings" method="get" className="mt-3"><input type="hidden" name="kind" value="withdrawals" /><button type="submit" className="btn btn-outline btn-sm">{t("تنزيل CSV للسحوبات", "Download withdrawals CSV")}</button></form>
        </Card>
        <Card title={t("القطع المتاحة للمبدعين", "Garments open to creators")}>
          <p className="mb-3 text-xs text-mute">{t("الصور ومناطق الطباعة والألوان والمقاسات من «أنواع المنتجات والطباعة». هنا تفتحها للمبدعين وتحدد سعرها للمبدعين وسقف الإضافة ونسبة خاصة لكل قطعة.", "Photos, print areas, colours and sizes come from “Product types & printing”. Open them to creators here, with their price for creators, a markup cap and an optional commission per garment.")}</p>
          <div className="space-y-3">
            {((types ?? []) as T[]).map((ty) => (
              <AdminForm key={ty.id} action={saveCreatorTypeOptions} className="space-y-2 rounded-2xl border border-line p-3">
                <input type="hidden" name="id" value={ty.id} />
                <div className="flex flex-wrap items-center justify-between gap-2"><b>{locale === "ar" ? ty.name_ar : ty.name_en}</b><span className="text-xs text-mute">{t("سعره بالمتجر", "Store price")} {formatIQD(ty.default_price, locale)}{!ty.is_active ? ` · ${t("غير مفعّل", "inactive")}` : ""}</span></div>
                <Checkbox name="creator_enabled" label={t("متاح للمبدعين", "Open to creators")} defaultChecked={ty.creator_enabled} />
                <Input name="creator_base_price" type="number" min={0} step={250} label={t("سعر القطعة للمبدعين (د.ع) — فارغ = سعره بالمتجر", "Price for creators (IQD) — empty = store price")} defaultValue={ty.creator_base_price ?? ""} placeholder={String(ty.default_price)} hint={t(`المبدع يبدي من ${formatIQD(ty.creator_base_price ?? ty.default_price, locale)} ويضيف ربحه فوقه. تغييره يحدّث أسعار تصاميم المبدعين على هالقطعة.`, `Creators start from ${formatIQD(ty.creator_base_price ?? ty.default_price, locale)} and add their markup. Changing it reprices creators' designs on this garment.`)} />
                <div className="grid gap-2 sm:grid-cols-3">
                  <Input name="max_markup" type="number" min={0} step={250} label={t("سقف الإضافة (فارغ = العام، 0 = بدون إضافة)", "Markup cap (empty = platform, 0 = none)")} defaultValue={ty.creator_max_markup ?? ""} />
                  <Select name="mode" label={t("نسبة خاصة", "Own commission")} defaultValue={ty.creator_commission_mode ?? ""} options={[{ value: "", label: t("العامة", "Platform") }, { value: "percent", label: "%" }, { value: "fixed", label: t("ثابت", "Fixed") }]} />
                  <Input name="value" type="number" min={0} label={t("القيمة", "Value")} defaultValue={ty.creator_commission_value ?? ""} />
                </div>
                <Submit variant="outline">{t("حفظ", "Save")}</Submit>
              </AdminForm>
            ))}
          </div>
        </Card>
        <Card title={t("إشعار لكل المبدعين", "Message all creators")}>
          <AdminForm action={broadcastToCreators} className="space-y-3" resetOnSuccess>
            <Input name="title" label={t("العنوان", "Title")} required />
            <Textarea name="body" label={t("الرسالة", "Message")} rows={3} />
            <Submit>{t("إرسال", "Send")}</Submit>
          </AdminForm>
        </Card>
      </div>
    </div>
  );
}
