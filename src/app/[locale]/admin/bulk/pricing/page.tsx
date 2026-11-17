import { notFound } from "next/navigation";
import { isLocale } from "@/lib/i18n/config";
import { getDictionary } from "@/lib/i18n";
import { adminT } from "@/lib/admin-i18n";
import { createClient } from "@/lib/supabase/server";
import { PageHeader, Card } from "@/components/admin/ui";
import { AdminForm, Submit } from "@/components/admin/form";
import { savePricingRule, deletePricingRule } from "@/lib/actions/admin/bulk";
import { BULK_PRODUCT_TYPES } from "@/lib/validation";

export default async function BulkPricing({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const t = adminT(locale);
  const dict = getDictionary(locale);
  const supabase = await createClient();
  const { data } = await supabase.from("bulk_pricing_rules").select("*").order("product_type").order("min_quantity");
  type Rule = { id?: string; product_type: string; min_quantity: number; max_quantity: number | null; unit_price: number; is_active: boolean };
  const row = (r?: Rule) => (
    <AdminForm action={savePricingRule} resetOnSuccess={!r} className="grid grid-cols-[1.2fr_1fr_1fr_1fr_auto_auto] items-center gap-2">
      {r?.id && <input type="hidden" name="id" value={r.id} />}
      <select name="product_type" defaultValue={r?.product_type ?? "tshirt"} className="field h-9 px-2 text-sm">{BULK_PRODUCT_TYPES.map((p) => <option key={p} value={p}>{dict.bulk.productTypes[p]}</option>)}</select>
      <input name="min_quantity" type="number" min={1} defaultValue={r?.min_quantity ?? 20} required className="field h-9 px-2 text-sm" aria-label={t("من", "Min")} />
      <input name="max_quantity" type="number" min={1} defaultValue={r?.max_quantity ?? ""} placeholder="∞" className="field h-9 px-2 text-sm" aria-label={t("إلى", "Max")} />
      <input name="unit_price" type="number" min={0} step={250} defaultValue={r?.unit_price ?? ""} required className="field h-9 px-2 text-sm" aria-label={t("السعر", "Price")} />
      <input type="checkbox" name="is_active" defaultChecked={r?.is_active ?? true} className="size-4 accent-ink" aria-label={t("فعال", "Active")} />
      <Submit variant={r ? "outline" : "primary"} className="h-9">{r ? "✓" : t("إضافة", "Add")}</Submit>
    </AdminForm>
  );
  return (
    <div>
      <PageHeader title={t("تسعير الجملة حسب الكمية", "Quantity-based bulk pricing")} subtitle={t("تظهر في صفحة الجملة وتُقترح تلقائياً عند إنشاء عروض الأسعار.", "Shown on the bulk page and suggested automatically in quotations.")} />
      <Card>
        <div className="mb-2 grid grid-cols-[1.2fr_1fr_1fr_1fr_auto_auto] gap-2 text-xs font-semibold text-mute"><span>{t("المنتج", "Product")}</span><span>{t("من (قطعة)", "Min qty")}</span><span>{t("إلى", "Max qty")}</span><span>{t("سعر القطعة", "Unit price")}</span><span>{t("فعال", "On")}</span><span /></div>
        <div className="space-y-2">
          {((data as Rule[]) ?? []).map((r) => (
            <div key={r.id} className="flex items-center gap-2"><div className="flex-1">{row(r)}</div><AdminForm action={deletePricingRule}><input type="hidden" name="id" value={r.id} /><button className="text-xs text-danger underline">{t("حذف", "Delete")}</button></AdminForm></div>
          ))}
          <div className="border-t border-line pt-3">{row()}</div>
        </div>
      </Card>
    </div>
  );
}
