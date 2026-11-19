/**
 * Print-on-demand garments (the customer studio at /design) use the SAME admin-managed records as catalog
 * products: product_types (matched by code: tshirt, hoodie…) → product_type_views (mockup photos, per colour)
 * → product_print_areas (position + max size in cm). No separate image system.
 *
 * The studio works on a fixed 600 × 700 artboard; a photo of any proportions is fitted ("contain") inside it
 * and every print area is converted into artboard pixels, so saved designs, previews and the production sheet
 * all speak the same coordinates.
 */
import { ARTBOARD, GARMENTS, LOCATION_VIEW, type GarmentType, type GarmentView, type PrintArea, type PrintLocation } from "./garments";
import type { ProductTypeRow } from "./print-config";

export interface PodView { mockup_url: string | null; color_mockups: Record<string, { url: string }>; width: number; height: number }
export interface PodArea { view: GarmentView; x: number; y: number; width: number; height: number; cmW: number; cmH: number }
export interface PodTemplate { views: Partial<Record<GarmentView, PodView>>; areas: Partial<Record<PrintLocation, PodArea>> }

const LOCATIONS: PrintLocation[] = ["front", "back", "left_chest", "sleeve", "sleeve_left"];

/** Builds the studio template from a product type (front / back views; areas matched by their code). */
export function podTemplate(type: ProductTypeRow | null | undefined): PodTemplate | null {
  if (!type) return null;
  const views: PodTemplate["views"] = {};
  const areas: PodTemplate["areas"] = {};
  for (const v of type.product_type_views ?? []) {
    if (!v.is_active || (v.code !== "front" && v.code !== "back")) continue;
    views[v.code] = { mockup_url: v.mockup_url, color_mockups: v.color_mockups ?? {}, width: v.mockup_width, height: v.mockup_height };
    for (const a of v.product_print_areas ?? []) {
      if (!a.is_active || !LOCATIONS.includes(a.code as PrintLocation)) continue;
      // a placement belongs to the view the studio shows it on (sleeves and chest are on the front)
      if (LOCATION_VIEW[a.code as PrintLocation] !== v.code) continue;
      areas[a.code as PrintLocation] = { view: v.code, x: Number(a.x), y: Number(a.y), width: Number(a.width), height: Number(a.height), cmW: Number(a.max_width_cm), cmH: Number(a.max_height_cm) };
    }
  }
  return { views, areas };
}

/** Where a mockup of w × h sits inside the artboard (contain-fit, centred). */
export function fitInArtboard(w: number, h: number) {
  const s = Math.min(ARTBOARD.width / w, ARTBOARD.height / h);
  const dw = w * s;
  const dh = h * s;
  return { x: (ARTBOARD.width - dw) / 2, y: (ARTBOARD.height - dh) / 2, width: dw, height: dh };
}

/** The photo the admin uploaded for this view and colour, or null (then the built-in drawing is used). */
export function podPhoto(t: PodTemplate | null, view: GarmentView, colorId?: string | null): string | null {
  const v = t?.views[view];
  if (!v) return null;
  return (colorId && v.color_mockups[colorId]?.url) || v.mockup_url || null;
}

/**
 * Print area of a placement in artboard pixels. Uses the admin's area (positioned on the photo when one is
 * uploaded, on the drawing otherwise) and its max size in cm; falls back to the built-in geometry.
 */
export function podArea(t: PodTemplate | null, garment: GarmentType, loc: PrintLocation): PrintArea {
  const builtIn = GARMENTS[garment].printAreas[loc];
  const a = t?.areas[loc];
  if (!a) return builtIn;
  const v = t!.views[a.view];
  const hasPhoto = !!v && (!!v.mockup_url || Object.keys(v.color_mockups).length > 0);
  const box = hasPhoto ? fitInArtboard(v!.width, v!.height) : { x: 0, y: 0, width: ARTBOARD.width, height: ARTBOARD.height };
  return {
    x: box.x + a.x * box.width,
    y: box.y + a.y * box.height,
    width: a.width * box.width,
    height: a.height * box.height,
    cm: { width: a.cmW, height: a.cmH },
  };
}

/** Every placement's area for a garment (for guides, clipping and the production sheet). */
export function podAreas(t: PodTemplate | null, garment: GarmentType): Record<PrintLocation, PrintArea> {
  return Object.fromEntries(LOCATIONS.map((l) => [l, podArea(t, garment, l)])) as Record<PrintLocation, PrintArea>;
}
