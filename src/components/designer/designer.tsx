"use client";
import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react";
import type { Canvas as FabricCanvas, FabricObject, IText as FabricIText } from "fabric";
import { Copy, Download, Eye, EyeOff, HeartHandshake, Loader2, Move, Redo2, ShoppingBag, Type as TypeIcon, Undo2, Upload, X } from "lucide-react";
import { useI18n } from "@/components/i18n-provider";
import { useCart } from "@/components/cart/store";
import { toast } from "@/components/ui/toast";
import { saveDesign } from "@/lib/actions/design";
import { ACCEPT_DESIGN, uploadArtwork } from "@/lib/upload-client";
import { adminT } from "@/lib/admin-i18n";
import { ARTBOARD, LOCATION_VIEW, garmentDataUrl, luminance, type GarmentType, type PrintLocation } from "@/lib/garments";
import { fitInArtboard, podArea, podAreas, podPhoto, viewOf, type PodTemplate, type StudioView } from "@/lib/pod-templates";
import { TEMPLATES, TEXT_PRESETS_UI, shapeById, type DesignerFont } from "@/lib/design-assets";
import { discountedUnit, placementsPrice, resolveOptions, tierPercent, type OptionLite } from "@/lib/design-pricing";
import { cn, formatIQD } from "@/lib/format";
import type { Color, DesignerOptionRow, DesignerSettings, DesignerTierRow, GarmentTypeRow, PrintLocationRow } from "@/lib/types";
import { PROPS, type Choice, type DesignerApi, type LayerInfo, type ReviewPiece, type TabId, type Tagged } from "./types";
import { Inspector } from "./inspector";
import { CreativeSpace, PieceCard } from "./studio";
import { ReviewDialog } from "./review";
import { ReferencePanel, emptyReference, type ReferenceState } from "./reference";

const MAX_HISTORY = 60;
const NUDGE = 1;

