import { notFound } from "next/navigation";
import { isLocale } from "@/lib/i18n/config";
import { adminT } from "@/lib/admin-i18n";
import { createClient } from "@/lib/supabase/server";
import { PageHeader, Pill } from "@/components/admin/ui";
import { AdminForm, Input, Textarea, Checkbox, Submit } from "@/components/admin/form";
import { MediaUrlInput } from "@/components/admin/media-upload";
import { saveHomepageSection } from "@/lib/actions/admin/marketing";
import type { HomepageSection } from "@/lib/types";

const NAMES: Record<string, [string, string, string]> = {
  hero: ["الواجهة (Hero)", "Hero", "النص والصورة تُدار من «البانرات» (المكان: Hero)."],
  categories: ["تسوّق حسب الفئة", "Shop by category", ""],
  new_arrivals: ["وصل حديثاً", "New arrivals", 'data: {"limit": 8}'],
  featured_collection: ["مجموعة مختارة", "Featured collection", 'data: {"collection_slug": "baghdad-nights"} — أو جدولة مجموعة مميزة من صفحة المجموعات/الحملات'],
  best_sellers: ["الأكثر مبيعاً", "Best sellers", ""],
  custom_design: ["التصميم الخاص", "Custom design", ""],
  bulk: ["الجامعات والشركات", "University & bulk", ""],
  story: ["قصة العلامة", "Brand story", ""],
  social: ["إنستغرام", "Instagram", 'data: {"handle": "thetpac", "images": ["https://..."]}'],
  newsletter: ["النشرة البريدية", "Newsletter", ""],
};

export default async function AdminHomepage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const t = adminT(locale);
  const supabase = await createClient();
  const { data } = await supabase.from("homepage_sections").select("*").order("sort_order");
  const sections = (data as HomepageSection[]) ?? [];
  return (
    <div className="space-y-4">
      <PageHeader title={t("أقسام الصفحة الرئيسية", "Homepage sections")} subtitle={t("رتّب الأقسام، أخفِها، وعدّل نصوصها وصورها. الحقول الفارغة تستخدم النص الافتراضي.", "Reorder, hide and edit each section. Empty fields fall back to default copy.")} />
      {sections.map((s) => (
        <details key={s.key} className="card-admin">
          <summary className="flex cursor-pointer items-center gap-3 px-5 py-3 text-sm"><span className="w-6 text-mute tabular-nums">{s.sort_order}</span><b>{NAMES[s.key]?.[locale === "ar" ? 0 : 1] ?? s.key}</b>{!s.is_visible && <Pill>{t("مخفي", "Hidden")}</Pill>}</summary>
          <AdminForm action={saveHomepageSection} className="grid gap-3 border-t border-line p-5 sm:grid-cols-2">
            <input type="hidden" name="key" value={s.key} />
            {NAMES[s.key]?.[2] && <p className="text-xs text-mute sm:col-span-2" dir="auto">{NAMES[s.key]![2]}</p>}
            <Input name="title_ar" label={t("العنوان (عربي)", "Title (AR)")} defaultValue={s.title_ar ?? ""} />
            <Input name="title_en" label={t("العنوان (إنجليزي)", "Title (EN)")} defaultValue={s.title_en ?? ""} dir="ltr" />
            <Input name="subtitle_ar" label={t("نص فرعي (عربي)", "Subtitle (AR)")} defaultValue={s.subtitle_ar ?? ""} />
            <Input name="subtitle_en" label={t("نص فرعي (إنجليزي)", "Subtitle (EN)")} defaultValue={s.subtitle_en ?? ""} dir="ltr" />
            <Textarea name="body_ar" label={t("النص (عربي)", "Body (AR)")} defaultValue={s.body_ar ?? ""} rows={3} />
            <Textarea name="body_en" label={t("النص (إنجليزي)", "Body (EN)")} defaultValue={s.body_en ?? ""} rows={3} dir="ltr" />
            <Input name="cta_label_ar" label={t("نص الزر (عربي)", "Button (AR)")} defaultValue={s.cta_label_ar ?? ""} />
            <Input name="cta_label_en" label={t("نص الزر (إنجليزي)", "Button (EN)")} defaultValue={s.cta_label_en ?? ""} dir="ltr" />
            <Input name="cta_href" label={t("رابط الزر", "Button link")} defaultValue={s.cta_href ?? ""} dir="ltr" />
            <MediaUrlInput name="image_url" label={t("الصورة", "Image")} defaultValue={s.image_url} />
            <Textarea name="data" label={t("إعدادات إضافية (JSON)", "Extra settings (JSON)")} defaultValue={JSON.stringify(s.data ?? {})} rows={2} dir="ltr" className="sm:col-span-2" />
            <Input name="sort_order" type="number" label={t("الترتيب", "Order")} defaultValue={s.sort_order} />
            <Checkbox name="is_visible" label={t("ظاهر", "Visible")} defaultChecked={s.is_visible} className="self-end pb-2" />
            <Submit className="sm:w-fit">{t("حفظ", "Save")}</Submit>
          </AdminForm>
        </details>
      ))}
    </div>
  );
}
