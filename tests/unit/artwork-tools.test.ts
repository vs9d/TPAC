import { describe, expect, it } from "vitest";
import { clearBackground, hexToRgb, mainColors, rgbToHex, swapColor, tintAll } from "@/lib/artwork-tools";

/** w×h image: white background with a red w/2 square in the middle and one blue pixel inside it */
function img(w = 10, h = 10) {
  const d = new Uint8ClampedArray(w * h * 4);
  for (let p = 0; p < w * h; p++) {
    const x = p % w, y = Math.floor(p / w);
    const inside = x >= w / 4 && x < (3 * w) / 4 && y >= h / 4 && y < (3 * h) / 4;
    d.set(inside ? [220, 20, 20, 255] : [255, 255, 255, 255], p * 4);
  }
  d.set([20, 20, 220, 255], (5 * w + 5) * 4);
  return d;
}

describe("artwork tools", () => {
  it("converts colours", () => {
    expect(hexToRgb("#e3963c")).toEqual([227, 150, 60]);
    expect(rgbToHex([227, 150, 60])).toBe("#e3963c");
    expect(hexToRgb("#fff")).toEqual([255, 255, 255]);
  });

  it("removes a plain background connected to the edges and keeps the design", () => {
    const d = img();
    const n = clearBackground(d, 10, 10);
    expect(n).toBe(100 - 25);
    expect(d[3]).toBe(0); // corner
    expect(d[(5 * 10 + 4) * 4 + 3]).toBe(255); // red square
    expect(d[(5 * 10 + 5) * 4 + 3]).toBe(255); // blue dot
  });

  it("leaves a transparent image alone", () => {
    const d = new Uint8ClampedArray(4 * 4 * 4);
    expect(clearBackground(d, 4, 4)).toBe(0);
  });

  it("recolours the whole design but not transparent pixels", () => {
    const d = img();
    clearBackground(d, 10, 10);
    tintAll(d, [0, 128, 0], false);
    expect([...d.slice((5 * 10 + 4) * 4, (5 * 10 + 4) * 4 + 4)]).toEqual([0, 128, 0, 255]);
    expect(d[3]).toBe(0);
  });

  it("swaps one colour only", () => {
    const d = img();
    const n = swapColor(d, [220, 20, 20], [255, 200, 0]);
    expect(n).toBe(24);
    expect([...d.slice((5 * 10 + 4) * 4, (5 * 10 + 4) * 4 + 3)]).toEqual([255, 200, 0]);
    expect([...d.slice((5 * 10 + 5) * 4, (5 * 10 + 5) * 4 + 3)]).toEqual([20, 20, 220]);
  });

  it("lists the main colours", () => {
    const list = mainColors(img()).map(rgbToHex);
    expect(list[0]).toBe("#ffffff");
    expect(list).toContain("#dc1414");
  });
});
