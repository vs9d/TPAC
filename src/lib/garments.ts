/**
 * Vector garment mockups shared by the custom designer and the catalog
 * image renderer. All coordinates live in a 600 × 700 artboard.
 */

export type GarmentType = "tshirt" | "oversized" | "hoodie" | "sweatshirt" | "longsleeve";
export type GarmentView = "front" | "back";
/** "sleeve" = wearer's right sleeve (viewer's left on the front view); "sleeve_left" = wearer's left sleeve. */
export type PrintLocation = "front" | "back" | "left_chest" | "sleeve" | "sleeve_left";

export const ARTBOARD = { width: 600, height: 700 } as const;

export interface PrintArea {
  x: number;
  y: number;
  width: number;
  height: number;
  /** physical print size in centimetres, for production sheets */
  cm: { width: number; height: number };
}

interface GarmentShape {
  body: Record<GarmentView, string>;
  /** shapes drawn behind the body (e.g. the hood on the front view) */
  behind?: Partial<Record<GarmentView, string>>;
  /** darkness of the neck/hood overlay (0–1) */
  neckShade?: Partial<Record<GarmentView, number>>;
  /** extra details (pockets, cuffs, ribbing) drawn as strokes */
  details: Record<GarmentView, string>;
  neck: Record<GarmentView, string>;
  printAreas: Record<PrintLocation, PrintArea>;
}

const tshirtBody = (neckDepth: number) =>
  `M210 60 C 240 ${60 + neckDepth}, 360 ${60 + neckDepth}, 390 60 L470 88 L572 192 L506 254 L470 220 L470 652 Q300 668 130 652 L130 220 L94 254 L28 192 L130 88 Z`;

const oversizedBody = (neckDepth: number) =>
  `M212 58 C 242 ${58 + neckDepth}, 358 ${58 + neckDepth}, 388 58 L492 92 L588 300 L512 330 L482 272 L486 666 Q300 680 114 666 L118 272 L88 330 L12 300 L108 92 Z`;

const longsleeveBody = (neckDepth: number) =>
  `M210 60 C 240 ${60 + neckDepth}, 360 ${60 + neckDepth}, 390 60 L470 88 L540 300 L566 540 L516 552 L478 330 L470 300 L470 652 Q300 668 130 652 L130 300 L122 330 L84 552 L34 540 L60 300 L130 88 Z`;

const sweatBody = (neckDepth: number) =>
  `M208 64 C 238 ${64 + neckDepth}, 362 ${64 + neckDepth}, 392 64 L478 94 L548 310 L572 548 L520 562 L484 336 L478 306 L480 640 L476 668 Q300 680 124 668 L120 640 L122 306 L116 336 L80 562 L28 548 L52 310 L122 94 Z`;

const hoodieBody = `M210 96 Q300 118 390 96 L478 112 L548 312 L572 548 L520 562 L484 338 L478 308 L480 640 L476 668 Q300 680 124 668 L120 640 L122 308 L116 338 L80 562 L28 548 L52 312 L122 112 Z`;

const mirror = (a: PrintArea): PrintArea => ({ ...a, x: 600 - a.x - a.width });
const withLeftSleeve = (areas: Omit<Record<PrintLocation, PrintArea>, "sleeve_left">): Record<PrintLocation, PrintArea> => ({ ...areas, sleeve_left: mirror(areas.sleeve) });

const standardAreas: Omit<Record<PrintLocation, PrintArea>, "sleeve_left"> = {
  front: { x: 198, y: 150, width: 204, height: 280, cm: { width: 30, height: 40 } },
  back: { x: 192, y: 130, width: 216, height: 320, cm: { width: 32, height: 45 } },
  left_chest: { x: 352, y: 140, width: 70, height: 70, cm: { width: 10, height: 10 } },
  sleeve: { x: 62, y: 150, width: 52, height: 52, cm: { width: 8, height: 8 } },
};

