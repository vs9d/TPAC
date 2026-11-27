"use client";
import { useState, useTransition } from "react";
import { cn } from "@/lib/format";
import { useRouter } from "next/navigation";
import { Check, Copy, Lock, LockOpen, Loader2, MessageCircle, Send, Trash2 } from "lucide-react";
import { useI18n } from "@/components/i18n-provider";
import { toast } from "@/components/ui/toast";
import { removeGroupMember, setGroupOpen, submitGroupOrder } from "@/lib/actions/group";
import type { GroupMember, GroupOrder } from "@/lib/data/group";
import { PLACEMENT_LABEL, type GroupPlacement, type PreviewKit } from "@/lib/group-template";
import { GroupPieceView } from "./preview";

/** The organiser's page: the link to share, who joined with which size, and sending it to TPAC. */
export function GroupManage({ token, group, members, requestNumber, kit, fixed, memberArt }: {
  token: string; group: GroupOrder; members: GroupMember[]; requestNumber: string | null;
  kit: PreviewKit | null; fixed: Partial<Record<GroupPlacement, string>>; memberArt: Record<string, string>;
}) {
  const { locale, dict } = useI18n();
  const ar = locale === "ar";
  const router = useRouter();
  const [pending, start] = useTransition();
  const [busy, setBusy] = useState<string | null>(null);
  const link = typeof window !== "undefined" ? `${window.location.origin}/${locale}/group/${group.code}` : `/${locale}/group/${group.code}`;
  const msg = ar ? `سجّل اسمك وقياسك لطلب «${group.title}» 👕\n${link}` : `Add your name and size for “${group.title}” 👕\n${link}`;
  const total = members.reduce((n, m) => n + m.quantity, 0);
  const bySize = members.reduce<Record<string, number>>((acc, m) => ({ ...acc, [m.size_code]: (acc[m.size_code] ?? 0) + m.quantity }), {});
  const submitted = group.status === "submitted";
  const kind = group.template.member.kind;
  const where = PLACEMENT_LABEL[group.template.member.placement][ar ? 0 : 1];
  const [peek, setPeek] = useState<GroupMember | null>(members[0] ?? null);

  const run = (key: string, fn: () => Promise<{ ok: boolean; error?: string }>, okMsg?: string) => {
    setBusy(key);
    start(async () => {
      const r = await fn();
      setBusy(null);
      if (!r.ok) {
        toast.error(r.error === "empty" ? (ar ? "ما أحد سجّل بعد" : "Nobody has joined yet") : r.error === "already" ? (ar ? "انرسل من قبل" : "Already sent") : dict.common.somethingWrong);
        return;
      }
      if (okMsg) toast.success(okMsg);
      router.refresh();
    });
  };

  return (
    <div className="space-y-6">
      {!submitted && (
        <section className="space-y-3 rounded-[1.5rem] border border-line bg-paper p-5" aria-label={ar ? "رابط المجموعة" : "Group link"}>
          <h2 className="font-bold">{ar ? "دز هذا الرابط بالكروب" : "Send this link to the group"}</h2>
          <input readOnly value={link} dir="ltr" onFocus={(e) => e.currentTarget.select()} className="field w-full text-sm" aria-label={ar ? "رابط المجموعة" : "Group link"} />
          <div className="grid grid-cols-2 gap-2">
            <button type="button" className="btn btn-outline h-11" onClick={() => navigator.clipboard.writeText(link).then(() => toast.success(ar ? "انسخ الرابط" : "Link copied"), () => undefined)}><Copy className="size-4" /> {ar ? "نسخ" : "Copy"}</button>
            <a className="btn btn-brand h-11" href={`https://wa.me/?text=${encodeURIComponent(msg)}`} target="_blank" rel="noopener noreferrer"><MessageCircle className="size-4" /> {ar ? "واتساب" : "WhatsApp"}</a>
          </div>
          <p className="text-xs text-mute">{ar ? "احفظ رابط هالصفحة عندك — منه تشوف القائمة وترسلها. لا تدزه للكروب." : "Keep this page's address — it's how you see and send the list. Don't share it with the group."}</p>
        </section>
      )}

      {submitted && (
        <p className="flex items-start gap-2 rounded-2xl bg-pine-soft px-4 py-3 text-sm font-semibold text-pine" role="status">
          <Check className="mt-0.5 size-5 shrink-0" /> {ar ? `انرسل الطلب لـ TPAC${requestNumber ? ` (رقم ${requestNumber})` : ""}. نتواصل وياك بالسعر والتفاصيل.` : `Sent to TPAC${requestNumber ? ` (no. ${requestNumber})` : ""}. We'll contact you with the price and details.`}
        </p>
      )}

      {kit && (
        <section className="space-y-3 rounded-[1.5rem] border border-line bg-paper p-5" aria-label={ar ? "القطعة" : "The piece"}>
          <h2 className="font-bold">{ar ? "القطعة" : "The piece"}{kind !== "none" && <span className="ms-2 text-sm font-normal text-mute">{ar ? `· كل واحد يضيف ${kind === "name" ? "اسمه" : "تصميمه"} على ${where}` : `· everyone adds their ${kind === "name" ? "name" : "design"} on the ${where.toLowerCase()}`}</span>}</h2>
          <div className="grid grid-cols-2 gap-3">
            {(["front", "back"] as const).map((v) => (
              <GroupPieceView key={v} kit={kit} colorId={group.color_id} view={v} fixed={fixed} template={group.template} member={{ name: peek?.print_name ?? "", image: peek?.artwork_id ? memberArt[peek.artwork_id] : null }} label={`${v === "front" ? (ar ? "الأمام" : "Front") : ar ? "الخلف" : "Back"}${peek ? ` — ${peek.name}` : ""}`} />
            ))}
          </div>
          {members.length > 0 && <p className="text-xs text-mute">{ar ? "اضغط على أي اسم بالقائمة حتى تشوف قطعته." : "Tap a name in the list to see their piece."}</p>}
        </section>
      )}

      <section className="rounded-[1.5rem] border border-line bg-paper p-5">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="font-bold">{ar ? "اللي سجّلوا" : "Who joined"}</h2>
            <p className="text-sm text-mute">{ar ? `${members.length} شخص · ${total} قطعة` : `${members.length} people · ${total} pieces`}</p>
          </div>
          {Object.keys(bySize).length > 0 && (
            <ul className="flex flex-wrap gap-1.5 text-xs font-bold" aria-label={ar ? "مجموع القياسات" : "Size totals"}>
              {Object.entries(bySize).map(([s, n]) => <li key={s} className="rounded-full bg-bone px-3 py-1.5">{s} × {n}</li>)}
            </ul>
          )}
        </div>
        {members.length === 0 ? (
          <p className="mt-4 rounded-2xl bg-bone p-4 text-center text-sm text-mute">{ar ? "ما أحد سجّل بعد — دز الرابط بالكروب." : "Nobody yet — send the link to the group."}</p>
        ) : (
          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[420px] text-sm">
              <thead><tr className="border-b border-line text-start text-xs text-mute"><th className="py-2 text-start">#</th><th className="py-2 text-start">{ar ? "الاسم" : "Name"}</th><th className="py-2 text-start">{ar ? "القياس" : "Size"}</th>{kind !== "none" && <th className="py-2 text-start">{kind === "name" ? (ar ? `ينطبع على ${where}` : `Printed on ${where.toLowerCase()}`) : ar ? "تصميمه" : "Design"}</th>}<th /></tr></thead>
              <tbody>
                {members.map((m, i) => (
                  <tr key={m.id} className="border-b border-line/60">
                    <td className="py-2 tabular-nums text-mute">{i + 1}</td>
                    <td className="py-2 font-semibold"><button type="button" onClick={() => setPeek(m)} className={cn("text-start underline-offset-4 hover:underline", peek?.id === m.id && "text-pine")}>{m.name}</button>{m.note && <span className="block text-xs font-normal text-mute">{m.note}</span>}</td>
                    <td className="py-2">{m.size_code}{m.quantity > 1 && ` × ${m.quantity}`}</td>
                    {kind === "name" && <td className="py-2" dir="auto">{m.print_name ?? "—"}</td>}
                    {kind === "design" && <td className="py-2">{m.artwork_id && memberArt[m.artwork_id] ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <a href={memberArt[m.artwork_id]} target="_blank" rel="noopener noreferrer"><img src={memberArt[m.artwork_id]} alt={ar ? `تصميم ${m.name}` : `${m.name}'s design`} className="size-10 rounded-lg bg-bone object-contain" /></a>
                    ) : "—"}</td>}
                    <td className="py-2 text-end">
                      {!submitted && (
                        <button type="button" className="grid size-10 place-items-center rounded-full hover:bg-bone" aria-label={ar ? `حذف ${m.name}` : `Remove ${m.name}`} disabled={pending}
                          onClick={() => { if (confirm(ar ? `تحذف ${m.name}؟` : `Remove ${m.name}?`)) run(`del-${m.id}`, () => removeGroupMember(token, m.id)); }}>
                          {busy === `del-${m.id}` ? <Loader2 className="size-4 animate-spin" /> : <Trash2 className="size-4" />}
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {!submitted && (
        <div className="grid gap-2 sm:grid-cols-2">
          <button type="button" className="btn btn-outline h-12" disabled={pending} onClick={() => run("lock", () => setGroupOpen(token, group.status !== "open"), group.status === "open" ? (ar ? "انقفل التسجيل" : "Closed") : (ar ? "انفتح التسجيل" : "Reopened"))}>
            {group.status === "open" ? <><Lock className="size-4" /> {ar ? "اقفل التسجيل" : "Close the list"}</> : <><LockOpen className="size-4" /> {ar ? "افتح التسجيل" : "Reopen the list"}</>}
          </button>
          <button type="button" className="btn btn-brand h-12" disabled={pending || members.length === 0}
            onClick={() => { if (confirm(ar ? `ترسل الطلب (${total} قطعة) لـ TPAC؟ بعدها ما ينضاف أحد.` : `Send the order (${total} pieces) to TPAC? Nobody can join after that.`)) run("send", () => submitGroupOrder(token), ar ? "انرسل الطلب ✓" : "Sent ✓"); }}>
            {busy === "send" ? <Loader2 className="size-5 animate-spin" /> : <Send className="size-5" />} {ar ? "إرسال الطلب لـ TPAC" : "Send the order to TPAC"}
          </button>
        </div>
      )}
    </div>
  );
}
