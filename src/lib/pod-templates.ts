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

/** Views the studio can show: front / back, plus a dedicated photo of each sleeve when the admin provides one. */
export type StudioView = GarmentView | "right" | "left" | "hood";
export const STUDIO_VIEWS: StudioView[] = ["front", "back", "right", "left", "hood"];
export interface PodView { mockup_url: string | null; color_mockups: Record<string, { url: string }>; width: number; height: number }
export interface PodArea { view: StudioView; x: number; y: number; width: number; height: number; cmW: number; cmH: number }
export interface PodTemplate { views: Partial<Record<StudioView, PodView>>; areas: Partial<Record<PrintLocation, PodArea>> }

/** Which views may hold a placement: sleeves sit on the front, or on their own sleeve photo. */
const ALLOWED: Record<PrintLocation, StudioView[]> = { front: ["front"], left_chest: ["front"], back: ["back"], sleeve: ["front", "right"], sleeve_left: ["front", "left"], hood: ["hood", "front"] };

/** The view a placement is shown on (its own sleeve photo when configured, else the built-in mapping). */
export const viewOf = (t: PodTemplate | null, loc: PrintLocation): StudioView => t?.areas[loc]?.view ?? LOCATION_VIEW[loc];

const LOCATIONS: PrintLocation[] = ["front", "back", "left_chest", "sleeve", "sleeve_left", "hood"];

/** Builds the studio template from a product type (front / back views; areas matched by their code). */
export function podTemplate(type: ProductTypeRow | null | undefined): PodTemplate | null {
  if (!type) return null;
  const views: PodTemplate["views"] = {};
  const areas: PodTemplate["areas"] = {};
  for (const v of type.product_type_views ?? []) {
    if (!v.is_active || !STUDIO_VIEWS.includes(v.code as StudioView)) continue;
    views[v.code as StudioView] = { mockup_url: v.mockup_url, color_mockups: v.color_mockups ?? {}, width: v.mockup_width, height: v.mockup_height };
    for (const a of v.product_print_areas ?? []) {
      const code = a.code.replace(/-/g, "_") as PrintLocation; // "left-chest" and "left_chest" are the same placement
      if (!a.is_active || !LOCATIONS.includes(code)) continue;
      // a placement belongs to a view the studio can show it on (a sleeve photo wins over the front)
      if (!ALLOWED[code].includes(v.code as StudioView)) continue;
      if (areas[code] && areas[code]!.view !== "front") continue;
      areas[code] = { view: v.code as StudioView, x: Number(a.x), y: Number(a.y), width: Number(a.width), height: Number(a.height), cmW: Number(a.max_width_cm), cmH: Number(a.max_height_cm) };
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
export function podPhoto(t: PodTemplate | null, view: StudioView, colorId?: string | null): string | null {
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
