"use client";
import { useI18n } from "@/components/i18n-provider";
import { adminT } from "@/lib/admin-i18n";
import { AdminForm, Input, Textarea, Select, Checkbox, Submit, Field } from "./form";
import { saveProduct } from "@/lib/actions/admin/products";
import type { Category, Collection, Product } from "@/lib/types";

export function ProductForm({ product, categories, collections, selectedCollections }: { product?: Product; categories: Category[]; collections: Collection[]; selectedCollections: string[] }) {
  const { locale } = useI18n();
  const t = adminT(locale);
  return (
    <AdminForm action={saveProduct} redirectTo={product ? undefined : (id) => `/${locale}/admin/products/${id}`} className="grid gap-6 xl:grid-cols-3">
      {product && <input type="hidden" name="id" value={product.id} />}
      <div className="card-admin space-y-4 p-5 xl:col-span-2">
        <div className="grid gap-4 sm:grid-cols-2">
          <Input name="name_ar" label={t("الاسم (عربي)", "Name (Arabic)")} defaultValue={product?.name_ar} required dir="rtl" />
          <Input name="name_en" label={t("الاسم (إنجليزي)", "Name (English)")} defaultValue={product?.name_en} required dir="ltr" />
          <Input name="slug" label={t("الرابط (slug)", "URL slug")} defaultValue={product?.slug} required dir="ltr" pattern="[a-z0-9]+(-[a-z0-9]+)*" hint="baghdad-oversized-tee" />
          <Select name="category_id" label={t("الفئة", "Category")} defaultValue={product?.category_id ?? ""} options={[{ value: "", label: "—" }, ...categories.map((c) => ({ value: c.id, label: locale === "ar" ? c.name_ar : c.name_en }))]} />
          <Input name="base_price" type="number" min={0} step={250} label={t("السعر (د.ع)", "Price (IQD)")} defaultValue={product?.base_price} required />
          <Input name="compare_at_price" type="number" min={0} step={250} label={t("السعر قبل الخصم (اختياري)", "Compare-at price (optional)")} defaultValue={product?.compare_at_price ?? ""} hint={t("يظهر مشطوباً لإظهار التخفيض", "Shown struck-through as a sale")} />
        </div>
        <Textarea name="description_ar" label={t("الوصف (عربي)", "Description (Arabic)")} defaultValue={product?.description_ar ?? ""} rows={4} dir="rtl" />
        <Textarea name="description_en" label={t("الوصف (إنجليزي)", "Description (English)")} defaultValue={product?.description_en ?? ""} rows={4} dir="ltr" />
        <div className="grid gap-4 sm:grid-cols-2">
          <Textarea name="material_ar" label={t("الخامة (عربي)", "Material (Arabic)")} defaultValue={product?.material_ar ?? ""} rows={2} dir="rtl" />
          <Textarea name="material_en" label={t("الخامة (إنجليزي)", "Material (English)")} defaultValue={product?.material_en ?? ""} rows={2} dir="ltr" />
          <Textarea name="printing_ar" label={t("الطباعة (عربي)", "Printing (Arabic)")} defaultValue={product?.printing_ar ?? ""} rows={2} dir="rtl" />
          <Textarea name="printing_en" label={t("الطباعة (إنجليزي)", "Printing (English)")} defaultValue={product?.printing_en ?? ""} rows={2} dir="ltr" />
        </div>
        <details className="border-t border-line pt-4">
          <summary className="cursor-pointer text-sm font-semibold">SEO</summary>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <Input name="seo_title_ar" label="SEO title (AR)" defaultValue={product?.seo_title_ar ?? ""} maxLength={120} />
            <Input name="seo_title_en" label="SEO title (EN)" defaultValue={product?.seo_title_en ?? ""} maxLength={120} />
            <Textarea name="seo_description_ar" label="Meta description (AR)" defaultValue={product?.seo_description_ar ?? ""} maxLength={300} rows={2} />
            <Textarea name="seo_description_en" label="Meta description (EN)" defaultValue={product?.seo_description_en ?? ""} maxLength={300} rows={2} />
          </div>
        </details>
      </div>
      <div className="space-y-6">
        <div className="card-admin space-y-3 p-5">
          <p className="text-sm font-semibold">{t("الظهور", "Visibility")}</p>
          <Checkbox name="is_published" label={t("منشور في المتجر", "Published")} defaultChecked={product?.is_published} />
          <Checkbox name="is_featured" label={t("مميز", "Featured")} defaultChecked={product?.is_featured} />
          <Checkbox name="is_new_arrival" label={t("وصل حديثاً", "New arrival")} defaultChecked={product?.is_new_arrival} />
          <Checkbox name="is_limited" label={t("إصدار محدود", "Limited edition")} defaultChecked={product?.is_limited} />
          <Checkbox name="is_customizable" label={t("قابل للتخصيص (رابط لأداة التصميم)", "Customisable (links to designer)")} defaultChecked={product?.is_customizable} />
        </div>
        <div className="card-admin space-y-3 p-5">
          <Field name="collection_ids" label={t("المجموعات", "Collections")}>
            <div className="space-y-2">
              {collections.map((c) => (
                <label key={c.id} className="flex items-center gap-2.5 text-sm"><input type="checkbox" name="collection_ids" value={c.id} defaultChecked={selectedCollections.includes(c.id)} className="size-4 accent-ink" /> {locale === "ar" ? c.name_ar : c.name_en}</label>
              ))}
            </div>
          </Field>
          <Input name="tags" label={t("الوسوم (مفصولة بفواصل)", "Tags (comma separated)")} defaultValue={product?.tags.join(", ")} />
        </div>
        <Submit className="w-full">{product ? t("حفظ التغييرات", "Save changes") : t("إنشاء المنتج", "Create product")}</Submit>
      </div>
    </AdminForm>
  );
}
