/**
 * Static building blocks of the print designer: vector shapes, text style presets and
 * one-tap layouts. Shared by the browser (to draw) and the server (to validate ids).
 * Shape paths live in a 100 × 100 box.
 */
import type { PrintLocation } from "./garments";

export interface ShapeDef { id: string; ar: string; en: string; group: "love" | "cute" | "basic" | "stars" | "symbols" | "lines"; path: string; evenodd?: boolean }

/** Regular star / burst: `points` tips, `ratio` = inner radius / outer radius. */
function star(points: number, ratio: number, rotate = -Math.PI / 2): string {
  const pts: string[] = [];
  for (let i = 0; i < points * 2; i++) {
    const r = (i % 2 === 0 ? 1 : ratio) * 46;
    const a = rotate + (i * Math.PI) / points;
    pts.push(`${(50 + r * Math.cos(a)).toFixed(1)} ${(50 + r * Math.sin(a)).toFixed(1)}`);
  }
  return `M${pts.join("L")}Z`;
}


const f1 = (n: number) => n.toFixed(1);
const poly = (pts: [number, number][]) => `M${pts.map(([x, y]) => `${f1(x)} ${f1(y)}`).join("L")}Z`;

/** Classic heart curve centred on (cx, cy), `s` ≈ half its width. */
function heartPts(cx: number, cy: number, s: number, n = 72): [number, number][] {
  const pts: [number, number][] = [];
  for (let i = 0; i < n; i++) {
    const t = (i / n) * Math.PI * 2;
    const x = 16 * Math.sin(t) ** 3;
    const y = 13 * Math.cos(t) - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t);
    pts.push([cx + (x / 16) * s, cy - (y / 16) * s]);
  }
  return pts;
}
const heart = (cx: number, cy: number, s: number) => poly(heartPts(cx, cy, s));
/** Outline: the outer heart and a smaller one cut out (even-odd). */
const heartOutline = (cx: number, cy: number, s: number, w: number) => `${heart(cx, cy, s)}${poly(heartPts(cx, cy + w * 0.25, s - w).reverse())}`;
const circle = (cx: number, cy: number, r: number, cw = true) => `M${f1(cx - r)} ${f1(cy)}a${r} ${r} 0 1 ${cw ? 1 : 0} ${f1(2 * r)} 0a${r} ${r} 0 1 ${cw ? 1 : 0} ${f1(-2 * r)} 0Z`;
const ellipse = (cx: number, cy: number, rx: number, ry: number, rot = 0, n = 40) => {
  const pts: [number, number][] = [];
  for (let i = 0; i < n; i++) {
    const t = (i / n) * Math.PI * 2;
    const x = rx * Math.cos(t), y = ry * Math.sin(t);
    pts.push([cx + x * Math.cos(rot) - y * Math.sin(rot), cy + x * Math.sin(rot) + y * Math.cos(rot)]);
  }
  return poly(pts);
};
/** Thick infinity sign: the lemniscate's band (filled non-zero, so the crossing stays solid). */
function infinity(w = 6): string {
  const n = 120;
  const c: [number, number][] = [];
  for (let i = 0; i < n; i++) {
    const t = (i / n) * Math.PI * 2;
    const d = 1 + Math.sin(t) ** 2;
    c.push([50 + (44 * Math.cos(t)) / d, 50 + (44 * Math.sin(t) * Math.cos(t)) / d]);
  }
  const off = (k: number): [number, number][] => c.map((p, i) => {
    const a = c[(i + n - 1) % n]!, b = c[(i + 1) % n]!;
    const dx = b[0] - a[0], dy = b[1] - a[1], l = Math.hypot(dx, dy) || 1;
    return [p[0] - (dy / l) * k, p[1] + (dx / l) * k];
  });
  return `${poly(off(w))}${poly(off(-w).reverse())}`;
}

