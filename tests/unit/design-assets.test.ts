import { describe, expect, it } from "vitest";
import { SHAPES, SHAPE_IDS, TEMPLATES, TEXT_PRESETS_UI, shapeById } from "@/lib/design-assets";
import { GARMENTS } from "@/lib/garments";
import { podTemplate, viewOf } from "@/lib/pod-templates";

const LOCATIONS = ["front", "back", "left_chest", "sleeve", "sleeve_left", "hood"];

describe("designer assets", () => {
  it("has unique shape ids and well-formed paths", () => {
    expect(new Set(SHAPE_IDS).size).toBe(SHAPES.length);
    for (const s of SHAPES) {
      expect(s.path, s.id).toMatch(/^M[-\d.]/);
      expect(s.path, s.id).not.toMatch(/NaN|undefined/);
    }
    for (const id of ["heart_outline", "infinity", "puzzle", "rings", "chick", "sparkles"]) expect(shapeById(id), id).toBeTruthy();
  });

  it("templates only use known shapes, text styles and placements", () => {
    const presets = new Set(TEXT_PRESETS_UI.map((p) => p.id));
    expect(new Set(TEMPLATES.map((t) => t.id)).size).toBe(TEMPLATES.length);
    for (const t of TEMPLATES) {
      for (const it of [...t.items, ...(t.pair ?? [])]) {
        expect(LOCATIONS, `${t.id} location`).toContain(it.location);
        if (it.kind === "shape") expect(shapeById(it.shape), `${t.id} shape ${it.shape}`).toBeTruthy();
        else expect(presets.has(it.preset), `${t.id} preset ${it.preset}`).toBe(true);
        expect(Math.abs(it.dy) <= 0.5 && Math.abs(it.dx ?? 0) <= 0.5, `${t.id} offset`).toBe(true);
      }
    }
  });

  it("couple ideas design both pieces", () => {
    const couples = TEMPLATES.filter((t) => t.group === "couple");
    expect(couples.length).toBeGreaterThanOrEqual(6);
    for (const t of couples) expect(t.pair?.length, t.id).toBeGreaterThan(0);
    expect(TEMPLATES.find((t) => t.id === "c-fik-minni")!.pair![0]).toMatchObject({ ar: "فيني منك .." });
  });
});

describe("inside-the-hood placement", () => {
  it("every garment has a hood area (built-in fallback on the front)", () => {
    for (const g of Object.values(GARMENTS)) expect(g.printAreas.hood.cm).toEqual({ width: 20, height: 9 });
    expect(viewOf(null, "hood")).toBe("front");
  });
  it("uses its own photo when the hoodie template has a hood view", () => {
    const view = (code: string, areas: { code: string }[]) => ({ id: code, code, is_active: true, mockup_url: `/m/${code}.webp`, color_mockups: {}, mockup_width: 750, mockup_height: 720, product_print_areas: areas.map((a) => ({ ...a, is_active: true, x: 0.25, y: 0.2, width: 0.5, height: 0.23, max_width_cm: 20, max_height_cm: 9 })) });
    const t = podTemplate({ product_type_views: [view("front", [{ code: "front" }]), view("hood", [{ code: "hood" }])] } as never);
    expect(viewOf(t, "hood")).toBe("hood");
    expect(t!.views.hood?.mockup_url).toBe("/m/hood.webp");
  });
});
