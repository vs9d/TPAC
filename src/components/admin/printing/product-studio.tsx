"use client";
import { forwardRef, useEffect, useImperativeHandle, useMemo, useRef, useState } from "react";
import { AlignCenterHorizontal, AlignCenterVertical, ArrowUpToLine, Expand, ImagePlus, Loader2, RefreshCw, Trash2 } from "lucide-react";
import { useI18n } from "@/components/i18n-provider";
import { adminT } from "@/lib/admin-i18n";
import { toast } from "@/components/ui/toast";
import { checkImageFile, extOf, imageSize, uploadProductImage } from "@/lib/admin-upload";
import { composeProductImage } from "@/lib/compose";
import { absolute, clampRect, designCm, fitArtwork, mockupFor, resizeDesign, viewAspect, type PrintAreaRow, type ProductDesignRow, type ProductTypeRow, type TypeViewRow } from "@/lib/print-config";
import { discardPrintFile } from "@/lib/actions/admin/printing";
import { cn } from "@/lib/format";
import type { Color } from "@/lib/types";
import { DragRect, MockupStage, rectStyle } from "./stage";

export interface DesignDraft {
  id?: string; area_id: string; artwork_url: string; artwork_path: string | null;
  artwork_width: number; artwork_height: number; x: number; y: number; width: number; height: number;
}
export interface GeneratedImage { url: string; storage_path: string; color_id: string | null; view_id: string }
export interface StudioHandle {
  designs: () => DesignDraft[];
  disabledAreas: () => string[];
  printEnabled: () => boolean;
  /** renders and uploads the product photos (one per view with artwork × colour) */
  generate: (productId: string, colorIds: string[], onProgress?: (done: number, total: number) => void) => Promise<GeneratedImage[]>;
}

const fromRow = (d: ProductDesignRow): DesignDraft => ({ id: d.id, area_id: d.area_id, artwork_url: d.artwork_url, artwork_path: d.artwork_path, artwork_width: d.artwork_width ?? 1000, artwork_height: d.artwork_height ?? 1000, x: d.x, y: d.y, width: d.width, height: d.height });

/**
 * Admin-only editor for the OFFICIAL artwork of a product: pick a view, upload a design into a print area,
 * drag / resize it (proportions kept, never outside the area), and see its print size in cm.
 */
