"use client";
import { createRef, useMemo, useRef, useState, type RefObject } from "react";
import Link from "next/link";
import { CheckCircle2, ChevronDown, CircleAlert, CopyPlus, ExternalLink, Loader2, Plus, Rocket, Trash2 } from "lucide-react";
import { useI18n } from "@/components/i18n-provider";
import { adminT } from "@/lib/admin-i18n";
import { toast } from "@/components/ui/toast";
import { saveProduct } from "@/lib/actions/admin/products";
import { DESCRIPTION_PRESETS } from "@/lib/product-tools";
import { cn } from "@/lib/format";
import type { ProductTypeRow } from "@/lib/print-config";
import type { Category, Collection, Color, Size } from "@/lib/types";
import { ProductStudio, type StudioHandle } from "./printing/product-studio";

interface Item {
  key: string;
  /** the product's id (upload paths use it before the product exists) */
  id: string;
  name_ar: string;
  name_en: string;
  collections: string[];
  /** empty = the shared price */
  price: string;
  ref: RefObject<StudioHandle | null>;
  state: "idle" | "working" | "done" | "error";
  message?: string;
  slug?: string;
  open: boolean;
}

const newItem = (collections: string[] = []): Item => ({
  key: crypto.randomUUID(), id: crypto.randomUUID(), name_ar: "", name_en: "", collections, price: "", ref: createRef<StudioHandle>(), state: "idle", open: true,
});

/**
 * Several products of the same type in one go: shared settings once (price, sizes, colours, stock, category,
 * description, status), then for each product its own artwork, name and collections — and one "publish all".
 * Every product is saved by the same server action as the single product form.
 */
