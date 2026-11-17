import Link from "next/link";
import { notFound } from "next/navigation";
import { isLocale } from "@/lib/i18n/config";
import { getDictionary } from "@/lib/i18n";
import { adminT } from "@/lib/admin-i18n";
import { createClient } from "@/lib/supabase/server";
import { PageHeader, Card, Stat, Pill, STATUS_TONE, Empty } from "@/components/admin/ui";
import { SalesChart } from "@/components/admin/sales-chart";
import { formatIQD, formatNumber, formatDate } from "@/lib/format";

interface Stats {
  total_orders: number; pending_orders: number; completed_orders: number; cancelled_orders: number;
  total_sales: number; revenue: number; customers: number; new_bulk_requests: number;
  daily: { day: string; total: number; orders: number }[];
  best_sellers: { product_id: string; name_ar: string; name_en: string; units: number; revenue: number }[];
  low_stock: { variant_id: string; sku: string; name_ar: string; name_en: string; quantity: number; low_stock_threshold: number }[];
}

export default async function AdminHome({ params, searchParams }: { params: Promise<{ locale: string }>; searchParams: Promise<{ days?: string }> }) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const t = adminT(locale);
  const dict = getDictionary(locale);
  const { days: daysRaw } = await searchParams;
  const days = [7, 30, 90, 365].includes(Number(daysRaw)) ? Number(daysRaw) : 30;
  const supabase = await createClient();
  const from = new Date(Date.now() - days * 86400000).toISOString();
  const [{ data: statsRaw }, { data: recent }, { data: activity }] = await Promise.all([
    supabase.rpc("admin_dashboard_stats", { p_from: from, p_to: new Date().toISOString() }),
    supabase.from("orders").select("id, order_number, customer_name, total, status, created_at").order("created_at", { ascending: false }).limit(8),
    supabase.from("notifications").select("id, title, body, link, created_at, read_at").eq("audience", "admin").eq("channel", "in_app").order("created_at", { ascending: false }).limit(8),
  ]);
  const s = (statsRaw ?? {}) as Stats;
  // Fill every day of the range (Baghdad time) so gaps show as zero instead of stretching bars.
  const byDay = new Map((s.daily ?? []).map((d) => [String(d.day).slice(0, 10), d]));
  const series = Array.from({ length: days }, (_, i) => {
    const day = new Date(Date.now() + 3 * 3600000 - (days - 1 - i) * 86400000).toISOString().slice(0, 10);
    return byDay.get(day) ?? { day, total: 0, orders: 0 };
  });
  return (
    <div className="space-y-6">
      <PageHeader
        title={t("نظرة عامة", "Overview")}
        actions={[7, 30, 90, 365].map((d) => (
          <Link key={d} href={`?days=${d}`} className={`btn btn-sm ${d === days ? "btn-primary" : "btn-outline"}`}>{d} {t("يوم", "days")}</Link>
        ))}
      />
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Stat label={t("إجمالي المبيعات", "Total sales")} value={formatIQD(s.total_sales ?? 0, locale)} hint={t(`آخر ${days} يوم (غير الملغية)`, `Last ${days} days (excl. cancelled)`)} />
        <Stat label={t("الإيرادات المحققة", "Realised revenue")} value={formatIQD(s.revenue ?? 0, locale)} hint={t("الطلبات المسلّمة بدون التوصيل", "Delivered, excl. delivery")} tone="good" />
        <Stat label={t("إجمالي الطلبات", "Total orders")} value={formatNumber(s.total_orders ?? 0, locale)} />
        <Stat label={t("طلبات قيد التنفيذ", "Pending orders")} value={formatNumber(s.pending_orders ?? 0, locale)} tone={(s.pending_orders ?? 0) > 0 ? "warn" : undefined} />
        <Stat label={t("طلبات مكتملة", "Completed")} value={formatNumber(s.completed_orders ?? 0, locale)} />
        <Stat label={t("طلبات ملغية", "Cancelled")} value={formatNumber(s.cancelled_orders ?? 0, locale)} />
        <Stat label={t("العملاء المسجلون", "Registered customers")} value={formatNumber(s.customers ?? 0, locale)} />
        <Stat label={t("طلبات جملة جديدة", "New bulk requests")} value={formatNumber(s.new_bulk_requests ?? 0, locale)} tone={(s.new_bulk_requests ?? 0) > 0 ? "warn" : undefined} />
      </div>
      <Card title={t("المبيعات اليومية", "Daily sales")}><SalesChart data={series} /></Card>
      <div className="grid gap-6 xl:grid-cols-2">
        <Card title={t("الأكثر مبيعاً", "Best sellers")}>
          {s.best_sellers?.length ? (
            <table className="table-admin"><tbody>
              {s.best_sellers.map((b) => (
                <tr key={b.product_id}><td><Link href={`/${locale}/admin/products/${b.product_id}`} className="font-medium hover:underline">{locale === "ar" ? b.name_ar : b.name_en}</Link></td><td className="tabular-nums">{b.units} {dict.common.pieces}</td><td className="text-end tabular-nums">{formatIQD(b.revenue, locale)}</td></tr>
              ))}
            </tbody></table>
          ) : <Empty>—</Empty>}
        </Card>
        <Card title={t("تنبيهات المخزون المنخفض", "Low-stock alerts")} actions={<Link href={`/${locale}/admin/inventory?low=1`} className="text-xs underline">{t("الكل", "All")}</Link>}>
          {s.low_stock?.length ? (
            <table className="table-admin"><tbody>
              {s.low_stock.map((v) => (
                <tr key={v.variant_id}><td><span className="font-medium">{locale === "ar" ? v.name_ar : v.name_en}</span><span className="block text-xs text-mute" dir="ltr">{v.sku}</span></td><td className="text-end"><Pill tone={v.quantity === 0 ? "bad" : "warn"}>{v.quantity}</Pill></td></tr>
              ))}
            </tbody></table>
          ) : <Empty>{t("لا توجد تنبيهات", "No alerts")}</Empty>}
        </Card>
        <Card title={t("أحدث الطلبات", "Recent orders")} actions={<Link href={`/${locale}/admin/orders`} className="text-xs underline">{t("الكل", "All")}</Link>}>
          {recent?.length ? (
            <table className="table-admin"><tbody>
              {recent.map((o) => (
                <tr key={o.id}>
                  <td><Link href={`/${locale}/admin/orders/${o.id}`} className="font-semibold hover:underline" dir="ltr">{o.order_number}</Link><span className="block text-xs text-mute">{o.customer_name}</span></td>
                  <td><Pill tone={STATUS_TONE[o.status]}>{dict.status[o.status]}</Pill></td>
                  <td className="text-end tabular-nums">{formatIQD(o.total, locale)}</td>
                </tr>
              ))}
            </tbody></table>
          ) : <Empty>—</Empty>}
        </Card>
        <Card title={t("النشاط الأخير", "Recent activity")} actions={<Link href={`/${locale}/admin/notifications`} className="text-xs underline">{t("الكل", "All")}</Link>}>
          {activity?.length ? (
            <ul className="divide-y divide-line text-sm">
              {activity.map((n) => (
                <li key={n.id} className="flex items-start justify-between gap-3 py-2.5">
                  <div>{n.link ? <Link href={`/${locale}${n.link}`} className={`hover:underline ${n.read_at ? "" : "font-semibold"}`}>{n.title}</Link> : n.title}<p className="text-xs text-mute">{n.body}</p></div>
                  <span className="shrink-0 text-xs text-mute">{formatDate(n.created_at, locale, true)}</span>
                </li>
              ))}
            </ul>
          ) : <Empty>—</Empty>}
        </Card>
      </div>
    </div>
  );
}
