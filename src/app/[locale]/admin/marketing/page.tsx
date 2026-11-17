import { notFound } from "next/navigation";
import { Download } from "lucide-react";
import { isLocale } from "@/lib/i18n/config";
import { adminT } from "@/lib/admin-i18n";
import { createClient } from "@/lib/supabase/server";
import { PageHeader, Card, Pill, Empty } from "@/components/admin/ui";
import { AdminForm, Input, Select, Checkbox, Submit, Textarea } from "@/components/admin/form";
import { MediaUrlInput } from "@/components/admin/media-upload";
import { saveBanner, deleteBanner, saveCampaign, deleteCampaign, removeSubscriber } from "@/lib/actions/admin/marketing";
import { formatDate, toBaghdadInput } from "@/lib/format";
import type { PromoBanner } from "@/lib/types";

export default async function AdminMarketing({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const t = adminT(locale);
  const supabase = await createClient();
  const [{ data: banners }, { data: campaigns }, { data: subs, count }, { data: collections }, { data: codes }] = await Promise.all([
    supabase.from("promo_banners").select("*").order("placement").order("sort_order"),
    supabase.from("campaigns").select("*").order("created_at", { ascending: false }),
    supabase.from("newsletter_subscribers").select("*", { count: "exact" }).eq("is_active", true).order("created_at", { ascending: false }).limit(50),
    supabase.from("collections").select("id, name_ar, name_en"),
    supabase.from("discount_codes").select("id, code"),
  ]);
  const placements = [{ value: "announcement", label: t("شريط الإعلانات", "Announcement bar") }, { value: "hero", label: t("الواجهة الرئيسية (Hero)", "Homepage hero") }, { value: "promo", label: t("بانر ترويجي", "Promo banner") }];
  const bannerFields = (b?: PromoBanner) => (
    <div className="grid gap-3 sm:grid-cols-4">
      {b && <input type="hidden" name="id" value={b.id} />}
      <Select name="placement" label={t("المكان", "Placement")} defaultValue={b?.placement ?? "announcement"} options={placements} />
      <Input name="title_ar" label={t("العنوان (عربي)", "Title (AR)")} defaultValue={b?.title_ar ?? ""} className="sm:col-span-3" />
      <Input name="title_en" label={t("العنوان (إنجليزي)", "Title (EN)")} defaultValue={b?.title_en ?? ""} className="sm:col-span-4" dir="ltr" />
      <Textarea name="subtitle_ar" label={t("نص فرعي (عربي)", "Subtitle (AR)")} defaultValue={b?.subtitle_ar ?? ""} rows={2} className="sm:col-span-2" />
      <Textarea name="subtitle_en" label={t("نص فرعي (إنجليزي)", "Subtitle (EN)")} defaultValue={b?.subtitle_en ?? ""} rows={2} className="sm:col-span-2" />
      <Input name="cta_label_ar" label={t("زر (عربي)", "Button (AR)")} defaultValue={b?.cta_label_ar ?? ""} />
      <Input name="cta_label_en" label={t("زر (إنجليزي)", "Button (EN)")} defaultValue={b?.cta_label_en ?? ""} />
      <Input name="link" label={t("الرابط", "Link")} defaultValue={b?.link ?? ""} dir="ltr" placeholder="/shop?new=1" className="sm:col-span-2" />
      <div className="sm:col-span-2"><MediaUrlInput name="image_url" label={t("الصورة", "Image")} defaultValue={b?.image_url} /></div>
      <Input name="starts_at" type="datetime-local" label={t("يبدأ", "Starts")} defaultValue={toBaghdadInput(b?.starts_at)} />
      <Input name="ends_at" type="datetime-local" label={t("ينتهي", "Ends")} defaultValue={toBaghdadInput(b?.ends_at)} />
      <Input name="sort_order" type="number" label={t("الترتيب", "Order")} defaultValue={b?.sort_order ?? 0} />
      <Checkbox name="is_active" label={t("فعال", "Active")} defaultChecked={b?.is_active ?? true} className="self-end pb-2" />
    </div>
  );
  return (
    <div className="space-y-8">
      <PageHeader title={t("البانرات والحملات", "Banners & campaigns")} />
      <Card title={t("البانرات والإعلانات", "Banners & announcements")}>
        <div className="space-y-3">
          {((banners as PromoBanner[]) ?? []).map((b) => (
            <details key={b.id} className="border border-line">
              <summary className="flex cursor-pointer flex-wrap items-center gap-2 px-4 py-3 text-sm"><Pill tone="dark">{placements.find((p) => p.value === b.placement)?.label}</Pill><span className="font-semibold">{locale === "ar" ? b.title_ar : b.title_en}</span>{!b.is_active && <Pill>{t("متوقف", "Off")}</Pill>}</summary>
              <div className="border-t border-line p-4">
                <AdminForm action={saveBanner} className="space-y-3">{bannerFields(b)}<Submit>{t("حفظ", "Save")}</Submit></AdminForm>
                <AdminForm action={deleteBanner} className="mt-3"><input type="hidden" name="id" value={b.id} /><button className="text-xs text-danger underline">{t("حذف", "Delete")}</button></AdminForm>
              </div>
            </details>
          ))}
          <AdminForm action={saveBanner} resetOnSuccess className="space-y-3 bg-bone p-4"><p className="text-sm font-semibold">{t("بانر جديد", "New banner")}</p>{bannerFields()}<Submit>{t("إضافة", "Add")}</Submit></AdminForm>
        </div>
      </Card>

      <Card title={t("الحملات (تجمع مجموعة + كود + بانر بجدول زمني واحد)", "Campaigns (schedule a collection + code + banner together)")}>
        <div className="space-y-3">
          {(campaigns ?? []).map((c) => (
            <div key={c.id} className="flex flex-wrap items-center justify-between gap-3 border border-line px-4 py-3 text-sm">
              <div><b>{c.name}</b> {c.is_active ? <Pill tone="good">{t("فعالة", "Active")}</Pill> : <Pill>{t("متوقفة", "Off")}</Pill>}<p className="text-xs text-mute">{c.starts_at ? formatDate(c.starts_at, locale, true) : "—"} → {c.ends_at ? formatDate(c.ends_at, locale, true) : "∞"}</p></div>
              <AdminForm action={deleteCampaign}><input type="hidden" name="id" value={c.id} /><button className="text-xs text-danger underline">{t("حذف", "Delete")}</button></AdminForm>
            </div>
          ))}
          <AdminForm action={saveCampaign} resetOnSuccess className="grid gap-3 bg-bone p-4 sm:grid-cols-3">
            <Input name="name" label={t("اسم الحملة", "Campaign name")} required />
            <Select name="collection_id" label={t("المجموعة المميزة", "Featured collection")} options={[{ value: "", label: "—" }, ...(collections ?? []).map((c) => ({ value: c.id, label: locale === "ar" ? c.name_ar : c.name_en }))]} />
            <Select name="discount_code_id" label={t("كود الخصم", "Discount code")} options={[{ value: "", label: "—" }, ...(codes ?? []).map((c) => ({ value: c.id, label: c.code }))]} />
            <Select name="banner_id" label={t("البانر", "Banner")} options={[{ value: "", label: "—" }, ...((banners as PromoBanner[]) ?? []).map((b) => ({ value: b.id, label: `${b.placement}: ${(locale === "ar" ? b.title_ar : b.title_en) ?? ""}`.slice(0, 60) }))]} />
            <Input name="starts_at" type="datetime-local" label={t("يبدأ", "Starts")} />
            <Input name="ends_at" type="datetime-local" label={t("ينتهي", "Ends")} />
            <Textarea name="description" label={t("الوصف", "Description")} rows={2} className="sm:col-span-2" />
            <Checkbox name="is_active" label={t("فعالة", "Active")} defaultChecked className="self-end" />
            <Submit className="sm:col-span-3 sm:w-fit">{t("إنشاء الحملة", "Create campaign")}</Submit>
          </AdminForm>
        </div>
      </Card>

      <Card title={`${t("مشتركو النشرة البريدية", "Newsletter subscribers")} (${count ?? 0})`} actions={<a href="/api/admin/newsletter" className="btn btn-outline btn-sm"><Download className="size-4" /> CSV</a>}>
        {!subs?.length ? <Empty>—</Empty> : (
          <table className="table-admin"><tbody>
            {subs.map((s) => (
              <tr key={s.id}><td dir="ltr">{s.email}</td><td>{s.locale}</td><td className="text-xs text-mute">{formatDate(s.created_at, locale)}</td><td><AdminForm action={removeSubscriber}><input type="hidden" name="id" value={s.id} /><button className="text-xs text-danger underline">{t("إلغاء الاشتراك", "Unsubscribe")}</button></AdminForm></td></tr>
            ))}
          </tbody></table>
        )}
      </Card>
    </div>
  );
}
