import { notFound } from "next/navigation";
import { isLocale } from "@/lib/i18n/config";
import { adminT } from "@/lib/admin-i18n";
import { createClient } from "@/lib/supabase/server";
import { PageHeader, Pill, Empty } from "@/components/admin/ui";
import { AdminForm } from "@/components/admin/form";
import { resolveInquiry } from "@/lib/actions/admin/settings";
import { formatDate } from "@/lib/format";

export default async function AdminInquiries({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const t = adminT(locale);
  const supabase = await createClient();
  const { data } = await supabase.from("contact_inquiries").select("*").order("is_resolved").order("created_at", { ascending: false }).limit(200);
  return (
    <div>
      <PageHeader title={t("استفسارات العملاء", "Customer inquiries")} />
      <div className="space-y-3">
        {!data?.length && <Empty>—</Empty>}
        {(data ?? []).map((q) => (
          <div key={q.id} className="card-admin p-5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="font-semibold">{q.name} <span className="text-xs font-normal text-mute" dir="ltr">{q.phone} {q.email}</span></p>
              <div className="flex items-center gap-3">
                {q.is_resolved ? <Pill tone="good">{t("تمت المعالجة", "Resolved")}</Pill> : <Pill tone="warn">{t("جديد", "Open")}</Pill>}
                <AdminForm action={resolveInquiry}><input type="hidden" name="id" value={q.id} /><input type="hidden" name="resolved" value={q.is_resolved ? "0" : "1"} /><button className="text-xs underline">{q.is_resolved ? t("إعادة فتح", "Reopen") : t("تعليم كمعالج", "Mark resolved")}</button></AdminForm>
              </div>
            </div>
            <p className="mt-2 whitespace-pre-line text-sm">{q.message}</p>
            <p className="mt-2 text-xs text-mute">{formatDate(q.created_at, locale, true)}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