export const ProductStudio = forwardRef<StudioHandle, {
  type: ProductTypeRow; colors: Color[]; productId: string; previewColorIds?: string[];
  initialDesigns?: ProductDesignRow[]; initialDisabled?: string[]; initialEnabled?: boolean;
}>(function ProductStudio({ type, colors, productId, previewColorIds, initialDesigns = [], initialDisabled = [], initialEnabled = true }, ref) {
  const { locale } = useI18n();
  const t = adminT(locale);
  const views = useMemo(() => (type.product_type_views ?? []).filter((v) => v.is_active), [type]);
  const [viewId, setViewId] = useState(views[0]?.id ?? "");
  const view = views.find((v) => v.id === viewId) ?? views[0];
  const [designs, setDesigns] = useState<DesignDraft[]>(() => initialDesigns.map(fromRow));
  const [disabled, setDisabled] = useState<string[]>(initialDisabled);
  const [enabled, setEnabled] = useState(initialEnabled);
  const areasOf = (v?: TypeViewRow) => (v?.product_print_areas ?? []).filter((a) => a.is_active);
  const [areaId, setAreaId] = useState<string>(areasOf(view)[0]?.id ?? "");
  const [busy, setBusy] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const uploaded = useRef<string[]>([]);

  const palette = useMemo(() => {
    const ids = previewColorIds?.length ? previewColorIds : type.default_color_ids;
    const list = colors.filter((c) => ids.includes(c.id));
    return list.length ? list : colors.slice(0, 1);
  }, [colors, previewColorIds, type.default_color_ids]);
  const [colorId, setColorId] = useState(palette[0]?.id ?? "");
  const color = colors.find((c) => c.id === colorId) ?? palette[0] ?? null;
  useEffect(() => {
    if (!palette.some((c) => c.id === colorId)) setColorId(palette[0]?.id ?? "");
  }, [palette, colorId]);

  useEffect(() => {
    const list = areasOf(view);
    if (!list.some((a) => a.id === areaId)) setAreaId(list[0]?.id ?? "");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [viewId]);

  const area = areasOf(view).find((a) => a.id === areaId);
  const design = designs.find((d) => d.area_id === areaId);

  const allAreas = useMemo(() => views.flatMap((v) => areasOf(v).map((a) => ({ a, v }))), [views]);
  const viewOfArea = (id: string) => allAreas.find((x) => x.a.id === id)?.v;

  useImperativeHandle(ref, () => ({
    designs: () => designs.filter((d) => !disabled.includes(d.area_id)),
    disabledAreas: () => disabled,
    printEnabled: () => enabled,
    generate: async (pid, colorIds, onProgress) => {
      const active = designs.filter((d) => !disabled.includes(d.area_id));
      const byView = views.filter((v) => active.some((d) => viewOfArea(d.area_id)?.id === v.id));
      // one photo per chosen colour; with no colour chosen, one photo (drawn in the first colour) for all colours
      const cols: { c: Color | null; store: string | null }[] = colorIds.length ? colors.filter((c) => colorIds.includes(c.id)).slice(0, 6).map((c) => ({ c, store: c.id })) : [{ c: palette[0] ?? null, store: null }];
      const jobs = cols.flatMap(({ c, store }) => byView.slice(0, 4).map((v) => ({ c, store, v })));
      const out: GeneratedImage[] = [];
      let done = 0;
      onProgress?.(0, jobs.length);
      for (const { c, store, v } of jobs) {
        const src = mockupFor(v, type.garment_shape, c);
        if (!src) continue;
        const items = active.filter((d) => viewOfArea(d.area_id)?.id === v.id).map((d) => {
          const ar = areasOf(v).find((a) => a.id === d.area_id)!;
          return { url: d.artwork_url, ...absolute(ar, d) };
        });
        const blob = await composeProductImage(src, viewAspect(v), items);
        const up = await uploadProductImage(blob, `products/${pid}/gen/${crypto.randomUUID()}.jpg`, "image/jpeg");
        out.push({ url: up.url, storage_path: up.path, color_id: store, view_id: v.id });
        onProgress?.(++done, jobs.length);
      }
      return out;
    },
  }), [designs, disabled, enabled, views, colors, palette, type.garment_shape]);

  if (!view) return <p className="text-sm text-mute">{t("هذا النوع بلا زوايا — أضفها من «أنواع المنتجات».", "This type has no views — add them under Product types.")}</p>;
  const aspect = viewAspect(view);
  const mockup = mockupFor(view, type.garment_shape, color);

  const setDesign = (next: DesignDraft | null) => setDesigns((list) => [...list.filter((d) => d.area_id !== areaId), ...(next ? [next] : [])]);

  const onFile = async (file: File) => {
    if (!area) return;
    const err = checkImageFile(file);
    if (err) {
      toast.error(err === "type" ? t("الصيغ المسموحة: PNG, JPG, WEBP, AVIF (يفضّل PNG شفاف)", "Allowed: PNG, JPG, WEBP, AVIF (transparent PNG is best)") : t("الحد ٨ ميغابايت", "Max 8 MB"));
      return;
    }
    setBusy(true);
    try {
      const size = await imageSize(file);
      const up = await uploadProductImage(file, `products/${productId}/art/${crypto.randomUUID()}.${extOf(file.type)}`, file.type);
      uploaded.current.push(up.path);
      const old = design;
      const rect = old ? resizeDesign(old, area, view, size.width, size.height, old.width) : fitArtwork(area, view, size.width, size.height);
      setDesign({ id: old?.id, area_id: area.id, artwork_url: up.url, artwork_path: up.path, artwork_width: size.width, artwork_height: size.height, ...rect });
      if (old?.artwork_path && uploaded.current.includes(old.artwork_path)) void discardPrintFile(old.artwork_path);
      // print quality hint: 150 DPI at the printed width
      const cm = designCm(area, rect);
      const dpi = Math.round(size.width / (cm.w / 2.54));
      if (dpi < 150) toast.info(t(`دقة التصميم ${dpi} DPI بهذا الحجم — يفضّل ملف أكبر (150+).`, `The artwork is ${dpi} DPI at this size — a bigger file (150+) prints sharper.`));
    } catch {
      toast.error(t("تعذّر رفع التصميم", "Upload failed"));
    } finally {
      setBusy(false);
    }
  };

  const toggleArea = (id: string) => setDisabled((d) => (d.includes(id) ? d.filter((x) => x !== id) : [...d, id]));
  const cm = area && design ? designCm(area, design) : null;
  const widthPct = design ? Math.round(design.width * 100) : 0;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-2">
          {views.map((v) => {
            const n = designs.filter((d) => areasOf(v).some((a) => a.id === d.area_id)).length;
            return <button key={v.id} type="button" aria-pressed={v.id === view.id} onClick={() => setViewId(v.id)} className="chip h-10 px-4">{locale === "ar" ? v.name_ar : v.name_en}{n > 0 && <span className="ms-1 size-2 rounded-full bg-amber" aria-hidden />}</button>;
          })}
        </div>
        <div className="flex items-center gap-1.5">
          {palette.map((c) => <button key={c.id} type="button" onClick={() => setColorId(c.id)} aria-label={locale === "ar" ? c.name_ar : c.name_en} aria-pressed={c.id === color?.id} className={cn("size-7 rounded-full border", c.id === color?.id ? "ring-2 ring-pine ring-offset-2" : "border-ink/20")} style={{ background: c.hex }} />)}
        </div>
      </div>

      <div className="grid gap-5 lg:grid-cols-5">
        <div className="lg:col-span-3">
          <div className="mx-auto max-w-[520px] pt-6">
            <MockupStage src={mockup} aspect={aspect}>
              {areasOf(view).map((a) => {
                const d = designs.find((x) => x.area_id === a.id);
                const off = disabled.includes(a.id) || !enabled;
                return (
                  <div key={a.id} onPointerDown={() => setAreaId(a.id)} className={cn("absolute border-2 border-dashed transition-colors", a.id === areaId ? "z-10 border-amber" : "border-pine/60", off && "border-ink/20 opacity-40")} style={rectStyle(a)}>
                    <span className={cn("pointer-events-none absolute -top-6 start-0 whitespace-nowrap rounded-md px-1.5 py-0.5 text-[11px] font-bold text-white", a.id === areaId ? "bg-amber" : "bg-pine")}>{locale === "ar" ? a.name_ar : a.name_en} · {a.max_width_cm}×{a.max_height_cm} cm</span>
                    {d && (
                      <DragRect
                        rect={d}
                        tone="design"
                        selected={a.id === areaId}
                        disabled={off}
                        onSelect={() => setAreaId(a.id)}
                        aspect={(d.artwork_height / d.artwork_width) * ((a.width * view.mockup_width) / (a.height * view.mockup_height))}
                        onChange={(r) => setDesigns((list) => list.map((x) => (x.area_id === a.id ? { ...x, ...r } : x)))}
                      >
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={d.artwork_url} alt="" draggable={false} className="pointer-events-none size-full object-contain" />
                      </DragRect>
                    )}
                    {!d && a.id === areaId && !off && (
                      <button type="button" onClick={() => fileRef.current?.click()} className="absolute inset-0 grid place-items-center text-center text-[11px] font-bold text-amber">
                        <span className="rounded-lg bg-paper/90 px-2 py-1 shadow">+ {t("ارفع التصميم", "Upload design")}</span>
                      </button>
                    )}
                  </div>
                );
              })}
            </MockupStage>
          </div>
          {busy && <p className="mt-3 flex items-center justify-center gap-2 text-sm text-mute"><Loader2 className="size-4 animate-spin" /> {t("جارِ رفع التصميم…", "Uploading the design…")}</p>}
        </div>

        <div className="space-y-4 lg:col-span-2">
          <label className="flex items-center justify-between gap-3 rounded-2xl border border-line p-3 text-sm font-semibold">
            {t("الطباعة مفعّلة لهذا المنتج", "Printing enabled for this product")}
            <input type="checkbox" className="size-5 accent-[var(--color-pine)]" checked={enabled} onChange={(e) => setEnabled(e.target.checked)} />
          </label>

          <div className="space-y-1.5">
            <p className="text-xs font-semibold text-mute">{t("مناطق الطباعة في هذه الزاوية", "Print areas on this view")}</p>
            {areasOf(view).map((a) => {
              const d = designs.find((x) => x.area_id === a.id);
              return (
                <div key={a.id} className={cn("flex items-center gap-2 rounded-2xl border px-3 py-2", a.id === areaId ? "border-amber bg-amber/5" : "border-line")}>
                  <button type="button" onClick={() => setAreaId(a.id)} className="min-w-0 flex-1 text-start">
                    <span className="block text-sm font-bold">{locale === "ar" ? a.name_ar : a.name_en}</span>
                    <span className="block text-xs text-mute">{t("حتى", "up to")} {a.max_width_cm}×{a.max_height_cm} cm{d ? ` · ${t("فيها تصميم", "has artwork")}` : ""}</span>
                  </button>
                  <label className="flex items-center gap-1.5 text-xs"><input type="checkbox" className="accent-ink" checked={!disabled.includes(a.id)} onChange={() => toggleArea(a.id)} /> {t("متاحة", "On")}</label>
                </div>
              );
            })}
          </div>

          {area && (
            <div className="card-admin space-y-3 p-4">
              <p className="text-sm font-bold">{locale === "ar" ? area.name_ar : area.name_en}</p>
              <input ref={fileRef} type="file" accept="image/png,image/jpeg,image/webp,image/avif" className="sr-only" onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ""; if (f) void onFile(f); }} />
              <div className="flex flex-wrap gap-2">
                <button type="button" disabled={busy || disabled.includes(area.id) || !enabled} onClick={() => fileRef.current?.click()} className="btn btn-brand btn-sm">{design ? <RefreshCw className="size-4" /> : <ImagePlus className="size-4" />} {design ? t("استبدال التصميم", "Replace design") : t("رفع التصميم", "Upload design")}</button>
                {design && <button type="button" onClick={() => setDesign(null)} className="btn btn-sm border border-danger text-danger"><Trash2 className="size-4" /> {t("إزالة", "Remove")}</button>}
              </div>
              {design && cm && (
                <>
                  <p className="text-sm">{t("حجم الطباعة:", "Print size:")} <b className="tabular-nums" dir="ltr">{cm.w} × {cm.h} cm</b> <span className="text-xs text-mute">({t("الحد", "max")} {area.max_width_cm}×{area.max_height_cm})</span></p>
                  <label className="block">
                    <span className="mb-1 block text-xs font-semibold text-mute">{t("الحجم", "Size")} — {widthPct}%</span>
                    <input type="range" min={5} max={100} value={widthPct} onChange={(e) => setDesign({ ...design, ...resizeDesign(design, area, view, design.artwork_width, design.artwork_height, Number(e.target.value) / 100) })} className="w-full accent-[var(--color-pine)]" />
                  </label>
                  <div className="flex flex-wrap gap-1.5">
                    <Btn label={t("توسيط أفقي", "Centre horizontally")} onClick={() => setDesign({ ...design, x: (1 - design.width) / 2 })}><AlignCenterVertical className="size-4" /></Btn>
                    <Btn label={t("توسيط عمودي", "Centre vertically")} onClick={() => setDesign({ ...design, y: (1 - design.height) / 2 })}><AlignCenterHorizontal className="size-4" /></Btn>
                    <Btn label={t("أعلى المنطقة", "Top of area")} onClick={() => setDesign({ ...design, y: 0 })}><ArrowUpToLine className="size-4" /></Btn>
                    <Btn label={t("أكبر حجم ممكن", "Largest size")} onClick={() => setDesign({ ...design, ...clampRect(fitArtwork(area, view, design.artwork_width, design.artwork_height, 1)) })}><Expand className="size-4" /></Btn>
                  </div>
                </>
              )}
              <p className="text-[11px] text-mute">{t("التصميم لا يخرج عن منطقة الطباعة أبداً، والنسبة محفوظة أثناء تغيير الحجم.", "The artwork never leaves the print area, and its proportions are kept while resizing.")}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
});

function Btn({ children, label, onClick }: { children: React.ReactNode; label: string; onClick: () => void }) {
  return <button type="button" title={label} aria-label={label} onClick={onClick} className="grid size-9 place-items-center rounded-full border border-line hover:bg-bone">{children}</button>;
}

export type { PrintAreaRow };
