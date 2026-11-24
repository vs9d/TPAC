import { describe, it, expect } from "vitest";
import { coupleOptionsSchema, missingInputs, optionInputs, resolveLocally, valuesKey, type CoupleOptions } from "@/lib/couple-options";
import { lineKey } from "@/components/cart/store";

const cfg: CoupleOptions = { second_size: true, fields: [
  { key: "letter", label_ar: "الحرف", label_en: "Letter", type: "letter", per_piece: true, required: true },
  { key: "date", label_ar: "التاريخ", label_en: "", type: "date", per_piece: false, required: false },
] };

describe("couple set options", () => {
  it("expands per-hoodie fields into two boxes with the same labels as the database", () => {
    expect(optionInputs(cfg).map((i) => [i.name, i.label_ar, i.max])).toEqual([
      ["letter_1", "الحرف — الهودي الأول", 3], ["letter_2", "الحرف — الهودي الثاني", 3], ["date", "التاريخ", 20],
    ]);
    expect(optionInputs(cfg)[2].label_en).toBe("التاريخ"); // no English label → Arabic
  });

  it("lists what is missing: second size first, then required boxes", () => {
    expect(missingInputs(cfg, {})).toEqual(["size_2", "letter_1", "letter_2"]);
    expect(missingInputs(cfg, { size_2: "M", letter_1: " M ", letter_2: "R" })).toEqual([]);
  });

  it("labels answers for the bag before the server quote arrives", () => {
    expect(resolveLocally(cfg, "L", { size_2: "M", letter_1: "M", letter_2: "Rxx", date: "" }).map((o) => [o.key, o.value])).toEqual([
      ["size_1", "L"], ["size_2", "M"], ["letter_1", "M"], ["letter_2", "Rxx"],
    ]);
  });

  it("gives the same cart line for the same answers and a different one otherwise", () => {
    expect(valuesKey({ b: "2", a: " 1 ", c: "" })).toBe(valuesKey({ a: "1", b: "2" }));
    const v = "00000000-0000-4000-8000-000000000000";
    expect(lineKey({ variant_id: v })).toBe(v); // ordinary products keep their old key
    expect(lineKey({ variant_id: v, options: { letter_1: "M" } })).not.toBe(lineKey({ variant_id: v, options: { letter_1: "A" } }));
    // a quote line (labelled options + echoed answers) matches its cart line
    expect(lineKey({ variant_id: v, options: [{ key: "letter_1", label_ar: "", label_en: "", value: "M" }], option_values: { letter_1: "M" } })).toBe(lineKey({ variant_id: v, options: { letter_1: "M" } }));
  });

  it("rejects duplicate keys and the reserved size key", () => {
    const f = cfg.fields[0];
    expect(coupleOptionsSchema.safeParse({ second_size: true, fields: [f, f] }).success).toBe(false);
    expect(coupleOptionsSchema.safeParse({ second_size: true, fields: [{ ...f, key: "size" }] }).success).toBe(false);
    expect(coupleOptionsSchema.safeParse(cfg).success).toBe(true);
  });
});
