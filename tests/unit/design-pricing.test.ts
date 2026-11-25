import { describe, expect, it } from "vitest";
import { discountedUnit, nextTier, placementCharges, placementsPrice, resolveOptions, tierPercent, type OptionLite } from "@/lib/design-pricing";
import { SHAPES, SHAPE_IDS, TEMPLATES, TEXT_PRESETS_UI } from "@/lib/design-assets";

const O = (group_code: OptionLite["group_code"], code: string, price: number, is_default = false): OptionLite => ({ id: `${group_code}-${code}`, group_code, code, price, is_default });
const options = [O("method", "dtf", 0, true), O("method", "vinyl", 2000), O("finish", "matte", 0, true), O("finish", "puff", 2500), O("addon", "rush", 5000), O("addon", "tag", 500)];

describe("option resolution", () => {
  it("falls back to defaults and prices the choice per piece", () => {
    const r = resolveOptions(options, {});
    expect(r.choice).toMatchObject({ method: "dtf", finish: "matte", addons: [] });
    expect(r.price).toBe(0);
  });
  it("adds single choices and add-ons, ignores unknown codes", () => {
    const r = resolveOptions(options, { method: "vinyl", finish: "puff", addons: ["rush", "tag", "ghost"] });
    expect(r.price).toBe(2000 + 2500 + 5000 + 500);
    expect(r.choice.addons).toEqual(["rush", "tag"]);
    expect(resolveOptions(options, { method: "nope" }).choice.method).toBe("dtf");
  });
  it("skips groups that have no options at all", () => {
    expect(resolveOptions([O("addon", "rush", 100)], { addons: ["rush"] }).choice.method).toBeUndefined();
  });
});

describe("quantity tiers", () => {
  const tiers = [{ min_qty: 6, discount_percent: 5 }, { min_qty: 12, discount_percent: 10 }, { min_qty: 24, discount_percent: 15 }];
  it("uses the best tier reached", () => {
    expect([1, 5, 6, 11, 12, 30].map((q) => tierPercent(tiers, q))).toEqual([0, 0, 5, 5, 10, 15]);
  });
  it("rounds the discount to 250 IQD exactly like quote_cart", () => {
    expect(discountedUnit(28000, 5)).toBe(26500);
    expect(discountedUnit(28000, 10)).toBe(25250);
    expect(discountedUnit(28000, 0)).toBe(28000);
  });
  it("hints the next tier", () => {
    expect(nextTier(tiers, 7)?.min_qty).toBe(12);
    expect(nextTier(tiers, 24)).toBeNull();
  });
});

describe("designer assets", () => {
  it("has unique shape ids that the server whitelist knows", () => {
    expect(new Set(SHAPES.map((s) => s.id)).size).toBe(SHAPES.length);
    expect(SHAPE_IDS.length).toBe(SHAPES.length);
    for (const s of SHAPES) expect(s.path).toMatch(/^M[\d .,-]+[A-Za-z]/);
  });
  it("templates and presets only reference real shapes and presets", () => {
    const presets = new Set(TEXT_PRESETS_UI.map((p) => p.id));
    for (const tp of TEMPLATES) for (const i of tp.items) {
      if (i.kind === "text") expect(presets.has(i.preset)).toBe(true);
      else expect(SHAPE_IDS).toContain(i.shape);
    }
  });
});

describe("print placements", () => {
  const price: Record<string, number> = { front: 5000, back: 6000, sleeve: 3000 };
  const of = (l: string) => price[l] ?? 0;
  it("includes one placement in the garment price", () => {
    expect(placementsPrice([], of)).toBe(0);
    expect(placementsPrice(["front"], of)).toBe(0);
    expect(placementsPrice(["sleeve"], of)).toBe(0);
  });
  it("charges every extra placement, keeping the most expensive one included", () => {
    expect(placementsPrice(["front", "back"], of)).toBe(5000);
    expect(placementsPrice(["front", "back", "sleeve"], of)).toBe(8000);
    expect(placementsPrice(["front", "front"], of)).toBe(0);
    expect([...placementCharges(["front", "back", "sleeve"], of)]).toEqual([["front", 5000], ["back", 0], ["sleeve", 3000]]);
  });
});
