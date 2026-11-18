"use client";
import { useRef } from "react";
import { useI18n } from "@/components/i18n-provider";
import { adminT } from "@/lib/admin-i18n";
import { AdminForm, Submit } from "./form";
import { saveStockGrid } from "@/lib/actions/admin/products";
import type { Color, Size, Variant } from "@/lib/types";

/** Colours × sizes matrix: edit all quantities in one place and save once. */
export function StockGrid({ variants, colors, sizes }: { variants: Variant[]; colors: Color[]; sizes: Size[] }) {
  const { locale } = useI18n();
  const t = adminT(locale);
  const fill = useRef<HTMLInputElement>(null);
  const usedColors = colors.filter((c) => variants.some((v) => v.color_id === c.id));
  const usedSizes = sizes.filter((s) => variants.some((v) => v.size_code === s.code));
  const at = (colorId: string, size: string) => variants.find((v) => v.color_id === colorId && v.size_code === size);
  const total = variants.reduce((n, v) => n + (v.inventory?.quantity ?? 0), 0);

  if (!variants.length) return <p className="text-sm text-mute">{t("لا توجد مقاسات بعد: أنشئها من القسم التالي أدناه.", "No sizes yet: create them in the next section below.")}</p>;

  const setAll = (value: string | null, colorId?: string) => {
    const form = document.getElementById("stock-grid");
    form?.querySelectorAll<HTMLInputElement>(colorId ? `input[data-color="${colorId}"]` : "input[name^=qty_]").forEach((el) => {
      el.value = value ?? el.defaultValue;
      el.dispatchEvent(new Event("input", { bubbles: true }));
    });
  };

  return (
    <AdminForm id="stock-grid" action={saveStockGrid} successMessage={t("تم تحديث المخزون", "Stock updated")} className="space-y-4">
      <div className="flex flex-wrap items-center gap-2 rounded-2xl bg-bone p-3 text-sm">
        <span className="font-semibold">{t("تعبئة سريعة:", "Quick fill:")}</span>
        <input ref={fill} type="number" min={0} inputMode="numeric" placeholder="10" className="field h-9 w-24 rounded-full px-3 text-center text-sm" aria-label={t("الكمية", "Quantity")} />
        <button type="button" className="chip h-9 text-xs" onClick={() => fill.current?.value !== "" && setAll(fill.current!.value)}>{t("كل الخلايا", "All cells")}</button>
        <button type="button" className="chip h-9 text-xs" onClick={() => setAll(null)}>{t("تراجع", "Reset")}</button>
        <span className="ms-auto text-xs text-mute">{t("المجموع الحالي", "Total now")}: <b className="tabular-nums text-ink">{total}</b></span>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-xs text-mute">
              <th className="p-2 text-start font-semibold">{t("اللون", "Colour")}</th>
              {usedSizes.map((s) => <th key={s.code} className="p-2 text-center font-semibold">{s.code}</th>)}
              <th className="p-2" />
            </tr>
          </thead>
          <tbody>
            {usedColors.map((c) => (
              <tr key={c.id} className="border-t border-line">
                <td className="p-2">
                  <span className="inline-flex items-center gap-2 whitespace-nowrap font-semibold"><span className="size-4 rounded-full border border-ink/25" style={{ background: c.hex }} />{locale === "ar" ? c.name_ar : c.name_en}</span>
                </td>
                {usedSizes.map((s) => {
                  const v = at(c.id, s.code);
                  const q = v?.inventory?.quantity ?? 0;
                  const low = v ? q <= (v.inventory?.low_stock_threshold ?? 5) : false;
                  return (
                    <td key={s.code} className="p-1.5 text-center">
                      {v ? (
                        <>
                          <input type="hidden" name={`orig_${v.id}`} value={q} />
                          <input key={`${v.id}-${q}`} name={`qty_${v.id}`} data-color={c.id} type="number" min={0} max={100000} inputMode="numeric" defaultValue={q} aria-label={`${locale === "ar" ? c.name_ar : c.name_en} ${s.code}`} className={`field h-10 w-16 rounded-xl px-1 text-center text-sm tabular-nums ${low ? "border-amber bg-amber/10" : ""} ${!v.is_active ? "opacity-50" : ""}`} />
                        </>
                      ) : <span className="text-mute">—</span>}
                    </td>
                  );
                })}
                <td className="p-2 text-end"><button type="button" onClick={() => setAll(fill.current?.value || "0", c.id)} className="text-xs font-semibold underline">{t("تعبئة الصف", "Fill row")}</button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <Submit variant="brand">{t("حفظ المخزون", "Save stock")}</Submit>
    </AdminForm>
  );
}
