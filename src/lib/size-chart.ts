/**
 * TPAC size charts (garment measurements in cm, measured flat) and the size finder.
 * Hoodie & sweatshirt and the kids chart are TPAC's own table; adult sizes run S → 5XL.
 */
export interface SizeRow { size: string; width: number; length: number; sleeve: number; sleeveLong?: number }
export type FinderProduct = "hoodie" | "sweatshirt" | "tshirt" | "kids";
export type Fit = "slim" | "regular" | "wide";

const HOODIE: SizeRow[] = [
  { size: "S", length: 73, width: 49, sleeve: 63 },
  { size: "M", length: 74, width: 52, sleeve: 64 },
  { size: "L", length: 75, width: 55, sleeve: 65 },
  { size: "XL", length: 76, width: 58, sleeve: 66 },
  { size: "XXL", length: 77, width: 61, sleeve: 67 },
  { size: "3XL", length: 78, width: 64, sleeve: 68 },
  { size: "4XL", length: 79, width: 67, sleeve: 69 },
  { size: "5XL", length: 80, width: 70, sleeve: 70 },
];
const TSHIRT: SizeRow[] = [
  { size: "S", length: 69, width: 49, sleeve: 20 },
  { size: "M", length: 72, width: 52, sleeve: 21 },
  { size: "L", length: 74, width: 55, sleeve: 22 },
  { size: "XL", length: 76, width: 58, sleeve: 23 },
  { size: "XXL", length: 78, width: 61, sleeve: 24 },
  { size: "3XL", length: 80, width: 64, sleeve: 25 },
  { size: "4XL", length: 82, width: 67, sleeve: 26 },
  { size: "5XL", length: 84, width: 70, sleeve: 27 },
];
/** kids t-shirt / hoodie by age; sleeve = short (t-shirt) and long (hoodie) */
const KIDS: (SizeRow & { age: number; height: number; weight: number })[] = [
  { size: "2", age: 2, height: 92, weight: 13, length: 39, width: 30, sleeve: 9.5, sleeveLong: 28 },
  { size: "4", age: 4, height: 104, weight: 17, length: 44, width: 33, sleeve: 11, sleeveLong: 35 },
  { size: "6", age: 6, height: 116, weight: 21, length: 48, width: 35, sleeve: 12.5, sleeveLong: 42 },
  { size: "8", age: 8, height: 128, weight: 26, length: 54, width: 38, sleeve: 14, sleeveLong: 47 },
  { size: "10", age: 10, height: 140, weight: 32, length: 58, width: 40.5, sleeve: 15, sleeveLong: 49.5 },
  { size: "12", age: 12, height: 152, weight: 40, length: 61, width: 43, sleeve: 17, sleeveLong: 54 },
  { size: "14", age: 14, height: 164, weight: 50, length: 66, width: 46, sleeve: 18, sleeveLong: 56 },
];

export const SIZE_CHARTS: Record<FinderProduct, SizeRow[]> = { hoodie: HOODIE, sweatshirt: HOODIE, tshirt: TSHIRT, kids: KIDS };

/** body chest circumference (cm) estimated from height and weight (adults) */
export const estimateChest = (heightCm: number, weightKg: number) => 43 + 0.5 * weightKg + 0.1 * heightCm;
/** extra room (cm, on the flat half width) for each fit */
const EASE: Record<Fit, number> = { slim: 1, regular: 3, wide: 5.5 };

export const LIMITS = { adult: { h: [140, 215], w: [35, 220] }, kids: { h: [80, 180], w: [9, 90] } } as const;

export interface SizeAdvice {
  size: string;
  row: SizeRow;
  /** a size up / down for a looser / snugger look (null at the ends of the chart) */
  bigger: string | null;
  smaller: string | null;
  /** the body is bigger than the largest size */
  tooBig: boolean;
  /** tall for the chosen size: picked one size up for the length */
  forLength: boolean;
}

export function findSize(product: FinderProduct, heightCm: number, weightKg: number, fit: Fit): SizeAdvice | null {
  if (!Number.isFinite(heightCm) || !Number.isFinite(weightKg)) return null;
  const chart = SIZE_CHARTS[product];
  const lim = product === "kids" ? LIMITS.kids : LIMITS.adult;
  if (heightCm < lim.h[0] || heightCm > lim.h[1] || weightKg < lim.w[0] || weightKg > lim.w[1]) return null;
  let i: number;
  let tooBig = false;
  let forLength = false;
  if (product === "kids") {
    // by height, then a size up for a heavier build or a looser fit
    i = KIDS.findIndex((k) => heightCm <= k.height + 3);
    if (i < 0) { i = KIDS.length - 1; tooBig = heightCm > KIDS[i]!.height + 8; }
    if (weightKg > KIDS[i]!.weight * 1.25) i++;
    if (fit === "wide") i++;
    if (i >= KIDS.length) { tooBig = tooBig || i > KIDS.length; i = KIDS.length - 1; }
  } else {
    const need = estimateChest(heightCm, weightKg) / 2 + EASE[fit];
    i = chart.findIndex((r) => r.width >= need);
    if (i < 0) { i = chart.length - 1; tooBig = true; }
    // a tall body needs the length: one size up when the garment would be short
    const idealLength = 0.42 * heightCm;
    if (!tooBig && chart[i]!.length < idealLength - 3 && i < chart.length - 1) { i++; forLength = true; }
  }
  return {
    size: chart[i]!.size,
    row: chart[i]!,
    bigger: chart[i + 1]?.size ?? null,
    smaller: chart[i - 1]?.size ?? null,
    tooBig,
    forLength,
  };
}
