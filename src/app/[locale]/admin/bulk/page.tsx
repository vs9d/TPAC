import Link from "next/link";
import { notFound } from "next/navigation";
import { isLocale } from "@/lib/i18n/config";
import { getDictionary } from "@/lib/i18n";
import { adminT } from "@/lib/admin-i18n";
import { createClient } from "@/lib/supabase/server";
import { PageHeader, Pill, Empty, BULK_TONE } from "@/components/admin/ui";
import { formatDate, formatNumber } from "@/lib/format";
import { formatIraqiPhone } from "@/lib/phone";


export default async function AdminBulk({ params, searchParams }: { params: Promise<{ locale: string }>; searchParams: Promise<{ status?: string }> }) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const t = adminT(locale);
  const dict = getDictionary(locale);
  const { status } = await searchParams;
  const supabase = await createClient();
  let q = supabase.from("bulk_order_requests").select("*").order("created_at", { ascending: false }).limit(200);
  if (status) q = q.eq("status", status);
  const { data } = await q;
  const statuses = ["new", "contacted", "quoted", "approved", "rejected", "converted"];
  const label: Record<string, string> = { new: t("طلب جديد", "New request"), contacted: t("قيد المراجعة", "Under review"), quoted: t("تم إرسال العرض", "Quotation sent"), approved: t("موافق عليه", "Approved"), rejected: t("مرفوض", "Rejected"), converted: t("تحوّل لطلب", "Converted") };
  return (
    <div>
      <PageHeader title={t("طلبات عروض الأسعار", "Quotation requests")} subtitle={t("الجامعات والشركات والطلبات بالجملة", "Universities, companies and bulk orders")} actions={<Link href={`/${locale}/admin/bulk/pricing`} className="btn btn-outline btn-sm">{t("قواعد التسعير", "Pricing rules")}</Link>} />
      <div className="mb-4 flex flex-wrap gap-2">
        <Link href="?" className={`btn btn-sm ${!status ? "btn-primary" : "btn-outline"}`}>{t("الكل", "All")}</Link>
        {statuses.map((s) => <Link key={s} href={`?status=${s}`} className={`btn btn-sm ${status === s ? "btn-primary" : "btn-outline"}`}>{label[s]}</Link>)}
      </div>
      <div className="card-admin overflow-x-auto">
        {!data?.length ? <Empty>—</Empty> : (
          <table className="table-admin">
            <thead><tr><th>#</th><th>{t("الجهة", "Organisation")}</th><th>{t("المنتج", "Product")}</th><th>{t("الكمية", "Qty")}</th><th>{t("الحالة", "Status")}</th><th>{t("التاريخ", "Date")}</th></tr></thead>
            <tbody>
              {data.map((r) => (
                <tr key={r.id}>
                  <td><Link href={`/${locale}/admin/bulk/${r.id}`} className="font-semibold hover:underline" dir="ltr">{r.request_number}</Link></td>
                  <td>{r.organization_name}<span className="block text-xs text-mute">{r.contact_name} · <span dir="ltr">{formatIraqiPhone(r.phone)}</span></span></td>
                  <td>{dict.bulk.productTypes[r.product_type] ?? r.product_type}</td>
                  <td className="tabular-nums">{r.quantity_min ? `${formatNumber(r.quantity_min, locale)}–${formatNumber(r.quantity_max ?? r.quantity_min, locale)}` : formatNumber(r.estimated_quantity, locale)}{r.preferred_color && <span className="block text-xs text-mute">{r.preferred_color}</span>}</td>
                  <td><Pill tone={BULK_TONE[r.status]}>{label[r.status]}</Pill></td>
                  <td className="text-xs text-mute">{formatDate(r.created_at, locale)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