export const SHAPES: ShapeDef[] = [
  { id: "heart_outline", ar: "قلب مفرّغ", en: "Heart outline", group: "love", path: heartOutline(50, 50, 46, 7), evenodd: true },
  { id: "heart_thin", ar: "قلب خط رفيع", en: "Thin heart", group: "love", path: heartOutline(50, 50, 46, 3.5), evenodd: true },
  { id: "two_hearts", ar: "قلبين", en: "Two hearts", group: "love", path: `${heart(36, 46, 30)}${heart(68, 58, 26)}` },
  { id: "hearts_row", ar: "ثلاث قلوب", en: "Three hearts", group: "love", path: `${heart(18, 52, 15)}${heart(50, 48, 19)}${heart(82, 52, 15)}` },
  { id: "infinity", ar: "إنفنتي ∞", en: "Infinity", group: "love", path: infinity(6) },
  { id: "rings", ar: "خاتمين", en: "Two rings", group: "love", path: `${circle(36, 56, 26)}${circle(36, 56, 19, false)}${circle(64, 44, 26)}${circle(64, 44, 19, false)}` },
  { id: "puzzle", ar: "قطعة بزل", en: "Puzzle piece", group: "love", path: "M16 30H38A12 12 0 1 1 62 30H84V52A12 12 0 1 1 84 76V94H16V76A12 12 0 1 0 16 52Z" },
  { id: "lock", ar: "قفل", en: "Padlock", group: "love", path: "M28 46V34A22 22 0 0 1 72 34V46H62V34A12 12 0 0 0 38 34V46ZM20 46H80V94H20Z" },
  { id: "key", ar: "مفتاح", en: "Key", group: "love", path: `${circle(28, 50, 22)}${circle(28, 50, 11, false)}M48 45H96V55H90V66H80V55H72V62H62V55H48Z` },
  { id: "cupid", ar: "قلب وسهم", en: "Heart & arrow", group: "love", path: `${heart(52, 52, 34)}M8 88L86 14L90 18L12 92ZM80 10H96V26Z` },
  { id: "envelope", ar: "ظرف رسالة", en: "Love letter", group: "love", path: `M6 22H94V82H6ZM12 28V76H88V28L50 56Z${heart(50, 47, 8)}`, evenodd: true },
  { id: "smile", ar: "وجه مبتسم", en: "Smiley", group: "cute", path: `${circle(50, 50, 46)}${circle(35, 40, 6)}${circle(65, 40, 6)}M28 58Q50 82 72 58L66 56Q50 72 34 56Z`, evenodd: true },
  { id: "paw", ar: "خف قطة", en: "Paw", group: "cute", path: `${ellipse(50, 66, 22, 18)}${ellipse(22, 42, 9, 12, -0.4)}${ellipse(40, 24, 9, 12, -0.15)}${ellipse(60, 24, 9, 12, 0.15)}${ellipse(78, 42, 9, 12, 0.4)}` },
  { id: "flower", ar: "وردة", en: "Flower", group: "cute", path: `${[0, 1, 2, 3, 4].map((i) => ellipse(50 + 24 * Math.cos(-Math.PI / 2 + (i * 2 * Math.PI) / 5), 50 + 24 * Math.sin(-Math.PI / 2 + (i * 2 * Math.PI) / 5), 13, 19, -Math.PI / 2 + (i * 2 * Math.PI) / 5 + Math.PI / 2)).join("")}${circle(50, 50, 13)}` },
  { id: "butterfly", ar: "فراشة", en: "Butterfly", group: "cute", path: `${ellipse(30, 36, 20, 24, -0.5)}${ellipse(70, 36, 20, 24, 0.5)}${ellipse(34, 70, 14, 17, 0.4)}${ellipse(66, 70, 14, 17, -0.4)}M47 20H53V88H47Z` },
  { id: "cat", ar: "قطة", en: "Cat", group: "cute", path: `M14 30L22 4L42 22Q50 20 58 22L78 4L86 30Q96 46 92 62Q86 92 50 94Q14 92 8 62Q4 46 14 30Z${circle(36, 54, 6, false)}${circle(64, 54, 6, false)}` },
  { id: "note", ar: "نوتة موسيقية", en: "Music note", group: "cute", path: `M40 8H86V24H52V74A16 13 0 1 1 40 62Z${circle(28, 76, 1)}` },
  { id: "cup", ar: "كوب قهوة", en: "Coffee cup", group: "cute", path: `M14 30H72V64Q72 90 43 90Q14 90 14 64ZM72 38H80A14 14 0 0 1 80 66H72V58H80A6 6 0 0 0 80 46H72ZM8 92H78V98H8Z` },
  { id: "chick", ar: "كتكوت", en: "Chick", group: "cute", path: `${circle(52, 62, 30)}${circle(52, 28, 18)}M68 26L84 32L68 36Z${circle(58, 24, 3.5, false)}` },
  { id: "star_outline", ar: "نجمة مفرّغة", en: "Star outline", group: "stars", path: `${star(5, 0.42)}${star(5, 0.42).replace(/(\d+\.\d) (\d+\.\d)/g, (_m, x: string, y: string) => `${f1(50 + (Number(x) - 50) * 0.62)} ${f1(50 + (Number(y) - 50) * 0.62)}`)}`, evenodd: true },
  { id: "sparkles", ar: "لمعات", en: "Sparkles", group: "stars", path: "M38 10C41 32 52 43 74 46C52 49 41 60 38 82C35 60 24 49 2 46C24 43 35 32 38 10ZM78 4C79 13 84 18 93 19C84 20 79 25 78 34C77 25 72 20 63 19C72 18 77 13 78 4ZM80 62C81 71 86 76 95 77C86 78 81 83 80 92C79 83 74 78 65 77C74 76 79 71 80 62Z" },

  { id: "circle", ar: "دائرة", en: "Circle", group: "basic", path: "M5 50a45 45 0 1 0 90 0a45 45 0 1 0 -90 0Z" },
  { id: "square", ar: "مربع", en: "Square", group: "basic", path: "M8 8H92V92H8Z" },
  { id: "rounded", ar: "مربع مدوّر", en: "Rounded", group: "basic", path: "M24 8H76Q92 8 92 24V76Q92 92 76 92H24Q8 92 8 76V24Q8 8 24 8Z" },
  { id: "triangle", ar: "مثلث", en: "Triangle", group: "basic", path: "M50 8L94 90H6Z" },
  { id: "diamond", ar: "معين", en: "Diamond", group: "basic", path: "M50 4L96 50L50 96L4 50Z" },
  { id: "pentagon", ar: "خماسي", en: "Pentagon", group: "basic", path: "M50 5L96 38L78 92H22L4 38Z" },
  { id: "hexagon", ar: "سداسي", en: "Hexagon", group: "basic", path: "M27 8H73L96 50L73 92H27L4 50Z" },
  { id: "shield", ar: "درع", en: "Shield", group: "basic", path: "M50 4L90 18V50C90 74 70 90 50 96C30 90 10 74 10 50V18Z" },
  { id: "star5", ar: "نجمة", en: "Star", group: "stars", path: star(5, 0.42) },
  { id: "star4", ar: "نجمة رباعية", en: "4-point star", group: "stars", path: star(4, 0.3) },
  { id: "star8", ar: "نجمة ثمانية", en: "8-point star", group: "stars", path: star(8, 0.6, -Math.PI / 8) },
  { id: "burst", ar: "انفجار", en: "Burst", group: "stars", path: star(14, 0.78) },
  { id: "sparkle", ar: "لمعة", en: "Sparkle", group: "stars", path: "M50 4C54 32 68 46 96 50C68 54 54 68 50 96C46 68 32 54 4 50C32 46 46 32 50 4Z" },
  { id: "sun", ar: "شمس", en: "Sun", group: "stars", path: star(20, 0.72) },
  { id: "heart", ar: "قلب", en: "Heart", group: "symbols", path: "M50 90C20 66 6 48 6 30C6 16 17 8 29 8C39 8 46 13 50 21C54 13 61 8 71 8C83 8 94 16 94 30C94 48 80 66 50 90Z" },
  { id: "bolt", ar: "صاعقة", en: "Lightning", group: "symbols", path: "M58 4L16 56H44L36 96L84 40H56Z" },
  { id: "moon", ar: "هلال", en: "Crescent", group: "symbols", path: "M62 6A46 46 0 1 0 94 68A38 38 0 0 1 62 6Z" },
  { id: "flame", ar: "نار", en: "Flame", group: "symbols", path: "M50 4C58 24 82 34 82 62A32 32 0 0 1 18 62C18 48 26 40 32 34C32 46 38 50 42 50C38 34 42 16 50 4Z" },
  { id: "drop", ar: "قطرة", en: "Drop", group: "symbols", path: "M50 5C50 5 18 42 18 64A32 32 0 0 0 82 64C82 42 50 5 50 5Z" },
  { id: "crown", ar: "تاج", en: "Crown", group: "symbols", path: "M6 80L12 28L34 50L50 16L66 50L88 28L94 80Z" },
  { id: "cloud", ar: "سحابة", en: "Cloud", group: "symbols", path: "M26 80A20 20 0 0 1 22 40A28 28 0 0 1 76 36A22 22 0 0 1 76 80Z" },
  { id: "bubble", ar: "فقاعة كلام", en: "Speech bubble", group: "symbols", path: "M12 10H88Q96 10 96 18V62Q96 70 88 70H44L22 92V70H12Q4 70 4 62V18Q4 10 12 10Z" },
  { id: "pin", ar: "موقع", en: "Location pin", group: "symbols", path: "M50 4A30 30 0 0 0 20 34C20 58 50 96 50 96S80 58 80 34A30 30 0 0 0 50 4ZM50 22A12 12 0 1 1 49.9 22Z", evenodd: true },
  { id: "check", ar: "صح", en: "Check", group: "symbols", path: "M8 54L22 40L40 58L78 14L92 28L40 86Z" },
  { id: "arrow", ar: "سهم", en: "Arrow", group: "symbols", path: "M6 38H58V14L96 50L58 86V62H6Z" },
  { id: "plus", ar: "زائد", en: "Plus", group: "symbols", path: "M38 6H62V38H94V62H62V94H38V62H6V38H38Z" },
  { id: "ring", ar: "حلقة", en: "Ring", group: "lines", path: "M50 4A46 46 0 1 0 50.1 4ZM50 22A28 28 0 1 1 49.9 22Z", evenodd: true },
  { id: "frame", ar: "إطار", en: "Frame", group: "lines", path: "M4 4H96V96H4ZM14 14V86H86V14Z", evenodd: true },
  { id: "banner", ar: "شريط", en: "Banner", group: "lines", path: "M4 24H96L84 50L96 76H4L16 50Z" },
  { id: "bar", ar: "خط", en: "Line", group: "lines", path: "M2 44H98V56H2Z" },
  { id: "bars2", ar: "خطّان", en: "Double line", group: "lines", path: "M2 30H98V40H2ZM2 60H98V70H2Z" },
  { id: "bars3", ar: "ثلاثة خطوط", en: "Triple stripe", group: "lines", path: "M2 22H98V32H2ZM2 45H98V55H2ZM2 68H98V78H2Z" },
];

