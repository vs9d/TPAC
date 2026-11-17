import Link from "next/link";
import { notFound } from "next/navigation";
import { Download, Paintbrush } from "lucide-react";
import { isLocale } from "@/lib/i18n/config";
import { getDictionary } from "@/lib/i18n";
import { adminT } from "@/lib/admin-i18n";
import { queryOrders } from "@/lib/data/admin-orders";
import { PageHeader, Pill, STATUS_TONE, Pagination, Empty } from "@/components/admin/ui";
import { ORDER_STATUSES } from "@/lib/order-status";
import { formatIQD, formatDate } from "@/lib/format";
import { formatIraqiPhone } from "@/lib/phone";
import { governorateName } from "@/lib/iraq";

const PAGE_SIZE = 30;

export default async function AdminOrders({ params, searchParams }: { params: Promise<{ locale: string }>; searchParams: Promise<Record<string, string | undefined>> }) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const t = adminT(locale);
  const dict = getDictionary(locale);
  const sp = await searchParams;
  const page = Math.max(1, Number(sp.page) || 1);
  const { data, count } = await queryOrders({ q: sp.q, status: sp.status, from: sp.from, to: sp.to, page, pageSize: PAGE_SIZE });
  const orders = (data ?? []) as unknown as { id: string; order_number: string; customer_name: string; phone: string; governorate: string; total: number; status: string; payment_status: string; has_custom_items: boolean; created_at: string }[];
  const qs = (extra: Record<string, string | number>) => {
    const p = new URLSearchParams(Object.entries({ ...sp, ...extra }).filter(([, v]) => v !== undefined && v !== "").map(([k, v]) => [k, String(v)]));
    return `?${p.toString()}`;
  };
  const exportQs = new URLSearchParams(Object.entries(sp).filter(([k, v]) => v && k !== "page") as [string, string][]).toString();
  return (
    <div>
      <PageHeader title={t("الطلبات", "Orders")} subtitle={`${count ?? 0} ${t("طلب", "orders")}`} actions={<a href={`/api/admin/orders?${exportQs}`} className="btn btn-outline btn-sm"><Download className="size-4" /> CSV</a>} />
      <form className="card-admin mb-4 grid gap-3 p-4 sm:grid-cols-2 lg:grid-cols-5">
        <input name="q" defaultValue={sp.q} placeholder={t("رقم الطلب، الاسم أو الهاتف", "Order #, name or phone")} className="field h-10 text-sm lg:col-span-2" />
        <select name="status" defaultValue={sp.status ?? ""} className="field h-10 text-sm">
          <option value="">{t("كل الحالات", "All statuses")}</option>
          {ORDER_STATUSES.map((s) => <option key={s} value={s}>{dict.status[s]}</option>)}
        </select>
        <div className="flex gap-2 lg:col-span-2">
          <input type="date" name="from" defaultValue={sp.from} className="field h-10 text-sm" aria-label={t("من", "From")} />
          <input type="date" name="to" defaultValue={sp.to} className="field h-10 text-sm" aria-label={t("إلى", "To")} />
          <button className="btn btn-primary btn-sm h-10">{t("بحث", "Filter")}</button>
        </div>
      </form>
      <div className="card-admin overflow-x-auto">
        {orders.length === 0 ? <Empty>{t("لا توجد طلبات", "No orders")}</Empty> : (
          <table className="table-admin">
            <thead><tr><th>{t("الطلب", "Order")}</th><th>{t("العميل", "Customer")}</th><th>{t("المحافظة", "Governorate")}</th><th>{t("الحالة", "Status")}</th><th>{t("الدفع", "Payment")}</th><th>{t("التاريخ", "Date")}</th><th className="text-end">{t("المجموع", "Total")}</th></tr></thead>
            <tbody>
              {orders.map((o) => (
                <tr key={o.id}>
                  <td><Link href={`/${locale}/admin/orders/${o.id}`} className="inline-flex items-center gap-1.5 font-semibold hover:underline" dir="ltr">{o.order_number}{o.has_custom_items && <Paintbrush className="size-3.5 text-amber-deep" aria-label="custom" />}</Link></td>
                  <td>{o.customer_name}<span className="block text-xs text-mute" dir="ltr">{formatIraqiPhone(o.phone)}</span></td>
                  <td>{governorateName(o.governorate, locale)}</td>
                  <td><Pill tone={STATUS_TONE[o.status]}>{dict.status[o.status]}</Pill></td>
                  <td><Pill tone={o.payment_status === "paid" ? "good" : "neutral"}>{o.payment_status}</Pill></td>
                  <td className="whitespace-nowrap text-xs text-mute">{formatDate(o.created_at, locale, true)}</td>
                  <td className="text-end font-semibold tabular-nums">{formatIQD(o.total, locale)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        <Pagination page={page} pageSize={PAGE_SIZE} total={count ?? 0} href={(p) => qs({ page: p })} />
      </div>
    </div>
  );
}
