import { notFound } from "next/navigation";
import { isLocale } from "@/lib/i18n/config";
import { getDictionary } from "@/lib/i18n";
import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { OrderRow } from "@/components/account/order-row";

export const metadata = { robots: { index: false } };

export default async function OrdersPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const dict = getDictionary(locale);
  const session = await requireUser(locale);
  const supabase = await createClient();
  const { data: orders } = await supabase.from("orders").select("id, order_number, status, total, created_at").eq("user_id", session.userId).order("created_at", { ascending: false }).limit(100);
  return (
    <section>
      <h2 className="display mb-4 text-2xl">{dict.account.orders}</h2>
      {orders?.length ? orders.map((o) => <OrderRow key={o.id} order={o} locale={locale} dict={dict} />) : <p className="text-mute">{dict.account.noOrders}</p>}
    </section>
  );
}
