import { notFound } from "next/navigation";
import { isLocale } from "@/lib/i18n/config";
import { adminT } from "@/lib/admin-i18n";
import { createClient } from "@/lib/supabase/server";
import { PageHeader, Empty } from "@/components/admin/ui";
import { formatDate } from "@/lib/format";

export default async function AdminActivity({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const t = adminT(locale);
  const supabase = await createClient();
  const { data } = await supabase.from("admin_activity_logs").select("*").order("created_at", { ascending: false }).limit(300);
  const actorIds = [...new Set((data ?? []).map((r) => r.actor_id).filter(Boolean))];
  const { data: actors } = actorIds.length ? await supabase.from("customer_profiles").select("id, full_name, email").in("id", actorIds) : { data: [] };
  const name = new Map((actors ?? []).map((a) => [a.id, a.full_name || a.email]));
  return (
    <div>
      <PageHeader title={t("سجل نشاط الإدارة", "Admin activity log")} />
      <div className="card-admin overflow-x-auto">
        {!data?.length ? <Empty>—</Empty> : (
          <table className="table-admin">
            <thead><tr><th>{t("الوقت", "Time")}</th><th>{t("المستخدم", "User")}</th><th>{t("الإجراء", "Action")}</th><th>{t("العنصر", "Entity")}</th><th>{t("التفاصيل", "Details")}</th></tr></thead>
            <tbody>
              {data.map((r) => (
                <tr key={r.id}>
                  <td className="whitespace-nowrap text-xs">{formatDate(r.created_at, locale, true)}</td>
                  <td>{name.get(r.actor_id) ?? "—"}</td>
                  <td className="font-mono text-xs" dir="ltr">{r.action}</td>
                  <td className="font-mono text-xs" dir="ltr">{r.entity_type}:{String(r.entity_id ?? "").slice(0, 12)}</td>
                  <td className="max-w-xs truncate font-mono text-xs" dir="ltr">{JSON.stringify(r.details)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
