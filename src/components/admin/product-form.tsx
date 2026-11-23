"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ArrowRight, ChevronDown, Copy, Loader2, Wand2 } from "lucide-react";
import { useI18n } from "@/components/i18n-provider";
import { adminT } from "@/lib/admin-i18n";
import { AdminForm, Input, Textarea, Select, Checkbox, Submit, Field } from "./form";
import { ImagePicker } from "./image-picker";
import { saveProduct } from "@/lib/actions/admin/products";
import { DESCRIPTION_PRESETS, slugify, TEXT_PRESETS } from "@/lib/product-tools";
import { toast } from "@/components/ui/toast";
import type { Category, Collection, Color, Product, Size } from "@/lib/types";
import type { ProductTypeRow } from "@/lib/print-config";
import { ProductStudio, type StudioHandle } from "./printing/product-studio";
import { GarmentLinksDraft } from "./printing/garment-links";

const setValue = (id: string, v: string) => {
  const el = document.getElementById(id) as HTMLInputElement | HTMLTextAreaElement | null;
  if (el) el.value = v;
};

/**
 * Simple by default: name, price, category, photos and (when creating) sizes / colours / stock.
 * Everything else — English name, slug, descriptions, fabric & printing texts, flags, collections,
 * tags, SEO — lives in one collapsed "More options" block and has sensible automatic defaults.
 */
