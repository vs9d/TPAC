/**
 * Product printing configuration — shared by the admin editors, the server actions and the storefront.
 * Every position is stored as a FRACTION: print areas relative to the mockup, designs relative to their area.
 * That keeps everything resolution-independent and guarantees a design can never leave its printable area.
 */
import { garmentDataUrl, type GarmentType } from "./garments";

export interface PrintAreaRow {
  id: string; view_id: string; code: string; name_ar: string; name_en: string;
  x: number; y: number; width: number; height: number;
  max_width_cm: number; max_height_cm: number; sort_order: number; is_active: boolean;
}
export interface TypeViewRow {
  id: string; product_type_id: string; code: string; name_ar: string; name_en: string;
  mockup_url: string | null; mockup_path: string | null; mockup_width: number; mockup_height: number;
  color_mockups: Record<string, { url: string; path?: string | null }>;
  sort_order: number; is_active: boolean;
  product_print_areas?: PrintAreaRow[];
}
export interface ProductTypeRow {
  id: string; code: string; name_ar: string; name_en: string; description_ar: string | null; description_en: string | null;
  garment_shape: GarmentType | null; default_price: number; default_sizes: string[]; default_color_ids: string[];
  category_id: string | null; sort_order: number; is_active: boolean;
  product_type_views?: TypeViewRow[];
}
export interface ProductDesignRow {
  id: string; product_id: string; area_id: string; artwork_url: string; artwork_path: string | null;
  artwork_width: number | null; artwork_height: number | null; x: number; y: number; width: number; height: number; sort_order: number;
}
export interface Rect { x: number; y: number; width: number; height: number }

export const GARMENT_SHAPES: GarmentType[] = ["tshirt", "oversized", "hoodie", "sweatshirt", "longsleeve"];

/** Postgres numerics arrive as strings: normalise a row's geometry to numbers. */
export function num<T extends object>(row: T, keys: (keyof T)[]): T {
  const out = { ...row };
  for (const k of keys) (out as Record<string, unknown>)[k as string] = Number(row[k]);
  return out;
}
export const normArea = (a: PrintAreaRow): PrintAreaRow => num(a, ["x", "y", "width", "height", "max_width_cm", "max_height_cm"]);
export const normDesign = (d: ProductDesignRow): ProductDesignRow => num(d, ["x", "y", "width", "height"]);
export function normType(t: ProductTypeRow): ProductTypeRow {
  return {
    ...t,
    product_type_views: (t.product_type_views ?? [])
      .map((v) => ({ ...v, product_print_areas: (v.product_print_areas ?? []).map(normArea).sort((a, b) => a.sort_order - b.sort_order) }))
      .sort((a, b) => a.sort_order - b.sort_order),
  };
}

/**
 * Blank garment image for a view in a colour: the colour's own mockup → the view's default photo →
 * the built-in vector drawing (tinted to the colour) → null.
 */
export function mockupFor(view: Pick<TypeViewRow, "code" | "mockup_url" | "color_mockups">, shape: GarmentType | null, color?: { id: string; hex: string } | null): string | null {
  if (color && view.color_mockups?.[color.id]?.url) return view.color_mockups[color.id]!.url;
  if (view.mockup_url) return view.mockup_url;
  if (shape) return garmentDataUrl(shape, view.code === "back" ? "back" : "front", color?.hex ?? "#111111");
  return null;
}

/** Rendered aspect of a view (vector mockups are 600 × 700). */
export const viewAspect = (v: Pick<TypeViewRow, "mockup_width" | "mockup_height">) => v.mockup_width / v.mockup_height;

const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n));
const round = (n: number) => Math.round(n * 100000) / 100000;

/** Keeps a rectangle (fractions) inside 0..1 without changing its size unless it is bigger than the bounds. */
export function clampRect(r: Rect, minSize = 0.01): Rect {
  const width = clamp(r.width, minSize, 1);
  const height = clamp(r.height, minSize, 1);
  return { width: round(width), height: round(height), x: round(clamp(r.x, 0, 1 - width)), y: round(clamp(r.y, 0, 1 - height)) };
}

/** Physical print size of a design in cm. */
export function designCm(area: Pick<PrintAreaRow, "max_width_cm" | "max_height_cm">, d: Pick<Rect, "width" | "height">) {
  return { w: Math.round(d.width * area.max_width_cm * 10) / 10, h: Math.round(d.height * area.max_height_cm * 10) / 10 };
}

/** Pixel size of an area on its mockup. */
const areaPx = (area: Rect, view: Pick<TypeViewRow, "mockup_width" | "mockup_height">) => ({ w: area.width * view.mockup_width, h: area.height * view.mockup_height });

/** Height (fraction of the area) that keeps the artwork's own proportions for a given width fraction. */
export function heightForWidth(area: Rect, view: Pick<TypeViewRow, "mockup_width" | "mockup_height">, artW: number, artH: number, width: number) {
  const px = areaPx(area, view);
  return (width * px.w * (artH / artW)) / px.h;
}