export const GARMENTS: Record<GarmentType, GarmentShape> = {
  tshirt: {
    body: { front: tshirtBody(42), back: tshirtBody(12) },
    neck: {
      front: "M210 60 C 240 102, 360 102, 390 60 C 360 88, 240 88, 210 60 Z",
      back: "M210 60 C 240 72, 360 72, 390 60 C 360 66, 240 66, 210 60 Z",
    },
    details: {
      front: "M130 220 L130 232 M470 220 L470 232 M134 640 Q300 655 466 640 M94 254 L130 220 M506 254 L470 220",
      back: "M134 640 Q300 655 466 640 M94 254 L130 220 M506 254 L470 220",
    },
    printAreas: withLeftSleeve(standardAreas),
  },
  oversized: {
    body: { front: oversizedBody(44), back: oversizedBody(12) },
    neck: {
      front: "M212 58 C 242 102, 358 102, 388 58 C 358 88, 242 88, 212 58 Z",
      back: "M212 58 C 242 70, 358 70, 388 58 C 358 64, 242 64, 212 58 Z",
    },
    details: {
      front: "M118 272 Q160 200 108 92 M482 272 Q440 200 492 92 M118 652 Q300 668 482 652",
      back: "M118 272 Q160 200 108 92 M482 272 Q440 200 492 92 M118 652 Q300 668 482 652",
    },
    printAreas: withLeftSleeve({
      ...standardAreas,
      front: { x: 192, y: 150, width: 216, height: 300, cm: { width: 32, height: 42 } },
      back: { x: 184, y: 128, width: 232, height: 340, cm: { width: 34, height: 48 } },
      left_chest: { x: 352, y: 140, width: 72, height: 72, cm: { width: 10, height: 10 } },
      sleeve: { x: 40, y: 200, width: 56, height: 56, cm: { width: 8, height: 8 } },
    }),
  },
  longsleeve: {
    body: { front: longsleeveBody(42), back: longsleeveBody(12) },
    neck: {
      front: "M210 60 C 240 102, 360 102, 390 60 C 360 88, 240 88, 210 60 Z",
      back: "M210 60 C 240 72, 360 72, 390 60 C 360 66, 240 66, 210 60 Z",
    },
    details: {
      front: "M38 522 L86 534 M562 522 L514 534 M134 640 Q300 655 466 640",
      back: "M38 522 L86 534 M562 522 L514 534 M134 640 Q300 655 466 640",
    },
    printAreas: withLeftSleeve({ ...standardAreas, sleeve: { x: 76, y: 170, width: 46, height: 46, cm: { width: 8, height: 8 } } }),
  },
  sweatshirt: {
    body: { front: sweatBody(44), back: sweatBody(14) },
    neck: {
      front: "M208 64 C 238 108, 362 108, 392 64 C 362 92, 238 92, 208 64 Z",
      back: "M208 64 C 238 78, 362 78, 392 64 C 362 70, 238 70, 208 64 Z",
    },
    details: {
      front: "M120 640 Q300 652 480 640 M32 528 L82 540 M568 528 L518 540",
      back: "M120 640 Q300 652 480 640 M32 528 L82 540 M568 528 L518 540",
    },
    printAreas: withLeftSleeve({ ...standardAreas, sleeve: { x: 76, y: 176, width: 46, height: 46, cm: { width: 8, height: 8 } } }),
  },
  hoodie: {
    body: { front: hoodieBody, back: hoodieBody },
    behind: { front: "M204 108 C 186 6, 414 6, 396 108 Z" },
    neck: {
      // inside of the hood opening (front) / hood lying flat on the back
      front: "M234 100 C 238 34, 362 34, 366 100 C 350 156, 250 156, 234 100 Z",
      back: "M200 100 C 188 14, 412 14, 400 100 C 396 176, 340 206, 300 210 C 260 206, 204 176, 200 100 Z",
    },
    neckShade: { front: 0.3, back: 0.08 },
    details: {
      front: "M196 440 L404 440 L432 566 L168 566 Z M266 146 L262 250 M334 146 L338 250 M120 640 Q300 652 480 640 M32 528 L82 540 M568 528 L518 540",
      back: "M300 22 L300 208 M120 640 Q300 652 480 640 M32 528 L82 540 M568 528 L518 540",
    },
    printAreas: withLeftSleeve({
      ...standardAreas,
      front: { x: 204, y: 190, width: 192, height: 220, cm: { width: 28, height: 30 } },
      back: { x: 190, y: 236, width: 220, height: 290, cm: { width: 32, height: 40 } },
      left_chest: { x: 350, y: 176, width: 64, height: 64, cm: { width: 10, height: 10 } },
      sleeve: { x: 80, y: 190, width: 46, height: 46, cm: { width: 8, height: 8 } },
    }),
  },
};

export const LOCATION_VIEW: Record<PrintLocation, GarmentView> = {
  front: "front",
  left_chest: "front",
  sleeve: "front",
  sleeve_left: "front",
  back: "back",
};

