import Link from "next/link";
import { notFound } from "next/navigation";
import { Plus } from "lucide-react";
import { isLocale } from "@/lib/i18n/config";
import { getMyCreator, creatorBalance } from "@/lib/creators";
import { creatorDaily, creatorEarnings, creatorListings } from "@/lib/data/creators";
import { BarChart } from "@/components/creators/bar-chart";
import { formatIQD, formatNumber } from "@/lib/format";

const day = (d: Date) => d.toISOString().slice(0, 10);

export default async function CreatorOverview({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const ar = locale === "ar";
  const me = (await getMyCreator())!;
  const [b, earnings, listings, daily] = await Promise.all([creatorBalance(me.user_id), creatorEarnings(me.user_id, 5000), creatorListings(me.user_id), creatorDaily(me.user_id, 400)]);
  const live = earnings.filter((e) => e.status !== "void");
  const orders = new Set(live.map((e) => e.order_id)).size;
  const completed = new Set(live.filter((e) => e.status === "cleared").map((e) => e.order_id)).size;
  const pieces = live.reduce((n, e) => n + e.quantity, 0);
  const pageViews = daily.reduce((n, d) => n + d.page_views, 0);
  const productViews = daily.reduce((n, d) => n + d.product_views, 0);
  const published = listings.filter((l) => l.status === "approved").length;
  const conv = pageViews + productViews > 0 ? (orders / (pageViews + productViews)) * 100 : 0;
  const totalEarned = live.reduce((n, e) => n + e.amount, 0);

  // earnings per day (30), week (12) and month (12)
  const sumBy = (key: (d: Date) => string) => {
    const m = new Map<string, number>();
    for (const e of live) { const k = key(new Date(e.created_at)); m.set(k, (m.get(k) ?? 0) + e.amount); }
    return m;
  };
  const byDay = sumBy(day);
  const now = new Date();
  const days = Array.from({ length: 30 }, (_, i) => { const d = new Date(now.getTime() - (29 - i) * 86400000); const k = day(d); return { key: k, label: k.slice(5), value: byDay.get(k) ?? 0 }; });
  const weekKey = (d: Date) => { const x = new Date(d); x.setUTCDate(x.getUTCDate() - ((x.getUTCDay() + 1) % 7)); return day(x); };
  const byWeek = sumBy(weekKey);
  const weeks = Array.from({ length: 12 }, (_, i) => { const k = weekKey(new Date(now.getTime() - (11 - i) * 7 * 86400000)); return { key: k, label: k.slice(5), value: byWeek.get(k) ?? 0 }; });
  const monthKey = (d: Date) => d.toISOString().slice(0, 7);
  const byMonth = sumBy(monthKey);
  const months = Array.from({ length: 12 }, (_, i) => { const d = new Date(now.getFullYear(), now.getMonth() - 11 + i, 15); const k = monthKey(d); return { key: k, label: k, value: byMonth.get(k) ?? 0 }; });
  const thisMonth = byMonth.get(monthKey(now)) ?? 0;
  const lastMonth = byMonth.get(monthKey(new Date(now.getFullYear(), now.getMonth() - 1, 15))) ?? 0;
  const change = lastMonth > 0 ? Math.round(((thisMonth - lastMonth) / lastMonth) * 100) : null;

  const bestSelling = [...listings].map((l) => ({ l, n: live.filter((e) => e.creator_product_id === l.id).reduce((s, e) => s + e.quantity, 0) })).filter((x) => x.n > 0).sort((a, b) => b.n - a.n).slice(0, 5);
  const mostViewed = [...listings].filter((l) => l.view_count > 0).sort((a, b) => b.view_count - a.view_count).slice(0, 5);
  const money = (n: number) => formatIQD(n, locale);
  const stat = (label: string, value: string, hint?: string) => (
    <div className="rounded-[1.25rem] border border-line bg-paper p-4">
      <p className="text-xs font-semibold text-mute">{label}</p>
      <p className="display mt-1 text-2xl tabular-nums">{value}</p>
      {hint && <p className="mt-0.5 text-[11px] text-mute">{hint}</p>}
    </div>
  );
  return (
    <div className="space-y-6">
      {listings.length === 0 && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-[1.5rem] bg-pine-soft p-5">
          <p className="font-semibold text-pine">{ar ? "ابدي بأول تصميم — كل تصميم ممكن يصير مصدر دخل 🎨" : "Start with your first design — every design can earn 🎨"}</p>
          <Link href={`/${locale}/creator-studio/designs/new`} className="btn btn-brand h-11"><Plus className="size-4" /> {ar ? "تصميم جديد" : "New design"}</Link>
        </div>
      )}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {stat(ar ? "إجمالي الأرباح" : "Total earnings", money(totalEarned))}
        {stat(ar ? "متاح للسحب" : "Available", money(b.available))}
        {stat(ar ? "أرباح معلّقة" : "Pending", money(b.pending + b.cleared_waiting), ar ? "طلبات ما اكتملت أو بفترة الإرجاع" : "Not completed yet or in the return window")}
        {stat(ar ? "القطع المباعة" : "Pieces sold", formatNumber(pieces, locale))}
        {stat(ar ? "الطلبات" : "Orders", formatNumber(orders, locale), ar ? `${completed} مكتمل` : `${completed} completed`)}
        {stat(ar ? "التصاميم المنشورة" : "Published designs", formatNumber(published, locale), ar ? `من ${listings.length}` : `of ${listings.length}`)}
        {stat(ar ? "زيارات صفحتك" : "Page visits", formatNumber(pageViews, locale), ar ? `${formatNumber(productViews, locale)} مشاهدة منتجات` : `${formatNumber(productViews, locale)} product views`)}
        {stat(ar ? "معدل التحويل" : "Conversion", `${conv.toFixed(1)}%`, ar ? "طلبات ÷ مشاهدات" : "orders ÷ views")}
      </div>
      <div className="grid gap-4 lg:grid-cols-3">
        <section className="rounded-[1.5rem] border border-line bg-paper p-5 lg:col-span-2" aria-label={ar ? "الأرباح اليومية" : "Daily earnings"}>
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h2 className="font-bold">{ar ? "الأرباح — آخر ٣٠ يوم" : "Earnings — last 30 days"}</h2>
            <p className="text-sm text-mute">{ar ? "هذا الشهر" : "This month"}: <b className="tabular-nums text-ink">{money(thisMonth)}</b>{change != null && <span className={change >= 0 ? "ms-2 text-pine" : "ms-2 text-danger"}>{change >= 0 ? "▲" : "▼"} {Math.abs(change)}% {ar ? "عن الشهر الماضي" : "vs last month"}</span>}</p>
          </div>
          <BarChart data={days} label={ar ? "الأرباح اليومية" : "Daily earnings"} format={money} />
        </section>
        <section className="space-y-3 rounded-[1.5rem] border border-line bg-paper p-5">
          <h2 className="font-bold">{ar ? "الأكثر مبيعاً" : "Best sellers"}</h2>
          {bestSelling.length === 0 ? <p className="text-sm text-mute">{ar ? "بعد ماكو مبيعات — شارك رابط صفحتك 🚀" : "No sales yet — share your page 🚀"}</p> : (
            <ol className="space-y-2 text-sm">{bestSelling.map(({ l, n }) => <li key={l.id} className="flex justify-between gap-2"><span className="truncate">{l.title}</span><b className="tabular-nums">{n}</b></li>)}</ol>
          )}
          <h2 className="pt-2 font-bold">{ar ? "الأكثر مشاهدة" : "Most viewed"}</h2>
          {mostViewed.length === 0 ? <p className="text-sm text-mute">—</p> : (
            <ol className="space-y-2 text-sm">{mostViewed.map((l) => <li key={l.id} className="flex justify-between gap-2"><span className="truncate">{l.title}</span><b className="tabular-nums">{l.view_count}</b></li>)}</ol>
          )}
        </section>
        <section className="rounded-[1.5rem] border border-line bg-paper p-5" aria-label={ar ? "الأرباح الأسبوعية" : "Weekly earnings"}>
          <h2 className="font-bold">{ar ? "أسبوعياً — ١٢ أسبوع" : "Weekly — 12 weeks"}</h2>
          <BarChart data={weeks} label={ar ? "الأرباح الأسبوعية" : "Weekly earnings"} format={money} />
        </section>
        <section className="rounded-[1.5rem] border border-line bg-paper p-5 lg:col-span-2" aria-label={ar ? "الأرباح الشهرية" : "Monthly earnings"}>
          <h2 className="font-bold">{ar ? "شهرياً — ١٢ شهر" : "Monthly — 12 months"}</h2>
          <BarChart data={months} label={ar ? "الأرباح الشهرية" : "Monthly earnings"} format={money} />
        </section>
      </div>
    </div>
  );
}
