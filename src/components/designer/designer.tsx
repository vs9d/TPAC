"use client";
import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react";
import type { Canvas as FabricCanvas, FabricObject, IText as FabricIText } from "fabric";
import { Download, Eye, EyeOff, Loader2, Redo2, Trash2, Undo2 } from "lucide-react";
import { useI18n } from "@/components/i18n-provider";
import { useCart } from "@/components/cart/store";
import { toast } from "@/components/ui/toast";
import { saveDesign } from "@/lib/actions/design";
import { uploadArtwork } from "@/lib/upload-client";
import { adminT } from "@/lib/admin-i18n";
import { ARTBOARD, GARMENTS, LOCATION_VIEW, garmentDataUrl, luminance, type GarmentType, type GarmentView, type PrintLocation } from "@/lib/garments";
import { SHAPES, TEMPLATES, TEXT_PRESETS_UI, shapeById, type DesignerFont } from "@/lib/design-assets";
import { discountedUnit, resolveOptions, tierPercent, type OptionLite } from "@/lib/design-pricing";
import { cn, formatIQD } from "@/lib/format";
import type { Color, DesignerOptionRow, DesignerSettings, DesignerTierRow, GarmentTypeRow, PrintLocationRow } from "@/lib/types";
import { PROPS, type Choice, type DesignerApi, type LayerInfo, type TabId, type Tagged } from "./types";
import { Inspector } from "./inspector";
import { AddTab, LayersTab, OrderTab, ProductTab } from "./tabs";
import { ReviewDialog } from "./review";

const MAX_HISTORY = 60;
const NUDGE = 1;

