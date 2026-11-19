"use client";
/** Renders product photos from a mockup + the official artwork, in the browser (no server image library needed). */

const load = (src: string) =>
  new Promise<HTMLImageElement>((resolve, reject) => {
    const img = new Image();
    if (!src.startsWith("data:") && !src.startsWith("blob:")) img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`image: ${src.slice(0, 80)}`));
    img.src = src;
  });

export interface ComposeItem { url: string; x: number; y: number; width: number; height: number }

/**
 * 1200 × 1500 (4:5, like the product cards) JPEG: the mockup fitted on a soft background,
 * each artwork drawn in its rectangle (fractions of the mockup), keeping its proportions.
 */
export async function composeProductImage(mockupUrl: string, mockAspect: number, items: ComposeItem[], opts: { width?: number; height?: number; background?: string } = {}): Promise<Blob> {
  const W = opts.width ?? 1200;
  const H = opts.height ?? 1500;
  const c = document.createElement("canvas");
  c.width = W;
  c.height = H;
  const ctx = c.getContext("2d")!;
  ctx.fillStyle = opts.background ?? "#EFECE6";
  ctx.fillRect(0, 0, W, H);
  const pad = 0.05;
  let mw = W * (1 - 2 * pad);
  let mh = mw / mockAspect;
  if (mh > H * (1 - 2 * pad)) { mh = H * (1 - 2 * pad); mw = mh * mockAspect; }
  const ox = (W - mw) / 2;
  const oy = (H - mh) / 2;
  const mock = await load(mockupUrl);
  ctx.drawImage(mock, ox, oy, mw, mh);
  for (const it of items) {
    const art = await load(it.url);
    const bw = it.width * mw;
    const bh = it.height * mh;
    const k = Math.min(bw / art.naturalWidth, bh / art.naturalHeight);
    const dw = art.naturalWidth * k;
    const dh = art.naturalHeight * k;
    ctx.drawImage(art, ox + it.x * mw + (bw - dw) / 2, oy + it.y * mh + (bh - dh) / 2, dw, dh);
  }
  return new Promise((resolve, reject) => c.toBlob((b) => (b ? resolve(b) : reject(new Error("encode"))), "image/jpeg", 0.9));
}
