import Link from "next/link";
import { notFound } from "next/navigation";
import { isLocale } from "@/lib/i18n/config";
import { adminT } from "@/lib/admin-i18n";
import { createClient } from "@/lib/supabase/server";
import { PageHeader, Pill, Pagination, Empty } from "@/components/admin/ui";
import { InventoryAdjustForm } from "@/components/admin/inventory-adjust";

const PAGE_SIZE = 50;

export default async function AdminInventory({ params, searchParams }: { params: Promise<{ locale: string }>; searchParams: Promise<{ q?: string; low?: string; page?: string }> }) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const t = adminT(locale);
  const sp = await searchParams;
  const page = Math.max(1, Number(sp.page) || 1);
  const supabase = await createClient();
  let q = supabase
    .from("product_variants")
    .select("id, sku, size_code, is_active, product:products!inner(id, name_ar, name_en), color:colors(name_ar, name_en, hex), inventory!inner(quantity, low_stock_threshold)", { count: "exact" })
    .order("sku")
    .range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1);
  const term = sp.q?.trim().replace(/[%_,()]/g, "");
  if (term) q = q.or(`sku.ilike.%${term}%`);
  if (sp.low) q = q.lte("inventory.quantity", 5);
  const { data, count } = await q;
  type Row = { id: string; sku: string; size_code: string; is_active: boolean; product: { id: string; name_ar: string; name_en: string }; color: { name_ar: string; name_en: string; hex: string } | null; inventory: { quantity: number; low_stock_threshold: number } };
  const rows = (data ?? []) as unknown as Row[];
  return (
    <div>
      <PageHeader title={t("المخزون", "Inventory")} subtitle={t("التعديلات تُسجّل في سجل المخزون مع السبب والمستخدم.", "Every adjustment is recorded in the stock history with reason and user.")} />
      <form className="card-admin mb-4 flex flex-wrap gap-3 p-4">
        <input name="q" defaultValue={sp.q} placeholder="SKU" className="field h-10 max-w-xs text-sm" dir="ltr" />
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="low" value="1" defaultChecked={!!sp.low} className="accent-ink" /> {t("المخزون المنخفض فقط (≤٥)", "Low stock only (≤5)")}</label>
        <button className="btn btn-primary btn-sm h-10">{t("بحث", "Filter")}</button>
      </form>
      <div className="card-admin overflow-x-auto">
        {rows.length === 0 ? <Empty>—</Empty> : (
          <table className="table-admin">
            <thead><tr><th>SKU</th><th>{t("المنتج", "Product")}</th><th>{t("اللون/المقاس", "Colour/size")}</th><th>{t("الكمية", "Qty")}</th><th>{t("تعديل", "Adjust")}</th><th></th></tr></thead>
            <tbody>
              {rows.map((v) => {
                const low = v.inventory.quantity <= v.inventory.low_stock_threshold;
                return (
                  <tr key={v.id}>
                    <td className="font-mono text-xs" dir="ltr">{v.sku}</td>
                    <td><Link href={`/${locale}/admin/products/${v.product.id}`} className="hover:underline">{locale === "ar" ? v.product.name_ar : v.product.name_en}</Link>{!v.is_active && <Pill>{t("معطل", "inactive")}</Pill>}</td>
                    <td><span className="inline-flex items-center gap-1.5"><span className="size-3 rounded-full border" style={{ background: v.color?.hex }} />{v.color ? (locale === "ar" ? v.color.name_ar : v.color.name_en) : ""} · {v.size_code}</span></td>
                    <td><Pill tone={v.inventory.quantity === 0 ? "bad" : low ? "warn" : "neutral"}>{v.inventory.quantity}</Pill></td>
                    <td><InventoryAdjustForm variantId={v.id} /></td>
                    <td><Link href={`/${locale}/admin/inventory/${v.id}`} className="text-xs underline">{t("السجل", "History")}</Link></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
        <Pagination page={page} pageSize={PAGE_SIZE} total={count ?? 0} href={(p) => `?${new URLSearchParams({ ...Object.fromEntries(Object.entries(sp).filter(([, v]) => v)), page: String(p) } as Record<string, string>)}`} />
      </div>
    </div>
  );
}
