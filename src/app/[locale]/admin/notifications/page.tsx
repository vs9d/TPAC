import Link from "next/link";
import { notFound } from "next/navigation";
import { isLocale } from "@/lib/i18n/config";
import { adminT } from "@/lib/admin-i18n";
import { createClient } from "@/lib/supabase/server";
import { PageHeader, Card, Pill, Empty } from "@/components/admin/ui";
import { markAdminNotificationsRead } from "@/lib/actions/admin/settings";
import { formatDate } from "@/lib/format";

export default async function AdminNotifications({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const t = adminT(locale);
  const supabase = await createClient();
  const [{ data: inApp }, { data: delivery }] = await Promise.all([
    supabase.from("notifications").select("*").eq("audience", "admin").eq("channel", "in_app").order("created_at", { ascending: false }).limit(100),
    supabase.from("notifications").select("*").neq("channel", "in_app").order("created_at", { ascending: false }).limit(100),
  ]);
  return (
    <div className="space-y-6">
      <PageHeader title={t("الإشعارات", "Notifications")} actions={<form action={markAdminNotificationsRead}><button className="btn btn-outline btn-sm">{t("تعليم الكل كمقروء", "Mark all read")}</button></form>} />
      <Card title={t("تنبيهات الإدارة", "Admin alerts")}>
        {!inApp?.length ? <Empty>—</Empty> : (
          <ul className="divide-y divide-line text-sm">
            {inApp.map((n) => (
              <li key={n.id} className="flex items-start justify-between gap-4 py-3">
                <div><Pill tone={n.read_at ? "neutral" : "warn"}>{n.event}</Pill> {n.link ? <Link href={`/${locale}${n.link}`} className={`hover:underline ${n.read_at ? "" : "font-semibold"}`}>{n.title}</Link> : n.title}<p className="text-xs text-mute">{n.body}</p></div>
                <span className="shrink-0 text-xs text-mute">{formatDate(n.created_at, locale, true)}</span>
              </li>
            ))}
          </ul>
        )}
      </Card>
      <Card title={t("سجل الإرسال (بريد / واتساب)", "Delivery log (email / WhatsApp)")}>
        {!delivery?.length ? <Empty>—</Empty> : (
          <table className="table-admin"><tbody>
            {delivery.map((n) => (
              <tr key={n.id}>
                <td><Pill tone="dark">{n.channel}</Pill> <span className="text-xs">{n.audience}</span></td>
                <td>{n.title}<span className="block text-xs text-mute" dir="ltr">{n.recipient}</span></td>
                <td><Pill tone={n.status === "sent" ? "good" : n.status === "failed" ? "bad" : "warn"}>{n.status}</Pill>{n.error && <span className="block text-xs text-mute">{n.error}</span>}</td>
                <td className="text-xs text-mute">{formatDate(n.created_at, locale, true)}</td>
              </tr>
            ))}
          </tbody></table>
        )}
      </Card>
    </div>
  );
}
