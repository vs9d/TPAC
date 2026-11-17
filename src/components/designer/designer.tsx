"use client";
import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react";
import type { Canvas as FabricCanvas, FabricObject, IText as FabricIText } from "fabric";
import { AlignCenter, ArrowUp, ImagePlus, Loader2, Minus, Plus, Trash2, Type as TypeIcon, AlertTriangle } from "lucide-react";
import { useI18n } from "@/components/i18n-provider";
import { useCart } from "@/components/cart/store";
import { toast } from "@/components/ui/toast";
import { saveDesign } from "@/lib/actions/design";
import { uploadArtwork, ACCEPT_DESIGN } from "@/lib/upload-client";
import { ARTBOARD, GARMENTS, LOCATION_VIEW, garmentDataUrl, type GarmentType, type GarmentView, type PrintLocation } from "@/lib/garments";
import { formatIQD, cn } from "@/lib/format";
import type { Color, GarmentTypeRow, PrintLocationRow } from "@/lib/types";

type Tagged = FabricObject & { tpacLocation?: PrintLocation; tpacArtworkId?: string; tpacKind?: "image" | "text" | "guide" };

export interface DesignerFont { label: string; family: string }

const TEXT_COLORS = ["#111111", "#FFFFFF", "#E3963C", "#376352", "#C0392B", "#1C2541", "#E9E2D3", "#F2C94C"];