/** First placement of new artwork: as big as fits in 80 % of the area, centred, proportions kept. */
export function fitArtwork(area: Rect, view: Pick<TypeViewRow, "mockup_width" | "mockup_height">, artW: number, artH: number, fill = 0.8): Rect {
  const px = areaPx(area, view);
  const k = Math.min((fill * px.w) / artW, (fill * px.h) / artH);
  const width = (artW * k) / px.w;
  const height = (artH * k) / px.h;
  return clampRect({ x: (1 - width) / 2, y: (1 - height) / 2, width, height });
}

/** Resizes a design to `width` (fraction of the area) around its centre, keeping proportions and staying inside. */
export function resizeDesign(d: Rect, area: Rect, view: Pick<TypeViewRow, "mockup_width" | "mockup_height">, artW: number, artH: number, width: number): Rect {
  let w = width;
  let h = heightForWidth(area, view, artW, artH, w);
  if (h > 1) { w = (w * 1) / h; h = 1; }
  if (w > 1) { h = h / w; w = 1; }
  const cx = d.x + d.width / 2;
  const cy = d.y + d.height / 2;
  return clampRect({ x: cx - w / 2, y: cy - h / 2, width: w, height: h });
}

/** Area height that makes its shape on the mockup match its cm proportions. */
export function lockedAreaHeight(area: Pick<Rect, "width">, view: Pick<TypeViewRow, "mockup_width" | "mockup_height">, cmW: number, cmH: number) {
  return (area.width * view.mockup_width * (cmH / cmW)) / view.mockup_height;
}

/** Absolute rectangle (fractions of the mockup) of a design inside its area. */
export const absolute = (area: Rect, d: Rect): Rect => ({ x: area.x + d.x * area.width, y: area.y + d.y * area.height, width: d.width * area.width, height: d.height * area.height });

/** Code for types / views / areas: lowercase latin, digits, "-" and "_" (underscores are kept: placement codes like left_chest rely on them). */
export const slugCode = (s: string) => s.toLowerCase().trim().replace(/[^a-z0-9_]+/g, "-").replace(/^[-_]+|[-_]+$/g, "").slice(0, 40);

/** The main print area of a view, used to carry a design from one garment to another (front ↔ front, sleeve ↔ sleeve). */
const ANCHOR: Record<string, string[]> = { front: ["front"], back: ["back"], right: ["sleeve"], left: ["sleeve_left"], sleeve: ["sleeve"] };
export function anchorArea(view: TypeViewRow): PrintAreaRow | null {
  const list = (view.product_print_areas ?? []).filter((a) => a.is_active && a.code !== "free");
  for (const code of ANCHOR[view.code] ?? []) {
    const a = list.find((x) => x.code === code);
    if (a) return a;
  }
  return list[0] ?? null;
}

export interface MappedDesign { view: TypeViewRow; source: ProductDesignRow; rect: Rect }
/**
 * Places the artwork of one garment on another: the same spot relative to the matching print area
 * (e.g. the centre of the hoodie's chest → the centre of the t-shirt's chest), same proportions,
 * as fractions of the target mockup (i.e. inside its whole-garment "free" area). Views the target lacks are skipped.
 */
export function mapDesigns(src: ProductTypeRow, designs: ProductDesignRow[], dst: ProductTypeRow): MappedDesign[] {
  const out: MappedDesign[] = [];
  const srcViews = (src.product_type_views ?? []).filter((v) => v.is_active);
  const dstViews = (dst.product_type_views ?? []).filter((v) => v.is_active);
  for (const d of designs) {
    const sv = srcViews.find((v) => (v.product_print_areas ?? []).some((a) => a.id === d.area_id));
    const area = sv?.product_print_areas?.find((a) => a.id === d.area_id);
    const dv = sv && dstViews.find((v) => v.code === sv.code);
    if (!sv || !area || !dv) continue;
    const A = anchorArea(sv);
    const B = anchorArea(dv);
    const R = absolute(area, d);
    if (!A || !B) { out.push({ view: dv, source: d, rect: clampRect(R) }); continue; }
    const relW = R.width / A.width;
    const cx = (R.x + R.width / 2 - A.x) / A.width;
    const cy = (R.y + R.height / 2 - A.y) / A.height;
    // keep the artwork's real proportions on the new photo
    const ratio = (R.height * sv.mockup_height) / (R.width * sv.mockup_width);
    let width = relW * B.width;
    let height = (width * dv.mockup_width * ratio) / dv.mockup_height;
    if (height > 1) { width *= 1 / height; height = 1; }
    if (width > 1) { height /= width; width = 1; }
    const x = B.x + cx * B.width - width / 2;
    const y = B.y + cy * B.height - height / 2;
    out.push({ view: dv, source: d, rect: clampRect({ x, y, width, height }) });
  }
  return out;
}
