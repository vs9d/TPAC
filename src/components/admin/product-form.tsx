"use client";
import { useEffect, useRef, useState } from "react";
import { ChevronDown, Copy, Loader2, SlidersHorizontal, Wand2 } from "lucide-react";
import { useI18n } from "@/components/i18n-provider";
import { adminT } from "@/lib/admin-i18n";
import { AdminForm, Input, Textarea, Select, Checkbox, Submit, Field } from "./form";
import { ImagePicker } from "./image-picker";
import { saveProduct } from "@/lib/actions/admin/products";
import { slugify, TEXT_PRESETS } from "@/lib/product-tools";
import { toast } from "@/components/ui/toast";
import type { Category, Collection, Color, Product, Size } from "@/lib/types";
import type { ProductTypeRow } from "@/lib/print-config";
import { ProductStudio, type StudioHandle } from "./printing/product-studio";

const setValue = (id: string, v: string) => {
  const el = document.getElementById(id) as HTMLInputElement | HTMLTextAreaElement | null;
  if (el) el.value = v;
};

/**
 * Simple by default: name, price, category, photos and (when creating) sizes / colours / stock.
 * Everything else — English name, slug, descriptions, fabric & printing texts, flags, collections,
 * tags, SEO — lives in one collapsed "More options" block and has sensible automatic defaults.
 */