export function Designer({ garments, locations, colors, fonts, initialGarment, initialColor }: { garments: GarmentTypeRow[]; locations: PrintLocationRow[]; colors: Color[]; fonts: DesignerFont[]; initialGarment?: string; initialColor?: string }) {
  const { locale, dict } = useI18n();
  const addToCart = useCart((s) => s.add);
  const openDrawer = useCart((s) => s.openDrawer);

  const first = garments.find((g) => g.code === initialGarment) ?? garments[0]!;
  const [garmentCode, setGarmentCode] = useState<GarmentTypeRow["code"]>(first.code);
  const garment = garments.find((g) => g.code === garmentCode)!;
  const garmentColors = useMemo(() => colors.filter((c) => garment.color_ids.includes(c.id)), [colors, garment]);
  const [colorId, setColorId] = useState<string>(garmentColors.find((c) => c.code === initialColor)?.id ?? garmentColors[0]?.id ?? "");
  const color = colors.find((c) => c.id === colorId) ?? garmentColors[0];
  const [size, setSize] = useState(garment.sizes.includes("L") ? "L" : garment.sizes[0]!);
  const availableLocations = locations.filter((l) => garment.print_locations.includes(l.code));
  const [location, setLocation] = useState<PrintLocation>("front");
  const view: GarmentView = LOCATION_VIEW[location];
  const [qty, setQty] = useState(1);
  const [notes, setNotes] = useState("");
  const [usedLocations, setUsedLocations] = useState<PrintLocation[]>([]);
  const [selected, setSelected] = useState<Tagged | null>(null);
  const [textValue, setTextValue] = useState("");
  const [uploading, setUploading] = useState(false);
  const [lowRes, setLowRes] = useState(false);
  const [saving, startSaving] = useTransition();
  const [ready, setReady] = useState(false);

  const wrapRef = useRef<HTMLDivElement>(null);
  const elRef = useRef<HTMLCanvasElement>(null);
  const canvasRef = useRef<FabricCanvas | null>(null);
  const fabricRef = useRef<typeof import("fabric") | null>(null);
  const stateRef = useRef({ garmentCode, location, view, colorHex: color?.hex ?? "#FFFFFF" });
  stateRef.current = { garmentCode, location, view, colorHex: color?.hex ?? "#FFFFFF" };

  const area = useCallback((loc: PrintLocation) => GARMENTS[stateRef.current.garmentCode as GarmentType].printAreas[loc], []);

  const refreshUsed = useCallback(() => {
    const c = canvasRef.current;
    if (!c) return;
    const used = new Set<PrintLocation>();
    for (const o of c.getObjects() as Tagged[]) if (o.tpacKind !== "guide" && o.tpacLocation) used.add(o.tpacLocation);
    setUsedLocations([...used]);
  }, []);

  /** Keep an object fully inside its print area (scale down if needed, then clamp position). */
  const constrain = useCallback((o: Tagged) => {
    if (!o.tpacLocation) return;
    const a = area(o.tpacLocation);
    o.setCoords();
    let pts = o.getCoords();
    let w = Math.max(...pts.map((p) => p.x)) - Math.min(...pts.map((p) => p.x));
    let h = Math.max(...pts.map((p) => p.y)) - Math.min(...pts.map((p) => p.y));
    const k = Math.min(1, a.width / w, a.height / h);
    if (k < 1) {
      o.set({ scaleX: (o.scaleX ?? 1) * k * 0.999, scaleY: (o.scaleY ?? 1) * k * 0.999 });
      o.setCoords();
      pts = o.getCoords();
      w = Math.max(...pts.map((p) => p.x)) - Math.min(...pts.map((p) => p.x));
      h = Math.max(...pts.map((p) => p.y)) - Math.min(...pts.map((p) => p.y));
    }
    const minX = Math.min(...pts.map((p) => p.x));
    const minY = Math.min(...pts.map((p) => p.y));
    let dx = 0;
    let dy = 0;
    if (minX < a.x) dx = a.x - minX;
    else if (minX + w > a.x + a.width) dx = a.x + a.width - (minX + w);
    if (minY < a.y) dy = a.y - minY;
    else if (minY + h > a.y + a.height) dy = a.y + a.height - (minY + h);
    if (dx || dy) o.set({ left: (o.left ?? 0) + dx, top: (o.top ?? 0) + dy });
    o.setCoords();
  }, [area]);

  /** Background garment, guides, and per-view visibility / editability. */
  const renderScene = useCallback(async (override?: { view: GarmentView; location: PrintLocation }) => {
    const c = canvasRef.current;
    const F = fabricRef.current;
    if (!c || !F) return;
    const { garmentCode: g, colorHex } = stateRef.current;
    const v = override?.view ?? stateRef.current.view;
    const loc = override?.location ?? stateRef.current.location;
    const bg = await F.FabricImage.fromURL(garmentDataUrl(g as GarmentType, v, colorHex));
    bg.set({ originX: "left", originY: "top", left: 0, top: 0, scaleX: ARTBOARD.width / (bg.width || 600), scaleY: ARTBOARD.height / (bg.height || 700) });
    c.backgroundImage = bg;
    for (const o of c.getObjects() as Tagged[]) if (o.tpacKind === "guide") c.remove(o);
    for (const l of Object.keys(GARMENTS[g as GarmentType].printAreas) as PrintLocation[]) {
      if (LOCATION_VIEW[l] !== v) continue;
      const a = GARMENTS[g as GarmentType].printAreas[l];
      const dark = colorHex && parseInt(colorHex.slice(1, 3), 16) + parseInt(colorHex.slice(3, 5), 16) + parseInt(colorHex.slice(5, 7), 16) < 300;
      const guide = new F.Rect({
        originX: "left",
        originY: "top",
        left: a.x,
        top: a.y,
        width: a.width,
        height: a.height,
        fill: l === loc ? (dark ? "rgba(255,255,255,0.05)" : "rgba(0,0,0,0.03)") : "transparent",
        stroke: l === loc ? "#E3963C" : dark ? "rgba(255,255,255,0.3)" : "rgba(0,0,0,0.25)",
        strokeDashArray: [6, 5],
        strokeWidth: l === loc ? 1.5 : 1,
        selectable: false,
        evented: false,
        excludeFromExport: true,
      }) as Tagged;
      guide.tpacKind = "guide";
      c.add(guide);
      c.sendObjectToBack(guide);
    }
    for (const o of c.getObjects() as Tagged[]) {
      if (o.tpacKind === "guide") continue;
      const onView = !!o.tpacLocation && LOCATION_VIEW[o.tpacLocation] === v;
      o.set({ visible: onView, selectable: o.tpacLocation === loc, evented: o.tpacLocation === loc });
      if (o.tpacLocation) {
        const a = GARMENTS[g as GarmentType].printAreas[o.tpacLocation];
        o.clipPath = new F.Rect({ originX: "left", originY: "top", left: a.x, top: a.y, width: a.width, height: a.height, absolutePositioned: true });
        constrain(o);
      }
    }
    const active = c.getActiveObject() as Tagged | undefined;
    if (active && active.tpacLocation !== loc) c.discardActiveObject();
    c.requestRenderAll();
  }, [constrain]);

  // Initialise Fabric once.
  useEffect(() => {
    let disposed = false;
    let ro: ResizeObserver | null = null;
    (async () => {
      const F = await import("fabric");
      if (disposed || !elRef.current) return;
      fabricRef.current = F;
      const c = new F.Canvas(elRef.current, { preserveObjectStacking: true, selection: false, controlsAboveOverlay: true, enableRetinaScaling: true });
      canvasRef.current = c;
      const fit = () => {
        const w = Math.min(wrapRef.current?.clientWidth ?? 600, 680);
        c.setDimensions({ width: w, height: (w * ARTBOARD.height) / ARTBOARD.width });
        c.setZoom(w / ARTBOARD.width);
        c.requestRenderAll();
      };
      fit();
      ro = new ResizeObserver(fit);
      if (wrapRef.current) ro.observe(wrapRef.current);
      const onChange = (e: { target?: FabricObject }) => {
        if (e.target) constrain(e.target as Tagged);
      };
      c.on("object:moving", onChange);
      c.on("object:scaling", onChange);
      c.on("object:rotating", onChange);
      c.on("object:modified", (e) => {
        onChange(e);
        c.requestRenderAll();
      });
      const sel = () => {
        const o = (c.getActiveObject() as Tagged) ?? null;
        setSelected(o);
        setTextValue(o && o.tpacKind === "text" ? ((o as unknown as FabricIText).text ?? "") : "");
      };
      c.on("selection:created", sel);
      c.on("selection:updated", sel);
      c.on("selection:cleared", sel);
      c.on("text:changed", (e) => {
        const t = e.target as unknown as FabricIText;
        setTextValue(t.text ?? "");
        constrain(t as unknown as Tagged);
      });
      await renderScene();
      if (!disposed) setReady(true);
    })();
    return () => {
      disposed = true;
      ro?.disconnect();
      canvasRef.current?.dispose();
      canvasRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Garment change: keep colour/size valid; drop objects on locations the garment doesn't support.
  useEffect(() => {
    if (!garment.color_ids.includes(colorId)) setColorId(garmentColors[0]?.id ?? "");
    if (!garment.sizes.includes(size)) setSize(garment.sizes[0]!);
    if (!garment.print_locations.includes(location)) setLocation("front");
    const c = canvasRef.current;
    if (c) for (const o of c.getObjects() as Tagged[]) if (o.tpacLocation && !garment.print_locations.includes(o.tpacLocation)) c.remove(o);
    refreshUsed();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [garmentCode]);

  useEffect(() => {
    void renderScene();
  }, [garmentCode, colorId, location, renderScene]);

  const placeNew = (o: Tagged, kind: "image" | "text") => {
    const c = canvasRef.current!;
    const a = area(location);
    o.tpacLocation = location;
    o.tpacKind = kind;
    o.set({ left: a.x + a.width / 2, top: a.y + Math.min(a.height / 2, kind === "text" ? a.height * 0.25 : a.height / 2), cornerColor: "#E3963C", cornerStyle: "circle", transparentCorners: false, borderColor: "#E3963C", cornerSize: 12, padding: 2 });
    o.setControlsVisibility({ mt: false, mb: false, ml: false, mr: false });
    c.add(o);
    void renderScene().then(() => {
      c.setActiveObject(o);
      c.requestRenderAll();
      refreshUsed();
    });
  };

  const onUpload = async (file: File) => {
    const F = fabricRef.current;
    if (!F) return;
    setUploading(true);
    try {
      const { id, width } = await uploadArtwork(file, "design");
      const url = URL.createObjectURL(file);
      const img = (await F.FabricImage.fromURL(url)) as Tagged;
      const a = area(location);
      const scale = Math.min((a.width * 0.85) / (img.width || 1), (a.height * 0.85) / (img.height || 1));
      img.set({ scaleX: scale, scaleY: scale });
      img.tpacArtworkId = id;
      // Recommend ≥150 DPI at the physical print width.
      const needed = (a.cm.width / 2.54) * 150;
      setLowRes(file.type !== "image/svg+xml" && (width ?? img.width ?? 0) < needed);
      placeNew(img, "image");
    } catch (e) {
      const key = e instanceof Error ? e.message : "";
      toast.error(key === "fileType" ? dict.validation.fileType : key === "fileSize" ? dict.validation.fileSize : key === "rate_limited" ? dict.checkout.errors.rate_limited! : dict.common.somethingWrong);
    } finally {
      setUploading(false);
    }
  };

  const addText = async () => {
    const F = fabricRef.current;
    if (!F) return;
    const font = fonts[0]!;
    await document.fonts.load(`700 48px ${font.family}`).catch(() => undefined);
    const t = new F.IText(dict.designer.textPlaceholder, {
      fontFamily: font.family,
      fontSize: location === "front" || location === "back" ? 44 : 18,
      fontWeight: 700,
      fill: (color?.hex ?? "#fff") === "#111111" || parseInt((color?.hex ?? "#ffffff").slice(1, 3), 16) < 90 ? "#FFFFFF" : "#111111",
      textAlign: "center",
      direction: locale === "ar" ? "rtl" : "ltr",
    }) as unknown as Tagged;
    placeNew(t, "text");
  };

  const updateSelected = (props: Record<string, unknown>) => {
    const c = canvasRef.current;
    if (!c || !selected) return;
    selected.set(props);
    constrain(selected);
    c.requestRenderAll();
    setSelected(selected);
  };

  const removeSelected = () => {
    const c = canvasRef.current;
    if (!c || !selected) return;
    c.remove(selected);
    c.discardActiveObject();
    c.requestRenderAll();
    setSelected(null);
    refreshUsed();
  };

  const price = garment.base_price + usedLocations.reduce((n, l) => n + (locations.find((x) => x.code === l)?.price ?? 0), 0);

  /** Renders a view to JPEG (garment + design, no guides). */
  const exportView = async (v: GarmentView): Promise<string> => {
    const c = canvasRef.current!;
    await renderScene({ view: v, location: v === "front" ? "front" : "back" });
    for (const o of c.getObjects() as Tagged[]) if (o.tpacKind === "guide") o.visible = false;
    c.discardActiveObject();
    c.backgroundColor = "#F3F1EC";
    c.renderAll();
    const url = c.toDataURL({ format: "jpeg", quality: 0.9, multiplier: 900 / c.getWidth() });
    c.backgroundColor = "";
    await renderScene();
    return url;
  };

  const save = () => {
    const c = canvasRef.current;
    if (!c) return;
    const objs = (c.getObjects() as Tagged[]).filter((o) => o.tpacKind === "image" || o.tpacKind === "text");
    if (!objs.length) {
      toast.error(dict.designer.emptyDesign);
      return;
    }
    startSaving(async () => {
      const [front, back] = [await exportView("front"), await exportView("back")];
      const thumb = await downscale(front, 360);
      const res = await saveDesign({
        garment_type: garmentCode,
        color_id: colorId,
        size_code: size,
        notes: notes || undefined,
        preview_front: front,
        preview_back: back,
        objects: objs.map((o) => {
          const base = {
            type: o.tpacKind as "image" | "text",
            location: o.tpacLocation!,
            left: o.left ?? 0,
            top: o.top ?? 0,
            scaleX: o.scaleX ?? 1,
            scaleY: o.scaleY ?? 1,
            angle: o.angle ?? 0,
            width: o.width || 1,
            height: o.height || 1,
          };
          if (o.tpacKind === "image") return { ...base, artwork_id: o.tpacArtworkId };
          const t = o as unknown as FabricIText;
          return { ...base, text: (t.text ?? "").slice(0, 200), fill: String(t.fill ?? "#111111").toUpperCase(), fontFamily: String(t.fontFamily ?? "").split(",")[0]!.replace(/['"]/g, "").slice(0, 60), fontSize: t.fontSize, fontWeight: t.fontWeight as string | number };
        }),
      });
      if (!res.ok) {
        toast.error(res.error === "rate_limited" ? dict.checkout.errors.rate_limited! : dict.common.somethingWrong);
        return;
      }
      addToCart({
        custom_design_id: res.design_id,
        quantity: qty,
        snapshot: {
          name_ar: `${garment.name_ar} — تصميم خاص`,
          name_en: `Custom ${garment.name_en}`,
          image: thumb,
          size,
          color_hex: color?.hex,
          color_name_ar: color?.name_ar,
          color_name_en: color?.name_en,
          unit_price: res.unit_price,
          print_locations: res.print_locations,
        },
      });
      toast.success(dict.designer.added);
      openDrawer(true);
    });
  };

  const selText = selected?.tpacKind === "text" ? (selected as unknown as FabricIText) : null;

  return (
    <div className="grid gap-8 pb-24 md:pb-0 lg:grid-cols-12 lg:gap-10">
      {/* Canvas */}
      <div className="lg:col-span-7">
        <div className="sticky top-20 z-10 bg-paper pb-2 lg:top-28">
          <div className="mb-3 flex items-center justify-between gap-3">
            <div className="flex rounded-full border border-line p-1" role="tablist" aria-label={dict.designer.view}>
              {(["front", "back"] as GarmentView[]).map((v) => (
                <button key={v} role="tab" aria-selected={view === v} onClick={() => setLocation(v === "front" ? (garment.print_locations.includes("front") ? "front" : "left_chest") : "back")} className={cn("rounded-full px-5 py-2 text-sm font-bold transition-colors", view === v ? "bg-pine text-white dark:text-night" : "hover:bg-bone")}>
                  {v === "front" ? dict.designer.front : dict.designer.back}
                </button>
              ))}
            </div>
            <p className="text-xs text-mute">{dict.designer.selectLocationHint}</p>
          </div>
          <div ref={wrapRef} className="relative mx-auto w-full max-w-[680px] overflow-hidden rounded-[1.75rem] bg-[radial-gradient(ellipse_at_50%_40%,#F6F4F0_0%,#E9E5DD_75%)]" style={{ aspectRatio: `${ARTBOARD.width} / ${ARTBOARD.height}` }}>
            <canvas ref={elRef} aria-label={dict.designer.title} />
            {!ready && <div className="absolute inset-0 grid place-items-center"><Loader2 className="size-6 animate-spin text-mute" /></div>}
            {saving && (
              <div className="absolute inset-0 grid place-items-center bg-paper/70">
                <p className="flex items-center gap-2 text-sm font-semibold"><Loader2 className="size-4 animate-spin" /> {dict.designer.saving}</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Controls */}
      <div className="space-y-8 lg:col-span-5">
        <section>
          <h2 className="label">{dict.designer.garment}</h2>
          <div className="grid grid-cols-2 gap-2">
            {garments.map((g) => (
              <button key={g.code} aria-pressed={g.code === garmentCode} onClick={() => setGarmentCode(g.code)} className="chip h-auto flex-col items-start px-3 py-2.5 text-start">
                <span>{locale === "ar" ? g.name_ar : g.name_en}</span>
                <span className="text-xs font-normal opacity-70">{formatIQD(g.base_price, locale)}</span>
              </button>
            ))}
          </div>
        </section>

        <section>
          <h2 className="label">{dict.designer.color}: <span className="font-normal text-mute">{color ? (locale === "ar" ? color.name_ar : color.name_en) : ""}</span></h2>
          <div className="flex flex-wrap gap-3" role="radiogroup" aria-label={dict.designer.color}>
            {garmentColors.map((c) => (
              <button key={c.id} role="radio" aria-checked={c.id === colorId} aria-label={locale === "ar" ? c.name_ar : c.name_en} onClick={() => setColorId(c.id)} className={cn("size-10 rounded-full border transition", c.id === colorId ? "border-ink ring-2 ring-ink ring-offset-2" : "border-ink/25")} style={{ background: c.hex }} />
            ))}
          </div>
        </section>

        <section>
          <h2 className="label">{dict.designer.size}</h2>
          <div className="flex flex-wrap gap-2" role="radiogroup" aria-label={dict.designer.size}>
            {garment.sizes.map((s) => <button key={s} role="radio" aria-checked={s === size} onClick={() => setSize(s)} className="chip">{s}</button>)}
          </div>
        </section>

        <section>
          <h2 className="label">{dict.designer.location}</h2>
          <div className="grid grid-cols-2 gap-2">
            {availableLocations.map((l) => (
              <button key={l.code} aria-pressed={location === l.code} onClick={() => setLocation(l.code)} className="chip h-auto justify-between px-3 py-2.5">
                <span className="flex items-center gap-2">
                  {usedLocations.includes(l.code) && <span className="size-2 rounded-full bg-amber" aria-hidden />}
                  {dict.designer.locations[l.code]}
                </span>
                <span className="text-xs font-normal opacity-70">+{formatIQD(l.price, locale)}</span>
              </button>
            ))}
          </div>
          <p className="mt-2 text-xs text-mute">
            {dict.designer.printArea}: {GARMENTS[garmentCode as GarmentType].printAreas[location].cm.width}×{GARMENTS[garmentCode as GarmentType].printAreas[location].cm.height} cm
          </p>
        </section>

        <section className="grid grid-cols-2 gap-2">
          <label className={cn("btn btn-outline cursor-pointer", (uploading || !ready) && "pointer-events-none opacity-50")} aria-disabled={!ready}>
            {uploading ? <Loader2 className="size-4 animate-spin" /> : <ImagePlus className="size-4" />}
            {uploading ? dict.designer.uploading : dict.designer.upload}
            <input type="file" accept={ACCEPT_DESIGN} className="sr-only" disabled={!ready} onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ""; if (f) void onUpload(f); }} />
          </label>
          <button onClick={addText} disabled={!ready} className="btn btn-outline"><TypeIcon className="size-4" /> {dict.designer.addText}</button>
          <p className="col-span-2 text-xs text-mute">{dict.designer.uploadHint}</p>
          {lowRes && <p className="col-span-2 flex items-center gap-2 text-xs font-semibold text-amber-deep"><AlertTriangle className="size-4" /> {dict.designer.lowResWarning}</p>}
        </section>

        {selected && (
          <section className="space-y-4 border border-line p-4">
            {selText && (
              <>
                <div>
                  <label htmlFor="d-text" className="label">{dict.designer.addText}</label>
                  <input id="d-text" className="field" maxLength={200} value={textValue} onChange={(e) => { setTextValue(e.target.value); updateSelected({ text: e.target.value }); }} />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label htmlFor="d-font" className="label">{dict.designer.font}</label>
                    <select id="d-font" className="field h-10" value={String(selText.fontFamily)} onChange={async (e) => { await document.fonts.load(`700 40px ${e.target.value}`).catch(() => undefined); updateSelected({ fontFamily: e.target.value }); }}>
                      {fonts.map((f) => <option key={f.family} value={f.family}>{f.label}</option>)}
                    </select>
                  </div>
                  <div>
                    <p className="label">{dict.designer.fontSize}</p>
                    <div className="flex h-10 items-center border border-line">
                      <button className="grid h-full w-10 place-items-center" onClick={() => updateSelected({ fontSize: Math.max(8, (selText.fontSize ?? 40) - 4) })} aria-label="-"><Minus className="size-4" /></button>
                      <span className="flex-1 text-center text-sm tabular-nums">{Math.round(selText.fontSize ?? 40)}</span>
                      <button className="grid h-full w-10 place-items-center" onClick={() => updateSelected({ fontSize: Math.min(200, (selText.fontSize ?? 40) + 4) })} aria-label="+"><Plus className="size-4" /></button>
                    </div>
                  </div>
                </div>
                <div>
                  <p className="label">{dict.designer.textColor}</p>
                  <div className="flex flex-wrap gap-2">
                    {TEXT_COLORS.map((hex) => (
                      <button key={hex} aria-label={hex} aria-pressed={String(selText.fill).toUpperCase() === hex} onClick={() => updateSelected({ fill: hex })} className={cn("size-8 rounded-full border", String(selText.fill).toUpperCase() === hex ? "ring-2 ring-ink ring-offset-2" : "border-ink/25")} style={{ background: hex }} />
                    ))}
                    <input type="color" aria-label={dict.designer.textColor} value={String(selText.fill).startsWith("#") ? String(selText.fill) : "#111111"} onChange={(e) => updateSelected({ fill: e.target.value.toUpperCase() })} className="size-8 cursor-pointer border border-line" />
                  </div>
                </div>
              </>
            )}
            <div className="flex flex-wrap gap-2">
              <button className="btn btn-ghost btn-sm border border-line" onClick={() => { const a = area(location); updateSelected({ left: a.x + a.width / 2 }); }}><AlignCenter className="size-4" /> {dict.designer.center}</button>
              <button className="btn btn-ghost btn-sm border border-line" onClick={() => { canvasRef.current?.bringObjectForward(selected); canvasRef.current?.requestRenderAll(); }}><ArrowUp className="size-4" /> {dict.designer.bringForward}</button>
              <button className="btn btn-sm border border-danger text-danger hover:bg-danger hover:text-paper" onClick={removeSelected}><Trash2 className="size-4" /> {dict.designer.remove}</button>
            </div>
          </section>
        )}

        <section>
          <label htmlFor="d-notes" className="label">{dict.designer.notes}</label>
          <textarea id="d-notes" rows={2} maxLength={1000} className="field" value={notes} onChange={(e) => setNotes(e.target.value)} />
        </section>

        <section className="space-y-4 rounded-[1.75rem] bg-bone p-5">
          <p className="eyebrow text-mute">{dict.designer.estimatedPrice}</p>
          <div className="space-y-1.5 text-sm">
            <div className="flex justify-between"><span>{dict.designer.base} — {locale === "ar" ? garment.name_ar : garment.name_en}</span><span className="tabular-nums">{formatIQD(garment.base_price, locale)}</span></div>
            {usedLocations.map((l) => (
              <div key={l} className="flex justify-between text-mute"><span>{dict.designer.printCost}: {dict.designer.locations[l]}</span><span className="tabular-nums">+{formatIQD(locations.find((x) => x.code === l)?.price ?? 0, locale)}</span></div>
            ))}
          </div>
          <div className="flex items-end justify-between border-t border-line pt-3">
            <div className="flex items-center rounded-full border border-line bg-paper" role="group" aria-label={dict.designer.quantity}>
              <button className="grid size-10 place-items-center" onClick={() => setQty((q) => Math.max(1, q - 1))} aria-label="-"><Minus className="size-4" /></button>
              <span className="w-8 text-center font-semibold tabular-nums">{qty}</span>
              <button className="grid size-10 place-items-center" onClick={() => setQty((q) => Math.min(99, q + 1))} aria-label="+"><Plus className="size-4" /></button>
            </div>
            <p className="display text-2xl tabular-nums">{formatIQD(price * qty, locale)}</p>
          </div>
          <button onClick={save} disabled={saving || uploading || !ready} className="btn btn-brand hidden h-14 w-full text-base md:inline-flex">
            {saving ? <><Loader2 className="size-4 animate-spin" /> {dict.designer.saving}</> : dict.designer.addToCart}
          </button>
        </section>
      </div>

      {/* Mobile: price + action always within thumb reach */}
      <div className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-paper/90 px-4 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-3 backdrop-blur-xl md:hidden">
        <div className="mx-auto flex max-w-md items-center gap-3">
          <div className="shrink-0">
            <p className="text-[11px] text-mute">{dict.designer.estimatedPrice}</p>
            <p className="display text-xl tabular-nums">{formatIQD(price * qty, locale)}</p>
          </div>
          <button onClick={save} disabled={saving || uploading || !ready} className="btn btn-brand h-12 flex-1">
            {saving ? <Loader2 className="size-4 animate-spin" /> : dict.designer.addToCart}
          </button>
        </div>
      </div>
    </div>
  );
}

async function downscale(dataUrl: string, width: number): Promise<string> {
  const img = new Image();
  img.src = dataUrl;
  await img.decode();
  const c = document.createElement("canvas");
  c.width = width;
  c.height = Math.round((img.height / img.width) * width);
  c.getContext("2d")!.drawImage(img, 0, 0, c.width, c.height);
  return c.toDataURL("image/jpeg", 0.8);
}
