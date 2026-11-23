"use client";
import { useI18n } from "@/components/i18n-provider";

import { SIZE_CHARTS, type SizeRow } from "@/lib/size-chart";

const rows = (list: SizeRow[]): Record<string, [number, number, number]> => Object.fromEntries(list.map((r) => [r.size, [r.width, r.length, r.sleeve]]));
// Garment measurements in cm: [chest width (flat), body length, sleeve length]
const CHARTS: Record<string, Record<string, [number, number, number]>> = {
  tshirt: rows(SIZE_CHARTS.tshirt),
  oversized: { S: [56, 70, 23], M: [59, 72, 24], L: [62, 74, 25], XL: [65, 76, 26], XXL: [68, 78, 27], "3XL": [71, 80, 28], "4XL": [74, 82, 29], "5XL": [77, 84, 30] },
  longsleeve: { S: [49, 69, 61], M: [52, 72, 62], L: [55, 74, 63], XL: [58, 76, 64], XXL: [61, 78, 65], "3XL": [64, 80, 66], "4XL": [67, 82, 67], "5XL": [70, 84, 68] },
  hoodie: rows(SIZE_CHARTS.hoodie),
  sweatshirt: rows(SIZE_CHARTS.sweatshirt),
};

export function SizeGuideTable({ garment }: { garment: string }) {
  const { dict } = useI18n();
  const chart = CHARTS[garment] ?? CHARTS.tshirt!;
  return (
    <div>
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-ink">
            {dict.product.sizeGuideCols.map((c) => <th key={c} className="py-2 text-start font-semibold">{c}</th>)}
          </tr>
        </thead>
        <tbody>
          {Object.entries(chart).map(([s, [w, l, sl]]) => (
            <tr key={s} className="border-b border-line">
              <td className="py-2.5 font-semibold">{s}</td>
              <td className="tabular-nums">{w}</td>
              <td className="tabular-nums">{l}</td>
              <td className="tabular-nums">{sl}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="mt-4 text-xs text-mute">{dict.product.sizeGuideNote}</p>
    </div>
  );
}