export function Designer({ garments, locations, colors, fonts, options, tiers, settings, initialGarment, initialColor }: {
  garments: GarmentTypeRow[];
  locations: PrintLocationRow[];
  colors: Color[];
  fonts: DesignerFont[];
  options: DesignerOptionRow[];
  tiers: DesignerTierRow[];
  settings: DesignerSettings;
  initialGarment?: string;
  initialColor?: string;
}) {
  const { locale, dict } = useI18n();
  const t = adminT(locale);
  const addToCart = useCart((s) => s.add);
  const openDrawer = useCart((s) => s.openDrawer);

  // ------------------------------------------------------------------ product state
  const first = garments.find((g) => g.code === initialGarment) ?? garments[0]!;
  const [garmentCode, setGarmentCode] = useState<GarmentTypeRow["code"]>(first.code);
  const garment = garments.find((g) => g.code === garmentCode)!;
  const garmentColors = useMemo(() => colors.filter((c) => garment.color_ids.includes(c.id)), [colors, garment]);
  const [colorId, setColorId] = useState<string>(garmentColors.find((c) => c.code === initialColor)?.id ?? garmentColors[0]?.id ?? "");
  const color = colors.find((c) => c.id === colorId) ?? garmentColors[0];
  const [sizes, setSizes] = useState<Record<string, number>>({ [garment.sizes.includes("L") ? "L" : garment.sizes[0]!]: 1 });
  const optionLite = useMemo<OptionLite[]>(() => options.map((o) => ({ id: o.id, group_code: o.group_code, code: o.code, price: o.price, is_default: o.is_default })), [options]);
  const [choice, setChoice] = useState<Choice>(() => resolveOptions(optionLite, {}).choice);
  const [notes, setNotes] = useState("");
  const [designName, setDesignName] = useState("");

  // ------------------------------------------------------------------ editor state
  const [tab, setTab] = useState<TabId>("add");
  const [location, setLocation] = useState<PrintLocation>("front");
  const view: GarmentView = LOCATION_VIEW[location];
  const [guides, setGuides] = useState(true);
  const [layers, setLayers] = useState<LayerInfo[]>([]);
  const [selected, setSelected] = useState<Tagged | null>(null);
  const [tick, setTick] = useState(0);
  const [uploading, setUploading] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [ready, setReady] = useState(false);
  const [hist, setHist] = useState({ undo: false, redo: false });
  const [review, setReview] = useState<{ front: string; back: string } | null>(null);
  const [preparing, setPreparing] = useState(false);
  const [saving, startSaving] = useTransition();

  const wrapRef = useRef<HTMLDivElement>(null);
  const elRef = useRef<HTMLCanvasElement>(null);
  const canvasRef = useRef<FabricCanvas | null>(null);
  const fabricRef = useRef<typeof import("fabric") | null>(null);
  const exportingRef = useRef(false);
  const snapRef = useRef({ x: false, y: false, loc: "front" as PrintLocation });
  const historyRef = useRef<{ stack: string[]; index: number; busy: boolean; timer: ReturnType<typeof setTimeout> | null }>({ stack: [], index: -1, busy: false, timer: null });
  const stateRef = useRef({ garmentCode, location, view, colorHex: color?.hex ?? "#FFFFFF", guides });
  stateRef.current = { garmentCode, location, view, colorHex: color?.hex ?? "#FFFFFF", guides };

  const area = useCallback((loc: PrintLocation) => GARMENTS[stateRef.current.garmentCode as GarmentType].printAreas[loc], []);
  const design = useCallback(() => ((canvasRef.current?.getObjects() ?? []) as Tagged[]).filter((o) => o.tpacKind && o.tpacKind !== "guide"), []);

  // ------------------------------------------------------------------ helpers
  const bbox = (o: Tagged) => {
    o.setCoords();
    const pts = o.getCoords();
    const xs = pts.map((p) => p.x);
    const ys = pts.map((p) => p.y);
    const x = Math.min(...xs);
    const y = Math.min(...ys);
    return { x, y, w: Math.max(...xs) - x, h: Math.max(...ys) - y };
  };

  /** Keep an object fully inside its print area (scale down if needed, then clamp position). */
  const constrain = useCallback((o: Tagged) => {
    if (!o.tpacLocation) return;
    const a = area(o.tpacLocation);
    let b = bbox(o);
    const k = Math.min(1, a.width / b.w, a.height / b.h);
    if (k < 1) {
      o.set({ scaleX: (o.scaleX ?? 1) * k * 0.999, scaleY: (o.scaleY ?? 1) * k * 0.999 });
      b = bbox(o);
    }
    let dx = 0;
    let dy = 0;
    if (b.x < a.x) dx = a.x - b.x;
    else if (b.x + b.w > a.x + a.width) dx = a.x + a.width - (b.x + b.w);
    if (b.y < a.y) dy = a.y - b.y;
    else if (b.y + b.h > a.y + a.height) dy = a.y + a.height - (b.y + b.h);
    if (dx || dy) o.set({ left: (o.left ?? 0) + dx, top: (o.top ?? 0) + dy });
    o.setCoords();
  }, [area]);

  const labelOf = useCallback((o: Tagged): string => {
    if (o.tpacKind === "text") return ((o as unknown as FabricIText).text ?? "").replace(/\s+/g, " ").slice(0, 28) || t("نص", "Text");
    if (o.tpacKind === "shape") {
      const s = shapeById(o.tpacShape ?? "");
      return s ? (locale === "ar" ? s.ar : s.en) : t("شكل", "Shape");
    }
    return o.tpacLabel ?? t("صورة", "Image");
  }, [locale, t]);

  const syncLayers = useCallback(() => {
    setLayers(design().map((o) => ({ id: o.tpacId!, kind: o.tpacKind as LayerInfo["kind"], label: labelOf(o), location: o.tpacLocation!, hidden: !!o.tpacHidden, locked: !!o.tpacLocked })));
  }, [design, labelOf]);

  // ------------------------------------------------------------------ history (undo / redo)
  const flagHistory = () => {
    const h = historyRef.current;
    setHist({ undo: h.index > 0, redo: h.index < h.stack.length - 1 });
  };
  const snapshot = useCallback(() => {
    const h = historyRef.current;
    if (h.busy) return;
    const json = JSON.stringify(design().map((o) => o.toObject(PROPS)));
    if (h.stack[h.index] === json) return;
    h.stack = [...h.stack.slice(0, h.index + 1), json].slice(-MAX_HISTORY);
    h.index = h.stack.length - 1;
    flagHistory();
  }, [design]);
  const commitSoon = useCallback(() => {
    const h = historyRef.current;
    if (h.timer) clearTimeout(h.timer);
    h.timer = setTimeout(snapshot, 350);
  }, [snapshot]);

  /** Re-applies clipping / visibility / guides for the current view. */
  const renderScene = useCallback(async (override?: { view: GarmentView; location: PrintLocation }) => {
    const c = canvasRef.current;
    const F = fabricRef.current;
    if (!c || !F) return;
    const { garmentCode: g, colorHex, guides: showGuides } = stateRef.current;
    const v = override?.view ?? stateRef.current.view;
    const loc = override?.location ?? stateRef.current.location;
    const bg = await F.FabricImage.fromURL(garmentDataUrl(g as GarmentType, v, colorHex));
    bg.set({ originX: "left", originY: "top", left: 0, top: 0, scaleX: ARTBOARD.width / (bg.width || 600), scaleY: ARTBOARD.height / (bg.height || 700) });
    c.backgroundImage = bg;
    for (const o of c.getObjects() as Tagged[]) if (o.tpacKind === "guide") c.remove(o);
    const dark = luminance(colorHex) < 0.35;
    for (const l of Object.keys(GARMENTS[g as GarmentType].printAreas) as PrintLocation[]) {
      if (LOCATION_VIEW[l] !== v) continue;
      const a = GARMENTS[g as GarmentType].printAreas[l];
      const active = l === loc;
      const guide = new F.Rect({
        originX: "left", originY: "top", left: a.x, top: a.y, width: a.width, height: a.height,
        fill: active ? (dark ? "rgba(255,255,255,0.05)" : "rgba(0,0,0,0.03)") : "transparent",
        stroke: active ? "#E3963C" : dark ? "rgba(255,255,255,0.3)" : "rgba(0,0,0,0.25)",
        strokeDashArray: [6, 5], strokeWidth: active ? 1.5 : 1,
        selectable: false, evented: false, excludeFromExport: true, visible: showGuides,
      }) as Tagged;
      guide.tpacKind = "guide";
      c.add(guide);
      c.sendObjectToBack(guide);
    }
    for (const o of c.getObjects() as Tagged[]) {
      if (o.tpacKind === "guide") continue;
      const onView = !!o.tpacLocation && LOCATION_VIEW[o.tpacLocation] === v && !o.tpacHidden;
      o.set({ visible: onView, selectable: onView, evented: onView, lockMovementX: !!o.tpacLocked, lockMovementY: !!o.tpacLocked, lockScalingX: !!o.tpacLocked, lockScalingY: !!o.tpacLocked, lockRotation: !!o.tpacLocked, hasControls: !o.tpacLocked });
      if (o.tpacLocation) {
        const a = GARMENTS[g as GarmentType].printAreas[o.tpacLocation];
        o.clipPath = new F.Rect({ originX: "left", originY: "top", left: a.x, top: a.y, width: a.width, height: a.height, absolutePositioned: true });
        constrain(o);
      }
    }
    const active = c.getActiveObject() as Tagged | undefined;
    if (active && (!active.visible || (active.tpacLocation && LOCATION_VIEW[active.tpacLocation] !== v))) c.discardActiveObject();
    snapRef.current.loc = loc;
    c.requestRenderAll();
  }, [constrain]);

  const afterChange = useCallback(() => {
    const c = canvasRef.current;
    if (!c) return;
    syncLayers();
    setTick((n) => n + 1);
    commitSoon();
  }, [syncLayers, commitSoon]);

  const restore = useCallback(async (index: number) => {
    const c = canvasRef.current;
    const F = fabricRef.current;
    const h = historyRef.current;
    if (!c || !F || index < 0 || index >= h.stack.length) return;
    h.busy = true;
    try {
      c.discardActiveObject();
      for (const o of design()) c.remove(o);
      const objs = (await F.util.enlivenObjects(JSON.parse(h.stack[index]!))) as Tagged[];
      for (const o of objs) {
        o.setControlsVisibility({ mt: false, mb: false, ml: false, mr: false });
        c.add(o);
      }
      h.index = index;
      await renderScene();
      syncLayers();
      setSelected(null);
      flagHistory();
    } finally {
      h.busy = false;
    }
  }, [design, renderScene, syncLayers]);

  // ------------------------------------------------------------------ Fabric bootstrap
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
        if (exportingRef.current) return;
        const w = Math.min(wrapRef.current?.clientWidth ?? 600, 680);
        c.setDimensions({ width: w, height: (w * ARTBOARD.height) / ARTBOARD.width });
        c.setZoom(w / ARTBOARD.width);
        c.requestRenderAll();
      };
      fit();
      ro = new ResizeObserver(fit);
      if (wrapRef.current) ro.observe(wrapRef.current);

      c.on("object:moving", (e) => {
        const o = e.target as Tagged | undefined;
        if (!o) return;
        constrain(o);
        // snap to the centre of the placement
        const a = area(o.tpacLocation ?? stateRef.current.location);
        const b = bbox(o);
        const dx = a.x + a.width / 2 - (b.x + b.w / 2);
        const dy = a.y + a.height / 2 - (b.y + b.h / 2);
        snapRef.current.x = Math.abs(dx) < 5;
        snapRef.current.y = Math.abs(dy) < 5;
        if (snapRef.current.x) o.set({ left: (o.left ?? 0) + dx });
        if (snapRef.current.y) o.set({ top: (o.top ?? 0) + dy });
        snapRef.current.loc = o.tpacLocation ?? stateRef.current.location;
      });
      const clamp = (e: { target?: FabricObject }) => e.target && constrain(e.target as Tagged);
      c.on("object:scaling", clamp);
      c.on("object:rotating", clamp);
      c.on("object:modified", (e) => {
        clamp(e);
        snapRef.current.x = snapRef.current.y = false;
        c.requestRenderAll();
        afterChange();
      });
      c.on("mouse:up", () => {
        if (snapRef.current.x || snapRef.current.y) {
          snapRef.current.x = snapRef.current.y = false;
          c.requestRenderAll();
        }
      });
      c.on("after:render", () => {
        const { x, y, loc } = snapRef.current;
        if (!x && !y) return;
        const a = area(loc);
        const ctx = c.getContext();
        const r = c.getRetinaScaling();
        const z = c.getZoom();
        ctx.save();
        ctx.setTransform(r, 0, 0, r, 0, 0);
        ctx.strokeStyle = "#E3963C";
        ctx.lineWidth = 1;
        ctx.setLineDash([4, 4]);
        ctx.beginPath();
        if (x) { ctx.moveTo((a.x + a.width / 2) * z, a.y * z); ctx.lineTo((a.x + a.width / 2) * z, (a.y + a.height) * z); }
        if (y) { ctx.moveTo(a.x * z, (a.y + a.height / 2) * z); ctx.lineTo((a.x + a.width) * z, (a.y + a.height / 2) * z); }
        ctx.stroke();
        ctx.restore();
      });
      const sel = () => {
        const o = (c.getActiveObject() as Tagged) ?? null;
        setSelected(o);
        if (o?.tpacLocation && o.tpacLocation !== stateRef.current.location) setLocation(o.tpacLocation);
        setTick((n) => n + 1);
      };
      c.on("selection:created", sel);
      c.on("selection:updated", sel);
      c.on("selection:cleared", sel);
      c.on("text:changed", (e) => {
        constrain(e.target as unknown as Tagged);
        afterChange();
      });
      await renderScene();
      snapshot();
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

  // Garment change: keep colour / sizes / placements valid.
  useEffect(() => {
    if (!garment.color_ids.includes(colorId)) setColorId(garmentColors[0]?.id ?? "");
    setSizes((s) => {
      const kept = Object.fromEntries(Object.entries(s).filter(([k]) => garment.sizes.includes(k)));
      return Object.keys(kept).length ? kept : { [garment.sizes.includes("L") ? "L" : garment.sizes[0]!]: 1 };
    });
    if (!garment.print_locations.includes(location)) setLocation("front");
    const c = canvasRef.current;
    if (c) {
      for (const o of c.getObjects() as Tagged[]) if (o.tpacLocation && !garment.print_locations.includes(o.tpacLocation)) c.remove(o);
      syncLayers();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [garmentCode]);

  useEffect(() => {
    void renderScene();
  }, [garmentCode, colorId, location, guides, renderScene]);

  // ------------------------------------------------------------------ adding things
  const placeNew = useCallback((o: Tagged, kind: "image" | "text" | "shape", loc: PrintLocation = stateRef.current.location, dy = 0) => {
    const c = canvasRef.current!;
    const a = area(loc);
    o.tpacId = crypto.randomUUID();
    o.tpacLocation = loc;
    o.tpacKind = kind;
    o.set({ left: a.x + a.width / 2, top: a.y + a.height / 2 + dy * a.height, cornerColor: "#E3963C", cornerStyle: "circle", transparentCorners: false, borderColor: "#E3963C", cornerSize: 12, padding: 2 });
    o.setControlsVisibility({ mt: false, mb: false, ml: false, mr: false });
    c.add(o);
    constrain(o);
  }, [area, constrain]);

  const finishAdd = useCallback(async (o: Tagged) => {
    const c = canvasRef.current!;
    if (o.tpacLocation && LOCATION_VIEW[o.tpacLocation] !== stateRef.current.view) setLocation(o.tpacLocation);
    await renderScene();
    c.setActiveObject(o);
    c.requestRenderAll();
    syncLayers();
    snapshot();
    setSelected(o);
    setTick((n) => n + 1);
  }, [renderScene, syncLayers, snapshot]);

  const autoFill = useCallback(() => (luminance(stateRef.current.colorHex) < 0.45 ? "#FFFFFF" : "#111111"), []);

  const makeText = useCallback(async (presetId: string | undefined, over?: { text?: string; size?: number; fill?: string; loc?: PrintLocation }) => {
    const F = fabricRef.current!;
    const preset = TEXT_PRESETS_UI.find((p) => p.id === (presetId ?? (locale === "ar" ? "kufi" : "impact"))) ?? TEXT_PRESETS_UI[0]!;
    const font = fonts.find((f) => f.label === preset.font) ?? fonts[0]!;
    const weight = font.weights === 2 ? preset.weight : 400;
    await document.fonts.load(`${weight} 40px ${font.family}`).catch(() => undefined);
    const loc = over?.loc ?? stateRef.current.location;
    const small = loc === "left_chest" || loc === "sleeve" || loc === "sleeve_left";
    const fill = over?.fill ?? (preset.fill === "auto" ? autoFill() : preset.fill);
    const base = over?.text ?? dict.designer.textPlaceholder;
    const txt = new F.IText(preset.upper && !/[؀-ۿ]/.test(base) ? base.toUpperCase() : base, {
      fontFamily: font.family,
      fontSize: over?.size ?? (small ? Math.round(preset.size * 0.4) : preset.size),
      fontWeight: weight,
      fill: fill ?? "rgba(0,0,0,0)",
      stroke: preset.stroke ? (preset.stroke === "auto" ? autoFill() : preset.stroke) : undefined,
      strokeWidth: preset.strokeWidth ?? 0,
      paintFirst: "stroke",
      // letter-spacing would break the joined Arabic letterforms
      charSpacing: /[؀-ۿ]/.test(base) ? 0 : preset.charSpacing ?? 0,
      textAlign: "center",
      direction: /[؀-ۿ]/.test(base) || (locale === "ar" && !over?.text) ? "rtl" : "ltr",
    }) as unknown as Tagged;
    txt.tpacFontLabel = font.label;
    return txt;
  }, [fonts, locale, dict.designer.textPlaceholder, autoFill]);

  const api: DesignerApi = {
    addText: async (presetId) => {
      if (!fabricRef.current) return;
      const txt = await makeText(presetId);
      placeNew(txt, "text");
      await finishAdd(txt);
    },
    addShape: async (id) => {
      const F = fabricRef.current;
      const def = shapeById(id);
      if (!F || !def) return;
      const a = area(stateRef.current.location);
      const p = new F.Path(def.path, { fill: autoFill(), fillRule: def.evenodd ? "evenodd" : "nonzero", objectCaching: true }) as unknown as Tagged;
      const k = Math.min(a.width, a.height) * 0.45 / Math.max(p.width || 100, p.height || 100);
      p.set({ scaleX: k, scaleY: k, originX: "center", originY: "center" });
      p.tpacShape = id;
      placeNew(p, "shape");
      await finishAdd(p);
    },
    applyTemplate: async (id) => {
      const tpl = TEMPLATES.find((x) => x.id === id);
      const F = fabricRef.current;
      if (!tpl || !F) return;
      let lastObj: Tagged | null = null;
      for (const item of tpl.items) {
        if (!garment.print_locations.includes(item.location)) continue;
        if (item.kind === "text") {
          const txt = await makeText(item.preset, { text: locale === "ar" ? item.ar : item.en, size: item.size, fill: item.fill, loc: item.location });
          placeNew(txt, "text", item.location, item.dy);
          lastObj = txt;
        } else {
          const def = shapeById(item.shape);
          if (!def) continue;
          const a = area(item.location);
          const p = new F.Path(def.path, { fill: item.fill ?? autoFill(), fillRule: def.evenodd ? "evenodd" : "nonzero" }) as unknown as Tagged;
          const k = Math.min(item.size, a.width, a.height) / Math.max(p.width || 100, p.height || 100);
          p.set({ scaleX: k, scaleY: k, originX: "center", originY: "center" });
          p.tpacShape = item.shape;
          placeNew(p, "shape", item.location, item.dy);
          lastObj = p;
        }
      }
      if (lastObj) {
        await finishAdd(lastObj);
        toast.success(t("تمت إضافة القالب — عدّل النصوص كما تريد", "Template added — edit the text as you like"));
        setTab("layers");
      }
    },
    upload: (file) => void onUpload(file),
    selectLayer: (id) => {
      const c = canvasRef.current;
      const o = design().find((x) => x.tpacId === id);
      if (!c || !o) return;
      if (o.tpacHidden) o.tpacHidden = false;
      if (o.tpacLocation) setLocation(o.tpacLocation);
      setTimeout(() => {
        void renderScene().then(() => {
          c.setActiveObject(o);
          c.requestRenderAll();
          setSelected(o);
          syncLayers();
        });
      }, 0);
    },
    layerAction: async (id, action) => {
      const c = canvasRef.current;
      const o = design().find((x) => x.tpacId === id);
      if (!c || !o) return;
      if (action === "delete") {
        c.remove(o);
        if (selected === o) { c.discardActiveObject(); setSelected(null); }
      } else if (action === "hide") {
        o.tpacHidden = !o.tpacHidden;
        await renderScene();
      } else if (action === "lock") {
        o.tpacLocked = !o.tpacLocked;
        await renderScene();
      } else if (action === "up" || action === "down") {
        const all = c.getObjects();
        const i = all.indexOf(o);
        const j = action === "up" ? Math.min(all.length - 1, i + 1) : Math.max(0, i - 1);
        if ((all[j] as Tagged).tpacKind !== "guide") c.moveObjectTo(o, j);
      } else if (action === "duplicate") {
        const copy = (await o.clone(PROPS)) as Tagged;
        copy.tpacId = crypto.randomUUID();
        copy.set({ left: (o.left ?? 0) + 14, top: (o.top ?? 0) + 14 });
        c.add(copy);
        constrain(copy);
        await finishAdd(copy);
        return;
      }
      c.requestRenderAll();
      afterChange();
      snapshot();
    },
    clearAll: () => {
      const c = canvasRef.current;
      if (!c) return;
      for (const o of design()) c.remove(o);
      c.discardActiveObject();
      setSelected(null);
      syncLayers();
      snapshot();
      c.requestRenderAll();
    },
    undo: () => void restore(historyRef.current.index - 1),
    redo: () => void restore(historyRef.current.index + 1),
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
      img.set({ scaleX: scale, scaleY: scale, originX: "center", originY: "center" });
      img.tpacArtworkId = id;
      img.tpacPx = width ?? img.width ?? 0;
      img.tpacVector = file.type === "image/svg+xml";
      img.tpacLabel = file.name.replace(/\.[a-z0-9]+$/i, "").slice(0, 28);
      placeNew(img, "image");
      await finishAdd(img);
      setTab("add");
    } catch (e) {
      const key = e instanceof Error ? e.message : "";
      toast.error(key === "fileType" ? dict.validation.fileType : key === "fileSize" ? dict.validation.fileSize : key === "rate_limited" ? dict.checkout.errors.rate_limited! : dict.common.somethingWrong);
    } finally {
      setUploading(false);
    }
  };

  // ------------------------------------------------------------------ keyboard
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement | null;
      if (el && /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName)) return;
      const c = canvasRef.current;
      const o = (c?.getActiveObject() as Tagged | undefined) ?? undefined;
      if (o && (o as unknown as FabricIText).isEditing) return;
      const mod = e.metaKey || e.ctrlKey;
      if (mod && e.key.toLowerCase() === "z") { e.preventDefault(); e.shiftKey ? api.redo() : api.undo(); return; }
      if (mod && e.key.toLowerCase() === "y") { e.preventDefault(); api.redo(); return; }
      if (!o || !c) return;
      if (mod && e.key.toLowerCase() === "d") { e.preventDefault(); void api.layerAction(o.tpacId!, "duplicate"); return; }
      if (e.key === "Delete" || e.key === "Backspace") { e.preventDefault(); void api.layerAction(o.tpacId!, "delete"); return; }
      const step = (e.shiftKey ? 10 : NUDGE);
      const move: Record<string, [number, number]> = { ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, -step], ArrowDown: [0, step] };
      const m = move[e.key];
      if (m && !o.tpacLocked) {
        e.preventDefault();
        o.set({ left: (o.left ?? 0) + m[0], top: (o.top ?? 0) + m[1] });
        constrain(o);
        c.requestRenderAll();
        commitSoon();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  // ------------------------------------------------------------------ inspector writes
  const setProps = (props: Record<string, unknown>, opts?: { keepSize?: boolean }) => {
    const c = canvasRef.current;
    if (!c || !selected) return;
    selected.set(props);
    if (!opts?.keepSize) selected.setCoords();
    constrain(selected);
    c.requestRenderAll();
    afterChange();
  };

  const applyFilters = async (key: "grayscale" | "invert", on: boolean) => {
    const F = fabricRef.current;
    const o = selected as unknown as (Tagged & { filters: unknown[]; applyFilters: () => void }) | null;
    if (!F || !o || o.tpacKind !== "image") return;
    o.tpacFilters = { ...(o.tpacFilters ?? {}), [key]: on };
    const list: unknown[] = [];
    if (o.tpacFilters.grayscale) list.push(new F.filters.Grayscale());
    if (o.tpacFilters.invert) list.push(new F.filters.Invert());
    o.filters = list;
    o.applyFilters();
    canvasRef.current?.requestRenderAll();
    afterChange();
  };

  const alignTo = (how: "left" | "centerX" | "right" | "top" | "centerY" | "bottom") => {
    const c = canvasRef.current;
    if (!c || !selected?.tpacLocation) return;
    const a = area(selected.tpacLocation);
    const b = bbox(selected);
    let dx = 0;
    let dy = 0;
    if (how === "left") dx = a.x - b.x;
    if (how === "centerX") dx = a.x + a.width / 2 - (b.x + b.w / 2);
    if (how === "right") dx = a.x + a.width - (b.x + b.w);
    if (how === "top") dy = a.y - b.y;
    if (how === "centerY") dy = a.y + a.height / 2 - (b.y + b.h / 2);
    if (how === "bottom") dy = a.y + a.height - (b.y + b.h);
    selected.set({ left: (selected.left ?? 0) + dx, top: (selected.top ?? 0) + dy });
    selected.setCoords();
    c.requestRenderAll();
    afterChange();
  };

  /** Resize keeping the aspect ratio so the print is `cm` wide. */
  const setWidthCm = (cm: number) => {
    if (!selected?.tpacLocation) return;
    const a = area(selected.tpacLocation);
    const b = bbox(selected);
    const target = Math.max(0.5, cm) * (a.width / a.cm.width);
    const k = target / b.w;
    setProps({ scaleX: (selected.scaleX ?? 1) * k, scaleY: (selected.scaleY ?? 1) * k });
  };

  const sizeCm = (o: Tagged) => {
    if (!o.tpacLocation) return { w: 0, h: 0 };
    const a = area(o.tpacLocation);
    const b = bbox(o);
    return { w: (b.w * a.cm.width) / a.width, h: (b.h * a.cm.height) / a.height };
  };

  // ------------------------------------------------------------------ pricing
  const resolved = useMemo(() => resolveOptions(optionLite, choice), [optionLite, choice]);
  const totalQty = Object.values(sizes).reduce((n, q) => n + q, 0);
  const usedLocations = useMemo(() => [...new Set(layers.filter((l) => !l.hidden).map((l) => l.location))], [layers]);
  const locPrice = usedLocations.reduce((n, l) => n + (locations.find((x) => x.code === l)?.price ?? 0), 0);
  const unit = garment.base_price + locPrice + resolved.price;
  const pct = tierPercent(tiers.filter((x) => x.is_active), totalQty);
  const unitAfter = discountedUnit(unit, pct);

  // ------------------------------------------------------------------ preview / save
  /**
   * Renders a view to an image (garment + design, no guides, no handles) at a fixed 900 × 1050 px,
   * independent of how big the canvas is on screen: size and zoom are set explicitly and restored afterwards.
   */
  const exportView = async (v: GarmentView, format: "jpeg" | "png" = "jpeg"): Promise<string> => {
    const c = canvasRef.current!;
    exportingRef.current = true;
    const prev = { w: c.getWidth(), h: c.getHeight(), z: c.getZoom() };
    try {
      await renderScene({ view: v, location: v === "front" ? "front" : "back" });
      for (const o of c.getObjects() as Tagged[]) if (o.tpacKind === "guide") o.visible = false;
      c.discardActiveObject();
      c.setDimensions({ width: 900, height: 1050 });
      c.setZoom(900 / ARTBOARD.width);
      c.backgroundColor = format === "jpeg" ? "#F3F1EC" : "";
      c.renderAll();
      return c.toDataURL({ format, quality: 0.9, multiplier: 1 });
    } finally {
      c.backgroundColor = "";
      c.setDimensions({ width: prev.w, height: prev.h });
      c.setZoom(prev.z);
      exportingRef.current = false;
      await renderScene();
    }
  };

  const hasContent = () => design().some((o) => !o.tpacHidden);

  const openReview = async () => {
    if (!hasContent()) {
      toast.error(dict.designer.emptyDesign);
      return;
    }
    if (totalQty < 1) {
      toast.error(t("اختر مقاساً واحداً على الأقل", "Pick at least one size"));
      setTab("order");
      return;
    }
    setPreparing(true);
    try {
      setReview({ front: await exportView("front"), back: await exportView("back") });
    } finally {
      setPreparing(false);
    }
  };

  const download = async () => {
    setPreparing(true);
    try {
      for (const v of ["front", "back"] as GarmentView[]) {
        const a = document.createElement("a");
        a.href = await exportView(v, "png");
        a.download = `tpac-${garmentCode}-${v}.png`;
        a.click();
      }
    } finally {
      setPreparing(false);
    }
  };

  const pickedRows = resolved.picked.map((o) => options.find((x) => x.id === o.id)).filter((x): x is DesignerOptionRow => !!x);
  const optionName = (o: DesignerOptionRow) => (locale === "ar" ? o.name_ar : o.name_en);

  const confirmSave = () => {
    if (!review) return;
    const objs = design().filter((o) => !o.tpacHidden);
    startSaving(async () => {
      const thumb = await downscale(review.front, 360);
      const res = await saveDesign({
        garment_type: garmentCode,
        color_id: colorId,
        sizes,
        name: designName || undefined,
        options: resolved.choice,
        notes: notes || undefined,
        preview_front: review.front,
        preview_back: review.back,
        objects: objs.map((o) => {
          const base = {
            type: o.tpacKind as "image" | "text" | "shape",
            location: o.tpacLocation!,
            left: o.left ?? 0,
            top: o.top ?? 0,
            scaleX: o.scaleX ?? 1,
            scaleY: o.scaleY ?? 1,
            angle: o.angle ?? 0,
            width: o.width || 1,
            height: o.height || 1,
            flipX: !!o.flipX,
            flipY: !!o.flipY,
            opacity: o.opacity ?? 1,
          };
          if (o.tpacKind === "image") return { ...base, artwork_id: o.tpacArtworkId, filters: o.tpacFilters };
          const hex = (v: unknown) => (typeof v === "string" && /^#[0-9a-fA-F]{6}$/.test(v) ? v.toUpperCase() : null);
          if (o.tpacKind === "shape") return { ...base, shape_id: o.tpacShape, fill: hex(o.fill), stroke: hex(o.stroke), strokeWidth: o.strokeWidth ?? 0 };
          const tx = o as unknown as FabricIText;
          return {
            ...base,
            text: (tx.text ?? "").slice(0, 200),
            fill: hex(tx.fill),
            stroke: hex(tx.stroke),
            strokeWidth: tx.strokeWidth ?? 0,
            fontFamily: String(tx.fontFamily ?? "").split(",")[0]!.replace(/['"]/g, "").slice(0, 80),
            fontLabel: o.tpacFontLabel,
            fontSize: tx.fontSize,
            fontWeight: tx.fontWeight as string | number,
            fontStyle: tx.fontStyle === "italic" ? "italic" : "normal",
            underline: !!tx.underline,
            textAlign: (["left", "center", "right"].includes(String(tx.textAlign)) ? tx.textAlign : "center") as "left" | "center" | "right",
            charSpacing: tx.charSpacing ?? 0,
            lineHeight: tx.lineHeight ?? 1.16,
          };
        }),
      });
      if (!res.ok) {
        const map: Record<string, string> = {
          rate_limited: dict.checkout.errors.rate_limited!,
          option_unavailable: t("أحد الخيارات لم يعد متاحاً — حدّث الصفحة", "One of the options is no longer available — refresh the page"),
          size_unavailable: t("أحد المقاسات غير متاح", "One of the sizes is unavailable"),
          location_unavailable: t("أحد أماكن الطباعة غير متاح لهذه القطعة", "A print placement is unavailable for this garment"),
        };
        toast.error(map[res.error] ?? dict.common.somethingWrong);
        return;
      }
      const extras = pickedRows.filter((o) => o.group_code !== "package" || !o.is_default).map(optionName).join(" · ");
      for (const l of res.lines) {
        addToCart({
          custom_design_id: l.design_id,
          quantity: l.quantity,
          snapshot: {
            name_ar: `${garment.name_ar} — ${designName || "تصميم خاص"}`,
            name_en: `Custom ${garment.name_en}${designName ? ` — ${designName}` : ""}`,
            image: thumb,
            size: l.size,
            color_hex: color?.hex,
            color_name_ar: color?.name_ar,
            color_name_en: color?.name_en,
            unit_price: discountedUnit(res.unit_price, pct),
            print_locations: res.print_locations,
            extras,
          },
        });
      }
      setReview(null);
      toast.success(dict.designer.added);
      openDrawer(true);
    });
  };

  // ------------------------------------------------------------------ drag & drop
  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    const f = e.dataTransfer.files?.[0];
    if (f) void onUpload(f);
  };

  const quality = selected?.tpacKind === "image" && !selected.tpacVector && selected.tpacLocation
    ? Math.round((selected.tpacPx ?? 0) / Math.max(0.1, sizeCm(selected).w / 2.54))
    : null;
  const warnings = useMemo(() => {
    const out: string[] = [];
    for (const o of design()) {
      if (o.tpacHidden || o.tpacKind !== "image" || o.tpacVector || !o.tpacLocation) continue;
      const dpi = Math.round((o.tpacPx ?? 0) / Math.max(0.1, sizeCm(o).w / 2.54));
      if (dpi < settings.min_dpi) out.push(t(`«${o.tpacLabel ?? "صورة"}» دقتها ${dpi} DPI فقط وقد تظهر مموّهة (المطلوب ${settings.min_dpi}+)`, `“${o.tpacLabel ?? "Image"}” is only ${dpi} DPI and may print soft (${settings.min_dpi}+ recommended)`));
    }
    if (!design().some((o) => !o.tpacHidden && o.tpacLocation && LOCATION_VIEW[o.tpacLocation] === "back")) out.push(t("الظهر فارغ — سيُطبع الأمام فقط", "The back is empty — only the front will be printed"));
    return out;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [layers, tick, settings.min_dpi, locale]);

  const availableLocations = locations.filter((l) => garment.print_locations.includes(l.code));

  return (
    <div className="pb-28 md:pb-0">
      <div className="grid gap-6 lg:grid-cols-12 lg:gap-10">
        {/* ------------------------------ canvas column */}
        {/* the grid item itself is sticky (and self-start) so the garment stays in view while the panels below scroll */}
        <div className="sticky top-[68px] z-20 -mx-4 self-start bg-paper px-4 pb-2 pt-1 lg:top-28 lg:col-span-7 lg:mx-0 lg:px-0">
          <div>
            <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
              <div className="flex rounded-full border border-line p-1" role="tablist" aria-label={dict.designer.view}>
                {(["front", "back"] as GarmentView[]).map((v) => (
                  <button key={v} role="tab" aria-selected={view === v} onClick={() => setLocation(v === "front" ? (garment.print_locations.includes("front") ? "front" : "left_chest") : "back")} className={cn("rounded-full px-4 py-1.5 text-sm font-bold transition-colors", view === v ? "bg-pine text-white dark:text-night" : "hover:bg-bone")}>
                    {v === "front" ? dict.designer.front : dict.designer.back}
                  </button>
                ))}
              </div>
              <div className="flex items-center gap-1" role="toolbar" aria-label={t("أدوات", "Tools")}>
                <IconBtn label={t("تراجع", "Undo")} disabled={!hist.undo} onClick={api.undo}><Undo2 className="size-4" /></IconBtn>
                <IconBtn label={t("إعادة", "Redo")} disabled={!hist.redo} onClick={api.redo}><Redo2 className="size-4" /></IconBtn>
                <IconBtn label={guides ? t("إخفاء حدود الطباعة", "Hide print areas") : t("إظهار حدود الطباعة", "Show print areas")} onClick={() => setGuides((g) => !g)} active={guides}>{guides ? <Eye className="size-4" /> : <EyeOff className="size-4" />}</IconBtn>
                <IconBtn label={t("تنزيل المعاينة", "Download preview")} disabled={!ready || preparing} onClick={download}><Download className="size-4" /></IconBtn>
                <IconBtn label={t("مسح التصميم", "Clear design")} disabled={!layers.length} onClick={() => { if (confirm(t("مسح كل عناصر التصميم؟", "Remove every element of the design?"))) api.clearAll(); }}><Trash2 className="size-4" /></IconBtn>
              </div>
            </div>
            <div
              ref={wrapRef}
              onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
              onDragLeave={() => setDragging(false)}
              onDrop={onDrop}
              className={cn("relative mx-auto w-full max-w-[min(680px,calc(34dvh*600/700))] overflow-hidden rounded-[1.75rem] bg-[radial-gradient(ellipse_at_50%_40%,#F6F4F0_0%,#E9E5DD_75%)] sm:max-w-[min(680px,calc(52dvh*600/700))] lg:max-w-[680px]", dragging && "ring-4 ring-amber")}
              style={{ aspectRatio: `${ARTBOARD.width} / ${ARTBOARD.height}` }}
            >
              <canvas ref={elRef} aria-label={dict.designer.title} />
              {!ready && <div className="absolute inset-0 grid place-items-center"><Loader2 className="size-6 animate-spin text-mute" /></div>}
              {dragging && <div className="absolute inset-0 grid place-items-center bg-amber/20 text-sm font-bold">{t("أفلت الصورة هنا", "Drop the image here")}</div>}
              {(saving || preparing) && (
                <div className="absolute inset-0 grid place-items-center bg-paper/70">
                  <p className="flex items-center gap-2 text-sm font-semibold"><Loader2 className="size-4 animate-spin" /> {saving ? dict.designer.saving : t("جاري تجهيز المعاينة…", "Preparing preview…")}</p>
                </div>
              )}
            </div>
            <p className="mt-2 text-center text-xs text-mute">
              {dict.designer.printArea} ({dict.designer.locations[location]}): {area(location).cm.width}×{area(location).cm.height} cm
              <span className="hidden sm:inline"> · {t("اسحب لتحريك • Delete للحذف • أسهم للتحريك الدقيق", "Drag to move · Delete to remove · arrows to nudge")}</span>
            </p>
          </div>
        </div>

        {/* ------------------------------ controls column */}
        <div className="space-y-5 lg:col-span-5">
          <div className="-mx-4 overflow-x-auto px-4 py-2 lg:mx-0 lg:px-0" role="tablist" aria-label={t("خطوات التصميم", "Design steps")}>
            <div className="flex min-w-max gap-1 rounded-full border border-line bg-bone p-1">
              {([
                ["product", t("القطعة", "Product"), 1],
                ["add", t("التصميم", "Design"), 2],
                ["layers", t("الطبقات", "Layers") + (layers.length ? ` (${layers.length})` : ""), 3],
                ["order", t("الطلب", "Order"), 4],
              ] as [TabId, string, number][]).map(([id, label, n]) => (
                <button key={id} role="tab" aria-selected={tab === id} onClick={() => setTab(id)} className={cn("flex items-center gap-2 rounded-full px-4 py-2 text-sm font-bold transition-colors", tab === id ? "bg-pine text-white dark:text-night" : "text-mute hover:text-ink")}>
                  <span className={cn("grid size-5 place-items-center rounded-full text-[11px] tabular-nums", tab === id ? "bg-white/20" : "bg-paper")}>{n}</span> {label}
                </button>
              ))}
            </div>
          </div>

          {selected && selected.tpacKind && selected.tpacKind !== "guide" && (
            <Inspector
              key={selected.tpacId}
              o={selected}
              tick={tick}
              fonts={fonts}
              quality={quality}
              minDpi={settings.min_dpi}
              sizeCm={sizeCm(selected)}
              setProps={setProps}
              applyFilters={applyFilters}
              alignTo={alignTo}
              setWidthCm={setWidthCm}
              onClose={() => { canvasRef.current?.discardActiveObject(); canvasRef.current?.requestRenderAll(); setSelected(null); }}
              onAction={(a) => void api.layerAction(selected.tpacId!, a)}
              onFont={async (f) => { await document.fonts.load(`${f.weights === 2 ? 700 : 400} 40px ${f.family}`).catch(() => undefined); (selected as Tagged).tpacFontLabel = f.label; setProps({ fontFamily: f.family, fontWeight: f.weights === 2 ? (selected as unknown as FabricIText).fontWeight : 400 }); }}
              onPreset={async (id) => {
                const p = TEXT_PRESETS_UI.find((x) => x.id === id);
                const f = p && fonts.find((x) => x.label === p.font);
                if (!p || !f) return;
                const wt = f.weights === 2 ? p.weight : 400;
                await document.fonts.load(`${wt} 40px ${f.family}`).catch(() => undefined);
                (selected as Tagged).tpacFontLabel = f.label;
                const fill = p.fill === "auto" ? autoFill() : p.fill;
                setProps({ fontFamily: f.family, fontWeight: wt, fill: fill ?? "rgba(0,0,0,0)", stroke: p.stroke ? (p.stroke === "auto" ? autoFill() : p.stroke) : undefined, strokeWidth: p.strokeWidth ?? 0, charSpacing: /[؀-ۿ]/.test((selected as unknown as FabricIText).text ?? "") ? 0 : p.charSpacing ?? 0 });
              }}
            />
          )}

          {tab === "product" && (
            <ProductTab garments={garments} garmentCode={garmentCode} setGarmentCode={setGarmentCode} colors={garmentColors} colorId={colorId} setColorId={setColorId} locations={availableLocations} location={location} setLocation={setLocation} used={usedLocations} garmentMeta={GARMENTS[garmentCode as GarmentType].printAreas} next={() => setTab("add")} />
          )}
          {tab === "add" && (
            <AddTab api={api} ready={ready} uploading={uploading} fonts={fonts} locationLabel={dict.designer.locations[location]} next={() => setTab("order")} garmentLocations={garment.print_locations} />
          )}
          {tab === "layers" && <LayersTab layers={layers} selectedId={selected?.tpacId} api={api} locationLabel={(l) => dict.designer.locations[l]} next={() => setTab("order")} />}
          {tab === "order" && (
            <OrderTab
              garment={garment} sizes={sizes} setSizes={setSizes} options={options} choice={choice} setChoice={setChoice}
              notes={notes} setNotes={setNotes} designName={designName} setDesignName={setDesignName}
              tiers={tiers.filter((x) => x.is_active)} totalQty={totalQty} pct={pct} unit={unit} unitAfter={unitAfter}
              basePrice={garment.base_price} placements={usedLocations.map((l) => ({ code: l, label: dict.designer.locations[l], price: locations.find((x) => x.code === l)?.price ?? 0 }))}
              picked={resolved.picked.map((o) => options.find((x) => x.id === o.id)!).filter(Boolean)} settings={settings} rush={resolved.choice.addons.includes("rush")}
            />
          )}
        </div>
      </div>

      {/* Mobile: price + action always within thumb reach; desktop: shown in a bar under the controls */}
      <div className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-paper/90 px-4 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-3 backdrop-blur-xl lg:static lg:mt-8 lg:rounded-[1.75rem] lg:border lg:bg-bone lg:p-5 lg:backdrop-blur-0">
        <div className="mx-auto flex max-w-xl items-center gap-3 lg:max-w-none">
          <div className="shrink-0">
            <p className="text-[11px] text-mute">{totalQty} × {t("قطعة", "pcs")}{pct > 0 && <span className="ms-1 rounded-full bg-pine-soft px-1.5 py-0.5 font-bold text-pine">-{pct}%</span>}</p>
            <p className="display text-xl tabular-nums lg:text-2xl">{formatIQD(unitAfter * totalQty, locale)}</p>
          </div>
          <button onClick={openReview} disabled={saving || uploading || preparing || !ready} className="btn btn-brand h-12 flex-1 text-base lg:h-14">
            {preparing || saving ? <Loader2 className="size-4 animate-spin" /> : t("مراجعة وإضافة للسلة", "Review & add to bag")}
          </button>
        </div>
      </div>

      {review && (
        <ReviewDialog
          front={review.front} back={review.back} warnings={warnings} saving={saving}
          garmentName={locale === "ar" ? garment.name_ar : garment.name_en} colorName={color ? (locale === "ar" ? color.name_ar : color.name_en) : ""} colorHex={color?.hex}
          sizes={sizes} placements={usedLocations.map((l) => dict.designer.locations[l]!)} extras={pickedRows.map(optionName)}
          unit={unitAfter} listUnit={unit} pct={pct} totalQty={totalQty} notice={locale === "ar" ? settings.notice_ar : settings.notice_en}
          onClose={() => setReview(null)} onConfirm={confirmSave}
          onFix={() => { setReview(null); setTab("layers"); }}
        />
      )}
    </div>
  );
}

function IconBtn({ children, label, onClick, disabled, active }: { children: React.ReactNode; label: string; onClick: () => void; disabled?: boolean; active?: boolean }) {
  return (
    <button type="button" title={label} aria-label={label} aria-pressed={active} disabled={disabled} onClick={onClick} className={cn("grid size-9 place-items-center rounded-full border border-line transition hover:bg-bone disabled:opacity-35", active && "bg-bone")}>
      {children}
    </button>
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
