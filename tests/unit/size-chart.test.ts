import { describe, expect, it } from "vitest";
import { findSize, SIZE_CHARTS } from "@/lib/size-chart";

describe("size finder", () => {
  it("uses TPAC's hoodie chart S → 5XL", () => {
    expect(SIZE_CHARTS.hoodie.map((r) => r.size)).toEqual(["S", "M", "L", "XL", "XXL", "3XL", "4XL", "5XL"]);
    expect(SIZE_CHARTS.hoodie.find((r) => r.size === "L")).toMatchObject({ length: 75, width: 55, sleeve: 65 });
  });

  it("recommends adult sizes by height, weight and fit", () => {
    expect(findSize("hoodie", 175, 75, "regular")!.size).toBe("M");
    expect(findSize("hoodie", 175, 75, "wide")!.size).toBe("L");
    expect(findSize("hoodie", 165, 55, "regular")!.size).toBe("S");
    expect(findSize("hoodie", 185, 100, "regular")!.size).toBe("XXL");
    expect(findSize("hoodie", 195, 130, "regular")!.size).toBe("4XL");
  });

  it("goes a size bigger as the fit gets looser, never smaller", () => {
    const order = ["S", "M", "L", "XL", "XXL", "3XL", "4XL", "5XL"];
    for (const [h, w] of [[160, 50], [172, 68], [180, 85], [190, 110]] as const) {
      const [s, r, x] = (["slim", "regular", "wide"] as const).map((f) => order.indexOf(findSize("hoodie", h, w, f)!.size));
      expect(s).toBeLessThanOrEqual(r!);
      expect(r).toBeLessThanOrEqual(x!);
    }
  });

  it("flags bodies bigger than 5XL and rejects impossible input", () => {
    const a = findSize("hoodie", 190, 200, "wide")!;
    expect(a.size).toBe("5XL");
    expect(a.tooBig).toBe(true);
    expect(findSize("hoodie", 90, 70, "regular")).toBeNull();
    expect(findSize("tshirt", 175, NaN, "regular")).toBeNull();
  });

  it("picks kids sizes by height", () => {
    expect(findSize("kids", 104, 17, "regular")!.size).toBe("4");
    expect(findSize("kids", 134, 28, "regular")!.size).toBe("10");
    expect(findSize("kids", 126, 26, "regular")!.size).toBe("8");
    expect(findSize("kids", 126, 26, "wide")!.size).toBe("10");
  });
});
