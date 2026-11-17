"use client";
import Link from "next/link";
import { useI18n } from "@/components/i18n-provider";
import { adminT } from "@/lib/admin-i18n";
import { AdminForm, Submit } from "./form";
import { saveVariant, deleteVariant, generateVariants } from "@/lib/actions/admin/products";
import type { Color, Size, Variant } from "@/lib/types";

export function VariantsTable({ productId, variants, colors, sizes, basePrice }: { productId: string; variants: Variant[]; colors: Color[]; sizes: Size[]; basePrice: number }) {
  const { locale } = useI18n();
  const t = adminT(locale);
  const colorName = (id: string) => { const c = colors.find((x) => x.id === id); return c ? (locale === "ar" ? c.name_ar : c.name_en) : "?"; };
  const sorted = [...variants].sort((a, b) => colorName(a.color_id).localeCompare(colorName(b.color_id)) || (sizes.findIndex((s) => s.code === a.size_code) - sizes.findIndex((s) => s.code === b.size_code)));
  return (
    <div className="space-y-6">
      <AdminForm action={generateVariants} className="space-y-3 bg-bone p-4">
        <input type="hidden" name="product_id" value={productId} />
        <p className="text-sm font-semibold">{t("توليد المقاسات والألوان", "Generate size × colour variants")}</p>
        <div className="flex flex-wrap gap-3">{sizes.map((s) => <label key={s.code} className="flex items-center gap-1.5 text-sm"><input type="checkbox" name="sizes" value={s.code} defaultChecked={["S", "M", "L", "XL", "XXL"].includes(s.code)} className="accent-ink" /> {s.code}</label>)}</div>
        <div className="flex flex-wrap gap-3">{colors.map((c) => <label key={c.id} className="flex items-center gap-1.5 text-sm"><input type="checkbox" name="color_ids" value={c.id} className="accent-ink" /><span className="size-3.5 rounded-full border" style={{ background: c.hex }} /> {locale === "ar" ? c.name_ar : c.name_en}</label>)}</div>
        <Submit variant="outline">{t("توليد الناقص", "Create missing")}</Submit>
      </AdminForm>
      <div className="overflow-x-auto">
        <table className="table-admin">
          <thead><tr><th>SKU</th><th>{t("اللون", "Colour")}</th><th>{t("المقاس", "Size")}</th><th>{t("سعر خاص", "Price override")}</th><th>{t("حد التنبيه", "Low-stock at")}</th><th>{t("فعال", "Active")}</th><th>{t("المخزون", "Stock")}</th><th></th></tr></thead>
          <tbody>
            {sorted.map((v) => (
              <tr key={v.id}>
                <td colSpan={6} className="p-0">
                  <AdminForm action={saveVariant} className="grid grid-cols-[1.4fr_1fr_.6fr_1fr_.7fr_.4fr_auto] items-center gap-2 px-4 py-2">
                    <input type="hidden" name="id" value={v.id} />
                    <input type="hidden" name="product_id" value={productId} />
                    <input name="sku" defaultValue={v.sku} className="field h-8 px-2 text-xs" dir="ltr" aria-label="SKU" />
                    <select name="color_id" defaultValue={v.color_id} className="field h-8 px-2 text-xs" aria-label={t("اللون", "Colour")}>{colors.map((c) => <option key={c.id} value={c.id}>{locale === "ar" ? c.name_ar : c.name_en}</option>)}</select>
                    <select name="size_code" defaultValue={v.size_code} className="field h-8 px-2 text-xs" aria-label={t("المقاس", "Size")}>{sizes.map((s) => <option key={s.code}>{s.code}</option>)}</select>
                    <input name="price_override" type="number" min={0} step={250} defaultValue={v.price_override ?? ""} placeholder={String(basePrice)} className="field h-8 px-2 text-xs" aria-label={t("سعر خاص", "Price override")} />
                    <input name="low_stock_threshold" type="number" min={0} defaultValue={v.inventory?.low_stock_threshold ?? 5} className="field h-8 px-2 text-xs" aria-label={t("حد التنبيه", "Low-stock at")} />
                    <input type="checkbox" name="is_active" defaultChecked={v.is_active} className="size-4 accent-ink" aria-label={t("فعال", "Active")} />
                    <Submit variant="outline" className="h-8">✓</Submit>
                  </AdminForm>
                </td>
                <td className="tabular-nums"><Link href={`/${locale}/admin/inventory?q=${encodeURIComponent(v.sku)}`} className="font-semibold underline">{v.inventory?.quantity ?? 0}</Link></td>
                <td>
                  <AdminForm action={deleteVariant}>
                    <input type="hidden" name="id" value={v.id} />
                    <button className="text-xs text-danger hover:underline" onClick={(e) => { if (!confirm(t("حذف هذا النوع؟ إذا كان له طلبات سابقة سيتم تعطيله فقط.", "Delete variant? If it has orders it will be deactivated instead."))) e.preventDefault(); }}>{t("حذف", "Delete")}</button>
                  </AdminForm>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <AdminForm action={saveVariant} resetOnSuccess className="grid items-end gap-2 border-t border-line pt-4 sm:grid-cols-6">
        <input type="hidden" name="product_id" value={productId} />
        <div className="sm:col-span-2"><label className="label">SKU</label><input name="sku" required className="field h-10 text-sm" dir="ltr" /></div>
        <div><label className="label">{t("اللون", "Colour")}</label><select name="color_id" className="field h-10 text-sm">{colors.map((c) => <option key={c.id} value={c.id}>{locale === "ar" ? c.name_ar : c.name_en}</option>)}</select></div>
        <div><label className="label">{t("المقاس", "Size")}</label><select name="size_code" className="field h-10 text-sm">{sizes.map((s) => <option key={s.code}>{s.code}</option>)}</select></div>
        <div><label className="label">{t("سعر خاص", "Price")}</label><input name="price_override" type="number" min={0} className="field h-10 text-sm" /></div>
        <input type="hidden" name="is_active" value="on" />
        <Submit>{t("إضافة نوع", "Add variant")}</Submit>
      </AdminForm>
    </div>
  );
}
