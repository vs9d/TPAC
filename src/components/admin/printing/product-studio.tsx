"use client";
import { forwardRef, useEffect, useImperativeHandle, useMemo, useRef, useState } from "react";
import { AlignCenterHorizontal, AlignCenterVertical, ArrowUpToLine, Expand, ImagePlus, Loader2, Move, Plus, RefreshCw, ScanLine, Trash2 } from "lucide-react";
import { useI18n } from "@/components/i18n-provider";
import { adminT } from "@/lib/admin-i18n";
import { toast } from "@/components/ui/toast";
import { checkImageFile, extOf, imageSize, uploadProductImage } from "@/lib/admin-upload";
import { composeProductImage } from "@/lib/compose";
import { absolute, clampRect, designCm, fitArtwork, mockupFor, normArea, resizeDesign, viewAspect, type PrintAreaRow, type ProductDesignRow, type ProductTypeRow, type TypeViewRow } from "@/lib/print-config";
import { discardPrintFile, ensureFreeArea } from "@/lib/actions/admin/printing";
import { cn } from "@/lib/format";
import type { Color } from "@/lib/types";
import { DragRect, MockupStage, rectStyle } from "./stage";

export interface DesignDraft {
  id?: string; area_id: string; artwork_url: string; artwork_path: string | null;
  artwork_width: number; artwork_height: number; x: number; y: number; width: number; height: number;
}
type Draft = DesignDraft & { key: string };
export interface GeneratedImage { url: string; storage_path: string; color_id: string | null; view_id: string }
export interface StudioHandle {
  designs: () => DesignDraft[];
  disabledAreas: () => string[];
  printEnabled: () => boolean;
  /** renders and uploads the product photos (one per view with artwork × colour) */
  generate: (productId: string, colorIds: string[], onProgress?: (done: number, total: number) => void) => Promise<GeneratedImage[]>;
}

const FREE = "free";
const fromRow = (d: ProductDesignRow): Draft => ({ key: d.id, id: d.id, area_id: d.area_id, artwork_url: d.artwork_url, artwork_path: d.artwork_path, artwork_width: d.artwork_width ?? 1000, artwork_height: d.artwork_height ?? 1000, x: d.x, y: d.y, width: d.width, height: d.height });
const strip = ({ key: _k, ...d }: Draft): DesignDraft => { void _k; return d; };