export function ProductForm({ product, categories, collections, selectedCollections, sizes = [], colors = [], printType }: { product?: Product; categories: Category[]; collections: Collection[]; selectedCollections: string[]; sizes?: Size[]; colors?: Color[]; printType?: ProductTypeRow | null }) {
  const { locale } = useI18n();
  const t = adminT(locale);
  const creating = !product;
  const [newId, setNewId] = useState(() => crypto.randomUUID());
  const [pickerKey, setPickerKey] = useState(0);
  const slugTouched = useRef(false);
  const studio = useRef<StudioHandle>(null);
  const ready = useRef(false);
  const [generating, setGenerating] = useState<string | null>(null);
  const [checkedColors, setCheckedColors] = useState<string[]>(printType?.default_color_ids ?? []);

  // With a printing template, the product photos are rendered from the mockup + artwork BEFORE the form is sent:
  // the native submit is held, the photos are uploaded, then the same submit is replayed for the server action.
  useEffect(() => {
    if (!creating || !printType) return;
    const form = document.getElementById("product-form") as HTMLFormElement | null;
    if (!form) return;
    const onSubmit = async (e: SubmitEvent) => {
      if (ready.current) {
        ready.current = false;
        return;
      }
      e.preventDefault();
      e.stopPropagation();
      const submitter = e.submitter as HTMLButtonElement | null;
      const s = studio.current;
      if (!s) return;
      const set = (name: string, value: string) => {
        const el = form.querySelector<HTMLInputElement>(`input[name="${name}"]`);
        if (el) el.value = value;
      };
      try {
        const designs = s.designs();
        const colorIds = Array.from(form.querySelectorAll<HTMLInputElement>("input[name=qs_colors]:checked")).map((i) => i.value);
        setGenerating(t("جارِ تجهيز صور المنتج…", "Preparing product photos…"));
        const images = designs.length && s.printEnabled() ? await s.generate(newId, colorIds, (d, n) => setGenerating(t(`جارِ تجهيز صور المنتج ${d}/${n}…`, `Preparing product photos ${d}/${n}…`))) : [];
        set("designs_json", JSON.stringify(designs.map(({ id: _i, ...d }) => { void _i; return d; })));
        set("generated_json", JSON.stringify(images));
        set("print_enabled", s.printEnabled() ? "1" : "0");
        form.querySelectorAll("input[name=disabled_print_area_ids]").forEach((n) => n.remove());
        for (const id of s.disabledAreas()) {
          const h = document.createElement("input");
          h.type = "hidden";
          h.name = "disabled_print_area_ids";
          h.value = id;
          form.appendChild(h);
        }
        ready.current = true;
        form.requestSubmit(submitter ?? undefined);
      } catch (err) {
        console.error(err);
        toast.error(t("تعذّر تجهيز صور المنتج — تأكد من الإنترنت وحاول مجدداً", "Couldn't prepare the product photos — check the connection and try again"));
      } finally {
        setGenerating(null);
      }
    };
    form.addEventListener("submit", onSubmit);
    return () => form.removeEventListener("submit", onSubmit);
  }, [creating, printType, newId, t]);

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
    // clear what must be unique — now, and again whenever the form keeper restores the typed values
    // (React resets the form after the action; on a slow device that can land after this callback)
    const clear = () => {
      for (const id of ["name_ar", "name_en", "slug", "seo_title_ar", "seo_title_en"]) setValue(id, "");
    };
    const form = document.getElementById("product-form");
    clear();
    form?.addEventListener("formkeeper:restored", clear, { once: true });
    setTimeout(() => form?.removeEventListener("formkeeper:restored", clear), 800);
    setTimeout(() => {
      clear();
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
      className="mx-auto max-w-3xl space-y-5"
    >
      {product && <input type="hidden" name="id" value={product.id} />}
      {creating && <input type="hidden" name="new_id" value={newId} />}

      {/* 1 — the essentials */}
      <div className="card-admin space-y-4 p-5">
        <Input name="name_ar" label={t("اسم المنتج", "Product name")} defaultValue={product?.name_ar} required dir="rtl" autoFocus={creating} />
        <div className="grid gap-4 sm:grid-cols-2">
          <Input name="base_price" type="number" min={0} step={250} inputMode="numeric" label={t("السعر (د.ع)", "Price (IQD)")} defaultValue={product?.base_price ?? (printType?.default_price || undefined)} required />
          <Select name="category_id" label={t("الفئة", "Category")} defaultValue={product?.category_id ?? printType?.category_id ?? ""} options={[{ value: "", label: "—" }, ...categories.map((c) => ({ value: c.id, label: locale === "ar" ? c.name_ar : c.name_en }))]} />
        </div>
      </div>

      {creating && printType && (
        <div className="card-admin relative space-y-3 p-5">
          <input type="hidden" name="product_type_id" value={printType.id} />
          <input type="hidden" name="designs_json" defaultValue="[]" />
          <input type="hidden" name="generated_json" defaultValue="[]" />
          <input type="hidden" name="print_enabled" defaultValue="1" />
          <div>
            <h2 className="text-sm font-semibold">{t("التصميم على القطعة", "Design on the product")} — {locale === "ar" ? printType.name_ar : printType.name_en}</h2>
            <p className="mt-1 text-xs text-mute">{t("ارفع تصميم المنتج الرسمي وضعه داخل منطقة الطباعة. صور المنتج تُصنع تلقائياً لكل لون تختاره.", "Upload the official artwork and place it inside the print area. Product photos are generated automatically for every colour you pick.")}</p>
          </div>
          <ProductStudio key={newId} ref={studio} type={printType} colors={colors} productId={newId} previewColorIds={checkedColors} />
          {generating && <div className="absolute inset-0 z-20 grid place-items-center rounded-[inherit] bg-paper/80"><p className="flex items-center gap-2 text-sm font-semibold"><Loader2 className="size-4 animate-spin" /> {generating}</p></div>}
        </div>
      )}

      {creating && (
        <>
          <div className="card-admin space-y-3 p-5">
            <h2 className="text-sm font-semibold">{printType ? t("صور إضافية (اختياري)", "Extra photos (optional)") : t("الصور", "Photos")}</h2>
            <ImagePicker key={pickerKey} productId={newId} colors={colors} />
          </div>
          <div className="card-admin space-y-4 p-5">
            <div>
              <h2 className="text-sm font-semibold">{t("المقاسات والألوان والكمية", "Sizes, colours & stock")}</h2>
              <p className="mt-1 text-xs text-mute">{t("نُنشئ كل التوليفات تلقائياً. تعدّل الكميات لاحقاً من جدول المخزون.", "Every combination is created automatically. Fine-tune quantities later in the stock grid.")}</p>
            </div>
            <Field label={t("المقاسات", "Sizes")}>
              <div className="flex flex-wrap gap-2">
                {sizes.map((s) => (
                  <label key={s.code} className="chip cursor-pointer has-[:checked]:border-pine has-[:checked]:bg-pine has-[:checked]:text-white dark:has-[:checked]:text-night">
                    <input type="checkbox" name="qs_sizes" value={s.code} defaultChecked={(printType?.default_sizes.length ? printType.default_sizes : ["S", "M", "L", "XL", "XXL"]).includes(s.code)} className="sr-only" /> {s.code}
                  </label>
                ))}
              </div>
            </Field>
            <Field label={t("الألوان", "Colours")}>
              <div className="flex flex-wrap gap-2">
                {colors.map((c) => (
                  <label key={c.id} className="chip cursor-pointer gap-2 has-[:checked]:border-pine has-[:checked]:bg-pine-soft">
                    <input type="checkbox" name="qs_colors" value={c.id} defaultChecked={printType?.default_color_ids.includes(c.id)} onChange={(e) => setCheckedColors((l) => (e.target.checked ? [...l, c.id] : l.filter((x) => x !== c.id)))} className="peer sr-only" />
                    <span className="size-4 rounded-full border border-ink/25" style={{ background: c.hex }} /> {locale === "ar" ? c.name_ar : c.name_en}
                  </label>
                ))}
              </div>
            </Field>
            <Input name="qs_stock" type="number" min={0} max={100000} inputMode="numeric" defaultValue={10} label={t("الكمية لكل مقاس ولون", "Stock per size & colour")} className="max-w-[12rem]" />
          </div>
        </>
      )}

      {/* 2 — everything else, tucked away */}
      <details className="card-admin group p-5">
        <summary className="flex cursor-pointer list-none items-center justify-between gap-3 text-sm font-semibold [&::-webkit-details-marker]:hidden">
          <span className="flex items-center gap-2"><SlidersHorizontal className="size-4 text-pine" /> {t("خيارات إضافية", "More options")} <span className="text-xs font-normal text-mute">{t("(اختيارية — كلها لها قيم تلقائية)", "(optional — all have automatic defaults)")}</span></span>
          <ChevronDown className="size-4 transition-transform group-open:rotate-180" />
        </summary>
        <div className="mt-5 space-y-5">
          <div className="grid gap-4 sm:grid-cols-2">
            <Input
              name="name_en"
              label={t("الاسم الإنجليزي", "English name")}
              defaultValue={product?.name_en}
              dir="ltr"
              hint={t("إن تُرك فارغاً يُستخدم الاسم العربي", "Falls back to the Arabic name")}
              onChange={(e) => { if (creating && !slugTouched.current) setValue("slug", slugify(e.target.value)); }}
            />
            <Input name="compare_at_price" type="number" min={0} step={250} inputMode="numeric" label={t("السعر قبل الخصم", "Compare-at price")} defaultValue={product?.compare_at_price ?? ""} hint={t("يظهر مشطوباً لإظهار التخفيض", "Shown struck-through as a sale")} />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <Textarea name="description_ar" label={t("الوصف (عربي)", "Description (Arabic)")} defaultValue={product?.description_ar ?? ""} rows={3} dir="rtl" />
            <Textarea name="description_en" label={t("الوصف (إنجليزي)", "Description (English)")} defaultValue={product?.description_en ?? ""} rows={3} dir="ltr" />
          </div>

          <div className="rounded-2xl bg-bone p-4">
            <p className="mb-2 flex items-center gap-2 text-sm font-semibold"><Wand2 className="size-4 text-pine" /> {t("نصوص جاهزة للخامة والطباعة", "Ready-made fabric & printing texts")}</p>
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

          <div className="grid gap-3 sm:grid-cols-2">
            <Checkbox name="is_featured" label={t("مميز", "Featured")} defaultChecked={product?.is_featured} />
            <Checkbox name="is_new_arrival" label={t("وصل حديثاً", "New arrival")} defaultChecked={product?.is_new_arrival ?? creating} />
            <Checkbox name="is_limited" label={t("إصدار محدود", "Limited edition")} defaultChecked={product?.is_limited} />
            <Checkbox name="is_customizable" label={t("قابل للتخصيص (رابط لأداة التصميم)", "Customisable (links to designer)")} defaultChecked={product?.is_customizable} />
          </div>

          {collections.length > 0 && (
            <Field name="collection_ids" label={t("المجموعات", "Collections")}>
              <div className="flex flex-wrap gap-x-5 gap-y-2">
                {collections.map((c) => (
                  <label key={c.id} className="flex items-center gap-2.5 text-sm"><input type="checkbox" name="collection_ids" value={c.id} defaultChecked={selectedCollections.includes(c.id)} className="size-4 accent-ink" /> {locale === "ar" ? c.name_ar : c.name_en}</label>
                ))}
              </div>
            </Field>
          )}
          <div className="grid gap-4 sm:grid-cols-2">
            <Input name="slug" label={t("الرابط (slug)", "URL slug")} defaultValue={product?.slug} dir="ltr" pattern="[a-z0-9]+(-[a-z0-9]+)*" hint={creating ? t("يُكتب تلقائياً", "Filled automatically") : undefined} onChange={() => { slugTouched.current = true; }} />
            <Input name="tags" label={t("الوسوم (مفصولة بفواصل)", "Tags (comma separated)")} defaultValue={product?.tags.join(", ")} />
          </div>
          <div className="grid gap-4 border-t border-line pt-4 sm:grid-cols-2">
            <Input name="seo_title_ar" label="SEO title (AR)" defaultValue={product?.seo_title_ar ?? ""} maxLength={120} />
            <Input name="seo_title_en" label="SEO title (EN)" defaultValue={product?.seo_title_en ?? ""} maxLength={120} />
            <Textarea name="seo_description_ar" label="Meta description (AR)" defaultValue={product?.seo_description_ar ?? ""} maxLength={300} rows={2} />
            <Textarea name="seo_description_en" label="Meta description (EN)" defaultValue={product?.seo_description_en ?? ""} maxLength={300} rows={2} />
          </div>
        </div>
      </details>

      {/* 3 — publish + save */}
      <div className="sticky bottom-3 z-10 space-y-3 rounded-2xl border border-line bg-paper/95 p-4 shadow-lg backdrop-blur">
        <Checkbox name="is_published" label={t("نشر المنتج في المتجر", "Publish to the store")} defaultChecked={product?.is_published ?? creating} />
        <div className="grid gap-2 sm:grid-cols-2">
          <Submit className="w-full" variant="brand" name="after" value="open">{creating ? t("إنشاء المنتج", "Create product") : t("حفظ التغييرات", "Save changes")}</Submit>
          {creating && (
            <Submit className="w-full" variant="outline" name="after" value="another"><Copy className="size-4" /> {t("إنشاء وإضافة منتج شبيه", "Create & add a similar one")}</Submit>
          )}
        </div>
      </div>
    </AdminForm>
  );
}
