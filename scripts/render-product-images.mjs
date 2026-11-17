// Renders starter catalog imagery (public/products/*.webp) from the vector
// garment mockups + print artwork defined in catalog-data.mjs.
// Replace with real photography from the admin dashboard when available.
// Usage: node scripts/render-product-images.mjs [slug-filter]
import { createRequire } from "node:module";
const { chromium } = createRequire(import.meta.url)("playwright");
import sharp from "sharp";
import { mkdirSync } from "node:fs";
import { products, colors } from "./catalog-data.mjs";
import { garmentSvg, GARMENTS, luminance } from "../src/lib/garments.ts";

const OUT = new URL("../public/products/", import.meta.url).pathname;
mkdirSync(OUT, { recursive: true });
const filter = process.argv[2];
const W = 1200, H = 1500, SCALE = 1.7; // garment artboard 600x700 -> 1020x1190

function artHtml(spec, area, ink, accent) {
  if (!spec) return "";
  const x = area.x * SCALE, y = area.y * SCALE, w = area.width * SCALE, h = area.height * SCALE;
  if (spec.chest) {
    return `<div style="position:absolute;left:${(area.x + area.width * 0.72) * SCALE}px;top:${(area.y + 6) * SCALE}px;font:700 ${spec.size}px Alexandria;color:${ink};letter-spacing:.08em">${spec.text}</div>`;
  }
  const lines = spec.text.split("\n").map((l) => `<div>${l}</div>`).join("");
  const extra = spec.ziggurat
    ? `<svg viewBox="0 0 200 120" width="${w * 0.8}" style="margin:0 auto 8px;display:block"><g fill="none" stroke="${ink}" stroke-width="3"><path d="M10 115 H190 M30 115 V90 H170 V115 M50 90 V65 H150 V90 M70 65 V42 H130 V65 M88 42 V24 H112 V42 M100 24 V4"/><path d="M92 115 L100 60 L108 115" /></g></svg>`
    : spec.palm
    ? `<svg viewBox="0 0 120 140" width="${w * 0.45}" style="margin:0 auto 4px;display:block"><g fill="none" stroke="${ink}" stroke-width="3" stroke-linecap="round"><path d="M60 138 C62 100 58 70 60 40"/><path d="M60 40 C40 25 20 30 6 46 M60 40 C80 25 100 30 114 46 M60 40 C45 15 30 8 18 10 M60 40 C75 15 90 8 102 10 M60 40 C58 20 60 8 62 2"/></g></svg>`
    : "";
  const border = spec.dashed ? `border:3px dashed ${ink};opacity:.85;` : "";
  return `<div style="position:absolute;left:${x}px;top:${y}px;width:${w}px;height:${h}px;display:flex;flex-direction:column;align-items:center;justify-content:flex-start;padding-top:${h*0.08}px;box-sizing:border-box;text-align:center;color:${ink};${border}">
    ${extra}
    <div style="font-family:'${spec.font}';font-weight:700;font-size:${spec.size * SCALE * 0.9}px;line-height:1.1;direction:${/[\u0600-\u06FF]/.test(spec.text) ? 'rtl' : 'ltr'}">${lines}</div>
    ${spec.sub ? `<div style="margin-top:14px;font:600 ${15 * SCALE}px Alexandria;letter-spacing:.32em;color:${accent}">${spec.sub}</div>` : ""}
  </div>`;
}

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: W, height: H }, deviceScaleFactor: 1 });
let count = 0;
for (const p of products) {
  if (filter && !p.slug.includes(filter)) continue;
  for (const code of p.colors) {
    const color = colors.find((c) => c.code === code);
    const dark = luminance(color.hex) < 0.45;
    const ink = dark ? "#F4F2EE" : "#111111";
    const accent = dark ? "#E3963C" : "#376352";
    for (const view of ["front", "back"]) {
      const g = GARMENTS[p.garment];
      const spec = p.art[view];
      const area = view === "front" ? (spec?.chest ? g.printAreas.front : g.printAreas.front) : g.printAreas.back;
      const svg = garmentSvg(p.garment, view, color.hex);
      const neckLabel = view === "back" && !spec
        ? `<div style="position:absolute;left:${282 * SCALE}px;top:${78 * SCALE}px;font:700 ${10 * SCALE}px Alexandria;color:${ink};opacity:.8;letter-spacing:.2em">TPAC</div>` : "";
      const html = `<!doctype html><html><head>
<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Alexandria:wght@600;700;800&family=Aref+Ruqaa:wght@700&family=Reem+Kufi:wght@700&display=block" rel="stylesheet">
<style>html,body{margin:0}body{width:${W}px;height:${H}px;background:radial-gradient(ellipse at 50% 40%, #F3F1EC 0%, #E7E3DB 70%, #DDD8CE 100%);position:relative;overflow:hidden}
.stage{position:absolute;left:${(W - 600 * SCALE) / 2}px;top:${(H - 700 * SCALE) / 2 + 20}px;width:${600 * SCALE}px;height:${700 * SCALE}px}
.stage svg{width:100%;height:100%}
.print{position:absolute;inset:0;mix-blend-mode:${dark ? "screen" : "multiply"};opacity:.94}
.floor{position:absolute;left:15%;right:15%;bottom:40px;height:40px;background:radial-gradient(ellipse, rgba(0,0,0,.18), transparent 70%)}</style></head>
<body><div class="floor"></div><div class="stage">${svg}<div class="print">${artHtml(spec, area, ink, accent)}${neckLabel}</div></div></body></html>`;
      await page.setContent(html, { waitUntil: "networkidle" });
      await page.evaluate(() => document.fonts.ready);
      const png = await page.screenshot({ type: "png" });
      await sharp(png).webp({ quality: 80 }).toFile(`${OUT}${p.slug}-${code}-${view}.webp`);
      count++;
    }
  }
}
await browser.close();
console.log(`rendered ${count} images`);