export function ProductForm({ product, categories, collections, selectedCollections, sizes = [], colors = [], printType, otherTypes = [] }: { product?: Product; categories: Category[]; collections: Collection[]; selectedCollections: string[]; sizes?: Size[]; colors?: Color[]; printType?: ProductTypeRow | null; otherTypes?: ProductTypeRow[] }) {
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

  const L = (ar: string, en: string) => t(ar, en);
  const card = "card-admin space-y-4 p-5";
  const title = (s: string) => <h2 className="text-sm font-bold">{s}</h2>;

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
      className="grid gap-5 xl:grid-cols-3 xl:items-start"
    >
      {product && <input type="hidden" name="id" value={product.id} />}
      {creating && <input type="hidden" name="new_id" value={newId} />}

      {/* contextual save bar (like Shopify): always reachable at the top */}
      <div className="sticky top-2 z-30 flex items-center justify-between gap-3 rounded-2xl bg-night px-3 py-2.5 text-snow shadow-lg sm:px-4 sm:py-3 xl:col-span-3">
        <div className="flex min-w-0 items-center gap-3">
          <Link href={`/${locale}/admin/products`} className="grid size-9 shrink-0 place-items-center rounded-full hover:bg-snow/10" aria-label={L("رجوع للمنتجات", "Back to products")}><ArrowRight className="size-4 ltr:rotate-180" /></Link>
          <p className="truncate text-sm font-semibold">{creating ? L("منتج جديد — غير محفوظ", "New product — not saved") : L("تعديل المنتج", "Editing product")}{printType ? ` · ${locale === "ar" ? printType.name_ar : printType.name_en}` : ""}</p>
        </div>
        <div className="flex shrink-0 gap-2">
          <Link href={`/${locale}/admin/products`} className="btn btn-sm hidden border border-snow/25 text-snow hover:bg-snow/10 sm:inline-flex">{L("تجاهل", "Discard")}</Link>
          {creating && <Submit className="!border-snow/25 !bg-transparent !text-snow hover:!bg-snow/10" variant="outline" name="after" value="another"><Copy className="size-4" /> <span className="sr-only sm:not-sr-only">{L("إنشاء وإضافة منتج شبيه", "Create & add a similar one")}</span></Submit>}
          <Submit variant="brand" name="after" value="open">{creating ? L("إنشاء المنتج", "Create product") : L("حفظ التغييرات", "Save changes")}</Submit>
        </div>
      </div>

      {/* ------------------------------------------------ main column */}
      <div className="space-y-5 xl:col-span-2">
        <div className={card}>
          <Input name="name_ar" label={L("العنوان", "Title")} defaultValue={product?.name_ar} required dir="rtl" autoFocus={creating} placeholder={L("مثال: هودي بغداد أوفرسايز", "e.g. Baghdad oversized hoodie")} />
          <Input
            name="name_en"
            label={L("العنوان بالإنجليزي", "English title")}
            defaultValue={product?.name_en}
            dir="ltr"
            hint={L("اختياري — يُستخدم العربي إذا تُرك فارغاً، ومنه يُكتب الرابط", "Optional — falls back to the Arabic title; the URL is made from it")}
            onChange={(e) => { if (creating && !slugTouched.current) setValue("slug", slugify(e.target.value)); }}
          />
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-semibold text-mute">{L("وصف مقترح:", "Suggested description:")}</span>
            {[...DESCRIPTION_PRESETS].sort((a, b) => Number((b.types as readonly string[]).includes(printType?.code ?? "")) - Number((a.types as readonly string[]).includes(printType?.code ?? ""))).map((p) => (
              <button
                type="button"
                key={p.key}
                onClick={() => {
                  const cur = (document.getElementById("description_ar") as HTMLTextAreaElement | null)?.value.trim();
                  if (cur && cur !== p.ar && !confirm(L("يستبدل الوصف الحالي؟", "Replace the current description?"))) return;
                  setValue("description_ar", p.ar);
                  setValue("description_en", p.en);
                }}
                className={(p.types as readonly string[]).includes(printType?.code ?? "") ? "chip h-9 border-pine text-xs font-bold" : "chip h-9 text-xs"}
              >
                {locale === "ar" ? p.label_ar : p.label_en}
              </button>
            ))}
          </div>
          <Textarea name="description_ar" label={L("الوصف", "Description")} defaultValue={product?.description_ar ?? ""} rows={8} dir="rtl" placeholder={L("القماش، القَصّة، الطباعة، ونصيحة المقاس…", "Fabric, fit, print, sizing tip…")} />
          <Textarea name="description_en" label={L("الوصف بالإنجليزي", "English description")} defaultValue={product?.description_en ?? ""} rows={3} dir="ltr" />
        </div>

        {creating && printType && (
          <div className={`${card} relative`}>
            <input type="hidden" name="product_type_id" value={printType.id} />
            <input type="hidden" name="designs_json" defaultValue="[]" />
            <input type="hidden" name="generated_json" defaultValue="[]" />
            <input type="hidden" name="print_enabled" defaultValue="1" />
            <div>
              {title(`${L("التصميم على القطعة", "Design on the product")} — ${locale === "ar" ? printType.name_ar : printType.name_en}`)}
              <p className="mt-1 text-xs text-mute">{L("ارفع تصميم المنتج الرسمي وضعه داخل منطقة الطباعة. صور المنتج تُصنع تلقائياً لكل لون تختاره.", "Upload the official artwork and place it inside the print area. Product photos are generated automatically for every colour you pick.")}</p>
            </div>
            <ProductStudio key={newId} ref={studio} type={printType} colors={colors} productId={newId} previewColorIds={checkedColors} />
            {generating && <div className="absolute inset-0 z-20 grid place-items-center rounded-[inherit] bg-paper/80"><p className="flex items-center gap-2 text-sm font-semibold"><Loader2 className="size-4 animate-spin" /> {generating}</p></div>}
          </div>
        )}

        {creating && printType && otherTypes.some((x) => x.id !== printType.id) && (
          <div className={card}>
            {title(L("نفس التصميم على قطعة ثانية", "Same design on another garment"))}
            <GarmentLinksDraft productId={newId} types={otherTypes} currentTypeId={printType.id} />
          </div>
        )}

        {creating && (
          <div className={card}>
            {title(printType ? L("صور إضافية (اختياري)", "Extra photos (optional)") : L("الصور", "Media"))}
            <ImagePicker key={pickerKey} productId={newId} colors={colors} />
          </div>
        )}

        <div className={card}>
          {title(L("التسعير", "Pricing"))}
          <div className="grid gap-4 sm:grid-cols-2">
            <Input name="base_price" type="number" min={0} step={250} inputMode="numeric" label={L("السعر (د.ع)", "Price (IQD)")} defaultValue={product?.base_price ?? (printType?.default_price || undefined)} required />
            <Input name="compare_at_price" type="number" min={0} step={250} inputMode="numeric" label={L("السعر قبل الخصم", "Compare-at price")} defaultValue={product?.compare_at_price ?? ""} hint={L("يظهر مشطوباً لإظهار التخفيض", "Shown struck-through as a sale")} />
          </div>
        </div>

        {creating && (
          <div className={card}>
            <div>
              {title(L("المقاسات والألوان والمخزون", "Variants & inventory"))}
              <p className="mt-1 text-xs text-mute">{L("نُنشئ كل التوليفات تلقائياً. تعدّل الكميات لاحقاً من جدول المخزون.", "Every combination is created automatically. Fine-tune quantities later in the stock grid.")}</p>
            </div>
            <Field label={L("المقاسات", "Sizes")}>
              <div className="flex flex-wrap gap-2">
                {sizes.map((s) => (
                  <label key={s.code} className="chip cursor-pointer has-[:checked]:border-pine has-[:checked]:bg-pine has-[:checked]:text-white dark:has-[:checked]:text-night">
                    <input type="checkbox" name="qs_sizes" value={s.code} defaultChecked={(printType?.default_sizes.length ? printType.default_sizes : ["S", "M", "L", "XL", "XXL"]).includes(s.code)} className="sr-only" /> {s.code}
                  </label>
                ))}
              </div>
            </Field>
            <Field label={L("الألوان", "Colours")}>
              <div className="flex flex-wrap gap-2">
                {colors.map((c) => (
                  <label key={c.id} className="chip cursor-pointer gap-2 has-[:checked]:border-pine has-[:checked]:bg-pine-soft">
                    <input type="checkbox" name="qs_colors" value={c.id} defaultChecked={printType?.default_color_ids.includes(c.id)} onChange={(e) => setCheckedColors((l) => (e.target.checked ? [...l, c.id] : l.filter((x) => x !== c.id)))} className="peer sr-only" />
                    <span className="size-4 rounded-full border border-ink/25" style={{ background: c.hex }} /> {locale === "ar" ? c.name_ar : c.name_en}
                  </label>
                ))}
              </div>
            </Field>
            <Input name="qs_stock" type="number" min={0} max={100000} inputMode="numeric" defaultValue={10} label={L("الكمية لكل مقاس ولون", "Stock per size & colour")} className="max-w-[12rem]" />
          </div>
        )}

        <details className="card-admin group p-5" open={!!(product?.material_ar || product?.printing_ar)}>
          <summary className="flex cursor-pointer list-none items-center justify-between gap-3 text-sm font-bold [&::-webkit-details-marker]:hidden">
            <span className="flex items-center gap-2"><Wand2 className="size-4 text-pine" /> {L("الخامة والطباعة", "Fabric & printing")} <span className="text-xs font-normal text-mute">{L("(اختياري)", "(optional)")}</span></span>
            <ChevronDown className="size-4 transition-transform group-open:rotate-180" />
          </summary>
          <div className="mt-4 space-y-4">
            <div className="flex flex-wrap gap-2">
              {TEXT_PRESETS.material.map((p) => <button type="button" key={p.key} onClick={() => applyPreset("material", p.key)} className="chip h-9 text-xs">{locale === "ar" ? p.label_ar : p.label_en}</button>)}
              {TEXT_PRESETS.printing.map((p) => <button type="button" key={p.key} onClick={() => applyPreset("printing", p.key)} className="chip h-9 border-dashed text-xs">{locale === "ar" ? p.label_ar : p.label_en}</button>)}
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <Textarea name="material_ar" label={L("الخامة (عربي)", "Material (Arabic)")} defaultValue={product?.material_ar ?? ""} rows={2} dir="rtl" />
              <Textarea name="material_en" label={L("الخامة (إنجليزي)", "Material (English)")} defaultValue={product?.material_en ?? ""} rows={2} dir="ltr" />
              <Textarea name="printing_ar" label={L("الطباعة (عربي)", "Printing (Arabic)")} defaultValue={product?.printing_ar ?? ""} rows={2} dir="rtl" />
              <Textarea name="printing_en" label={L("الطباعة (إنجليزي)", "Printing (English)")} defaultValue={product?.printing_en ?? ""} rows={2} dir="ltr" />
            </div>
          </div>
        </details>

        <div className={card}>
          {title(L("نتيجة البحث في جوجل", "Search engine listing"))}
          <SearchPreview locale={locale} />
          <details className="group">
            <summary className="cursor-pointer list-none text-sm font-semibold text-pine underline underline-offset-4 [&::-webkit-details-marker]:hidden">{L("تعديل الرابط والعنوان والوصف", "Edit URL, title and description")}</summary>
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <Input name="slug" label={L("الرابط (slug)", "URL handle")} defaultValue={product?.slug} dir="ltr" pattern="[a-z0-9]+(-[a-z0-9]+)*" hint={creating ? L("يُكتب تلقائياً", "Filled automatically") : undefined} onChange={() => { slugTouched.current = true; }} className="sm:col-span-2" />
              <Input name="seo_title_ar" label={L("عنوان الصفحة (عربي)", "Page title (AR)")} defaultValue={product?.seo_title_ar ?? ""} maxLength={120} />
              <Input name="seo_title_en" label={L("عنوان الصفحة (إنجليزي)", "Page title (EN)")} defaultValue={product?.seo_title_en ?? ""} maxLength={120} dir="ltr" />
              <Textarea name="seo_description_ar" label={L("الوصف في جوجل (عربي)", "Meta description (AR)")} defaultValue={product?.seo_description_ar ?? ""} maxLength={300} rows={2} />
              <Textarea name="seo_description_en" label={L("الوصف في جوجل (إنجليزي)", "Meta description (EN)")} defaultValue={product?.seo_description_en ?? ""} maxLength={300} rows={2} dir="ltr" />
            </div>
          </details>
        </div>
      </div>

      {/* ------------------------------------------------ sidebar */}
      <div className="space-y-5 xl:sticky xl:top-24">
        <div className={card}>
          {title(L("الحالة", "Status"))}
          <select id="is_published" name="is_published" defaultValue={(product?.is_published ?? creating) ? "1" : ""} className="field h-11" aria-label={L("الحالة", "Status")}>
            <option value="1">{L("نشط — ظاهر في المتجر", "Active — visible in the store")}</option>
            <option value="">{L("مسودة — مخفي", "Draft — hidden")}</option>
          </select>
        </div>

        <div className={card}>
          {title(L("تنظيم المنتج", "Product organization"))}
          <Select name="category_id" label={L("الفئة", "Category")} defaultValue={product?.category_id ?? printType?.category_id ?? ""} options={[{ value: "", label: "—" }, ...categories.map((c) => ({ value: c.id, label: locale === "ar" ? c.name_ar : c.name_en }))]} />
          <Field label={L("نوع المنتج", "Product type")}>
            <p className="field flex h-10 items-center text-sm text-mute">{printType ? (locale === "ar" ? printType.name_ar : printType.name_en) : L("مخصص (بدون قالب طباعة)", "Custom (no print template)")}</p>
          </Field>
          {collections.length > 0 && (
            <Field name="collection_ids" label={L("المجموعات", "Collections")}>
              <div className="max-h-48 space-y-2 overflow-y-auto">
                {collections.map((c) => (
                  <label key={c.id} className="flex items-center gap-2.5 text-sm"><input type="checkbox" name="collection_ids" value={c.id} defaultChecked={selectedCollections.includes(c.id)} className="size-4 accent-ink" /> {locale === "ar" ? c.name_ar : c.name_en}</label>
                ))}
              </div>
            </Field>
          )}
          <Input name="tags" label={L("الوسوم", "Tags")} defaultValue={product?.tags.join(", ")} placeholder={L("هودي، شتوي، بغداد", "hoodie, winter, baghdad")} hint={L("افصلها بفواصل", "Separate with commas")} />
        </div>

        <div className={`${card} !space-y-3`}>
          {title(L("الشارات", "Badges"))}
          <Checkbox name="is_new_arrival" label={L("وصل حديثاً", "New arrival")} defaultChecked={product?.is_new_arrival ?? creating} />
          <Checkbox name="is_featured" label={L("مميز في الرئيسية", "Featured on the homepage")} defaultChecked={product?.is_featured} />
          <Checkbox name="is_limited" label={L("إصدار محدود", "Limited edition")} defaultChecked={product?.is_limited} />
          <Checkbox name="is_customizable" label={L("قابل للتخصيص (رابط لأداة التصميم)", "Customisable (links to the designer)")} defaultChecked={product?.is_customizable} />
        </div>
      </div>
    </AdminForm>
  );
}

