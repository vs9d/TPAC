import Link from "next/link";
import { notFound } from "next/navigation";
import { isLocale } from "@/lib/i18n/config";
import { adminT } from "@/lib/admin-i18n";
import { createClient } from "@/lib/supabase/server";
import { PageHeader, Card, Pill, Empty } from "@/components/admin/ui";
import { InventoryAdjustForm } from "@/components/admin/inventory-adjust";
import { formatDate } from "@/lib/format";

export default async function VariantHistory({ params }: { params: Promise<{ locale: string; variantId: string }> }) {
  const { locale, variantId } = await params;
  if (!isLocale(locale) || !/^[0-9a-f-]{36}$/.test(variantId)) notFound();
  const t = adminT(locale);
  const supabase = await createClient();
  const { data: v } = await supabase.from("product_variants").select("sku, size_code, product:products(id, name_ar, name_en), inventory(quantity)").eq("id", variantId).maybeSingle();
  if (!v) notFound();
  const { data: tx } = await supabase.from("inventory_transactions").select("*, order:orders(order_number, id)").eq("variant_id", variantId).order("created_at", { ascending: false }).limit(200);
  const variant = v as unknown as { sku: string; size_code: string; product: { id: string; name_ar: string; name_en: string }; inventory: { quantity: number } | null };
  const reasons: Record<string, string> = { initial: t("رصيد أولي", "Initial"), adjustment: t("تصحيح", "Adjustment"), sale: t("بيع", "Sale"), cancellation: t("إلغاء طلب", "Cancellation"), return: t("مرتجع", "Return"), restock: t("إعادة تخزين", "Restock"), damage: t("تالف", "Damaged") };
  return (
    <div className="space-y-6">
      <PageHeader title={`${variant.sku}`} subtitle={`${locale === "ar" ? variant.product.name_ar : variant.product.name_en} · ${variant.size_code} — ${t("الكمية الحالية", "On hand")}: ${variant.inventory?.quantity ?? 0}`} actions={<InventoryAdjustForm variantId={variantId} />} />
      <Card title={t("سجل المخزون", "Stock history")}>
        {!tx?.length ? <Empty>—</Empty> : (
          <table className="table-admin">
            <thead><tr><th>{t("التاريخ", "Date")}</th><th>{t("السبب", "Reason")}</th><th>{t("التغيير", "Change")}</th><th>{t("بعد", "After")}</th><th>{t("الطلب/ملاحظة", "Order/note")}</th></tr></thead>
            <tbody>
              {tx.map((r) => (
                <tr key={r.id}>
                  <td className="text-xs">{formatDate(r.created_at, locale, true)}</td>
                  <td>{reasons[r.reason] ?? r.reason}</td>
                  <td><Pill tone={r.change > 0 ? "good" : "bad"}>{r.change > 0 ? `+${r.change}` : r.change}</Pill></td>
                  <td className="tabular-nums">{r.quantity_after}</td>
                  <td className="text-xs">{r.order ? <Link href={`/${locale}/admin/orders/${r.order.id}`} className="underline" dir="ltr">{r.order.order_number}</Link> : r.note}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>
    </div>
  );
}
