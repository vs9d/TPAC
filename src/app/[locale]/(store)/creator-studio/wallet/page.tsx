import { notFound } from "next/navigation";
import { isLocale } from "@/lib/i18n/config";
import { getMyCreator, creatorBalance, getCreatorSettings } from "@/lib/creators";
import { createAdminClient } from "@/lib/supabase/admin";
import { WithdrawForm } from "@/components/creators/withdraw-form";
import { formatDate, formatIQD, cn } from "@/lib/format";

const WD: Record<string, [string, string, string]> = { requested: ["قيد المراجعة", "In review", "bg-amber/20"], approved: ["موافق عليه — قيد التحويل", "Approved — transferring", "bg-amber/20"], paid: ["تم التحويل ✓", "Paid ✓", "bg-pine-soft text-pine"], rejected: ["مرفوض", "Rejected", "bg-danger/10 text-danger"] };

export default async function CreatorWallet({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const ar = locale === "ar";
  const me = (await getMyCreator())!;
  const [b, s, { data: wds }] = await Promise.all([creatorBalance(me.user_id), getCreatorSettings(), createAdminClient().from("creator_withdrawals").select("*").eq("creator_id", me.user_id).order("created_at", { ascending: false })]);
  const money = (n: number) => formatIQD(n, locale);
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {[[ar ? "متاح للسحب" : "Available", b.available, "border-pine bg-pine-soft/40"], [ar ? "معلّق (طلب ما اكتمل)" : "Pending (order open)", b.pending, ""], [ar ? `بفترة الإرجاع (${s.hold_days} أيام)` : `In return window (${s.hold_days} days)`, b.cleared_waiting, ""], [ar ? "تم سحبه" : "Paid out", b.withdrawn, ""]].map(([l, v, cls]) => (
          <div key={String(l)} className={cn("rounded-[1.25rem] border border-line bg-paper p-4", String(cls))}><p className="text-xs font-semibold text-mute">{String(l)}</p><p className="display mt-1 text-2xl tabular-nums">{money(Number(v))}</p></div>
        ))}
      </div>
      <section className="space-y-3 rounded-[1.5rem] border border-line bg-paper p-5">
        <h2 className="font-bold">{ar ? "سحب الأرباح" : "Withdraw"}</h2>
        {b.requested > 0 && <p className="text-sm text-mute">{ar ? `عندك ${money(b.requested)} بطلبات سحب قيد المعالجة.` : `${money(b.requested)} is in withdrawal requests being processed.`}</p>}
        <WithdrawForm available={b.available} min={s.min_withdrawal} methods={s.payout_methods} />
      </section>
      <section className="space-y-3">
        <h2 className="font-bold">{ar ? "سجل السحب" : "Withdrawal history"}</h2>
        {(wds ?? []).length === 0 ? <p className="text-sm text-mute">—</p> : (
          <ul className="divide-y divide-line rounded-[1.5rem] border border-line bg-paper">
            {((wds ?? []) as { id: string; amount: number; method: string; status: string; created_at: string; admin_note: string | null }[]).map((w) => { const st = WD[w.status] ?? WD.requested!; return (
              <li key={w.id} className="flex flex-wrap items-center justify-between gap-2 p-4 text-sm">
                <span><b className="tabular-nums">{money(w.amount)}</b> · {w.method} · <span className="text-mute">{formatDate(w.created_at, locale)}</span>{w.admin_note && <span className="block text-xs text-mute">{w.admin_note}</span>}</span>
                <span className={cn("rounded-full px-2.5 py-1 text-xs font-bold", st[2])}>{ar ? st[0] : st[1]}</span>
              </li>
            ); })}
          </ul>
        )}
      </section>
    </div>
  );
}
