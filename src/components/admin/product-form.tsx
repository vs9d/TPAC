"use client";
import { useRef, useState } from "react";
import { Copy, Wand2 } from "lucide-react";
import { useI18n } from "@/components/i18n-provider";
import { adminT } from "@/lib/admin-i18n";
import { AdminForm, Input, Textarea, Select, Checkbox, Submit, Field } from "./form";
import { ImagePicker } from "./image-picker";
import { saveProduct } from "@/lib/actions/admin/products";
import { slugify, TEXT_PRESETS } from "@/lib/product-tools";
import { toast } from "@/components/ui/toast";
import type { Category, Collection, Color, Product, Size } from "@/lib/types";

const setValue = (id: string, v: string) => {
  const el = document.getElementById(id) as HTMLInputElement | HTMLTextAreaElement | null;
  if (el) el.value = v;
};

export function ProductForm({ product, categories, collections, selectedCollections, sizes = [], colors = [] }: { product?: Product; categories: Category[]; collections: Collection[]; selectedCollections: string[]; sizes?: Size[]; colors?: Color[] }) {
  const { locale } = useI18n();
  const t = adminT(locale);
  const creating = !product;
  const [newId, setNewId] = useState(() => crypto.randomUUID());
  const [pickerKey, setPickerKey] = useState(0);
  const slugTouched = useRef(false);

  const applyPreset = (kind: "material" | "printing", key: string) => {
    const p = TEXT_PRESETS[kind].find((x) => x.key === key);
    if (!p) return;
    setValue(`${kind}_ar`, p.ar);
    setValue(`${kind}_en`, p.en);
  };

  /** After "create & add similar": keep price/category/sizes/colours/texts, clear what must be unique. */
  const startSimilar = () => {
    slugTouched.current = false;
    setNewId(crypto.randomUUID());
    setPickerKey((k) => k + 1);
    // wait until the form keeper has restored the typed values, then clear what must be unique
    setTimeout(() => {
      for (const id of ["name_ar", "name_en", "slug", "seo_title_ar", "seo_title_en"]) setValue(id, "");
      document.getElementById("name_ar")?.scrollIntoView({ behavior: "smooth", block: "center" });
      document.getElementById("name_ar")?.focus();
    }, 60);
    toast.success(t("تم الحفظ — أضف المنتج الشبيه. السعر والفئة والمقاسات محفوظة.", "Saved — add the similar one. Price, category and sizes are kept."));
  };

  return (
    <AdminForm
      id="product-form"
      action={saveProduct}
      redirectTo={creating ? `/${locale}/admin/products/{id}` : undefined}
      successMessage={creating ? t("تم إنشاء المنتج", "Product created") : undefined}
      onSuccess={(s) => {
        if (creating && s.extra === "another") {
          startSimilar();
          return "handled";
        }
      }}
      className="grid gap-6 xl:grid-cols-3"
    >
      {product && <input type="hidden" name="id" value={product.id} />}
      {creating && <input type="hidden" name="new_id" value={newId} />}
      <div className="space-y-6 xl:col-span-2">
        <div className="card-admin space-y-4 p-5">
          <div className="grid gap-4 sm:grid-cols-2">
            <Input name="name_ar" label={t("الاسم (عربي)", "Name (Arabic)")} defaultValue={product?.name_ar} required dir="rtl" autoFocus={creating} />
            <Input
              name="name_en"
              label={t("الاسم (إنجليزي)", "Name (English)")}
              defaultValue={product?.name_en}
              required
              dir="ltr"
              onChange={(e) => { if (creating && !slugTouched.current) setValue("slug", slugify(e.target.value)); }}
            />
            <Input name="slug" label={t("الرابط (slug)", "URL slug")} defaultValue={product?.slug} required dir="ltr" pattern="[a-z0-9]+(-[a-z0-9]+)*" hint={creating ? t("يُكتب تلقائياً من الاسم الإنجليزي", "Filled automatically from the English name") : undefined} onChange={() => { slugTouched.current = true; }} />
            <Select name="category_id" label={t("الفئة", "Category")} defaultValue={product?.category_id ?? ""} options={[{ value: "", label: "—" }, ...categories.map((c) => ({ value: c.id, label: locale === "ar" ? c.name_ar : c.name_en }))]} />
            <Input name="base_price" type="number" min={0} step={250} inputMode="numeric" label={t("السعر (د.ع)", "Price (IQD)")} defaultValue={product?.base_price} required />
            <Input name="compare_at_price" type="number" min={0} step={250} inputMode="numeric" label={t("السعر قبل الخصم (اختياري)", "Compare-at price (optional)")} defaultValue={product?.compare_at_price ?? ""} hint={t("يظهر مشطوباً لإظهار التخفيض", "Shown struck-through as a sale")} />
          </div>
          <Textarea name="description_ar" label={t("الوصف (عربي)", "Description (Arabic)")} defaultValue={product?.description_ar ?? ""} rows={3} dir="rtl" />
          <Textarea name="description_en" label={t("الوصف (إنجليزي)", "Description (English)")} defaultValue={product?.description_en ?? ""} rows={3} dir="ltr" />

          <div className="rounded-2xl bg-bone p-4">
            <p className="mb-2 flex items-center gap-2 text-sm font-semibold"><Wand2 className="size-4 text-pine" /> {t("نصوص جاهزة (اضغط لتعبئة الخامة والطباعة)", "Ready-made texts (tap to fill fabric & printing)")}</p>
            <div className="flex flex-wrap gap-2">
              {TEXT_PRESETS.material.map((p) => <button type="button" key={p.key} onClick={() => applyPreset("material", p.key)} className="chip h-9 text-xs">{locale === "ar" ? p.label_ar : p.label_en}</button>)}
              {TEXT_PRESETS.printing.map((p) => <button type="button" key={p.key} onClick={() => applyPreset("printing", p.key)} className="chip h-9 border-dashed text-xs">{locale === "ar" ? p.label_ar : p.label_en}</button>)}
            </div>
          </div>
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

        {creating && (
          <>
            <div className="card-admin space-y-4 p-5">
              <h2 className="text-sm font-semibold">{t("الصور", "Photos")}</h2>
              <ImagePicker key={pickerKey} productId={newId} colors={colors} />
            </div>
            <div className="card-admin space-y-4 p-5">
              <div>
                <h2 className="text-sm font-semibold">{t("المقاسات والألوان والكمية", "Sizes, colours & stock")}</h2>
                <p className="mt-1 text-xs text-mute">{t("اختر المقاسات والألوان وسننشئ كل التوليفات مع الكمية الابتدائية لكل واحدة. تعدّل لاحقاً من جدول المخزون.", "Pick sizes and colours; every combination is created with the starting stock. Fine-tune later in the stock grid.")}</p>
              </div>
              <Field label={t("المقاسات", "Sizes")}>
                <div className="flex flex-wrap gap-2">
                  {sizes.map((s) => (
                    <label key={s.code} className="chip cursor-pointer has-[:checked]:border-pine has-[:checked]:bg-pine has-[:checked]:text-white dark:has-[:checked]:text-night">
                      <input type="checkbox" name="qs_sizes" value={s.code} defaultChecked={["S", "M", "L", "XL", "XXL"].includes(s.code)} className="sr-only" /> {s.code}
                    </label>
                  ))}
                </div>
              </Field>
              <Field label={t("الألوان", "Colours")}>
                <div className="flex flex-wrap gap-2">
                  {colors.map((c) => (
                    <label key={c.id} className="chip cursor-pointer gap-2 has-[:checked]:border-pine has-[:checked]:bg-pine-soft">
                      <input type="checkbox" name="qs_colors" value={c.id} className="peer sr-only" />
                      <span className="size-4 rounded-full border border-ink/25" style={{ background: c.hex }} /> {locale === "ar" ? c.name_ar : c.name_en}
                    </label>
                  ))}
                </div>
              </Field>
              <Input name="qs_stock" type="number" min={0} max={100000} inputMode="numeric" defaultValue={10} label={t("الكمية لكل مقاس ولون", "Stock per size & colour")} className="max-w-[12rem]" />
            </div>
          </>
        )}
      </div>

      <div className="space-y-6">
        <div className="card-admin space-y-3 p-5">
          <p className="text-sm font-semibold">{t("الظهور", "Visibility")}</p>
          <Checkbox name="is_published" label={t("منشور في المتجر", "Published")} defaultChecked={product?.is_published ?? creating} />
          <Checkbox name="is_featured" label={t("مميز", "Featured")} defaultChecked={product?.is_featured} />
          <Checkbox name="is_new_arrival" label={t("وصل حديثاً", "New arrival")} defaultChecked={product?.is_new_arrival ?? creating} />
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
        <div className="sticky bottom-3 z-10 space-y-2 rounded-2xl border border-line bg-paper/95 p-3 backdrop-blur xl:static xl:border-0 xl:bg-transparent xl:p-0">
          <Submit className="w-full" variant="brand" name="after" value="open">{creating ? t("إنشاء المنتج", "Create product") : t("حفظ التغييرات", "Save changes")}</Submit>
          {creating && (
            <Submit className="w-full" variant="outline" name="after" value="another"><Copy className="size-4" /> {t("إنشاء وإضافة منتج شبيه", "Create & add a similar one")}</Submit>
          )}
        </div>
      </div>
    </AdminForm>
  );
}