/** Live Google-style preview of the product's search result, read from the form fields as you type. */
function SearchPreview({ locale }: { locale: "ar" | "en" }) {
  const [v, setV] = useState({ title: "", desc: "", slug: "" });
  useEffect(() => {
    const form = document.getElementById("product-form");
    const val = (id: string) => (document.getElementById(id) as HTMLInputElement | null)?.value?.trim() ?? "";
    const read = () => setV({
      title: val("seo_title_ar") || val("name_ar"),
      desc: val("seo_description_ar") || val("description_ar"),
      slug: val("slug") || "…",
    });
    read();
    form?.addEventListener("input", read);
    return () => form?.removeEventListener("input", read);
  }, []);
  const t = adminT(locale);
  return (
    <div className="rounded-2xl border border-line bg-paper p-4" dir="rtl">
      {v.title ? (
        <>
          <p className="truncate text-xs text-mute" dir="ltr">thetpac.com › {locale} › product › {v.slug}</p>
          <p className="mt-1 truncate text-lg text-[#1a0dab] dark:text-[#8ab4f8]">{(v.title + " | TPAC").slice(0, 70)}</p>
          <p className="mt-0.5 line-clamp-2 text-sm text-mute">{v.desc ? v.desc.slice(0, 160) : t("أضف وصفاً يظهر هنا في نتائج البحث.", "Add a description to show here in search results.")}</p>
        </>
      ) : (
        <p className="text-sm text-mute">{t("اكتب عنوان المنتج لترى كيف يظهر في جوجل.", "Add a title to see how the product appears on Google.")}</p>
      )}
    </div>
  );
}
