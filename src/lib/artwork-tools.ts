/**
 * Small in-browser image tools for the admin's official artwork (no external service):
 * remove a plain background, recolour the whole design, or swap one colour of it.
 * Everything returns a transparent PNG blob ready to upload.
 */
export type RGB = [number, number, number];

export const hexToRgb = (hex: string): RGB => {
  const h = hex.replace("#", "");
  const n = parseInt(h.length === 3 ? h.split("").map((c) => c + c).join("") : h, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
};
export const rgbToHex = ([r, g, b]: RGB) => `#${[r, g, b].map((v) => v.toString(16).padStart(2, "0")).join("")}`;
const dist = (d: Uint8ClampedArray, i: number, c: RGB) => Math.hypot(d[i]! - c[0], d[i + 1]! - c[1], d[i + 2]! - c[2]);

async function load(url: string): Promise<{ ctx: CanvasRenderingContext2D; img: ImageData; w: number; h: number }> {
  const blob = await (await fetch(url)).blob();
  const bmp = await createImageBitmap(blob);
  const max = 2400;
  const k = Math.min(1, max / Math.max(bmp.width, bmp.height));
  const w = Math.max(1, Math.round(bmp.width * k));
  const h = Math.max(1, Math.round(bmp.height * k));
  const c = document.createElement("canvas");
  c.width = w; c.height = h;
  const ctx = c.getContext("2d", { willReadFrequently: true })!;
  ctx.drawImage(bmp, 0, 0, w, h);
  return { ctx, img: ctx.getImageData(0, 0, w, h), w, h };
}

async function out(ctx: CanvasRenderingContext2D, img: ImageData): Promise<{ blob: Blob; width: number; height: number }> {
  ctx.putImageData(img, 0, 0);
  const blob = await new Promise<Blob>((res, rej) => ctx.canvas.toBlob((b) => (b ? res(b) : rej(new Error("png"))), "image/png"));
  return { blob, width: img.width, height: img.height };
}

/** Pure pixel work (exported for tests): clears every pixel connected to the border that is close to the border colour. */
export function clearBackground(data: Uint8ClampedArray, w: number, h: number, tolerance = 40): number {
  // the background colour = the most common colour among the border pixels
  const counts = new Map<string, { c: RGB; n: number }>();
  const edge: number[] = [];
  for (let x = 0; x < w; x++) edge.push(x, (h - 1) * w + x);
  for (let y = 0; y < h; y++) edge.push(y * w, y * w + w - 1);
  for (const p of edge) {
    const i = p * 4;
    if (data[i + 3]! < 16) continue;
    const c: RGB = [data[i]! & 0xf0, data[i + 1]! & 0xf0, data[i + 2]! & 0xf0];
    const k = c.join(",");
    const e = counts.get(k);
    if (e) e.n++; else counts.set(k, { c: [data[i]!, data[i + 1]!, data[i + 2]!], n: 1 });
  }
  const bg = [...counts.values()].sort((a, b) => b.n - a.n)[0]?.c;
  if (!bg) return 0;
  const seen = new Uint8Array(w * h);
  const stack: number[] = [];
  for (const p of edge) if (!seen[p]) { seen[p] = 1; stack.push(p); }
  let cleared = 0;
  while (stack.length) {
    const p = stack.pop()!;
    const i = p * 4;
    if (data[i + 3]! >= 16 && dist(data, i, bg) > tolerance) continue;
    if (data[i + 3]! !== 0) { data[i + 3] = 0; cleared++; }
    const x = p % w, y = (p - x) / w;
    if (x > 0 && !seen[p - 1]) { seen[p - 1] = 1; stack.push(p - 1); }
    if (x < w - 1 && !seen[p + 1]) { seen[p + 1] = 1; stack.push(p + 1); }
    if (y > 0 && !seen[p - w]) { seen[p - w] = 1; stack.push(p - w); }
    if (y < h - 1 && !seen[p + w]) { seen[p + w] = 1; stack.push(p + w); }
  }
  // soften the cut edge: pixels next to the cleared area that are close to the background become half transparent
  for (let p = 0; p < w * h; p++) {
    const i = p * 4;
    if (data[i + 3] === 0) continue;
    const x = p % w;
    const near = (x > 0 && data[i - 1] === 0) || (x < w - 1 && data[i + 7] === 0) || (p >= w && data[i - w * 4 + 3] === 0) || (p < w * (h - 1) && data[i + w * 4 + 3] === 0);
    if (near && dist(data, i, bg) < tolerance * 2) data[i + 3] = Math.round(data[i + 3]! * 0.5);
  }
  return cleared;
}

/** Recolours every visible pixel (keeps transparency and the light/dark shading of the design). */
export function tintAll(data: Uint8ClampedArray, color: RGB, keepShading = true) {
  for (let i = 0; i < data.length; i += 4) {
    if (data[i + 3] === 0) continue;
    const l = keepShading ? (0.299 * data[i]! + 0.587 * data[i + 1]! + 0.114 * data[i + 2]!) / 255 : 0.5;
    // shading: dark parts stay a darker shade of the colour, light parts a lighter one
    const k = keepShading ? 0.55 + l * 0.9 : 1;
    data[i] = Math.min(255, Math.round(color[0] * k));
    data[i + 1] = Math.min(255, Math.round(color[1] * k));
    data[i + 2] = Math.min(255, Math.round(color[2] * k));
  }
}

/** Replaces one colour of the design (with a tolerance) by another. Returns how many pixels changed. */
export function swapColor(data: Uint8ClampedArray, from: RGB, to: RGB, tolerance = 60): number {
  let n = 0;
  for (let i = 0; i < data.length; i += 4) {
    if (data[i + 3] === 0 || dist(data, i, from) > tolerance) continue;
    data[i] = to[0]; data[i + 1] = to[1]; data[i + 2] = to[2];
    n++;
  }
  return n;
}

/** The main colours of the design (for the "change one colour" picker). */
export function mainColors(data: Uint8ClampedArray, max = 6): RGB[] {
  const buckets = new Map<string, { sum: [number, number, number]; n: number }>();
  const step = Math.max(4, Math.floor(data.length / 4 / 40000) * 4);
  for (let i = 0; i < data.length; i += step) {
    if (data[i + 3]! < 128) continue;
    const k = `${data[i]! >> 5},${data[i + 1]! >> 5},${data[i + 2]! >> 5}`;
    const b = buckets.get(k) ?? { sum: [0, 0, 0], n: 0 };
    b.sum[0] += data[i]!; b.sum[1] += data[i + 1]!; b.sum[2] += data[i + 2]!; b.n++;
    buckets.set(k, b);
  }
  const list = [...buckets.values()].sort((a, b) => b.n - a.n).map((b) => b.sum.map((s) => Math.round(s / b.n)) as RGB);
  const picked: RGB[] = [];
  for (const c of list) {
    if (picked.every((p) => Math.hypot(p[0] - c[0], p[1] - c[1], p[2] - c[2]) > 48)) picked.push(c);
    if (picked.length >= max) break;
  }
  return picked;
}

export async function removeBackground(url: string, tolerance = 40) {
  const { ctx, img } = await load(url);
  const cleared = clearBackground(img.data, img.width, img.height, tolerance);
  return { ...(await out(ctx, img)), changed: cleared };
}
export async function recolorAll(url: string, hex: string) {
  const { ctx, img } = await load(url);
  tintAll(img.data, hexToRgb(hex), false);
  return { ...(await out(ctx, img)), changed: 1 };
}
export async function recolorPart(url: string, fromHex: string, toHex: string, tolerance = 60) {
  const { ctx, img } = await load(url);
  const changed = swapColor(img.data, hexToRgb(fromHex), hexToRgb(toHex), tolerance);
  return { ...(await out(ctx, img)), changed };
}
export async function colorsOf(url: string): Promise<string[]> {
  const { img } = await load(url);
  return mainColors(img.data).map(rgbToHex);
}