export const SHAPE_IDS = SHAPES.map((s) => s.id) as [string, ...string[]];
export const shapeById = (id: string) => SHAPES.find((s) => s.id === id);

/** Colours offered for text and shapes (garment-agnostic, print friendly). */
export const PRINT_COLORS = [
  "#111111", "#FFFFFF", "#E3963C", "#376352", "#C0392B", "#1C2541", "#E9E2D3", "#F2C94C",
  "#8E44AD", "#2980B9", "#16A085", "#E91E63", "#795548", "#7F8C8D", "#FF6B35", "#00BCD4",
];

export type FontGroup = "arabic" | "latin";
export interface DesignerFont { label: string; labelAr?: string; family: string; group: FontGroup; weights: 1 | 2 }

/** One-tap text looks. `fill: null` = outline only. */
export interface TextPreset { id: string; ar: string; en: string; font: string; weight: number; fill: "auto" | string | null; stroke?: string; strokeWidth?: number; charSpacing?: number; upper?: boolean; size: number }
export const TEXT_PRESETS_UI: TextPreset[] = [
  { id: "solid", ar: "سادة", en: "Solid", font: "Cairo", weight: 700, fill: "auto", size: 44 },
  { id: "impact", ar: "عريض", en: "Impact", font: "Anton", weight: 400, fill: "auto", size: 52, upper: true },
  { id: "outline", ar: "مفرّغ", en: "Outline", font: "Bebas Neue", weight: 400, fill: null, stroke: "auto", strokeWidth: 2, size: 56, upper: true },
  { id: "varsity", ar: "جامعي", en: "Varsity", font: "Staatliches", weight: 400, fill: "auto", stroke: "#E3963C", strokeWidth: 3, size: 52, upper: true },
  { id: "wide", ar: "متباعد", en: "Wide", font: "Montserrat", weight: 700, fill: "auto", charSpacing: 400, size: 26, upper: true },
  { id: "script", ar: "خط يد", en: "Script", font: "Pacifico", weight: 400, fill: "auto", size: 46 },
  { id: "street", ar: "ستريت", en: "Street", font: "Permanent Marker", weight: 400, fill: "auto", size: 46 },
  { id: "kufi", ar: "كوفي", en: "Kufi", font: "Reem Kufi", weight: 700, fill: "auto", size: 50 },
  { id: "ruqaa", ar: "رقعة", en: "Ruqaa", font: "Aref Ruqaa", weight: 700, fill: "auto", size: 52 },
  { id: "lalezar", ar: "عريض عربي", en: "Arabic bold", font: "Lalezar", weight: 400, fill: "auto", size: 54 },
  { id: "classic", ar: "كلاسيكي (تطريز)", en: "Classic (embroidery)", font: "Playfair Display", weight: 400, fill: "auto", size: 34 },
  { id: "naskh", ar: "نسخ ناعم", en: "Soft naskh", font: "Amiri", weight: 400, fill: "auto", size: 40 },
];

