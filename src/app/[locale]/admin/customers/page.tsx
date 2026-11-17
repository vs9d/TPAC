import Link from "next/link";
import { notFound } from "next/navigation";
import { isLocale } from "@/lib/i18n/config";
import { adminT } from "@/lib/admin-i18n";
import { createClient } from "@/lib/supabase/server";
import { PageHeader, Pill, Pagination, Empty } from "@/components/admin/ui";
import { formatIQD, formatDate } from "@/lib/format";
import { formatIraqiPhone } from "@/lib/phone";

const PAGE_SIZE = 50;

export default async function AdminCustomers({ params, searchParams }: { params: Promise<{ locale: string }>; searchParams: Promise<{ q?: string; repeat?: string; page?: string }> }) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const t = adminT(locale);
  const sp = await searchParams;
  const page = Math.max(1, Number(sp.page) || 1);
  const supabase = await createClient();
  const { data } = await supabase.rpc("admin_customers", { p_search: sp.q ?? null, p_limit: PAGE_SIZE, p_offset: (page - 1) * PAGE_SIZE, p_repeat_only: sp.repeat === "1" });
  const res = (data ?? { total: 0, items: [] }) as { total: number; items: { user_id: string | null; name: string | null; phone: string | null; email: string | null; role: string; order_count: number; total_spent: number; last_order_at: string | null; created_at: string }[] };
  return (
    <div>
      <PageHeader title={t("العملاء", "Customers")} subtitle={t("يشمل المسجلين والزوار (حسب رقم الهاتف)", "Registered customers and guest buyers (by phone)")} />
      <form className="card-admin mb-4 flex flex-wrap gap-3 p-4">
        <input name="q" defaultValue={sp.q} placeholder={t("الاسم، الهاتف أو البريد", "Name, phone or email")} className="field h-10 max-w-sm text-sm" />
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="repeat" value="1" defaultChecked={sp.repeat === "1"} className="accent-ink" /> {t("العملاء المتكررون فقط", "Repeat customers only")}</label>
        <button className="btn btn-primary btn-sm h-10">{t("بحث", "Search")}</button>
      </form>
      <div className="card-admin overflow-x-auto">
        {!res.items.length ? <Empty>—</Empty> : (
          <table className="table-admin">
            <thead><tr><th>{t("العميل", "Customer")}</th><th>{t("النوع", "Type")}</th><th>{t("الطلبات", "Orders")}</th><th>{t("إجمالي الإنفاق", "Total spent")}</th><th>{t("آخر طلب", "Last order")}</th></tr></thead>
            <tbody>
              {res.items.map((c, i) => (
                <tr key={c.user_id ?? `g-${c.phone}-${i}`}>
                  <td>
                    {c.user_id ? <Link href={`/${locale}/admin/customers/${c.user_id}`} className="font-semibold hover:underline">{c.name || c.email}</Link> : <Link href={`/${locale}/admin/orders?q=${c.phone}`} className="font-semibold hover:underline">{c.name}</Link>}
                    <span className="block text-xs text-mute" dir="ltr">{formatIraqiPhone(c.phone)} {c.email && `· ${c.email}`}</span>
                  </td>
                  <td>{c.role === "guest" ? <Pill>{t("زائر", "Guest")}</Pill> : c.role === "customer" ? <Pill tone="neutral">{t("مسجل", "Registered")}</Pill> : <Pill tone="dark">{c.role}</Pill>} {c.order_count >= 2 && <Pill tone="good">{t("متكرر", "Repeat")}</Pill>}</td>
                  <td className="tabular-nums">{c.order_count}</td>
                  <td className="tabular-nums">{formatIQD(c.total_spent, locale)}</td>
                  <td className="text-xs text-mute">{c.last_order_at ? formatDate(c.last_order_at, locale) : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        <Pagination page={page} pageSize={PAGE_SIZE} total={res.total} href={(p) => `?${new URLSearchParams({ ...Object.fromEntries(Object.entries(sp).filter(([, v]) => v)), page: String(p) } as Record<string, string>)}`} />
      </div>
    </div>
  );
}
