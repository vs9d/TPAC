/**
 * Static building blocks of the print designer: vector shapes, text style presets and
 * one-tap layouts. Shared by the browser (to draw) and the server (to validate ids).
 * Shape paths live in a 100 × 100 box.
 */
import type { PrintLocation } from "./garments";

export interface ShapeDef { id: string; ar: string; en: string; group: "basic" | "stars" | "symbols" | "lines"; path: string; evenodd?: boolean }

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

export const SHAPES: ShapeDef[] = [
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
];

/** Ready-made layouts: each entry is a text/shape dropped on a placement. */
export type TemplateItem =
  | { kind: "text"; location: PrintLocation; ar: string; en: string; preset: string; size: number; dy: number; fill?: string }
  | { kind: "shape"; location: PrintLocation; shape: string; size: number; dy: number; fill?: string };
export interface DesignTemplate { id: string; ar: string; en: string; hint_ar: string; hint_en: string; items: TemplateItem[] }
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
];

export const FILTER_KEYS = ["grayscale", "invert"] as const;
