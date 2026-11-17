import { describe, it, expect } from "vitest";
import { checkoutSchema, bulkRequestSchema, designSchema, quoteSchema, discountSchema, homepageSectionSchema, fieldErrors } from "@/lib/validation";

const V = "8f14e45f-ceea-467f-a4a9-1d1f7f3c1a2b";
const base = {
  items: [{ variant_id: V, quantity: 2 }],
  customer_name: " Ali Hassan ",
  phone: "0770 123 4567",
  governorate: "baghdad",
  city: "Karrada",
  address_line: "Street 62, house 10",
  delivery_method: "standard",
  payment_method: "cod",
  locale: "ar",
};

describe("checkout validation", () => {
  it("accepts a valid guest order and normalises fields", () => {
    const r = checkoutSchema.safeParse(base);
    expect(r.success).toBe(true);
    if (r.success) {
      expect(r.data.phone).toBe("9647701234567");
      expect(r.data.customer_name).toBe("Ali Hassan");
    }
  });
  it("rejects bad phone, unknown governorate, empty cart and silly quantities", () => {
    const r = checkoutSchema.safeParse({ ...base, phone: "12345", governorate: "atlantis", items: [] });
    expect(r.success).toBe(false);
    if (!r.success) {
      const f = fieldErrors(r.error);
      expect(f.phone).toBe("phone");
      expect(f.governorate).toBeDefined();
      expect(f.items).toBeDefined();
    }
    expect(checkoutSchema.safeParse({ ...base, items: [{ variant_id: V, quantity: 500 }] }).success).toBe(false);
    expect(checkoutSchema.safeParse({ ...base, items: [{ variant_id: "x", quantity: 1 }] }).success).toBe(false);
  });
  it("never accepts client-supplied prices", () => {
    const r = checkoutSchema.safeParse({ ...base, items: [{ variant_id: V, quantity: 1, unit_price: 1 }], total: 1 });
    expect(r.success).toBe(true);
    if (r.success) {
      expect(r.data.items[0]).not.toHaveProperty("unit_price");
      expect(r.data).not.toHaveProperty("total");
    }
  });
  it("caps cart size", () => {
    const items = Array.from({ length: 51 }, () => ({ variant_id: V, quantity: 1 }));
    expect(quoteSchema.safeParse({ items }).success).toBe(false);
  });
});

describe("bulk request validation", () => {
  it("coerces quantities and filters size breakdown keys", () => {
    const r = bulkRequestSchema.safeParse({ organization_name: "University of Baghdad", contact_name: "Sara", phone: "07801234567", product_type: "hoodie", estimated_quantity: "120", size_breakdown: { M: "40", L: "80" } });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.estimated_quantity).toBe(120);
    expect(bulkRequestSchema.safeParse({ organization_name: "X", contact_name: "Y", phone: "07801234567", product_type: "spaceship", estimated_quantity: 5 }).success).toBe(false);
    expect(bulkRequestSchema.safeParse({ organization_name: "X", contact_name: "Y", phone: "07801234567", product_type: "tshirt", estimated_quantity: 5, size_breakdown: { HUGE: 4 } }).success).toBe(false);
  });
});

describe("designer payload validation", () => {
  const obj = { type: "text", location: "front", left: 300, top: 200, scaleX: 1, scaleY: 1, angle: 0, width: 100, height: 40, text: "بغداد", fill: "#FFFFFF" };
  const ok = { garment_type: "tshirt", color_id: V, size_code: "L", objects: [obj], preview_front: "data:image/jpeg;base64,AAAA", preview_back: "data:image/jpeg;base64,AAAA" };
  it("accepts a valid design", () => expect(designSchema.safeParse(ok).success).toBe(true));
  it("accepts tiny artwork scaled up into the print area, rejects absurd rendered sizes", () => {
    const img = { ...obj, type: "image", width: 2, height: 2, scaleX: 110, scaleY: 110, artwork_id: V };
    expect(designSchema.safeParse({ ...ok, objects: [img] }).success).toBe(true);
    expect(designSchema.safeParse({ ...ok, objects: [{ ...img, scaleX: 4000 }] }).success).toBe(false);
  });
  it("rejects empty designs, unknown placements, script-y previews", () => {
    expect(designSchema.safeParse({ ...ok, objects: [] }).success).toBe(false);
    expect(designSchema.safeParse({ ...ok, objects: [{ ...obj, location: "hat" }] }).success).toBe(false);
    expect(designSchema.safeParse({ ...ok, preview_front: "data:text/html;base64,PHNjcmlwdD4=" }).success).toBe(false);
    expect(designSchema.safeParse({ ...ok, objects: [{ ...obj, fill: "red;}" }] }).success).toBe(false);
  });
});

describe("admin validation", () => {
  it("bounds percent discounts", () => {
    const base = { code: "save10", type: "percent", value: 10, min_order_total: 0, is_active: true };
    const r = discountSchema.safeParse(base);
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.code).toBe("SAVE10");
    expect(discountSchema.safeParse({ ...base, value: 150 }).success).toBe(false);
  });
  it("requires valid JSON object for homepage section data", () => {
    const s = { key: "social", data: '{"handle":"thetpac"}', sort_order: 1, is_visible: true };
    expect(homepageSectionSchema.safeParse(s).success).toBe(true);
    expect(homepageSectionSchema.safeParse({ ...s, data: "[1,2]" }).success).toBe(false);
    expect(homepageSectionSchema.safeParse({ ...s, data: "{oops" }).success).toBe(false);
  });
});
