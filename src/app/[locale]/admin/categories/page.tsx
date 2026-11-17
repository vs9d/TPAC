import { notFound } from "next/navigation";
import { isLocale } from "@/lib/i18n/config";
import { adminT } from "@/lib/admin-i18n";
import { createClient } from "@/lib/supabase/server";
import { PageHeader, Card } from "@/components/admin/ui";
import { AdminForm, Input, Textarea, Select, Checkbox, Submit } from "@/components/admin/form";
import { saveCategory, deleteCategory, saveCollection, deleteCollection } from "@/lib/actions/admin/catalog";
import type { Category, Collection } from "@/lib/types";
import { toBaghdadInput } from "@/lib/format";

export default async function AdminCategories({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const t = adminT(locale);
  const supabase = await createClient();
  const [{ data: cats }, { data: cols }] = await Promise.all([supabase.from("categories").select("*").order("sort_order"), supabase.from("collections").select("*").order("sort_order")]);
  const categories = (cats as Category[]) ?? [];
  const collections = (cols as Collection[]) ?? [];
  const catFields = (c?: Category) => (
    <>
      {c && <input type="hidden" name="id" value={c.id} />}
      <div className="grid gap-3 sm:grid-cols-3">
        <Input name="name_ar" label={t("الاسم (عربي)", "Name (AR)")} defaultValue={c?.name_ar} required />
        <Input name="name_en" label={t("الاسم (إنجليزي)", "Name (EN)")} defaultValue={c?.name_en} required />
        <Input name="slug" label="Slug" defaultValue={c?.slug} required dir="ltr" />
        <Input name="image_url" label={t("رابط الصورة", "Image URL")} defaultValue={c?.image_url ?? ""} dir="ltr" className="sm:col-span-2" />
        <Select name="parent_id" label={t("الفئة الأم", "Parent")} defaultValue={c?.parent_id ?? ""} options={[{ value: "", label: "—" }, ...categories.filter((x) => x.id !== c?.id).map((x) => ({ value: x.id, label: locale === "ar" ? x.name_ar : x.name_en }))]} />
        <Textarea name="description_ar" label={t("الوصف (عربي)", "Description (AR)")} defaultValue={c?.description_ar ?? ""} rows={2} />
        <Textarea name="description_en" label={t("الوصف (إنجليزي)", "Description (EN)")} defaultValue={c?.description_en ?? ""} rows={2} />
        <div className="space-y-2">
          <Input name="sort_order" type="number" label={t("الترتيب", "Order")} defaultValue={c?.sort_order ?? 0} />
          <Checkbox name="is_active" label={t("ظاهرة", "Active")} defaultChecked={c?.is_active ?? true} />
        </div>
      </div>
    </>
  );
  const colFields = (c?: Collection) => (
    <>
      {c && <input type="hidden" name="id" value={c.id} />}
      <div className="grid gap-3 sm:grid-cols-3">
        <Input name="name_ar" label={t("الاسم (عربي)", "Name (AR)")} defaultValue={c?.name_ar} required />
        <Input name="name_en" label={t("الاسم (إنجليزي)", "Name (EN)")} defaultValue={c?.name_en} required />
        <Input name="slug" label="Slug" defaultValue={c?.slug} required dir="ltr" />
        <Input name="image_url" label={t("رابط الصورة", "Image URL")} defaultValue={c?.image_url ?? ""} dir="ltr" className="sm:col-span-3" />
        <Textarea name="description_ar" label={t("الوصف (عربي)", "Description (AR)")} defaultValue={c?.description_ar ?? ""} rows={2} />
        <Textarea name="description_en" label={t("الوصف (إنجليزي)", "Description (EN)")} defaultValue={c?.description_en ?? ""} rows={2} />
        <div className="space-y-2">
          <Input name="sort_order" type="number" label={t("الترتيب", "Order")} defaultValue={c?.sort_order ?? 0} />
          <Checkbox name="is_active" label={t("ظاهرة", "Active")} defaultChecked={c?.is_active ?? true} />
          <Checkbox name="is_featured" label={t("مميزة", "Featured")} defaultChecked={c?.is_featured} />
        </div>
        <Input name="featured_from" type="datetime-local" label={t("تمييز من (جدولة)", "Feature from (schedule)")} defaultValue={toBaghdadInput(c?.featured_from)} />
        <Input name="featured_until" type="datetime-local" label={t("تمييز حتى", "Feature until")} defaultValue={toBaghdadInput(c?.featured_until)} />
      </div>
    </>
  );
  return (
    <div className="space-y-8">
      <PageHeader title={t("الفئات والمجموعات", "Categories & collections")} />
      <Card title={t("الفئات", "Categories")}>
        <div className="space-y-4">
          {categories.map((c) => (
            <details key={c.id} className="border border-line">
              <summary className="flex cursor-pointer items-center justify-between px-4 py-3 text-sm font-semibold">{locale === "ar" ? c.name_ar : c.name_en} <span className="text-xs font-normal text-mute" dir="ltr">/{c.slug}</span></summary>
              <div className="border-t border-line p-4">
                <AdminForm action={saveCategory} className="space-y-3">{catFields(c)}<Submit>{t("حفظ", "Save")}</Submit></AdminForm>
                <AdminForm action={deleteCategory} className="mt-3"><input type="hidden" name="id" value={c.id} /><button className="text-xs text-danger underline">{t("حذف الفئة", "Delete category")}</button></AdminForm>
              </div>
            </details>
          ))}
          <AdminForm action={saveCategory} resetOnSuccess className="space-y-3 bg-bone p-4"><p className="text-sm font-semibold">{t("فئة جديدة", "New category")}</p>{catFields()}<Submit>{t("إضافة", "Add")}</Submit></AdminForm>
        </div>
      </Card>
      <Card title={t("المجموعات (موسمية، محدودة، مختارة)", "Collections (seasonal, limited, featured)")}>
        <div className="space-y-4">
          {collections.map((c) => (
            <details key={c.id} className="border border-line">
              <summary className="flex cursor-pointer items-center justify-between px-4 py-3 text-sm font-semibold">{locale === "ar" ? c.name_ar : c.name_en} {c.is_featured && "★"} <span className="text-xs font-normal text-mute" dir="ltr">/{c.slug}</span></summary>
              <div className="border-t border-line p-4">
                <AdminForm action={saveCollection} className="space-y-3">{colFields(c)}<Submit>{t("حفظ", "Save")}</Submit></AdminForm>
                <AdminForm action={deleteCollection} className="mt-3"><input type="hidden" name="id" value={c.id} /><button className="text-xs text-danger underline">{t("حذف المجموعة", "Delete collection")}</button></AdminForm>
              </div>
            </details>
          ))}
          <AdminForm action={saveCollection} resetOnSuccess className="space-y-3 bg-bone p-4"><p className="text-sm font-semibold">{t("مجموعة جديدة", "New collection")}</p>{colFields()}<Submit>{t("إضافة", "Add")}</Submit></AdminForm>
        </div>
      </Card>
    </div>
  );
}