/**
 * Admin-only editor for the OFFICIAL artwork of a product.
 * - Free placement (default): put any number of designs anywhere on the garment, on every view.
 * - Print areas: one design per configured print area, sized within its maximum in cm.
 * Proportions are always kept while resizing; the print size is shown in cm.
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
  const [designs, setDesigns] = useState<Draft[]>(() => initialDesigns.map(fromRow));
  const [disabled, setDisabled] = useState<string[]>(initialDisabled);
  const [enabled, setEnabled] = useState(initialEnabled);
  // the whole-garment area of each view (created on first use)
  const [freeAreas, setFreeAreas] = useState<Record<string, PrintAreaRow>>(() =>
    Object.fromEntries(views.flatMap((v) => (v.product_print_areas ?? []).filter((a) => a.code === FREE).map((a) => [v.id, a]))));
  const areasOf = (v?: TypeViewRow) => (v?.product_print_areas ?? []).filter((a) => a.is_active && a.code !== FREE);
  const freeIds = useMemo(() => new Set(Object.values(freeAreas).map((a) => a.id)), [freeAreas]);
  // free placement unless the product already uses the fixed print areas only
  const [mode, setMode] = useState<"free" | "areas">(() => (initialDesigns.length && initialDesigns.every((d) => !views.some((v) => (v.product_print_areas ?? []).some((a) => a.id === d.area_id && a.code === FREE))) ? "areas" : "free"));
  const [areaId, setAreaId] = useState<string>(areasOf(view)[0]?.id ?? "");
  const [selKey, setSelKey] = useState<string>("");
  const [busy, setBusy] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const replaceKey = useRef<string | null>(null);
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
    // the first free design of the view is ready to edit
    const free = freeAreas[viewId];
    setSelKey(designs.find((d) => free && d.area_id === free.id)?.key ?? "");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [viewId]);

  /** every area (fixed + free) with its view, to find where a design lives */
  const allAreas = useMemo(() => views.flatMap((v) => [...(v.product_print_areas ?? []).filter((a) => a.is_active && a.code !== FREE), ...(freeAreas[v.id] ? [freeAreas[v.id]!] : [])].map((a) => ({ a, v }))), [views, freeAreas]);
  const areaById = (id: string) => allAreas.find((x) => x.a.id === id);

  const getFreeArea = async (v: TypeViewRow): Promise<PrintAreaRow | null> => {
    if (freeAreas[v.id]) return freeAreas[v.id]!;
    const r = await ensureFreeArea(v.id);
    if (!r.ok) {
      toast.error(t("تعذّر تجهيز المساحة الحرة", "Couldn't prepare the free area"));
      return null;
    }
    const a = normArea(r.area as unknown as PrintAreaRow);
    setFreeAreas((m) => ({ ...m, [v.id]: a }));
    return a;
  };

  useImperativeHandle(ref, () => ({
    designs: () => designs.filter((d) => !disabled.includes(d.area_id)).map(strip),
    disabledAreas: () => disabled,
    printEnabled: () => enabled,
    generate: async (pid, colorIds, onProgress) => {
      const active = designs.filter((d) => !disabled.includes(d.area_id));
      const byView = views.filter((v) => active.some((d) => areaById(d.area_id)?.v.id === v.id));
      // one photo per chosen colour; with no colour chosen, one photo (drawn in the first colour) for all colours
      const cols: { c: Color | null; store: string | null }[] = colorIds.length ? colors.filter((c) => colorIds.includes(c.id)).slice(0, 6).map((c) => ({ c, store: c.id })) : [{ c: palette[0] ?? null, store: null }];
      const jobs = cols.flatMap(({ c, store }) => byView.slice(0, 4).map((v) => ({ c, store, v })));
      const out: GeneratedImage[] = [];
      let done = 0;
      onProgress?.(0, jobs.length);
      for (const { c, store, v } of jobs) {
        const src = mockupFor(v, type.garment_shape, c);
        if (!src) continue;
        const items = active.filter((d) => areaById(d.area_id)?.v.id === v.id).map((d) => ({ url: d.artwork_url, ...absolute(areaById(d.area_id)!.a, d) }));
        const blob = await composeProductImage(src, viewAspect(v), items);
        const up = await uploadProductImage(blob, `products/${pid}/gen/${crypto.randomUUID()}.jpg`, "image/jpeg");
        out.push({ url: up.url, storage_path: up.path, color_id: store, view_id: v.id });
        onProgress?.(++done, jobs.length);
      }
      return out;
    },
  }), [designs, disabled, enabled, views, colors, palette, type.garment_shape, allAreas]);

  if (!view) return <p className="text-sm text-mute">{t("هذا النوع بلا زوايا — أضفها من «أنواع المنتجات».", "This type has no views — add them under Product types.")}</p>;
  const aspect = viewAspect(view);
  const mockup = mockupFor(view, type.garment_shape, color);
  const free = freeAreas[view.id];
  const fixedArea = areasOf(view).find((a) => a.id === areaId);
  const viewDesigns = designs.filter((d) => areaById(d.area_id)?.v.id === view.id);
  const sel = mode === "free" ? designs.find((d) => d.key === selKey) : designs.find((d) => d.area_id === areaId);
  const selArea = sel ? areaById(sel.area_id)?.a : mode === "free" ? free : fixedArea;

  const patch = (key: string, p: Partial<Draft>) => setDesigns((list) => list.map((d) => (d.key === key ? { ...d, ...p } : d)));
  const remove = (key: string) => {
    const d = designs.find((x) => x.key === key);
    if (d?.artwork_path && uploaded.current.includes(d.artwork_path)) void discardPrintFile(d.artwork_path);
    setDesigns((list) => list.filter((x) => x.key !== key));
    if (selKey === key) setSelKey("");
  };

  const pick = (replace: string | null) => {
    replaceKey.current = replace;
    fileRef.current?.click();
  };

  const onFile = async (file: File) => {
    const err = checkImageFile(file);
    if (err) {
      toast.error(err === "type" ? t("الصيغ المسموحة: PNG, JPG, WEBP, AVIF (يفضّل PNG شفاف)", "Allowed: PNG, JPG, WEBP, AVIF (transparent PNG is best)") : t("الحد ٨ ميغابايت", "Max 8 MB"));
      return;
    }
    setBusy(true);
    try {
      const target = replaceKey.current ? designs.find((d) => d.key === replaceKey.current) : mode === "areas" ? designs.find((d) => d.area_id === areaId) : undefined;
      const area = target ? areaById(target.area_id)?.a : mode === "free" ? await getFreeArea(view) : fixedArea;
      if (!area) throw new Error("area");
      const size = await imageSize(file);
      const up = await uploadProductImage(file, `products/${productId}/art/${crypto.randomUUID()}.${extOf(file.type)}`, file.type);
      uploaded.current.push(up.path);
      let rect;
      if (target) rect = resizeDesign(target, area, view, size.width, size.height, target.width);
      else if (area.code === FREE) {
        // a new free design starts as a chest-sized print in the middle of the garment
        const r = fitArtwork(area, view, size.width, size.height, 0.32);
        rect = clampRect({ ...r, y: 0.34 - r.height / 2 });
      } else rect = fitArtwork(area, view, size.width, size.height);
      const next: Draft = { key: target?.key ?? crypto.randomUUID(), id: target?.id, area_id: area.id, artwork_url: up.url, artwork_path: up.path, artwork_width: size.width, artwork_height: size.height, ...rect };
      setDesigns((list) => (target ? list.map((d) => (d.key === target.key ? next : d)) : [...list, next]));
      setSelKey(next.key);
      if (target?.artwork_path && uploaded.current.includes(target.artwork_path)) void discardPrintFile(target.artwork_path);
      const cm = designCm(area, rect);
      const dpi = Math.round(size.width / (cm.w / 2.54));
      if (dpi < 150) toast.info(t(`دقة التصميم ${dpi} DPI بهذا الحجم — يفضّل ملف أكبر (150+).`, `The artwork is ${dpi} DPI at this size — a bigger file (150+) prints sharper.`));
    } catch {
      toast.error(t("تعذّر رفع التصميم", "Upload failed"));
    } finally {
      setBusy(false);
      replaceKey.current = null;
    }
  };

  const toggleArea = (id: string) => setDisabled((d) => (d.includes(id) ? d.filter((x) => x !== id) : [...d, id]));
  const cm = sel && selArea ? designCm(selArea, sel) : null;
  const widthPct = sel ? Math.round(sel.width * 100) : 0;
  const designLayer = (d: Draft, a: PrintAreaRow, off: boolean) => (
    <DragRect
      key={d.key}
      rect={d}
      tone="design"
      selected={mode === "free" ? selKey === d.key : a.id === areaId}
      disabled={off}
      onSelect={() => { setSelKey(d.key); if (a.code !== FREE) setAreaId(a.id); }}
      aspect={(d.artwork_height / d.artwork_width) * ((a.width * view.mockup_width) / (a.height * view.mockup_height))}
      onChange={(r) => patch(d.key, r)}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={d.artwork_url} alt="" draggable={false} className="pointer-events-none size-full object-contain" />
    </DragRect>
  );

  return (
    <div className="space-y-4">
      <input ref={fileRef} type="file" accept="image/png,image/jpeg,image/webp,image/avif" className="sr-only" onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ""; if (f) void onFile(f); }} />
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex rounded-full border border-line p-1" role="tablist" aria-label={t("طريقة الوضع", "Placement mode")}>
          <button type="button" role="tab" aria-selected={mode === "free"} onClick={() => { setMode("free"); setSelKey(""); }} className={cn("flex items-center gap-1.5 rounded-full px-4 py-2 text-sm font-bold transition", mode === "free" ? "bg-pine text-white dark:text-night" : "hover:bg-bone")}><Move className="size-4" /> {t("حر — أي مكان", "Free — anywhere")}</button>
          <button type="button" role="tab" aria-selected={mode === "areas"} onClick={() => setMode("areas")} className={cn("flex items-center gap-1.5 rounded-full px-4 py-2 text-sm font-bold transition", mode === "areas" ? "bg-pine text-white dark:text-night" : "hover:bg-bone")}><ScanLine className="size-4" /> {t("مناطق الطباعة", "Print areas")}</button>
        </div>
        <div className="flex items-center gap-1.5">
          {palette.map((c) => <button key={c.id} type="button" onClick={() => setColorId(c.id)} aria-label={locale === "ar" ? c.name_ar : c.name_en} aria-pressed={c.id === color?.id} className={cn("size-7 rounded-full border", c.id === color?.id ? "ring-2 ring-pine ring-offset-2" : "border-ink/20")} style={{ background: c.hex }} />)}
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        {views.map((v) => {
          const n = designs.filter((d) => areaById(d.area_id)?.v.id === v.id).length;
          return <button key={v.id} type="button" aria-pressed={v.id === view.id} onClick={() => setViewId(v.id)} className="chip h-10 px-4">{locale === "ar" ? v.name_ar : v.name_en}{n > 0 && <span className="ms-1 rounded-full bg-amber px-1.5 text-[11px] font-bold text-ink">{n}</span>}</button>;
        })}
      </div>

      <div className="grid gap-5 lg:grid-cols-5">
        <div className="lg:col-span-3">
          <div className="mx-auto max-w-[520px] pt-6">
            <MockupStage src={mockup} aspect={aspect}>
              {mode === "free" ? (
                <>
                  {/* designs in the fixed areas stay where they are; free designs move anywhere on the photo */}
                  {viewDesigns.filter((d) => !freeIds.has(d.area_id)).map((d) => {
                    const a = areaById(d.area_id)!.a;
                    return <div key={d.key} className="absolute opacity-60" style={rectStyle(a)}>{designLayer(d, a, true)}</div>;
                  })}
                  {free ? (
                    <div className="absolute inset-0">
                      {viewDesigns.filter((d) => d.area_id === free.id).map((d) => designLayer(d, free, !enabled))}
                    </div>
                  ) : null}
                  {!viewDesigns.some((d) => freeIds.has(d.area_id)) && (
                    <button type="button" disabled={busy || !enabled} onClick={() => pick(null)} className="absolute inset-x-0 top-[38%] mx-auto flex w-fit items-center gap-2 rounded-xl bg-paper/95 px-4 py-2 text-sm font-bold text-pine shadow">
                      <Plus className="size-4" /> {t("أضف تصميماً بأي مكان", "Add a design anywhere")}
                    </button>
                  )}
                </>
              ) : (
                areasOf(view).map((a) => {
                  const d = designs.find((x) => x.area_id === a.id);
                  const off = disabled.includes(a.id) || !enabled;
                  return (
                    <div key={a.id} onPointerDown={() => setAreaId(a.id)} className={cn("absolute border-2 border-dashed transition-colors", a.id === areaId ? "z-10 border-amber" : "border-pine/60", off && "border-ink/20 opacity-40")} style={rectStyle(a)}>
                      <span className={cn("pointer-events-none absolute -top-6 start-0 whitespace-nowrap rounded-md px-1.5 py-0.5 text-[11px] font-bold text-white", a.id === areaId ? "bg-amber" : "bg-pine")}>{locale === "ar" ? a.name_ar : a.name_en} · {a.max_width_cm}×{a.max_height_cm} cm</span>
                      {d && designLayer(d as Draft, a, off)}
                      {!d && a.id === areaId && !off && (
                        <button type="button" onClick={() => pick(null)} className="absolute inset-0 grid place-items-center text-center text-[11px] font-bold text-amber">
                          <span className="rounded-lg bg-paper/90 px-2 py-1 shadow">+ {t("ارفع التصميم", "Upload design")}</span>
                        </button>
                      )}
                    </div>
                  );
                })
              )}
            </MockupStage>
          </div>
          {busy && <p className="mt-3 flex items-center justify-center gap-2 text-sm text-mute"><Loader2 className="size-4 animate-spin" /> {t("جارِ رفع التصميم…", "Uploading the design…")}</p>}
        </div>

        <div className="space-y-4 lg:col-span-2">
          <label className="flex items-center justify-between gap-3 rounded-2xl border border-line p-3 text-sm font-semibold">
            {t("الطباعة مفعّلة لهذا المنتج", "Printing enabled for this product")}
            <input type="checkbox" className="size-5 accent-[var(--color-pine)]" checked={enabled} onChange={(e) => setEnabled(e.target.checked)} />
          </label>

          {mode === "free" ? (
            <div className="space-y-2">
              <p className="text-xs text-mute">{t("ضع التصميم بأي مكان على القطعة: اسحبه، وكبّره من الزوايا. تگدر تضيف أكثر من تصميم بكل زاوية.", "Place artwork anywhere on the garment: drag it and resize from the corners. You can add several designs on each view.")}</p>
              <button type="button" disabled={busy || !enabled} onClick={() => pick(null)} className="btn btn-brand btn-sm w-full"><ImagePlus className="size-4" /> {t("إضافة تصميم", "Add a design")}</button>
              {viewDesigns.filter((d) => freeIds.has(d.area_id)).map((d, i) => (
                <button key={d.key} type="button" onClick={() => setSelKey(d.key)} className={cn("flex w-full items-center gap-3 rounded-2xl border px-3 py-2 text-start", selKey === d.key ? "border-amber bg-amber/5" : "border-line")}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={d.artwork_url} alt="" className="size-10 rounded-lg bg-bone object-contain" />
                  <span className="text-sm font-semibold">{t("تصميم", "Design")} {i + 1}</span>
                  <span className="ms-auto text-xs tabular-nums text-mute" dir="ltr">≈ {designCm(free!, d).w} × {designCm(free!, d).h} cm</span>
                </button>
              ))}
            </div>
          ) : (
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
              {fixedArea && !designs.some((d) => d.area_id === fixedArea.id) && (
                <button type="button" disabled={busy || disabled.includes(fixedArea.id) || !enabled} onClick={() => pick(null)} className="btn btn-brand btn-sm w-full"><ImagePlus className="size-4" /> {t("رفع التصميم", "Upload design")}</button>
              )}
            </div>
          )}

          {sel && selArea && cm && (
            <div className="card-admin space-y-3 p-4">
              <p className="text-sm font-bold">{selArea.code === FREE ? t("التصميم المحدد", "Selected design") : (locale === "ar" ? selArea.name_ar : selArea.name_en)}</p>
              <div className="flex flex-wrap gap-2">
                <button type="button" disabled={busy} onClick={() => pick(sel.key)} className="btn btn-outline btn-sm"><RefreshCw className="size-4" /> {t("استبدال", "Replace")}</button>
                <button type="button" onClick={() => remove(sel.key)} className="btn btn-sm border border-danger text-danger"><Trash2 className="size-4" /> {t("إزالة", "Remove")}</button>
              </div>
              <p className="text-sm">{t("حجم الطباعة:", "Print size:")} <b className="tabular-nums" dir="ltr">{selArea.code === FREE ? "≈ " : ""}{cm.w} × {cm.h} cm</b>{selArea.code !== FREE && <span className="text-xs text-mute"> ({t("الحد", "max")} {selArea.max_width_cm}×{selArea.max_height_cm})</span>}</p>
              <label className="block">
                <span className="mb-1 block text-xs font-semibold text-mute">{t("الحجم", "Size")} — {widthPct}%</span>
                <input type="range" min={3} max={100} value={widthPct} onChange={(e) => patch(sel.key, resizeDesign(sel, selArea, view, sel.artwork_width, sel.artwork_height, Number(e.target.value) / 100))} className="w-full accent-[var(--color-pine)]" />
              </label>
              <div className="flex flex-wrap gap-1.5">
                <Btn label={t("توسيط أفقي", "Centre horizontally")} onClick={() => patch(sel.key, { x: (1 - sel.width) / 2 })}><AlignCenterVertical className="size-4" /></Btn>
                <Btn label={t("توسيط عمودي", "Centre vertically")} onClick={() => patch(sel.key, { y: (1 - sel.height) / 2 })}><AlignCenterHorizontal className="size-4" /></Btn>
                <Btn label={t("للأعلى", "To the top")} onClick={() => patch(sel.key, { y: 0 })}><ArrowUpToLine className="size-4" /></Btn>
                <Btn label={t("أكبر حجم ممكن", "Largest size")} onClick={() => patch(sel.key, clampRect(fitArtwork(selArea, view, sel.artwork_width, sel.artwork_height, 1)))}><Expand className="size-4" /></Btn>
              </div>
              <p className="text-[11px] text-mute">{selArea.code === FREE ? t("الحجم بالسنتيمتر تقريبي — محسوب من مقاس القطعة.", "The cm size is an estimate from the garment's size.") : t("التصميم لا يخرج عن منطقة الطباعة، والنسبة محفوظة أثناء تغيير الحجم.", "The artwork never leaves the print area, and its proportions are kept while resizing.")}</p>
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
