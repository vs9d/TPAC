import { describe, expect, it } from "vitest";
import { GARMENTS } from "@/lib/garments";
import { fitInArtboard, podArea, podPhoto, podTemplate } from "@/lib/pod-templates";
import type { ProductTypeRow } from "@/lib/print-config";

const type = (mockup: string | null, w = 600, h = 700, colorMockups: Record<string, { url: string }> = {}): ProductTypeRow => ({
  id: "t", code: "tshirt", name_ar: "ت", name_en: "T", description_ar: null, description_en: null, garment_shape: "tshirt",
  default_price: 0, default_sizes: [], default_color_ids: [], category_id: null, sort_order: 0, is_active: true,
  product_type_views: [{
    id: "v", product_type_id: "t", code: "front", name_ar: "أ", name_en: "F", mockup_url: mockup, mockup_path: null, mockup_width: w, mockup_height: h,
    color_mockups: colorMockups, sort_order: 0, is_active: true,
    product_print_areas: [{ id: "a", view_id: "v", code: "front", name_ar: "و", name_en: "C", x: 0.25, y: 0.2, width: 0.5, height: 0.5, max_width_cm: 30, max_height_cm: 40, sort_order: 0, is_active: true }],
  }],
});

describe("print-on-demand images in the studio", () => {
  it("uses the colour photo, then the default photo, else the drawing", () => {
    const t = podTemplate(type("/default.png", 600, 700, { white: { url: "/white.png" } }));
    expect(podPhoto(t, "front", "white")).toBe("/white.png");
    expect(podPhoto(t, "front", "black")).toBe("/default.png");
    expect(podPhoto(podTemplate(type(null)), "front", "black")).toBeNull();
    expect(podPhoto(t, "back", "black")).toBeNull();
  });
  it("fits any photo inside the 600 × 700 artboard", () => {
    expect(fitInArtboard(900, 1000)).toEqual({ x: 0, y: 16.666666666666686, width: 600, height: 666.6666666666666 });
    expect(fitInArtboard(1200, 700)).toMatchObject({ x: 0, width: 600, height: 350 });
  });
  it("places the admin's print area on the photo, with its cm size", () => {
    const a = podArea(podTemplate(type("/p.png", 900, 1000)), "tshirt", "front");
    // photo box 600 × 666.67 starting at y = 16.67
    expect(a.x).toBeCloseTo(150, 5);
    expect(a.y).toBeCloseTo(16.6667 + 0.2 * 666.6667, 3);
    expect(a.width).toBeCloseTo(300, 5);
    expect(a.cm).toEqual({ width: 30, height: 40 });
  });
  it("falls back to the built-in geometry for placements without an area", () => {
    expect(podArea(podTemplate(type("/p.png")), "tshirt", "back")).toEqual(GARMENTS.tshirt.printAreas.back);
    expect(podArea(null, "hoodie", "front")).toEqual(GARMENTS.hoodie.printAreas.front);
  });
});
