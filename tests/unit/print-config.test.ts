import { describe, expect, it } from "vitest";
import { absolute, clampRect, designCm, fitArtwork, heightForWidth, lockedAreaHeight, mockupFor, resizeDesign } from "@/lib/print-config";

const view = { mockup_width: 800, mockup_height: 1000 };
const area = { x: 0.3, y: 0.25, width: 0.4, height: 0.4 };

describe("print geometry", () => {
  it("keeps rectangles inside their bounds", () => {
    expect(clampRect({ x: 0.9, y: -0.2, width: 0.3, height: 0.5 })).toEqual({ x: 0.7, y: 0, width: 0.3, height: 0.5 });
    expect(clampRect({ x: 0, y: 0, width: 2, height: 2 })).toEqual({ x: 0, y: 0, width: 1, height: 1 });
  });
  it("fits new artwork centred at 80 % with its proportions", () => {
    const d = fitArtwork(area, view, 1200, 600); // 2:1 artwork
    expect(d.width).toBeCloseTo(0.8, 4);
    // area is 320 x 400 px: 0.8 * 320 = 256 px wide -> 128 px high -> 0.32 of 400
    expect(d.height).toBeCloseTo(0.32, 4);
    expect(d.x).toBeCloseTo(0.1, 4);
    expect(d.y).toBeCloseTo(0.34, 4);
    // proportions on screen are those of the artwork
    expect((d.width * area.width * view.mockup_width) / (d.height * area.height * view.mockup_height)).toBeCloseTo(2, 4);
  });
  it("resizes around the centre without leaving the area", () => {
    const d = fitArtwork(area, view, 1000, 1000);
    const big = resizeDesign(d, area, view, 1000, 1000, 1.5);
    expect(big.width).toBeLessThanOrEqual(1);
    expect(big.height).toBeLessThanOrEqual(1);
    expect(big.x + big.width).toBeLessThanOrEqual(1.00001);
    expect(heightForWidth(area, view, 1000, 1000, big.width)).toBeCloseTo(big.height, 4);
  });
  it("converts to centimetres from the area's maximum print size", () => {
    expect(designCm({ max_width_cm: 30, max_height_cm: 40 }, { width: 0.5, height: 0.25 })).toEqual({ w: 15, h: 10 });
  });
  it("locks an area's shape to its cm proportions", () => {
    // 30 x 40 cm on an 800 x 1000 mockup, 0.375 wide (300 px) -> 400 px tall -> 0.4
    expect(lockedAreaHeight({ width: 0.375 }, view, 30, 40)).toBeCloseTo(0.4, 5);
  });
  it("places a design in mockup coordinates", () => {
    expect(absolute(area, { x: 0.5, y: 0, width: 0.5, height: 0.5 })).toEqual({ x: 0.5, y: 0.25, width: 0.2, height: 0.2 });
  });
  it("picks the colour's own mockup, then the default photo, then the built-in drawing", () => {
    const v = { code: "front", mockup_url: "/m.png", color_mockups: { c1: { url: "/white.png" } } };
    expect(mockupFor(v, "hoodie", { id: "c1", hex: "#FFFFFF" })).toBe("/white.png");
    expect(mockupFor(v, "hoodie", { id: "c2", hex: "#111111" })).toBe("/m.png");
    expect(mockupFor({ ...v, mockup_url: null, color_mockups: {} }, "hoodie", { id: "c2", hex: "#111111" })).toMatch(/^data:image\/svg\+xml/);
    expect(mockupFor({ ...v, mockup_url: null, color_mockups: {} }, null, null)).toBeNull();
  });
});

describe("mapDesigns (same artwork on another garment)", async () => {
  const { mapDesigns } = await import("@/lib/print-config");
  const view = (id: string, code: string, area: { id: string; code: string; x: number; y: number; width: number; height: number }, w = 600, h = 700) => ({
    id, code, name_ar: code, name_en: code, mockup_url: null, mockup_path: null, mockup_width: w, mockup_height: h, color_mockups: {}, sort_order: 0, is_active: true,
    product_print_areas: [{ ...area, view_id: id, name_ar: area.code, name_en: area.code, max_width_cm: 30, max_height_cm: 40, sort_order: 0, is_active: true }],
  });
  const type = (id: string, views: ReturnType<typeof view>[]) => ({ id, code: id, name_ar: id, name_en: id, description_ar: null, description_en: null, garment_shape: null, default_price: 0, default_sizes: [], default_color_ids: [], category_id: null, sort_order: 0, is_active: true, product_type_views: views }) as never;
  const hoodie = type("h", [view("hf", "front", { id: "ha", code: "front", x: 0.3, y: 0.3, width: 0.4, height: 0.2 })]);
  const tee = type("t", [view("tf", "front", { id: "ta", code: "front", x: 0.25, y: 0.2, width: 0.5, height: 0.5 })]);
  const design = (x: number, y: number, width: number, height: number) => ({ id: "d", product_id: "p", area_id: "ha", artwork_url: "/a.png", artwork_path: null, artwork_width: 100, artwork_height: 100, x, y, width, height, sort_order: 0 }) as never;

  it("keeps the spot relative to the matching print area", () => {
    const [m] = mapDesigns(hoodie, [design(0.25, 0.25, 0.5, 0.5)], tee);
    expect(m!.view.id).toBe("tf");
    // centre of the hoodie's front area → centre of the tee's front area
    expect(m!.rect.x + m!.rect.width / 2).toBeCloseTo(0.5, 3);
    expect(m!.rect.y + m!.rect.height / 2).toBeCloseTo(0.45, 3);
    // same proportions as before (same mockup size)
    expect(m!.rect.height / m!.rect.width).toBeCloseTo((0.5 * 0.2) / (0.5 * 0.4), 3);
  });

  it("skips views the other garment lacks", () => {
    const back = type("h2", [view("hb", "back", { id: "hba", code: "back", x: 0.3, y: 0.3, width: 0.4, height: 0.4 })]);
    expect(mapDesigns(back, [{ ...(design(0, 0, 1, 1) as object), area_id: "hba" } as never], tee)).toEqual([]);
  });
});
