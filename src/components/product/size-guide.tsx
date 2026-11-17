"use client";
import { useI18n } from "@/components/i18n-provider";

// Garment measurements in cm: [chest width (flat), body length, sleeve length]
const CHARTS: Record<string, Record<string, [number, number, number]>> = {
  tshirt: { S: [49, 69, 20], M: [52, 72, 21], L: [55, 74, 22], XL: [58, 76, 23], XXL: [61, 78, 24] },
  oversized: { S: [56, 70, 23], M: [59, 72, 24], L: [62, 74, 25], XL: [65, 76, 26], XXL: [68, 78, 27] },
  longsleeve: { S: [49, 69, 61], M: [52, 72, 62], L: [55, 74, 63], XL: [58, 76, 64], XXL: [61, 78, 65] },
  hoodie: { S: [54, 68, 62], M: [57, 70, 63], L: [60, 72, 64], XL: [63, 74, 65], XXL: [66, 76, 66] },
  sweatshirt: { S: [53, 66, 61], M: [56, 68, 62], L: [59, 70, 63], XL: [62, 72, 64], XXL: [65, 74, 65] },
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
