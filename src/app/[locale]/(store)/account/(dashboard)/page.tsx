import Link from "next/link";
import { notFound } from "next/navigation";
import { isLocale } from "@/lib/i18n/config";
import { getDictionary } from "@/lib/i18n";
import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { OrderRow } from "@/components/account/order-row";
import { formatDate } from "@/lib/format";
import { markNotificationsRead } from "@/lib/actions/account";

export const metadata = { robots: { index: false } };

export default async function AccountOverview({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const dict = getDictionary(locale);
  const session = await requireUser(locale);
  const supabase = await createClient();
  const [{ data: orders }, { data: notes }] = await Promise.all([
    supabase.from("orders").select("id, order_number, status, total, created_at").eq("user_id", session.userId).order("created_at", { ascending: false }).limit(5),
    supabase.from("notifications").select("id, title, body, link, read_at, created_at").eq("user_id", session.userId).eq("audience", "customer").order("created_at", { ascending: false }).limit(8),
  ]);
  const unread = (notes ?? []).some((n) => !n.read_at);
  return (
    <div className="grid gap-12 xl:grid-cols-2">
      <section>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="display text-2xl">{dict.account.orders}</h2>
          <Link href={`/${locale}/account/orders`} className="text-sm underline">{dict.common.viewAll}</Link>
        </div>
        {orders?.length ? orders.map((o) => <OrderRow key={o.id} order={o} locale={locale} dict={dict} />) : <p className="text-mute">{dict.account.noOrders}</p>}
      </section>
      <section>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="display text-2xl">{dict.account.notifications}</h2>
          {unread && <form action={markNotificationsRead}><button className="text-xs underline">✓</button></form>}
        </div>
        {notes?.length ? (
          <ul className="divide-y divide-line border-y border-line">
            {notes.map((n) => (
              <li key={n.id} className={`py-3 text-sm ${n.read_at ? "text-mute" : ""}`}>
                <p className="font-semibold">{n.title}</p>
                <p className="text-xs">{dict.status[n.body ?? ""] ?? n.body} · {formatDate(n.created_at, locale, true)}</p>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-mute">{dict.account.noNotifications}</p>
        )}
      </section>
    </div>
  );
}
