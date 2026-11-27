"use client";
import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Save, Send } from "lucide-react";
import { useI18n } from "@/components/i18n-provider";
import { toast } from "@/components/ui/toast";
import { ProductStudio, type StudioHandle } from "@/components/admin/printing/product-studio";
import { saveCreatorDesign } from "@/lib/actions/creators";
import { MARKUP_CEILING, STATUS_LABEL } from "@/lib/creator-labels";
import { cn, formatIQD } from "@/lib/format";
import type { ProductDesignRow, ProductTypeRow } from "@/lib/print-config";
import type { Color } from "@/lib/types";
import { studioUploader } from "./upload";

const CATEGORIES: [string, string][] = [["street", "ستريت"], ["art", "فني"], ["calligraphy", "خط عربي"], ["iraq", "عراقي"], ["funny", "مضحك"], ["sport", "رياضي"], ["love", "حب ومناسبات"], ["minimal", "بسيط"], ["other", "أخرى"]];

export interface EditorListing {
  id: string; product_id: string; title: string; description: string | null; category: string | null; tags: string[]; markup: number; status: string; review_note: string | null; slug: string;
}

/** A creator's listing: the official mockups with their artwork, colours, sizes, price and earning — then review. */
export function CreatorDesignEditor({ listing, type, colors, designs, chosenColors, chosenSizes, base, maxMarkup, rule, reviewRequired }: {
  listing: EditorListing; type: ProductTypeRow; colors: Color[]; designs: ProductDesignRow[];
  chosenColors: string[]; chosenSizes: string[]; base: number; maxMarkup: number | null;
  rule: { mode: "percent" | "fixed"; value: number }; reviewRequired: boolean;
}) {
  const { locale } = useI18n();
  const ar = locale === "ar";
  const router = useRouter();
  const studio = useRef<StudioHandle>(null);
  const offered = colors.filter((c) => !type.default_color_ids?.length || type.default_color_ids.includes(c.id));
  const sizesOffered = type.default_sizes?.length ? type.default_sizes : ["S", "M", "L", "XL", "XXL"];
  const [title, setTitle] = useState(listing.title);
  const [description, setDescription] = useState(listing.description ?? "");
  const [category, setCategory] = useState(listing.category ?? "");
  const [tags, setTags] = useState(listing.tags.join("، "));
  const [colorIds, setColorIds] = useState<string[]>(chosenColors.length ? chosenColors : offered.slice(0, 2).map((c) => c.id));
  const [sizes, setSizes] = useState<string[]>(chosenSizes.length ? chosenSizes : sizesOffered);
  // no cap from the admin: the slider covers a sensible range, the number field takes any amount
  const cap = maxMarkup ?? MARKUP_CEILING;
  const sliderMax = maxMarkup ?? Math.max(50000, Math.ceil(((listing.markup || 0) * 2) / 1000) * 1000);
  const [markup, setMarkup] = useState(listing.markup || Math.min(5000, cap));
  const [progress, setProgress] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const earning = rule.mode === "fixed" ? rule.value : Math.round((markup * Math.min(rule.value, 100)) / 100);
  const st = STATUS_LABEL[listing.status] ?? STATUS_LABEL.draft!;
  const toggle = (list: string[], v: string) => (list.includes(v) ? list.filter((x) => x !== v) : [...list, v]);

  const save = (submit: boolean) => start(async () => {
    const s = studio.current;
    if (!s) return;
    const ds = s.designs();
    if (!ds.length) { toast.error(ar ? "ارفع تصميمك على القطعة أولاً" : "Upload your design onto the garment first"); return; }
    if (title.trim().length < 2) { toast.error(ar ? "اكتب اسم التصميم" : "Give your design a name"); return; }
    if (!colorIds.length || !sizes.length) { toast.error(ar ? "اختار لون ومقاس واحد على الأقل" : "Pick at least one colour and size"); return; }
    try {
      setProgress(ar ? "نجهّز صور المعاينة…" : "Making the mockups…");
      const images = await s.generate(listing.product_id, colorIds, (d, t) => setProgress(ar ? `نجهّز صور المعاينة ${d}/${t}` : `Mockups ${d}/${t}`));
      setProgress(ar ? "نحفظ…" : "Saving…");
      const r = await saveCreatorDesign({
        id: listing.id, title: title.trim(), description: description.trim() || undefined, category: category || undefined,
        tags: tags.split(/[,،]/).map((x) => x.trim()).filter(Boolean).slice(0, 15), color_ids: colorIds, sizes, cover_color: s.coverColor(),
        markup, designs: ds, images, submit,
      });
      if (!r.ok) {
        toast.error(r.fields?.markup ? (ar ? `أعلى إضافة مسموحة ${formatIQD(cap, locale)}` : `Max markup is ${formatIQD(cap, locale)}`) : r.error === "hidden" ? (ar ? "هذا التصميم مخفي من الإدارة" : "This design was hidden by staff") : ar ? "ما انحفظ — تأكد من الخانات" : "Not saved — check the fields");
        return;
      }
      toast.success(r.status === "approved" ? (ar ? "انشر ✓ صار بمتجرك" : "Published ✓") : r.status === "pending" ? (ar ? "انرسل للمراجعة ✓ نبلغك أول ما ينقبل" : "Sent for review ✓") : ar ? "انحفظ ✓" : "Saved ✓");
      router.refresh();
    } catch {
      toast.error(ar ? "صار خطأ برفع الصور — حاول مرة ثانية" : "Upload failed — try again");
    } finally {
      setProgress(null);
    }
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-3">
        <span className={cn("rounded-full px-3 py-1 text-xs font-bold", st[2])}>{ar ? st[0] : st[1]}</span>
        {listing.status === "approved" && <a href={`/${locale}/product/${listing.slug}`} target="_blank" className="text-sm font-semibold underline">{ar ? "شوفه بالمتجر ↗" : "View in store ↗"}</a>}
        {listing.review_note && <p className="w-full rounded-2xl bg-amber/15 px-4 py-3 text-sm"><b>{ar ? "ملاحظة الإدارة: " : "Note from TPAC: "}</b>{listing.review_note}</p>}
      </div>
      <div className="grid gap-6 lg:grid-cols-12">
        <section className="rounded-[1.5rem] border border-line bg-paper p-4 lg:col-span-7" aria-label={ar ? "المعاينة" : "Mockup"}>
          <p className="mb-3 text-sm text-mute">{ar ? "ارفع تصميمك (PNG بخلفية شفافة)، حرّكه وكبّره ضمن مناطق الطباعة، وغيّر اللون حتى تشوف المعاينة. تقدر تحط تصميم على الأمام والخلف." : "Upload your design (transparent PNG), move and resize it inside the print areas, and switch colours to preview. Front and back both work."}</p>
          <ProductStudio ref={studio} type={type} colors={colors} productId={listing.product_id} previewColorIds={colorIds} initialDesigns={designs} uploader={studioUploader} areasOnly initialCover={colorIds[0] ?? null} />
        </section>
        <div className="space-y-5 lg:col-span-5">
          <section className="space-y-4 rounded-[1.5rem] border border-line bg-paper p-5">
            <label className="block"><span className="mb-1.5 block text-sm font-semibold">{ar ? "اسم التصميم" : "Design name"}</span><input className="field w-full" maxLength={80} value={title} onChange={(e) => setTitle(e.target.value)} /></label>
            <label className="block"><span className="mb-1.5 block text-sm font-semibold">{ar ? "الوصف" : "Description"}</span><textarea className="field w-full" rows={3} maxLength={2000} value={description} onChange={(e) => setDescription(e.target.value)} /></label>
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="block"><span className="mb-1.5 block text-sm font-semibold">{ar ? "التصنيف" : "Category"}</span>
                <select className="field w-full" value={category} onChange={(e) => setCategory(e.target.value)}>
                  <option value="">—</option>
                  {CATEGORIES.map(([k, l]) => <option key={k} value={k}>{l}</option>)}
                </select>
              </label>
              <label className="block"><span className="mb-1.5 block text-sm font-semibold">{ar ? "كلمات مفتاحية" : "Tags"}</span><input className="field w-full" value={tags} onChange={(e) => setTags(e.target.value)} placeholder={ar ? "بغداد، خط، فن" : "baghdad, art"} /></label>
            </div>
          </section>
          <section className="space-y-4 rounded-[1.5rem] border border-line bg-paper p-5">
            <fieldset>
              <legend className="mb-2 text-sm font-semibold">{ar ? "الألوان المتاحة للزبون" : "Colours offered"}</legend>
              <div className="flex flex-wrap gap-2">
                {offered.map((c) => (
                  <button key={c.id} type="button" role="checkbox" aria-checked={colorIds.includes(c.id)} onClick={() => setColorIds((l) => toggle(l, c.id))} className={cn("flex min-h-11 items-center gap-2 rounded-full border px-3 text-sm font-semibold", colorIds.includes(c.id) ? "border-pine bg-pine-soft text-pine" : "border-line")}>
                    <span className="size-5 rounded-full border border-ink/20" style={{ background: c.hex }} aria-hidden="true" /> {ar ? c.name_ar : c.name_en}
                  </button>
                ))}
              </div>
            </fieldset>
            <fieldset>
              <legend className="mb-2 text-sm font-semibold">{ar ? "المقاسات" : "Sizes"}</legend>
              <div className="flex flex-wrap gap-2">
                {sizesOffered.map((s) => <button key={s} type="button" role="checkbox" aria-checked={sizes.includes(s)} onClick={() => setSizes((l) => toggle(l, s))} className={cn("min-h-11 min-w-12 rounded-xl border px-3 text-sm font-bold", sizes.includes(s) ? "border-ink bg-ink text-paper" : "border-line")}>{s}</button>)}
              </div>
            </fieldset>
          </section>
          <section className="space-y-3 rounded-[1.5rem] border-2 border-pine/40 bg-pine-soft/30 p-5" aria-label={ar ? "السعر والربح" : "Price and earning"}>
            <h3 className="font-bold">{ar ? "السعر وربحك" : "Price and your earning"}</h3>
            <label className="block">
              <span className="mb-1.5 flex justify-between text-sm font-semibold"><span>{ar ? "اللي تضيفه على السعر" : "Your markup"}</span><span className="tabular-nums">{formatIQD(markup, locale)}</span></span>
              <input type="range" min={0} max={sliderMax} step={250} value={Math.min(markup, sliderMax)} onChange={(e) => setMarkup(Number(e.target.value))} className="w-full accent-[#376352]" aria-label={ar ? "الإضافة" : "Markup"} />
              <input type="number" min={0} max={cap} step={250} value={markup} onChange={(e) => setMarkup(Math.max(0, Math.min(cap, Math.round(Number(e.target.value) || 0))))} className="field mt-2 w-full" aria-label={ar ? "الإضافة بالدينار" : "Markup in IQD"} />
              <span className="mt-1 block text-xs text-mute">{maxMarkup === null ? (ar ? "تكدر تضيف اللي يعجبك — اكتب المبلغ." : "Add any amount — type it in.") : (ar ? `لحد ${formatIQD(maxMarkup, locale)}` : `Up to ${formatIQD(maxMarkup, locale)}`)}</span>
            </label>
            <dl className="space-y-1.5 text-sm">
              <div className="flex justify-between"><dt className="text-mute">{ar ? "سعر القطعة الأساسي (من TPAC)" : "Garment base price (set by TPAC)"}</dt><dd className="tabular-nums">{formatIQD(base, locale)}</dd></div>
              <div className="flex justify-between"><dt className="text-mute">{ar ? "إضافتك" : "Your markup"}</dt><dd className="tabular-nums">+ {formatIQD(markup, locale)}</dd></div>
              <div className="flex justify-between border-t border-line pt-1.5 font-bold"><dt>{ar ? "سعر البيع للزبون" : "Customer price"}</dt><dd className="tabular-nums">{formatIQD(base + markup, locale)}</dd></div>
              <div className="flex justify-between rounded-xl bg-paper px-3 py-2 font-bold text-pine"><dt>{ar ? "صافي ربحك لكل قطعة" : "Your net per piece"}</dt><dd className="tabular-nums">{formatIQD(earning, locale)}</dd></div>
            </dl>
            <p className="text-xs text-mute">{rule.mode === "percent" ? (ar ? `ربحك ${rule.value}% من إضافتك.` : `You earn ${rule.value}% of your markup.`) : (ar ? `ربحك ${formatIQD(rule.value, locale)} ثابت لكل قطعة.` : `You earn a fixed ${formatIQD(rule.value, locale)} per piece.`)} {ar ? "ينحسب من السيرفر وقت كل بيعة، ويصير قابل للسحب بعد ما يكتمل الطلب." : "Computed by TPAC at each sale; withdrawable once the order is completed."}</p>
          </section>
          <div className="grid gap-2 sm:grid-cols-2">
            <button type="button" disabled={pending} onClick={() => save(false)} className="btn btn-outline h-12">{pending && !progress?.includes("…") ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />} {ar ? "حفظ" : "Save"}</button>
            <button type="button" disabled={pending} onClick={() => save(true)} className="btn btn-brand h-12">{pending ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />} {reviewRequired ? (ar ? "إرسال للمراجعة" : "Send for review") : (ar ? "نشر" : "Publish")}</button>
          </div>
          {progress && <p className="text-center text-sm text-mute" role="status">{progress}</p>}
        </div>
      </div>
    </div>
  );
}