/** Perceived luminance (0–1) of a #RRGGBB colour. */
export function luminance(hex: string): number {
  const v = hex.replace("#", "");
  const r = parseInt(v.slice(0, 2), 16) / 255;
  const g = parseInt(v.slice(2, 4), 16) / 255;
  const b = parseInt(v.slice(4, 6), 16) / 255;
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/**
 * Builds a self-contained SVG for a garment in a colour. Shading is done
 * with gradients + fold lines so dark and light fabrics both read well.
 */
export function garmentSvg(
  type: GarmentType,
  view: GarmentView,
  colorHex: string,
  opts: { background?: string | null; showPrintAreas?: PrintLocation[]; artwork?: string } = {},
): string {
  const g = GARMENTS[type];
  const dark = luminance(colorHex) < 0.35;
  const stroke = dark ? "rgba(255,255,255,0.10)" : "rgba(0,0,0,0.14)";
  const fold = dark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.07)";
  const id = `${type}-${view}`;
  const areas = (opts.showPrintAreas ?? [])
    .filter((loc) => LOCATION_VIEW[loc] === view)
    .map((loc) => {
      const a = g.printAreas[loc];
      return `<rect x="${a.x}" y="${a.y}" width="${a.width}" height="${a.height}" fill="none" stroke="${dark ? "#ffffff" : "#000000"}" stroke-opacity="0.35" stroke-dasharray="6 6" stroke-width="1.5"/>`;
    })
    .join("");
  const bg = opts.background ? `<rect width="600" height="700" fill="${opts.background}"/>` : "";
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 600 700" width="600" height="700">
<defs>
  <linearGradient id="shade-${id}" x1="0" x2="1" y1="0" y2="0">
    <stop offset="0" stop-color="#000" stop-opacity="0.18"/>
    <stop offset="0.18" stop-color="#000" stop-opacity="0.02"/>
    <stop offset="0.5" stop-color="#fff" stop-opacity="0.06"/>
    <stop offset="0.82" stop-color="#000" stop-opacity="0.02"/>
    <stop offset="1" stop-color="#000" stop-opacity="0.2"/>
  </linearGradient>
  <linearGradient id="vshade-${id}" x1="0" x2="0" y1="0" y2="1">
    <stop offset="0" stop-color="#fff" stop-opacity="0.05"/>
    <stop offset="1" stop-color="#000" stop-opacity="0.12"/>
  </linearGradient>
  <filter id="soft-${id}" x="-20%" y="-20%" width="140%" height="140%"><feGaussianBlur stdDeviation="9"/></filter>
  <clipPath id="clip-${id}"><path d="${g.body[view]}"/></clipPath>
  <filter id="drop-${id}" x="-10%" y="-10%" width="120%" height="125%">
    <feDropShadow dx="0" dy="14" stdDeviation="14" flood-color="#000" flood-opacity="0.18"/>
  </filter>
</defs>
${bg}
<g filter="url(#drop-${id})">
  ${g.behind?.[view] ? `<path d="${g.behind[view]}" fill="${colorHex}"/>` : ""}
  <path d="${g.body[view]}" fill="${colorHex}"/>
</g>
${g.behind?.[view] ? `<path d="${g.behind[view]}" fill="url(#shade-${id})"/><path d="${g.behind[view]}" fill="none" stroke="${stroke}" stroke-width="2"/>` : ""}
<path d="${g.body[view]}" fill="url(#shade-${id})"/>
<path d="${g.body[view]}" fill="url(#vshade-${id})"/>
<path d="${g.neck[view]}" fill="${colorHex}"/>
<path d="${g.neck[view]}" fill="#000" fill-opacity="${g.neckShade?.[view] ?? (dark ? 0.35 : 0.12)}"/>
<path d="${g.neck[view]}" fill="none" stroke="${stroke}" stroke-width="2"/>
<g clip-path="url(#clip-${id})"><path d="M230 300 Q250 420 236 560 M372 320 Q356 450 370 590 M150 240 Q200 250 240 300" fill="none" stroke="${fold}" stroke-width="16" stroke-linecap="round" filter="url(#soft-${id})"/></g>
<path d="${g.details[view]}" fill="none" stroke="${stroke}" stroke-width="2" stroke-linejoin="round"/>
<path d="${g.body[view]}" fill="none" stroke="${stroke}" stroke-width="2" stroke-linejoin="round"/>
${opts.artwork ?? ""}
${areas}
</svg>`;
}

export function garmentDataUrl(...args: Parameters<typeof garmentSvg>): string {
  const svg = garmentSvg(...args);
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}