export function BatchCreator({ type, categories, collections, sizes, colors }: { type: ProductTypeRow; categories: Category[]; collections: Collection[]; sizes: Size[]; colors: Color[] }) {
  const { locale } = useI18n();
  const t = adminT(locale);
  const L = (a: string, e: string) => (locale === "ar" ? a : e);
  const [items, setItems] = useState<Item[]>(() => [newItem()]);
  const [price, setPrice] = useState(String(type.default_price || ""));
  const [category, setCategory] = useState(type.category_id ?? "");
  const [sizeCodes, setSizeCodes] = useState<string[]>(type.default_sizes.length ? type.default_sizes : ["S", "M", "L", "XL", "XXL"]);
  const [colorIds, setColorIds] = useState<string[]>(type.default_color_ids);
  const [stock, setStock] = useState("10");
  const preset = useMemo(() => DESCRIPTION_PRESETS.find((p) => (p.types as readonly string[]).includes(type.code)), [type.code]);
  const [descAr, setDescAr] = useState<string>(preset?.ar ?? "");
  const [descEn, setDescEn] = useState<string>(preset?.en ?? "");
  const [publish, setPublish] = useState(true);
  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState("");
  const top = useRef<HTMLDivElement>(null);

  const patch = (key: string, p: Partial<Item>) => setItems((list) => list.map((x) => (x.key === key ? { ...x, ...p } : x)));
  const toggle = (list: string[], v: string) => (list.includes(v) ? list.filter((x) => x !== v) : [...list, v]);
  const typeName = locale === "ar" ? type.name_ar : type.name_en;
  const pending = items.filter((x) => x.state !== "done");

  const publishAll = async () => {
    // check everything first, so nothing half-publishes because of a typo in the last card
    const problems: string[] = [];
    if (!(Number(price) >= 0) || price === "") problems.push(L("اكتب السعر", "Enter the price"));
    if (!colorIds.length) problems.push(L("اختار لون واحد على الأقل", "Choose at least one colour"));
    if (!sizeCodes.length) problems.push(L("اختار مقاس واحد على الأقل", "Choose at least one size"));
    pending.forEach((x, i) => {
      if (!x.name_ar.trim()) problems.push(L(`المنتج ${i + 1}: اكتب الاسم`, `Product ${i + 1}: enter the name`));
      if (!x.ref.current?.designs().length) problems.push(L(`المنتج ${i + 1}: ضيف التصميم`, `Product ${i + 1}: add the artwork`));
    });
    if (problems.length) {
      toast.error(problems.slice(0, 3).join(" · "));
      setItems((list) => list.map((x) => (x.state !== "done" && (!x.name_ar.trim() || !x.ref.current?.designs().length) ? { ...x, open: true, state: "error", message: !x.name_ar.trim() ? L("الاسم ناقص", "Name missing") : L("التصميم ناقص", "Artwork missing") } : x)));
      return;
    }
    setRunning(true);
    let ok = 0;
    for (const [n, x] of pending.entries()) {
      const label = `${n + 1}/${pending.length}`;
      patch(x.key, { state: "working", message: undefined });
      try {
        const s = x.ref.current!;
        const designs = s.designs();
        setProgress(L(`المنتج ${label}: تجهيز الصور…`, `Product ${label}: preparing photos…`));
        const images = s.printEnabled() ? await s.generate(x.id, colorIds, (d, total) => setProgress(L(`المنتج ${label}: الصور ${d}/${total}…`, `Product ${label}: photos ${d}/${total}…`))) : [];
        setProgress(L(`المنتج ${label}: الحفظ…`, `Product ${label}: saving…`));
        const fd = new FormData();
        fd.set("new_id", x.id);
        fd.set("name_ar", x.name_ar.trim());
        if (x.name_en.trim()) fd.set("name_en", x.name_en.trim());
        fd.set("base_price", x.price.trim() || price);
        fd.set("category_id", category);
        fd.set("description_ar", descAr);
        fd.set("description_en", descEn);
        if (publish) fd.set("is_published", "1");
        fd.set("is_new_arrival", "1");
        for (const c of x.collections) fd.append("collection_ids", c);
        fd.set("product_type_id", type.id);
        fd.set("designs_json", JSON.stringify(designs.map(({ id: _i, ...d }) => { void _i; return { ...d, artwork_width: Math.round(d.artwork_width), artwork_height: Math.round(d.artwork_height) }; })));
        fd.set("generated_json", JSON.stringify(images));
        fd.set("print_enabled", s.printEnabled() ? "1" : "0");
        for (const a of s.disabledAreas()) fd.append("disabled_print_area_ids", a);
        for (const z of sizeCodes) fd.append("qs_sizes", z);
        for (const c of colorIds) fd.append("qs_colors", c);
        fd.set("qs_stock", stock || "0");
        const r = await saveProduct(null, fd);
        if (!r?.ok) throw new Error(r && !r.ok ? (r.fields ? Object.keys(r.fields).join(", ") : r.error) : "save");
        patch(x.key, { state: "done", open: false, message: undefined });
        ok++;
      } catch (e) {
        console.error(e);
        patch(x.key, { state: "error", open: true, message: L("ما انحفظ — صحّح وجرّب مرة ثانية", "Not saved — fix it and try again") + (e instanceof Error && e.message ? ` (${e.message})` : "") });
      }
    }
    setRunning(false);
    setProgress("");
    if (ok === pending.length) toast.success(L(`انضافت ${ok} منتجات ${publish ? "ونُشرت" : "كمسودة"} ✅`, `${ok} products added${publish ? " and published" : " as drafts"} ✅`));
    else toast.error(L(`انضاف ${ok} من ${pending.length} — المنتجات الباقية عليها ملاحظة`, `${ok} of ${pending.length} added — see the marked products`));
    top.current?.scrollIntoView({ behavior: "smooth" });
  };

  const card = "card-admin space-y-4 p-5";
  return (
    <div ref={top} className="space-y-5 pb-28">
      <section className={card} aria-labelledby="batch-shared">
        <h2 id="batch-shared" className="text-sm font-bold">{L("إعدادات مشتركة لكل المنتجات", "Shared by every product")}</h2>
        <div className="grid gap-3 sm:grid-cols-3">
          <label className="block"><span className="label">{L("السعر (د.ع)", "Price (IQD)")}</span><input id="batch-price" type="number" min={0} step={250} inputMode="numeric" value={price} onChange={(e) => setPrice(e.target.value)} className="field" /></label>
          <label className="block"><span className="label">{L("الكمية لكل مقاس ولون", "Stock per size & colour")}</span><input id="batch-stock" type="number" min={0} inputMode="numeric" value={stock} onChange={(e) => setStock(e.target.value)} className="field" /></label>
          <label className="block"><span className="label">{L("الفئة", "Category")}</span>
            <select value={category} onChange={(e) => setCategory(e.target.value)} className="field"><option value="">—</option>{categories.map((c) => <option key={c.id} value={c.id}>{locale === "ar" ? c.name_ar : c.name_en}</option>)}</select>
          </label>
        </div>
        <div>
          <p className="label">{L("المقاسات", "Sizes")}</p>
          <div className="flex flex-wrap gap-2">
            {sizes.map((z) => <button key={z.code} type="button" aria-pressed={sizeCodes.includes(z.code)} onClick={() => setSizeCodes((l) => toggle(l, z.code))} className={cn("grid size-11 place-items-center rounded-full border text-xs font-bold", sizeCodes.includes(z.code) ? "border-pine bg-pine text-white dark:text-night" : "border-line")}>{z.code}</button>)}
          </div>
        </div>
        <div>
          <p className="label">{L("الألوان (نفسها لكل المنتجات)", "Colours (the same for every product)")}</p>
          <div className="flex flex-wrap gap-2">
            {colors.map((c) => (
              <button key={c.id} type="button" aria-pressed={colorIds.includes(c.id)} onClick={() => setColorIds((l) => toggle(l, c.id))} className={cn("flex h-10 items-center gap-2 rounded-full border px-3 text-sm", colorIds.includes(c.id) ? "border-ink bg-bone font-bold" : "border-line")}>
                <span className="size-4 rounded-full border border-ink/20" style={{ background: c.hex }} /> {locale === "ar" ? c.name_ar : c.name_en}
              </button>
            ))}
          </div>
        </div>
        <details className="rounded-2xl border border-line p-3">
          <summary className="cursor-pointer text-sm font-semibold">{L("الوصف", "Description")} {preset && <span className="text-xs font-normal text-mute">— {L("الوصف المقترح جاهز", "the suggested one is filled in")}</span>}</summary>
          <div className="mt-3 grid gap-3 md:grid-cols-2">
            <textarea aria-label={L("الوصف", "Description")} rows={8} value={descAr} onChange={(e) => setDescAr(e.target.value)} className="field" dir="rtl" />
            <textarea aria-label={L("الوصف بالإنجليزي", "English description")} rows={8} value={descEn} onChange={(e) => setDescEn(e.target.value)} className="field" dir="ltr" />
          </div>
        </details>
        <label className="flex items-center gap-3 text-sm font-semibold">
          <input type="checkbox" className="size-5 accent-[var(--color-pine)]" checked={publish} onChange={(e) => setPublish(e.target.checked)} /> {L("انشرها بالمتجر مباشرة (إذا تشيل الصح تنحفظ مسودة)", "Publish in the store right away (untick to save as drafts)")}
        </label>
      </section>

      {items.map((x, i) => (
        <section key={x.key} className={cn("card-admin overflow-hidden", x.state === "error" && "border-danger", x.state === "done" && "border-pine")} aria-label={`${L("المنتج", "Product")} ${i + 1}`}>
          <header className="flex flex-wrap items-center gap-3 px-5 py-3">
            <button type="button" onClick={() => patch(x.key, { open: !x.open })} className="flex min-w-0 flex-1 items-center gap-2 text-start" aria-expanded={x.open}>
              <ChevronDown className={cn("size-4 shrink-0 transition", !x.open && "-rotate-90 rtl:rotate-90")} />
              <span className="grid size-7 shrink-0 place-items-center rounded-full bg-ink text-xs font-bold text-paper">{i + 1}</span>
              <span className="truncate font-bold">{x.name_ar || `${typeName} ${i + 1}`}</span>
            </button>
            {x.state === "working" && <Loader2 className="size-4 animate-spin text-pine" />}
            {x.state === "done" && <span className="flex items-center gap-1 text-sm font-semibold text-pine"><CheckCircle2 className="size-4" /> {publish ? L("تم النشر", "Published") : L("انحفظ", "Saved")} · <Link href={`/${locale}/admin/products/${x.id}`} className="underline">{L("فتح", "Open")}</Link></span>}
            {x.state === "error" && <span className="flex items-center gap-1 text-xs font-semibold text-danger"><CircleAlert className="size-4" /> {x.message}</span>}
            {x.state !== "done" && items.length > 1 && !running && (
              <button type="button" onClick={() => setItems((l) => l.filter((y) => y.key !== x.key))} className="grid size-9 place-items-center rounded-full border border-line text-danger" aria-label={`${L("حذف المنتج", "Remove product")} ${i + 1}`}><Trash2 className="size-4" /></button>
            )}
          </header>
          {/* kept mounted while collapsed: the studio holds this product's artwork */}
          <div className={cn("space-y-4 border-t border-line p-5", (!x.open || x.state === "done") && "hidden")}>
            <div className="grid gap-3 sm:grid-cols-3">
              <label className="block"><span className="label">{L("الاسم", "Name")} *</span><input aria-label={`${L("اسم المنتج", "Product name")} ${i + 1}`} value={x.name_ar} onChange={(e) => patch(x.key, { name_ar: e.target.value, state: x.state === "error" ? "idle" : x.state })} className="field" placeholder={L("مثلاً: هودي ليالي بغداد", "e.g. Baghdad Nights hoodie")} disabled={running} /></label>
              <label className="block"><span className="label">{L("الاسم بالإنجليزي (اختياري)", "English name (optional)")}</span><input aria-label={`${L("الاسم بالإنجليزي", "English name")} ${i + 1}`} value={x.name_en} onChange={(e) => patch(x.key, { name_en: e.target.value })} className="field" dir="ltr" disabled={running} /></label>
              <label className="block"><span className="label">{L("سعر خاص (اختياري)", "Own price (optional)")}</span><input aria-label={`${L("سعر خاص", "Own price")} ${i + 1}`} type="number" min={0} step={250} inputMode="numeric" value={x.price} onChange={(e) => patch(x.key, { price: e.target.value })} placeholder={price} className="field" disabled={running} /></label>
            </div>
            {collections.length > 0 && (
              <div>
                <p className="label">{L("المجموعة", "Collection")}</p>
                <div className="flex flex-wrap gap-2">
                  {collections.map((c) => <button key={c.id} type="button" aria-pressed={x.collections.includes(c.id)} onClick={() => patch(x.key, { collections: toggle(x.collections, c.id) })} disabled={running} className={cn("h-9 rounded-full border px-4 text-sm", x.collections.includes(c.id) ? "border-ink bg-ink font-bold text-paper" : "border-line")}>{locale === "ar" ? c.name_ar : c.name_en}</button>)}
                </div>
              </div>
            )}
            <ProductStudio ref={x.ref} type={type} colors={colors} productId={x.id} previewColorIds={colorIds} />
          </div>
        </section>
      ))}

      {!running && (
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={() => setItems((l) => [...l.map((y) => ({ ...y, open: y.state === "error" })), newItem()])} className="btn btn-outline"><Plus className="size-4" /> {L(`إضافة ${typeName} آخر`, `Add another ${typeName}`)}</button>
          {items.every((x) => x.state === "done") && <Link href={`/${locale}/admin/products`} className="btn btn-outline"><ExternalLink className="size-4" /> {L("كل المنتجات", "All products")}</Link>}
        </div>
      )}

      <div className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-paper/95 px-4 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-3 backdrop-blur lg:start-[250px]">
        <div className="mx-auto flex max-w-5xl items-center gap-3">
          <p className="min-w-0 flex-1 truncate text-sm text-mute" aria-live="polite">{running ? progress : L(`${pending.length} منتج جاهز للنشر`, `${pending.length} product(s) ready`)}</p>
          {!running && pending.length > 0 && <button type="button" onClick={() => setItems((l) => [...l, newItem()])} className="btn btn-outline btn-sm hidden sm:inline-flex"><CopyPlus className="size-4" /> {L("منتج آخر", "Another")}</button>}
          <button type="button" onClick={publishAll} disabled={running || !pending.length} className="btn btn-brand">{running ? <Loader2 className="size-4 animate-spin" /> : <Rocket className="size-4" />} {publish ? L(`نشر الكل (${pending.length})`, `Publish all (${pending.length})`) : L(`حفظ الكل (${pending.length})`, `Save all (${pending.length})`)}</button>
        </div>
      </div>
    </div>
  );
}