export function Designer({ garments, locations, colors, fonts, options, tiers, settings, initialGarment, initialColor, initialCouple = false, templates = {} }: {
  garments: GarmentTypeRow[];
  locations: PrintLocationRow[];
  colors: Color[];
  fonts: DesignerFont[];
  options: DesignerOptionRow[];
  tiers: DesignerTierRow[];
  settings: DesignerSettings;
  initialGarment?: string;
  initialColor?: string;
  /** open straight in couples mode (two pieces) — from the couples page */
  initialCouple?: boolean;
  /** admin-managed photos + print areas per garment code (Dashboard → Print designer → Printing images) */
  templates?: Record<string, PodTemplate | null>;
}) {
  const { locale, dict } = useI18n();
  const t = adminT(locale);
  const addToCart = useCart((s) => s.add);
  const openDrawer = useCart((s) => s.openDrawer);

  // ------------------------------------------------------------------ product state
  const first = garments.find((g) => g.code === initialGarment) ?? garments[0]!;
  const [garmentCode, setGarmentCode] = useState<GarmentTypeRow["code"]>(first.code);
  const garment = garments.find((g) => g.code === garmentCode)!;
  // when the admin gave this garment a photo per colour, only offer colours that have one
  // (a colour without its photo would otherwise show the default photo in the wrong colour)
  const garmentColors = useMemo(() => {
    const list = colors.filter((c) => garment.color_ids.includes(c.id));
    const front = templates[garment.code]?.views.front;
    const photographed = front ? Object.keys(front.color_mockups) : [];
    const withPhoto = photographed.length ? list.filter((c) => photographed.includes(c.id)) : list;
    return withPhoto.length ? withPhoto : list;
  }, [colors, garment, templates]);
  const [colorId, setColorId] = useState<string>(garmentColors.find((c) => c.code === initialColor)?.id ?? garmentColors[0]?.id ?? "");
  const color = colors.find((c) => c.id === colorId) ?? garmentColors[0];
  const [sizes, setSizes] = useState<Record<string, number>>({ [garment.sizes.includes("L") ? "L" : garment.sizes[0]!]: 1 });
  const optionLite = useMemo<OptionLite[]>(() => options.map((o) => ({ id: o.id, group_code: o.group_code, code: o.code, price: o.price, is_default: o.is_default })), [options]);
  const [choice, setChoice] = useState<Choice>(() => resolveOptions(optionLite, {}).choice);
  const [notes, setNotes] = useState("");
  const [designName, setDesignName] = useState("");
  const [boxText, setBoxText] = useState("");
  // "I don't have the design": photos of a piece the customer wants copied
  const [reference, setReference] = useState<ReferenceState>(emptyReference);

  // ------------------------------------------------------------------ editor state
  const [tab, setTab] = useState<TabId>("image");
  const fileRef = useRef<HTMLInputElement>(null);
  const textRef = useRef<HTMLInputElement>(null);
  const creativeRef = useRef<HTMLDivElement>(null);
  const pieceRef = useRef<HTMLElement>(null);
  const [location, setLocation] = useState<PrintLocation>("front");
  const view: StudioView = viewOf(templates[garmentCode] ?? null, location);
  const [guides, setGuides] = useState(true);
  const [layers, setLayers] = useState<LayerInfo[]>([]);
  const [selected, setSelected] = useState<Tagged | null>(null);
  const [tick, setTick] = useState(0);
  const [uploading, setUploading] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [ready, setReady] = useState(false);
  const [hist, setHist] = useState({ undo: false, redo: false });
  const [review, setReview] = useState<{ pieces: ReviewPiece[] } | null>(null);
  // couples: two pieces designed together — the one on the canvas lives in the editor, the other is kept here
  const [couple, setCouple] = useState(false);
  const [piece, setPiece] = useState<0 | 1>(0);
  const piecesRef = useRef<({ objects: string; colorId: string; sizes: Record<string, number> } | null)[]>([null, null]);
  const [preparing, setPreparing] = useState(false);
  const [saving, startSaving] = useTransition();

  const wrapRef = useRef<HTMLDivElement>(null);
  const elRef = useRef<HTMLCanvasElement>(null);
  const canvasRef = useRef<FabricCanvas | null>(null);
  const fabricRef = useRef<typeof import("fabric") | null>(null);
  const exportingRef = useRef(false);
  const snapRef = useRef({ x: false, y: false, loc: "front" as PrintLocation });
  const historyRef = useRef<{ stack: string[]; index: number; busy: boolean; timer: ReturnType<typeof setTimeout> | null }>({ stack: [], index: -1, busy: false, timer: null });
  const stateRef = useRef({ garmentCode, location, view, colorHex: color?.hex ?? "#FFFFFF", colorId: color?.id ?? "", guides });
  stateRef.current = { garmentCode, location, view, colorHex: color?.hex ?? "#FFFFFF", colorId: color?.id ?? "", guides };
  const liveRef = useRef({ piece: 0 as 0 | 1, sizes, colorId });
  liveRef.current = { piece, sizes, colorId };
  const tplRef = useRef(templates);
  tplRef.current = templates;
  const tpl = (g: string) => tplRef.current[g] ?? null;

  const area = useCallback((loc: PrintLocation) => podArea(tplRef.current[stateRef.current.garmentCode] ?? null, stateRef.current.garmentCode as GarmentType, loc), []);
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
  const renderScene = useCallback(async (override?: { view: StudioView; location: PrintLocation }) => {
    const c = canvasRef.current;
    const F = fabricRef.current;
    if (!c || !F) return;
    const { garmentCode: g, colorHex, colorId: cid, guides: showGuides } = stateRef.current;
    const v = override?.view ?? stateRef.current.view;
    const loc = override?.location ?? stateRef.current.location;
    // the admin's photo for this view / colour when there is one, the built-in drawing otherwise
    const photo = podPhoto(tpl(g), v, cid);
    let bg: Awaited<ReturnType<typeof F.FabricImage.fromURL>> | null = null;
    if (photo) {
      try {
        bg = await F.FabricImage.fromURL(photo, { crossOrigin: "anonymous" });
        const box = fitInArtboard(bg.width || 600, bg.height || 700);
        bg.set({ originX: "left", originY: "top", left: box.x, top: box.y, scaleX: box.width / (bg.width || 600), scaleY: box.height / (bg.height || 700) });
      } catch {
        bg = null;
      }
    }
    if (!bg) {
      bg = await F.FabricImage.fromURL(garmentDataUrl(g as GarmentType, v === "back" ? "back" : "front", colorHex));
      bg.set({ originX: "left", originY: "top", left: 0, top: 0, scaleX: ARTBOARD.width / (bg.width || 600), scaleY: ARTBOARD.height / (bg.height || 700) });
    }
    c.backgroundImage = bg;
    const areaMap = podAreas(tpl(g), g as GarmentType);
    for (const o of c.getObjects() as Tagged[]) if (o.tpacKind === "guide") c.remove(o);
    const dark = luminance(colorHex) < 0.35;
    for (const l of Object.keys(areaMap) as PrintLocation[]) {
      if (viewOf(tpl(g), l) !== v) continue;
      const a = areaMap[l];
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
      const onView = !!o.tpacLocation && viewOf(tpl(g), o.tpacLocation) === v && !o.tpacHidden;
      o.set({ visible: onView, selectable: onView, evented: onView, lockMovementX: !!o.tpacLocked, lockMovementY: !!o.tpacLocked, lockScalingX: !!o.tpacLocked, lockScalingY: !!o.tpacLocked, lockRotation: !!o.tpacLocked, hasControls: !o.tpacLocked });
      if (o.tpacLocation) {
        const a = areaMap[o.tpacLocation];
        o.clipPath = new F.Rect({ originX: "left", originY: "top", left: a.x, top: a.y, width: a.width, height: a.height, absolutePositioned: true });
        constrain(o);
      }
    }
    const active = c.getActiveObject() as Tagged | undefined;
    if (active && (!active.visible || (active.tpacLocation && viewOf(tpl(g), active.tpacLocation) !== v))) c.discardActiveObject();
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

  /** Region of the artboard shown for a placement: the whole garment, or a close-up for chest / sleeves. */
  const focusOf = (loc: PrintLocation) => {
    // whole view for front / back, and for a sleeve that has its own close-up photo
    const own = viewOf(tplRef.current[stateRef.current.garmentCode] ?? null, loc);
    if (loc === "front" || loc === "back" || own === "right" || own === "left" || own === "hood") return { x: 0, y: 0, w: ARTBOARD.width };
    const a = area(loc);
    const w = Math.min(ARTBOARD.width, Math.max(a.width, a.height) * 6);
    const h = (w * ARTBOARD.height) / ARTBOARD.width;
    const x = Math.max(0, Math.min(ARTBOARD.width - w, a.x + a.width / 2 - w / 2));
    const y = Math.max(0, Math.min(ARTBOARD.height - h, a.y + a.height / 2 - h / 2));
    return { x, y, w };
  };
  const cameraAnim = useRef<number | null>(null);
  /** Moves the viewport to the current placement (animated when the placement changes). */
  const applyCamera = (animate: boolean) => {
    const c = canvasRef.current;
    if (!c || exportingRef.current) return;
    const f = focusOf(stateRef.current.location);
    const k = c.getWidth() / f.w;
    const target = [k, 0, 0, k, -f.x * k, -f.y * k];
    if (cameraAnim.current) cancelAnimationFrame(cameraAnim.current);
    const from = [...(c.viewportTransform ?? [1, 0, 0, 1, 0, 0])];
    if (!animate || window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      c.setViewportTransform(target as [number, number, number, number, number, number]);
      c.requestRenderAll();
      return;
    }
    const t0 = performance.now();
    const step = (now: number) => {
      const p = Math.min(1, (now - t0) / 320);
      const e = 1 - Math.pow(1 - p, 3);
      c.setViewportTransform(from.map((v, i) => v + (target[i]! - v) * e) as [number, number, number, number, number, number]);
      c.requestRenderAll();
      if (p < 1) cameraAnim.current = requestAnimationFrame(step);
    };
    cameraAnim.current = requestAnimationFrame(step);
  };

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
        const w = Math.min(wrapRef.current?.clientWidth ?? 600, 720);
        c.setDimensions({ width: w, height: (w * ARTBOARD.height) / ARTBOARD.width });
        applyCamera(false);
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
        const vt = c.viewportTransform;
        ctx.save();
        ctx.setTransform(r * vt[0], 0, 0, r * vt[3], r * vt[4], r * vt[5]);
        ctx.strokeStyle = "#E3963C";
        ctx.lineWidth = 1 / vt[0];
        ctx.setLineDash([4 / vt[0], 4 / vt[0]]);
        ctx.beginPath();
        if (x) { ctx.moveTo(a.x + a.width / 2, a.y); ctx.lineTo(a.x + a.width / 2, a.y + a.height); }
        if (y) { ctx.moveTo(a.x, a.y + a.height / 2); ctx.lineTo(a.x + a.width, a.y + a.height / 2); }
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
  useEffect(() => {
    applyCamera(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location, garmentCode]);

  // ------------------------------------------------------------------ couples
  const serialize = () => JSON.stringify(design().map((o) => o.toObject(PROPS)));
  /** Puts a stored design on the canvas (its own undo history starts fresh). */
  const loadObjects = async (json: string) => {
    const c = canvasRef.current;
    const F = fabricRef.current;
    if (!c || !F) return;
    const h = historyRef.current;
    h.busy = true;
    try {
      c.discardActiveObject();
      for (const o of design()) c.remove(o);
      const objs = (await F.util.enlivenObjects(JSON.parse(json))) as Tagged[];
      for (const o of objs) {
        if (o.tpacLocation && !garment.print_locations.includes(o.tpacLocation)) continue;
        o.setControlsVisibility({ mt: false, mb: false, ml: false, mr: false });
        c.add(o);
      }
      await renderScene();
      syncLayers();
      setSelected(null);
    } finally {
      h.busy = false;
    }
    historyRef.current = { stack: [], index: -1, busy: false, timer: null };
    snapshot();
  };
  /** Shows the other piece: the current one is stored, the other one loaded with its colour and sizes. */
  const switchPiece = async (to: 0 | 1) => {
    const cur = liveRef.current;
    if (to === cur.piece) return;
    piecesRef.current[cur.piece] = { objects: serialize(), colorId: cur.colorId, sizes: cur.sizes };
    const stored = piecesRef.current[to] ?? { objects: "[]", colorId: cur.colorId, sizes: { ...cur.sizes } };
    // the garment may have changed since this piece was stored: keep its colour and sizes valid
    const okSizes = Object.fromEntries(Object.entries(stored.sizes).filter(([k]) => garment.sizes.includes(k)));
    const next = {
      ...stored,
      colorId: garmentColors.some((c) => c.id === stored.colorId) ? stored.colorId : garmentColors[0]?.id ?? cur.colorId,
      sizes: Object.keys(okSizes).length ? okSizes : { [garment.sizes.includes("L") ? "L" : garment.sizes[0]!]: 1 },
    };
    const col = colors.find((c) => c.id === next.colorId);
    // the canvas reads the colour from stateRef: update it now, before React re-renders
    stateRef.current = { ...stateRef.current, colorId: next.colorId, colorHex: col?.hex ?? stateRef.current.colorHex };
    liveRef.current = { piece: to, sizes: next.sizes, colorId: next.colorId };
    setColorId(next.colorId);
    setSizes(next.sizes);
    setPiece(to);
    await loadObjects(next.objects);
  };
  const startCouple = () => {
    if (couple) return;
    const cur = liveRef.current;
    const other = garmentColors.find((c) => c.id !== cur.colorId)?.id ?? cur.colorId;
    piecesRef.current = [null, { objects: "[]", colorId: other, sizes: { ...cur.sizes } }];
    setCouple(true);
  };
  const stopCouple = async () => {
    if (liveRef.current.piece === 1) await switchPiece(0);
    piecesRef.current = [null, null];
    setCouple(false);
  };
  const copyToOther = () => {
    const cur = liveRef.current;
    const otherIdx = cur.piece === 0 ? 1 : 0;
    const o = piecesRef.current[otherIdx];
    piecesRef.current[otherIdx] = { objects: serialize(), colorId: o?.colorId ?? cur.colorId, sizes: o?.sizes ?? { ...cur.sizes } };
    setTick((n) => n + 1);
    toast.success(t(`انسخ التصميم للقطعة ${otherIdx + 1} — عدّل عليها براحتك`, `Copied to piece ${otherIdx + 1} — edit it freely`));
  };

  // links from the couples page open with two pieces ready
  useEffect(() => {
    if (ready && initialCouple) startCouple();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready]);

  // ------------------------------------------------------------------ adding things
  const placeNew = useCallback((o: Tagged, kind: "image" | "text" | "shape", loc: PrintLocation = stateRef.current.location, dy = 0, dx = 0) => {
    const c = canvasRef.current!;
    const a = area(loc);
    o.tpacId = crypto.randomUUID();
    o.tpacLocation = loc;
    o.tpacKind = kind;
    o.set({ left: a.x + a.width / 2 + dx * a.width, top: a.y + a.height / 2 + dy * a.height, cornerColor: "#E3963C", cornerStyle: "circle", transparentCorners: false, borderColor: "#E3963C", cornerSize: 12, padding: 2 });
    o.setControlsVisibility({ mt: false, mb: false, ml: false, mr: false });
    c.add(o);
    constrain(o);
  }, [area, constrain]);

  const finishAdd = useCallback(async (o: Tagged) => {
    const c = canvasRef.current!;
    if (o.tpacLocation && viewOf(tpl(stateRef.current.garmentCode), o.tpacLocation) !== stateRef.current.view) setLocation(o.tpacLocation);
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
    const small = loc === "left_chest" || loc === "sleeve" || loc === "sleeve_left" || loc === "hood";
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
    addText: async (presetId, text) => {
      if (!fabricRef.current) return;
      const txt = await makeText(presetId, text?.trim() ? { text: text.trim().slice(0, 200) } : undefined);
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
      const applyItems = async (items: typeof tpl.items) => {
        let lastObj: Tagged | null = null;
        for (const item of items) {
          if (!garment.print_locations.includes(item.location)) continue;
          if (item.kind === "text") {
            const txt = await makeText(item.preset, { text: locale === "ar" ? item.ar : item.en, size: item.size, fill: item.fill, loc: item.location });
            placeNew(txt, "text", item.location, item.dy, item.dx ?? 0);
            lastObj = txt;
          } else {
            const def = shapeById(item.shape);
            if (!def) continue;
            const a = area(item.location);
            const p = new F.Path(def.path, { fill: item.fill ?? autoFill(), fillRule: def.evenodd ? "evenodd" : "nonzero" }) as unknown as Tagged;
            const k = Math.min(item.size, a.width, a.height) / Math.max(p.width || 100, p.height || 100);
            p.set({ scaleX: k, scaleY: k, originX: "center", originY: "center" });
            p.tpacShape = item.shape;
            placeNew(p, "shape", item.location, item.dy, item.dx ?? 0);
            lastObj = p;
          }
        }
        if (lastObj) await finishAdd(lastObj);
        return lastObj;
      };
      if (tpl.pair) {
        // a design for two: piece 1 gets `items`, piece 2 gets `pair`
        startCouple();
        await switchPiece(0);
        await applyItems(tpl.items);
        await switchPiece(1);
        await applyItems(tpl.pair);
        await switchPiece(0);
        toast.success(t("انضاف التصميم على القطعتين — بدّل بينهن من فوق وعدّل الكلام", "Added to both pieces — switch between them above and edit the words"));
        setTab("ideas");
        return;
      }
      if (await applyItems(tpl.items)) {
        toast.success(t("تمت إضافة القالب — عدّل النصوص كما تريد", "Template added — edit the text as you like"));
        setTab("ideas");
      }
    },
    addCode: async (kind, text) => {
      const value = text.trim().slice(0, kind === "qr" ? 300 : 60);
      if (!value) return;
      const ink = autoFill();
      let svg: string;
      try {
        if (kind === "qr") {
          const QR = await import("qrcode");
          svg = await QR.toString(value, { type: "svg", margin: 0, errorCorrectionLevel: "M", color: { dark: ink, light: "#ffffff00" } });
        } else {
          const JsBarcode = (await import("jsbarcode")).default;
          const el = document.createElementNS("http://www.w3.org/2000/svg", "svg");
          JsBarcode(el, value, { format: "CODE128", lineColor: ink, background: "transparent", displayValue: true, font: "monospace", fontSize: 16, margin: 0, height: 70, width: 2 });
          svg = new XMLSerializer().serializeToString(el);
        }
      } catch {
        toast.error(t("هذا النص ما ينفع كباركود — جرّب أحرف إنجليزية وأرقام", "This text can't be a barcode — try English letters and digits"));
        return;
      }
      await onUpload(new File([svg], `${kind}.svg`, { type: "image/svg+xml" }), kind === "qr" ? t("رمز QR", "QR code") : t("باركود", "Barcode"));
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

  const onUpload = async (file: File, label?: string) => {
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
      const base = file.name.replace(/\.[a-z0-9]+$/i, "");
      img.tpacLabel = label ?? (/^[0-9a-f-]{16,}$/i.test(base) || /^(image|img_\d+)$/i.test(base) ? t("صورتك", "Your image") : base.slice(0, 28));
      placeNew(img, "image");
      await finishAdd(img);
      if (!label) setTab("image");
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
  // the paid packaging option is the gift box: its own step, with the customer's words on the lid
  const giftOption = useMemo(() => {
    const paid = options.filter((o) => o.group_code === "package" && o.price > 0);
    return paid.find((o) => o.code === "gift") ?? paid[0] ?? null;
  }, [options]);
  const giftOn = !!giftOption && resolved.choice.package === giftOption.code;
  const boxFont = fonts.find((f) => /ruqaa/i.test(f.label))?.family;
  const totalQty = Object.values(sizes).reduce((n, q) => n + q, 0);
  // placements picked for a "make it like this photo" request count like designed ones (same price per placement)
  const refOn = reference.items.length > 0;
  const refLocs = useMemo<PrintLocation[]>(() => {
    if (!refOn) return [];
    const allowed = reference.locations.filter((l) => garment.print_locations.includes(l));
    return allowed.length ? allowed : garment.print_locations.includes("front") ? ["front"] : [garment.print_locations[0] as PrintLocation];
  }, [refOn, reference.locations, garment.print_locations]);
  const usedLocations = useMemo(() => [...new Set([...layers.filter((l) => !l.hidden).map((l) => l.location), ...refLocs])], [layers, refLocs]);
  const priceOfLoc = (l: string) => locations.find((x) => x.code === l)?.price ?? 0;
  // one placement is included in the garment price, extra placements add theirs
  const locPrice = placementsPrice(usedLocations, priceOfLoc);
  const unit = garment.base_price + locPrice + resolved.price;
  // the other piece of a couple design: its own placements and sizes, priced the same way
  const other = couple ? piecesRef.current[piece === 0 ? 1 : 0] : null;
  const otherUsed = other ? [...new Set([...(JSON.parse(other.objects) as { tpacLocation?: string; tpacHidden?: boolean }[]).filter((o) => !o.tpacHidden && o.tpacLocation).map((o) => o.tpacLocation!), ...refLocs])] : [];
  const otherQty = other ? Object.values(other.sizes).reduce((n, q) => n + q, 0) : 0;
  const otherUnit = garment.base_price + placementsPrice(otherUsed, priceOfLoc) + resolved.price;
  const pct = tierPercent(tiers.filter((x) => x.is_active), totalQty + otherQty);
  const unitAfter = discountedUnit(unit, pct);
  const grandTotal = unitAfter * totalQty + discountedUnit(otherUnit, pct) * otherQty;
  void tick;

  // ------------------------------------------------------------------ preview / save
  /**
   * Renders a view to an image (garment + design, no guides, no handles) at a fixed 900 × 1050 px,
   * independent of how big the canvas is on screen: size and zoom are set explicitly and restored afterwards.
   */
  const exportView = async (v: StudioView, format: "jpeg" | "png" = "jpeg"): Promise<string> => {
    const c = canvasRef.current!;
    exportingRef.current = true;
    const prev = { w: c.getWidth(), h: c.getHeight(), vpt: [...c.viewportTransform] as [number, number, number, number, number, number] };
    try {
      await renderScene({ view: v, location: v === "front" ? "front" : v === "back" ? "back" : v === "right" ? "sleeve" : v === "hood" ? "hood" : "sleeve_left" });
      for (const o of c.getObjects() as Tagged[]) if (o.tpacKind === "guide") o.visible = false;
      c.discardActiveObject();
      c.setDimensions({ width: 900, height: 1050 });
      c.setViewportTransform([900 / ARTBOARD.width, 0, 0, 900 / ARTBOARD.width, 0, 0]);
      c.backgroundColor = format === "jpeg" ? "#F3F1EC" : "";
      c.renderAll();
      return c.toDataURL({ format, quality: 0.9, multiplier: 1 });
    } finally {
      c.backgroundColor = "";
      c.setDimensions({ width: prev.w, height: prev.h });
      c.setViewportTransform(prev.vpt);
      exportingRef.current = false;
      await renderScene();
    }
  };

  const hasContent = () => refOn || design().some((o) => !o.tpacHidden);

  /** Canvas objects → the payload saved with the design. */
  const toPayload = (objs: Tagged[]) => objs.map((o) => {
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
        });

  /** Previews + everything needed to save the piece that is on the canvas right now. */
  const capture = async (): Promise<ReviewPiece> => {
    const sides: ReviewPiece["sides"] = [];
    const sideLabel = { right: t("الكم الأيمن", "Right sleeve"), left: t("الكم الأيسر", "Left sleeve"), hood: t("داخل القبعة", "Inside the hood") };
    const raw: Partial<Record<"right" | "left" | "hood", string>> = {};
    for (const side of ["right", "left", "hood"] as const) {
      const loc = side === "right" ? "sleeve" : side === "hood" ? "hood" : "sleeve_left";
      if (viewOf(tpl(garmentCode), loc) === side && design().some((o) => !o.tpacHidden && o.tpacLocation === loc)) {
        raw[side] = await compact(await exportView(side));
        sides.push({ src: raw[side]!, label: sideLabel[side] });
      }
    }
    const objs = design().filter((o) => !o.tpacHidden);
    const live = liveRef.current;
    const col = colors.find((c) => c.id === live.colorId);
    const used = [...new Set([...objs.map((o) => o.tpacLocation!).filter(Boolean), ...refLocs])];
    return {
      front: await compact(await exportView("front")), back: await compact(await exportView("back")), sides, raw,
      colorId: live.colorId, colorName: col ? (locale === "ar" ? col.name_ar : col.name_en) : "", colorHex: col?.hex, sizes: { ...live.sizes },
      used, objects: toPayload(objs),
    };
  };
  const qtyOf = (z: Record<string, number>) => Object.values(z).reduce((n, q) => n + q, 0);

  const openReview = async () => {
    if (!hasContent()) {
      toast.error(dict.designer.emptyDesign);
      return;
    }
    if (totalQty < 1) {
      toast.error(t("اختر مقاساً واحداً على الأقل", "Pick at least one size"));
      pieceRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
      return;
    }
    if (couple) {
      const otherIdx = piece === 0 ? 1 : 0;
      const o = piecesRef.current[otherIdx];
      const otherEmpty = !o || !(JSON.parse(o.objects) as { tpacHidden?: boolean }[]).some((x) => !x.tpacHidden);
      if ((otherEmpty && !refOn) || !o || qtyOf(o.sizes) < 1) {
        toast.error(otherEmpty && !refOn ? t(`صمّم القطعة ${otherIdx + 1} كمان`, `Design piece ${otherIdx + 1} too`) : t(`اختار مقاس القطعة ${otherIdx + 1}`, `Pick a size for piece ${otherIdx + 1}`));
        await switchPiece(otherIdx as 0 | 1);
        return;
      }
    }
    setPreparing(true);
    try {
      if (!couple) {
        setReview({ pieces: [await capture()] });
        return;
      }
      const start = liveRef.current.piece;
      const first = await capture();
      await switchPiece(start === 0 ? 1 : 0);
      const second = await capture();
      await switchPiece(start);
      setReview({ pieces: start === 0 ? [first, second] : [second, first] });
    } finally {
      setPreparing(false);
    }
  };

  const download = async () => {
    setPreparing(true);
    try {
      for (const v of (["front", "back", "right", "left", "hood"] as StudioView[]).filter((x) => x === "front" || x === "back" || tpl(garmentCode)?.views[x])) {
        const a = document.createElement("a");
        a.href = await exportView(v, "png");
        a.download = `tpac-${garmentCode}-${couple ? `piece${piece + 1}-` : ""}${v}.png`;
        a.click();
      }
    } finally {
      setPreparing(false);
    }
  };

  const pickedRows = resolved.picked.map((o) => options.find((x) => x.id === o.id)).filter((x): x is DesignerOptionRow => !!x);
  const optionName = (o: DesignerOptionRow) => (locale === "ar" ? o.name_ar : o.name_en);
  // the gift box carries the customer's words with it in the bag, the review and the order
  const optionLabel = (o: DesignerOptionRow) => (o.id === giftOption?.id && boxText.trim() ? `${optionName(o)} «${boxText.trim()}»` : optionName(o));

  const confirmSave = () => {
    if (!review) return;
    const errorText: Record<string, string> = {
      rate_limited: dict.checkout.errors.rate_limited!,
      option_unavailable: t("أحد الخيارات لم يعد متاحاً — حدّث الصفحة", "One of the options is no longer available — refresh the page"),
      size_unavailable: t("أحد المقاسات غير متاح", "One of the sizes is unavailable"),
      location_unavailable: t("أحد أماكن الطباعة غير متاح لهذه القطعة", "A print placement is unavailable for this garment"),
      garment_unavailable: t("هذه القطعة غير متاحة حالياً", "This garment is not available right now"),
      color_unavailable: t("هذا اللون غير متاح لهذه القطعة", "This colour is not available for this garment"),
      artwork_missing: t("لم تكتمل رفع إحدى الصور — احذفها وارفعها مرة ثانية", "One image didn't finish uploading — remove it and upload it again"),
      invalid_preview: t("تعذّر تجهيز المعاينة — حاول مرة ثانية", "Couldn't prepare the preview — try again"),
      validation: t("في عنصر بالتصميم غير صالح — جرّب حذف آخر عنصر أضفته", "Something in the design isn't valid — try removing the last element you added"),
      storage_failed: t("تعذّر حفظ صور المعاينة — حاول بعد قليل", "Couldn't store the preview images — try again shortly"),
      uploads_disabled: t("رفع التصاميم الخاصة متوقف حالياً", "Uploading your own designs is paused right now"),
      save_failed: t("تعذّر حفظ التصميم — حاول بعد قليل", "Couldn't save the design — try again shortly"),
    };
    const extras = pickedRows.filter((o) => o.group_code !== "package" || o.price > 0).map(optionLabel).join(" · ");
    const pieces = review.pieces;
    startSaving(async () => {
      for (const [i, p] of pieces.entries()) {
        const label = pieces.length > 1 ? ` (${t(`للمرتبطين ${i + 1}/2`, `couple ${i + 1}/2`)})` : "";
        // nothing drawn on the piece (only a photo request): the bag shows the customer's photo instead of a blank garment
        const thumb = await downscale(p.objects.length === 0 && refOn ? reference.items[0]!.url : p.front, 360).catch(() => downscale(p.front, 360));
        let res: Awaited<ReturnType<typeof saveDesign>>;
        try {
          res = await saveDesign({
            garment_type: garmentCode,
            color_id: p.colorId,
            sizes: p.sizes,
            name: (designName || (pieces.length > 1 ? t("تصميم للمرتبطين", "Couple design") : "")) ? `${designName || t("تصميم للمرتبطين", "Couple design")}${label}`.slice(0, 80) : undefined,
            options: resolved.choice,
            notes: notes || undefined,
            box_text: giftOn && boxText.trim() ? boxText.trim() : undefined,
            reference: refOn ? { artwork_ids: reference.items.map((x) => x.id), note: reference.note.trim() || undefined, locations: refLocs } : undefined,
            preview_front: p.front,
            preview_back: p.back,
            preview_sides: p.raw.right || p.raw.left || p.raw.hood ? { right: p.raw.right, left: p.raw.left, hood: p.raw.hood } : undefined,
            objects: p.objects,
          });
        } catch (e) {
          console.error("saveDesign failed", e);
          toast.error(t("تعذّر رفع التصميم — تأكد من الإنترنت وحاول مرة ثانية. إذا الصورة كبيرة جداً جرّب صورة أصغر.", "Couldn't upload the design — check your connection and try again. If the image is very large, try a smaller one."));
          return;
        }
        if (!res.ok) {
          toast.error((pieces.length > 1 ? t(`القطعة ${i + 1}: `, `Piece ${i + 1}: `) : "") + (errorText[res.error] ?? dict.common.somethingWrong));
          return;
        }
        const col = colors.find((c) => c.id === p.colorId);
        for (const l of res.lines) {
          addToCart({
            custom_design_id: l.design_id,
            quantity: l.quantity,
            snapshot: {
              name_ar: `${garment.name_ar} — ${designName || (pieces.length > 1 ? "للمرتبطين" : "تصميم خاص")}${pieces.length > 1 ? ` (${i + 1}/2)` : ""}`,
              name_en: `Custom ${garment.name_en}${designName ? ` — ${designName}` : pieces.length > 1 ? " — couple" : ""}${pieces.length > 1 ? ` (${i + 1}/2)` : ""}`,
              image: thumb,
              size: l.size,
              color_hex: col?.hex,
              color_name_ar: col?.name_ar,
              color_name_en: col?.name_en,
              unit_price: discountedUnit(res.unit_price, pct),
              print_locations: res.print_locations,
              extras,
            },
          });
        }
      }
      setReview(null);
      setReference(emptyReference());
      toast.success(pieces.length > 1 ? t("انضافت القطعتين للسلة 💞", "Both pieces are in your bag 💞") : dict.designer.added);
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
  const hereCount = layers.filter((l) => l.location === location && !l.hidden).length;
  const anyContent = refOn || layers.some((l) => !l.hidden);
  const locLabel = dict.designer.locations[location] ?? location;
  const closeUp = location !== "front" && location !== "back";
  const openUpload = () => fileRef.current?.click();
  const writeWord = () => {
    setTab("text");
    creativeRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    setTimeout(() => textRef.current?.focus({ preventScroll: true }), 450);
  };

  return (
    <div className="pb-32">
      <input ref={fileRef} type="file" accept={ACCEPT_DESIGN} className="sr-only" tabIndex={-1} aria-hidden onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ""; if (f) void onUpload(f); }} />
      <div className="grid gap-5 lg:grid-cols-12 lg:gap-8">
        {/* ------------------------------ live preview */}
        <section className="studio-card self-start overflow-hidden lg:sticky lg:top-24 lg:col-span-7" aria-label={dict.designer.title}>
          <div className="flex items-center justify-between px-5 pt-5 sm:px-7">
            <p className="flex min-w-0 items-center gap-2 truncate text-[13px] font-semibold text-pine sm:text-sm">
              <span className="size-2.5 shrink-0 rounded-full bg-pine/60" aria-hidden /> {locLabel} · {closeUp ? t("معاينة مقرّبة", "close-up preview") : t("معاينة مباشرة", "live preview")}
            </p>
            <div className="flex items-center gap-1" role="toolbar" aria-label={t("أدوات", "Tools")}>
              <IconBtn label={t("تراجع", "Undo")} disabled={!hist.undo} onClick={api.undo}><Undo2 className="size-5" /></IconBtn>
              <IconBtn label={t("إعادة", "Redo")} disabled={!hist.redo} onClick={api.redo}><Redo2 className="size-5" /></IconBtn>
              <IconBtn label={guides ? t("إخفاء حدود الطباعة", "Hide print areas") : t("إظهار حدود الطباعة", "Show print areas")} onClick={() => setGuides((g) => !g)} active={!guides}>{guides ? <Eye className="size-5" /> : <EyeOff className="size-5" />}</IconBtn>
              <IconBtn label={t("تنزيل المعاينة", "Download preview")} disabled={!ready || preparing} onClick={download}><Download className="size-5" /></IconBtn>
            </div>
          </div>

          {/* one piece, or two for a couple */}
          <div className="px-5 pt-3 sm:px-7">
            {couple ? (
              <div className="flex items-center gap-1.5">
                <div className="flex flex-1 gap-1 rounded-2xl bg-bone p-1" role="tablist" aria-label={t("القطع", "Pieces")}>
                  {([0, 1] as const).map((i) => {
                    const cid = i === piece ? colorId : piecesRef.current[i]?.colorId;
                    const col = colors.find((c) => c.id === cid);
                    return (
                      <button key={i} type="button" role="tab" aria-selected={piece === i} disabled={preparing || saving} onClick={() => void switchPiece(i)} className={cn("flex flex-1 items-center justify-center gap-2 whitespace-nowrap rounded-xl px-2 py-2.5 text-sm font-bold transition", piece === i ? "bg-paper shadow-sm" : "text-mute")}>
                        <span className="size-4 rounded-full border border-ink/20" style={{ background: col?.hex }} aria-hidden /> {t(`القطعة ${i + 1}`, `Piece ${i + 1}`)}
                      </button>
                    );
                  })}
                </div>
                <IconBtn label={t("انسخ التصميم للقطعة الثانية", "Copy this design to the other piece")} onClick={copyToOther}><Copy className="size-5" /></IconBtn>
                <IconBtn label={t("رجوع لقطعة وحدة", "Back to one piece")} onClick={() => { if (confirm(t("تحذف تصميم القطعة الثانية وترجع لقطعة وحدة؟", "Remove the second piece and go back to one?"))) void stopCouple(); }}><X className="size-5" /></IconBtn>
              </div>
            ) : (
              <button type="button" onClick={startCouple} disabled={!ready} className="flex w-full items-center justify-center gap-2 rounded-2xl border border-dashed border-pine/50 px-4 py-2.5 text-sm font-bold text-pine transition hover:bg-pine-soft">
                <HeartHandshake className="size-5" /> {t("صمّم قطعتين للمرتبطين 💞", "Design two pieces for a couple 💞")}
              </button>
            )}
          </div>

          <div className="px-3 pb-2 pt-3 sm:px-6">
            <div
              ref={wrapRef}
              onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
              onDragLeave={() => setDragging(false)}
              onDrop={onDrop}
              className={cn("relative mx-auto w-full max-w-[720px] overflow-hidden rounded-[1.25rem] transition", dragging && "ring-4 ring-pine/40")}
              style={{ aspectRatio: `${ARTBOARD.width} / ${ARTBOARD.height}` }}
            >
              <canvas ref={elRef} aria-label={dict.designer.title} />
              {!ready && <div className="absolute inset-0 grid place-items-center"><Loader2 className="size-7 animate-spin text-mute" /></div>}
              {dragging && <div className="absolute inset-0 grid place-items-center bg-pine/15 text-base font-bold text-pine">{t("أفلت الصورة هنا", "Drop the image here")}</div>}
              {(saving || preparing) && (
                <div className="absolute inset-0 grid place-items-center bg-paper/70">
                  <p className="flex items-center gap-2 text-sm font-semibold"><Loader2 className="size-4 animate-spin" /> {saving ? dict.designer.saving : t("جاري تجهيز المعاينة…", "Preparing preview…")}</p>
                </div>
              )}
            </div>
          </div>

          {/* first step, under the garment so the whole piece stays visible */}
          {ready && hereCount === 0 && !selected && (
            <div className="flex flex-wrap items-center justify-center gap-2 px-4 pt-3">
              <button type="button" onClick={openUpload} disabled={uploading} className="flex min-h-12 flex-1 items-center justify-center gap-2 rounded-2xl bg-pine px-5 py-3 text-[15px] font-bold leading-tight text-white shadow-[0_10px_24px_-14px_rgba(0,0,0,.55)] transition active:scale-[.98] sm:max-w-xs dark:text-night">
                {uploading ? <Loader2 className="size-5 animate-spin" /> : <Upload className="size-5" />} {t(`ارفع تصميمك على ${locLabel}`, `Upload your design for the ${locLabel.toLowerCase()}`)}
              </button>
              <button type="button" onClick={writeWord} className="flex min-h-12 items-center justify-center gap-2 rounded-2xl border border-line bg-paper px-5 py-3 text-sm font-semibold text-ink transition active:scale-[.98]">
                <TypeIcon className="size-5" /> {t("أو اكتب كلمة", "or write a word")}
              </button>
            </div>
          )}

          {/* no design of their own: a photo of a piece they liked + what they want */}
          <div className="px-4 pt-3">
            <ReferencePanel
              value={reference} onChange={setReference} disabled={!ready}
              locations={availableLocations.map((l) => l.code)} locationName={(l) => dict.designer.locations[l] ?? l}
            />
          </div>

          {/* placements */}
          <div className="flex justify-center gap-1 overflow-x-auto px-4 pb-1 pt-2" role="tablist" aria-label={dict.designer.location}>
            {availableLocations.map((l) => {
              const on = location === l.code;
              const has = layers.some((x) => x.location === l.code && !x.hidden);
              return (
                <button key={l.code} role="tab" aria-selected={on} onClick={() => setLocation(l.code)} className={cn("relative shrink-0 rounded-2xl px-4 py-3 text-sm font-semibold transition sm:px-5", on ? "bg-pine-soft text-pine shadow-sm" : "text-ink/80 hover:bg-bone")}>
                  {dict.designer.locations[l.code]}
                  {has && <span className="absolute end-2 top-2 size-1.5 rounded-full bg-amber" aria-hidden />}
                </button>
              );
            })}
          </div>
          <p className="flex items-center justify-center gap-2 px-5 pb-4 pt-3 text-center text-xs text-mute">
            <Move className="size-4 shrink-0" /> {t("اسحب التصميم حتى تحرّكه · الزوايا للحجم · الدائرة للتدوير", "Drag to move · corners to resize · the circle to rotate")}
          </p>
          {closeUp && <p className="-mt-2 pb-4 text-center text-[11px] text-mute">{t(`منطقة الطباعة ${area(location).cm.width}×${area(location).cm.height} سم`, `Print area ${area(location).cm.width}×${area(location).cm.height} cm`)}</p>}

          {selected && selected.tpacKind && selected.tpacKind !== "guide" && (
            <div className="border-t border-line">
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
            </div>
          )}
        </section>

        {/* ------------------------------ tools + piece */}
        <div className="space-y-5 lg:col-span-5">
          <div ref={creativeRef} className="scroll-mt-24">
            <CreativeSpace
              tab={tab} setTab={setTab} api={api} ready={ready} uploading={uploading} openUpload={openUpload} fonts={fonts}
              location={location} locationLabel={locLabel} layers={layers} selectedId={selected?.tpacId}
              garmentLocations={garment.print_locations} textRef={textRef}
              onClear={() => { if (confirm(t("مسح كل عناصر التصميم؟", "Remove every element of the design?"))) api.clearAll(); }}
            />
          </div>
          <PieceCard
            garments={garments} garmentCode={garmentCode} setGarmentCode={setGarmentCode} colors={garmentColors} colorId={colorId} setColorId={setColorId}
            sizes={sizes} setSizes={setSizes} locations={availableLocations} used={usedLocations} options={options} choice={choice} setChoice={setChoice}
            tiers={tiers.filter((x) => x.is_active)} totalQty={totalQty} pct={pct} unit={unit} unitAfter={unitAfter} settings={settings} rush={resolved.choice.addons.includes("rush")}
            notes={notes} setNotes={setNotes} designName={designName} setDesignName={setDesignName} sectionRef={pieceRef}
            giftOption={giftOption} boxText={boxText} setBoxText={setBoxText} boxFont={boxFont}
          />
        </div>
      </div>

      {/* price + main action, always within thumb reach */}
      <div className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-paper/92 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-3 backdrop-blur-xl">
        <div className="container-x flex items-center justify-between gap-4">
          <div className="min-w-0">
            <p className="text-xs text-mute">{couple ? t("القطعتين مع الطباعة", "Both pieces with printing") : t("السعر مع الطباعة", "Price with printing")}{totalQty + otherQty > 1 && ` · ${totalQty + otherQty} ${t("قطع", "pcs")}`}{pct > 0 && <span className="ms-1.5 rounded-full bg-pine-soft px-1.5 py-0.5 font-bold text-pine">-{pct}%</span>}</p>
            <p className="display text-2xl tabular-nums">{formatIQD(grandTotal, locale)}</p>
          </div>
          {anyContent ? (
            <button onClick={openReview} disabled={saving || uploading || preparing || !ready} className="btn btn-brand h-14 min-w-[44%] rounded-2xl px-6 text-base sm:min-w-64">
              {preparing || saving ? <Loader2 className="size-5 animate-spin" /> : <><ShoppingBag className="size-5" /> {t("مراجعة وإضافة للسلة", "Review & add to bag")}</>}
            </button>
          ) : (
            <button onClick={openUpload} disabled={uploading || !ready} className="btn btn-brand h-14 min-w-[44%] rounded-2xl px-6 text-base sm:min-w-64">
              {uploading ? <Loader2 className="size-5 animate-spin" /> : <><Upload className="size-5" /> {t("ارفع تصميمك", "Upload your design")}</>}
            </button>
          )}
        </div>
      </div>

      {review && (
        <ReviewDialog
          pieces={review.pieces.map((p) => {
            const list = garment.base_price + placementsPrice(p.used, priceOfLoc) + resolved.price;
            return { front: p.front, back: p.back, sides: p.sides, colorName: p.colorName, colorHex: p.colorHex, sizes: p.sizes, placements: p.used.map((l) => dict.designer.locations[l] ?? l), unit: discountedUnit(list, pct), listUnit: list };
          })}
          reference={refOn ? { urls: reference.items.map((x) => x.url), note: reference.note.trim() } : undefined}
          warnings={warnings} saving={saving} garmentName={locale === "ar" ? garment.name_ar : garment.name_en} extras={pickedRows.map(optionLabel)} pct={pct}
          notice={locale === "ar" ? settings.notice_ar : settings.notice_en}
          onClose={() => setReview(null)} onConfirm={confirmSave}
          onFix={() => { setReview(null); wrapRef.current?.scrollIntoView({ behavior: "smooth", block: "center" }); }}
        />
      )}
    </div>
  );
}

function IconBtn({ children, label, onClick, disabled, active }: { children: React.ReactNode; label: string; onClick: () => void; disabled?: boolean; active?: boolean }) {
  return (
    <button type="button" title={label} aria-label={label} aria-pressed={active} disabled={disabled} onClick={onClick} className={cn("grid size-10 place-items-center rounded-full text-pine transition hover:bg-pine-soft disabled:text-mute disabled:opacity-40", active && "bg-pine-soft")}>
      {children}
    </button>
  );
}

/** Preview images are capped at 900 px wide and ~1.2 MB so the upload stays light on any phone. */
async function compact(dataUrl: string): Promise<string> {
  const img = new Image();
  img.src = dataUrl;
  await img.decode();
  if (img.width <= 900 && dataUrl.length < 1_200_000) return dataUrl;
  const c = document.createElement("canvas");
  c.width = Math.min(900, img.width);
  c.height = Math.round((img.height / img.width) * c.width);
  const ctx = c.getContext("2d")!;
  ctx.fillStyle = "#F3F1EC";
  ctx.fillRect(0, 0, c.width, c.height);
  ctx.drawImage(img, 0, 0, c.width, c.height);
  for (const q of [0.86, 0.78, 0.7, 0.6]) {
    const out = c.toDataURL("image/jpeg", q);
    if (out.length < 1_200_000) return out;
  }
  return c.toDataURL("image/jpeg", 0.5);
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
