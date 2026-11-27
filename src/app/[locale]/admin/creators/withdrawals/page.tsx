import Link from "next/link";
import { notFound } from "next/navigation";
import { isLocale } from "@/lib/i18n/config";
import { adminT } from "@/lib/admin-i18n";
import { createAdminClient } from "@/lib/supabase/admin";
import { PageHeader, Card, Pill, Empty } from "@/components/admin/ui";
import { AdminForm, Input, Submit } from "@/components/admin/form";
import { CreatorsTabs } from "@/components/admin/creators-tabs";
import { processWithdrawal } from "@/lib/actions/admin/creators";
import { creatorBalance } from "@/lib/creators";
import { creatorQueueCounts } from "@/lib/data/creators-admin";
import { formatDate, formatIQD, cn } from "@/lib/format";

const FILTERS = ["requested", "approved", "paid", "rejected"] as const;

export default async function AdminWithdrawals({ params, searchParams }: { params: Promise<{ locale: string }>; searchParams: Promise<{ status?: string }> }) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const t = adminT(locale);
  const sp = await searchParams;
  const status = (FILTERS as readonly string[]).includes(sp.status ?? "") ? sp.status! : "requested";
  const { data } = await createAdminClient().from("creator_withdrawals").select("*, creators(username, display_name)").eq("status", status).order("created_at", { ascending: status === "requested" }).limit(200);
  type Row = { id: string; creator_id: string; amount: number; method: string; account: string; status: string; admin_note: string | null; created_at: string; processed_at: string | null; creators: { username: string; display_name: string } };
  const rows = (data ?? []) as unknown as Row[];
  const balances = new Map(await Promise.all([...new Set(rows.map((r) => r.creator_id))].map(async (id) => [id, await creatorBalance(id)] as const)));
  const counts = await creatorQueueCounts().catch(() => undefined);
  const label: Record<string, string> = { requested: t("جديد", "New"), approved: t("موافق — بانتظار التحويل", "Approved — to transfer"), paid: t("تم التحويل", "Paid"), rejected: t("مرفوض", "Rejected") };
  return (
    <div className="space-y-6">
      <PageHeader title={t("طلبات سحب الأرباح", "Withdrawal requests")} subtitle={t("راجع الرصيد قبل التحويل. «تم التحويل» يخصم المبلغ نهائياً ويبلّغ المبدع.", "Check the balance before transferring. “Paid” settles it and tells the creator.")} />
      <CreatorsTabs locale={locale} active="withdrawals" counts={counts} />
      <nav className="flex flex-wrap gap-1 text-sm font-bold">{FILTERS.map((s) => <Link key={s} href={`/${locale}/admin/creators/withdrawals?status=${s}`} className={cn("rounded-full border px-4 py-2", status === s ? "border-ink bg-ink text-paper" : "border-line text-mute")}>{label[s]}</Link>)}</nav>
      {rows.length === 0 ? <Empty>{t("ماكو طلبات", "No requests")}</Empty> : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {rows.map((w) => { const b = balances.get(w.creator_id); return (
            <Card key={w.id} title={`${formatIQD(w.amount, locale)} — ${w.creators.display_name}`} actions={<Pill tone={w.status === "paid" ? "good" : w.status === "rejected" ? "neutral" : "warn"}>{label[w.status]}</Pill>}>
              <dl className="space-y-1 text-sm">
                <div className="flex justify-between"><dt className="text-mute">{t("المبدع", "Creator")}</dt><dd><Link className="underline" href={`/${locale}/admin/creators/${w.creator_id}`} dir="ltr">@{w.creators.username}</Link></dd></div>
                <div className="flex justify-between"><dt className="text-mute">{t("الطريقة", "Method")}</dt><dd>{w.method}</dd></div>
                <div className="flex justify-between gap-2"><dt className="text-mute">{t("الحساب", "Account")}</dt><dd className="font-semibold" dir="ltr">{w.account}</dd></div>
                <div className="flex justify-between"><dt className="text-mute">{t("التاريخ", "Date")}</dt><dd>{formatDate(w.created_at, locale, true)}</dd></div>
                {b && <div className="flex justify-between"><dt className="text-mute">{t("رصيده المكتمل", "Cleared balance")}</dt><dd className="tabular-nums">{formatIQD(b.available + b.requested, locale)}</dd></div>}
                {w.admin_note && <p className="text-xs text-mute">{w.admin_note}</p>}
              </dl>
              {(w.status === "requested" || w.status === "approved") && (
                <AdminForm action={processWithdrawal} className="mt-4 space-y-2">
                  <input type="hidden" name="id" value={w.id} />
                  <Input name="note" label={t("ملاحظة / رقم الحوالة", "Note / transfer ref")} />
                  <div className="flex flex-wrap gap-2">
                    {w.status === "requested" && <Submit variant="outline" name="action" value="approve">{t("موافقة", "Approve")}</Submit>}
                    <Submit variant="brand" name="action" value="paid">{t("تم التحويل", "Mark paid")}</Submit>
                    {w.status === "requested" && <Submit variant="danger" name="action" value="reject">{t("رفض", "Reject")}</Submit>}
                  </div>
                </AdminForm>
              )}
            </Card>
          ); })}
        </div>
      )}
    </div>
  );
}