/** Ready-made layouts: each entry is a text/shape dropped on a placement. */
/** dx / dy: offset from the centre of the placement, as a fraction of its width / height */
export type TemplateItem =
  | { kind: "text"; location: PrintLocation; ar: string; en: string; preset: string; size: number; dy: number; dx?: number; fill?: string }
  | { kind: "shape"; location: PrintLocation; shape: string; size: number; dy: number; dx?: number; fill?: string };
/** `pair`: a design for two pieces at once (couples) — `items` go on piece 1, `pair` on piece 2. */
export interface DesignTemplate { id: string; ar: string; en: string; hint_ar: string; hint_en: string; items: TemplateItem[]; pair?: TemplateItem[]; group?: "couple" | "gift" }
export const TEMPLATES: DesignTemplate[] = [
  {
    id: "name-number", ar: "اسم + رقم", en: "Name & number", hint_ar: "على الظهر — فريق أو دفعة", hint_en: "On the back — team or class",
    items: [
      { kind: "text", location: "back", ar: "اسمك", en: "YOUR NAME", preset: "wide", size: 28, dy: -0.38 },
      { kind: "text", location: "back", ar: "٧", en: "07", preset: "impact", size: 150, dy: 0.1 },
    ],
  },
  {
    id: "chest-back", ar: "شعار الصدر + نص كبير بالظهر", en: "Chest logo + big back text", hint_ar: "تصميم ستريت كلاسيكي", hint_en: "Classic streetwear layout",
    items: [
      { kind: "text", location: "left_chest", ar: "TPAC", en: "TPAC", preset: "impact", size: 26, dy: 0 },
      { kind: "text", location: "back", ar: "بغداد", en: "BAGHDAD", preset: "impact", size: 84, dy: -0.18 },
      { kind: "text", location: "back", ar: "مدينة السلام", en: "CITY OF PEACE", preset: "wide", size: 18, dy: 0.04 },
    ],
  },
  {
    id: "statement", ar: "عبارة وسط الصدر", en: "Centre statement", hint_ar: "سطران بخط قوي", hint_en: "Two bold lines",
    items: [
      { kind: "text", location: "front", ar: "اصنع", en: "MAKE", preset: "impact", size: 70, dy: -0.18 },
      { kind: "text", location: "front", ar: "الفرق", en: "THE DIFFERENCE", preset: "varsity", size: 44, dy: 0.1 },
    ],
  },
  {
    id: "class", ar: "دفعة التخرج", en: "Graduation class", hint_ar: "أمام + خلف للجامعات", hint_en: "Front + back for universities",
    items: [
      { kind: "text", location: "front", ar: "دفعة", en: "CLASS OF", preset: "wide", size: 26, dy: -0.16 },
      { kind: "text", location: "front", ar: "٢٠٢٦", en: "2026", preset: "varsity", size: 100, dy: 0.0 },
      { kind: "shape", location: "front", shape: "star5", size: 34, dy: 0.28, fill: "#E3963C" },
      { kind: "text", location: "back", ar: "اسم الكلية", en: "FACULTY NAME", preset: "impact", size: 52, dy: -0.12 },
      { kind: "text", location: "back", ar: "جامعة بغداد", en: "UNIVERSITY OF BAGHDAD", preset: "wide", size: 16, dy: 0.08 },
    ],
  },
  {
    id: "badge", ar: "شارة مع نص", en: "Badge with text", hint_ar: "درع ونص بالمنتصف", hint_en: "Shield with a name inside",
    items: [
      { kind: "shape", location: "front", shape: "shield", size: 200, dy: -0.02 },
      { kind: "text", location: "front", ar: "فريقنا", en: "TEAM", preset: "impact", size: 52, dy: -0.04, fill: "#FFFFFF" },
    ],
  },
  {
    id: "sleeves", ar: "خطوط الأكمام", en: "Sleeve stripes", hint_ar: "خطوط رياضية على الكمين", hint_en: "Sporty stripes on both sleeves",
    items: [
      { kind: "shape", location: "sleeve", shape: "bars3", size: 44, dy: 0 },
      { kind: "shape", location: "sleeve_left", shape: "bars3", size: 44, dy: 0 },
    ],
  },
  // ---------------------------------------------------------------- gifts & personal
  {
    id: "date-sleeve", group: "gift", ar: "تاريخكم على الكم", en: "Your date on the sleeve", hint_ar: "قلب صغير وتاريخ — مثل التطريز", hint_en: "A small heart and a date — embroidery style",
    items: [
      { kind: "shape", location: "sleeve", shape: "heart_outline", size: 34, dy: -0.22 },
      { kind: "text", location: "sleeve", ar: "20.09.2020", en: "20.09.2020", preset: "classic", size: 16, dy: 0.12 },
    ],
  },
  {
    id: "you-are-mine", group: "gift", ar: "عبارة + تاريخ على الصدر", en: "Words + date on the chest", hint_ar: "you are mine · 21.06.23", hint_en: "you are mine · 21.06.23",
    items: [{ kind: "text", location: "left_chest", ar: "you are\nmine\n21.06.23", en: "you are\nmine\n21.06.23", preset: "classic", size: 14, dy: 0 }],
  },
  {
    id: "coordinates", group: "gift", ar: "إحداثيات مكانكم", en: "Your place's coordinates", hint_ar: "مكان أول لقاء — غيّر الأرقام", hint_en: "Where you first met — change the numbers",
    items: [{ kind: "text", location: "front", ar: "33°18'45\"N\n44°21'58\"E", en: "33°18'45\"N\n44°21'58\"E", preset: "classic", size: 22, dy: -0.25 }],
  },
  {
    id: "initials-sleeve", group: "gift", ar: "حروف الأسماء على الكم", en: "Initials on the sleeve", hint_ar: "M ♥ A", hint_en: "M ♥ A",
    items: [
      { kind: "text", location: "sleeve", ar: "M", en: "M", preset: "classic", size: 24, dy: 0, dx: -0.26 },
      { kind: "shape", location: "sleeve", shape: "heart", size: 14, dy: 0 },
      { kind: "text", location: "sleeve", ar: "A", en: "A", preset: "classic", size: 24, dy: 0, dx: 0.26 },
    ],
  },
  {
    id: "heart-line", group: "gift", ar: "قلب خط وعبارة", en: "Line heart + words", hint_ar: "دايماً بقلبي", hint_en: "Always in my heart",
    items: [
      { kind: "shape", location: "left_chest", shape: "heart_thin", size: 60, dy: -0.12 },
      { kind: "text", location: "left_chest", ar: "دايماً بقلبي", en: "always in my heart", preset: "classic", size: 11, dy: 0.38 },
    ],
  },
  {
    id: "tiny-icon", group: "gift", ar: "رسمة صغيرة على الصدر", en: "Tiny chest icon", hint_ar: "كتكوت، قلب، أو لمعة", hint_en: "A chick, heart or sparkle",
    items: [{ kind: "shape", location: "left_chest", shape: "chick", size: 40, dy: 0, fill: "#F2C94C" }],
  },
  {
    id: "hood-words", group: "gift", ar: "كلمة داخل القبعة", en: "Words inside the hood", hint_ar: "ليحتضنك دائماً بدلاً عني", hint_en: "A hidden message inside the hood",
    items: [{ kind: "text", location: "hood", ar: "ليحتضنك دائماً\nبدلاً عني", en: "to hold you\nwhen I can't", preset: "naskh", size: 26, dy: 0 }],
  },
  // ---------------------------------------------------------------- couples: two pieces at once
  {
    id: "c-fik-minni", group: "couple", ar: "فيك مني · فيني منك", en: "Part of me · part of you", hint_ar: "قطعتين — كل وحدة عبارتها", hint_en: "Two pieces — one line each",
    items: [{ kind: "text", location: "front", ar: "فيك مني ..", en: "part of me ..", preset: "naskh", size: 40, dy: -0.25 }],
    pair: [{ kind: "text", location: "front", ar: "فيني منك ..", en: "part of you ..", preset: "naskh", size: 40, dy: -0.25 }],
  },
  {
    id: "c-forever", group: "couple", ar: "Forever yours · you are mine", en: "Forever yours · you are mine", hint_ar: "تاريخكم على الكم والصدر", hint_en: "Your date on a sleeve and a chest",
    items: [{ kind: "text", location: "sleeve", ar: "Forever\nyours\n21.06.23", en: "Forever\nyours\n21.06.23", preset: "classic", size: 16, dy: 0 }],
    pair: [{ kind: "text", location: "left_chest", ar: "you are\nmine\n21.06.23", en: "you are\nmine\n21.06.23", preset: "classic", size: 14, dy: 0 }],
  },
  {
    id: "c-puzzle", group: "couple", ar: "قلب وقطعة البزل", en: "Heart & puzzle piece", hint_ar: "u complete me", hint_en: "u complete me",
    items: [
      { kind: "shape", location: "left_chest", shape: "heart_thin", size: 70, dy: 0 },
      { kind: "text", location: "sleeve", ar: "u complete\nme", en: "u complete\nme", preset: "classic", size: 14, dy: 0 },
    ],
    pair: [
      { kind: "shape", location: "left_chest", shape: "puzzle", size: 30, dy: 0 },
      { kind: "text", location: "sleeve", ar: "u complete\nme", en: "u complete\nme", preset: "classic", size: 14, dy: 0 },
    ],
  },
  {
    id: "c-initials", group: "couple", ar: "الحروف ∞ و ♥", en: "Initials with ∞ and ♥", hint_ar: "حرف على كل كم", hint_en: "One initial on each sleeve",
    items: [
      { kind: "text", location: "sleeve", ar: "D", en: "D", preset: "classic", size: 26, dy: 0, dx: -0.2 },
      { kind: "shape", location: "sleeve", shape: "infinity", size: 22, dy: 0, dx: 0.2 },
    ],
    pair: [
      { kind: "text", location: "sleeve", ar: "D", en: "D", preset: "classic", size: 26, dy: 0, dx: -0.2 },
      { kind: "shape", location: "sleeve", shape: "heart", size: 16, dy: 0, dx: 0.2 },
    ],
  },
  {
    id: "c-coords", group: "couple", ar: "نفس الإحداثيات للاثنين", en: "Same coordinates for both", hint_ar: "مكانكم + حرف على الكم", hint_en: "Your place + an initial on the sleeve",
    items: [
      { kind: "text", location: "front", ar: "33°18'45\"N\n44°21'58\"E", en: "33°18'45\"N\n44°21'58\"E", preset: "classic", size: 22, dy: -0.25 },
      { kind: "text", location: "sleeve", ar: "M", en: "M", preset: "classic", size: 24, dy: 0 },
    ],
    pair: [
      { kind: "text", location: "front", ar: "33°18'45\"N\n44°21'58\"E", en: "33°18'45\"N\n44°21'58\"E", preset: "classic", size: 22, dy: -0.25 },
      { kind: "text", location: "sleeve", ar: "A", en: "A", preset: "classic", size: 24, dy: 0 },
    ],
  },
  {
    id: "c-date", group: "couple", ar: "قلب وتاريخ على الكمين", en: "Heart + date on both", hint_ar: "التواريخ اللي بالأكمام 🥹", hint_en: "The dates on the sleeves",
    items: [
      { kind: "shape", location: "sleeve", shape: "heart_outline", size: 34, dy: -0.22 },
      { kind: "text", location: "sleeve", ar: "20.09.2020", en: "20.09.2020", preset: "classic", size: 16, dy: 0.12 },
    ],
    pair: [
      { kind: "shape", location: "sleeve_left", shape: "heart_outline", size: 34, dy: -0.22 },
      { kind: "text", location: "sleeve_left", ar: "20.09.2020", en: "20.09.2020", preset: "classic", size: 16, dy: 0.12 },
    ],
  },
  {
    id: "c-hearts", group: "couple", ar: "قلبين وعبارتين", en: "Two hearts, two lines", hint_ar: "I'm full of you · always in my heart", hint_en: "I'm full of you · always in my heart",
    items: [
      { kind: "shape", location: "front", shape: "heart_thin", size: 90, dy: -0.18 },
      { kind: "text", location: "front", ar: "I'm full of you", en: "I'm full of you", preset: "classic", size: 18, dy: 0.12 },
    ],
    pair: [
      { kind: "shape", location: "front", shape: "heart_thin", size: 90, dy: -0.18 },
      { kind: "text", location: "front", ar: "You are always in my heart", en: "You are always in my heart", preset: "classic", size: 18, dy: 0.12 },
    ],
  },
  {
    id: "c-chicks", group: "couple", ar: "كتكوتين صغار", en: "Two little chicks", hint_ar: "رسمة صغيرة على صدر كل وحدة", hint_en: "A tiny drawing on each chest",
    items: [{ kind: "shape", location: "left_chest", shape: "chick", size: 40, dy: 0, fill: "#F2C94C" }],
    pair: [{ kind: "shape", location: "left_chest", shape: "two_hearts", size: 40, dy: 0, fill: "#E91E63" }],
  },
];

export const FILTER_KEYS = ["grayscale", "invert"] as const;
