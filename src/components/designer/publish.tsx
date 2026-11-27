"use client";
import { useState } from "react";
import Image from "next/image";
import { Loader2, Sparkles, X } from "lucide-react";
import { useI18n } from "@/components/i18n-provider";
import { adminT } from "@/lib/admin-i18n";

export interface PublishForm { title: string; name: string; phone: string }

/** Sends the design to the community page on its own — nothing is added to the bag. */
export function PublishDialog({ front, back, onClose, onSubmit }: { front: string; back: string; onClose: () => void; onSubmit: (f: PublishForm) => Promise<boolean> }) {
  const { locale } = useI18n();
  const t = adminT(locale);
  const [f, setF] = useState<PublishForm>({ title: "", name: "", phone: "" });
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const ok = f.title.trim().length >= 2 && f.name.trim().length >= 2;
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!ok) return;
    setBusy(true);
    try {
      if (await onSubmit(f)) setDone(true);
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="fixed inset-0 z-[90] grid place-items-end bg-ink/50 sm:place-items-center" role="dialog" aria-modal="true" aria-label={t("انشر تصميمك", "Publish your design")}>
      <div className="absolute inset-0" onClick={busy ? undefined : onClose} />
      <form onSubmit={submit} className="relative max-h-[94dvh] w-full max-w-lg space-y-4 overflow-y-auto rounded-t-[2rem] bg-paper p-5 shadow-2xl sm:rounded-[2rem]">
        <header className="flex items-start justify-between gap-3">
          <div>
            <h2 className="display flex items-center gap-2 text-xl"><Sparkles className="size-5 text-amber-deep" aria-hidden="true" /> {t("انشر تصميمك", "Publish your design")}</h2>
            <p className="mt-1 text-sm text-mute">{t("يروح لصفحة «تصاميم الزبائن» بعد موافقتنا. الناس تكدر تطلبه، وأنت تاخذ مكافأة على كل قطعة تنباع منه. هذا منفصل عن طلبك — ما ينضاف شي للسلة.", "It goes to “Customer designs” once we approve it. Others can order it and you get a reward for every piece sold. This is separate from ordering — nothing goes in your bag.")}</p>
          </div>
          <button type="button" onClick={onClose} disabled={busy} className="grid size-11 shrink-0 place-items-center rounded-full hover:bg-bone" aria-label={t("إغلاق", "Close")}><X className="size-5" /></button>
        </header>
        <div className="grid grid-cols-2 gap-2">
          {[[front, t("الأمام", "Front")], [back, t("الخلف", "Back")]].map(([src, label]) => (
            <figure key={label} className="overflow-hidden rounded-2xl bg-bone">
              <div className="relative aspect-[6/7]"><Image src={src!} alt={label!} fill sizes="240px" className="object-contain" unoptimized /></div>
              <figcaption className="py-1 text-center text-xs font-bold">{label}</figcaption>
            </figure>
          ))}
        </div>
        {done ? (
          <p className="rounded-2xl bg-pine-soft p-4 text-sm font-semibold text-pine" role="status">{t("وصل تصميمك ✓ يظهر بالصفحة بعد ما نوافق عليه. تكدر تكمل تصميمك أو تطلبه عادي.", "Sent ✓ It appears on the page once we approve it. You can keep designing or order it as usual.")}</p>
        ) : (
          <>
            <label className="block"><span className="mb-1.5 block text-sm font-semibold">{t("اسم التصميم", "Design title")}</span><input className="field w-full" maxLength={60} value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} required /></label>
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="block"><span className="mb-1.5 block text-sm font-semibold">{t("اسمك (يظهر للناس)", "Your name (shown)")}</span><input className="field w-full" maxLength={60} value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} autoComplete="name" required /></label>
              <label className="block"><span className="mb-1.5 block text-sm font-semibold">{t("رقمك للمكافأة (مخفي)", "Phone for rewards (private)")}</span><input className="field w-full" inputMode="tel" dir="ltr" value={f.phone} onChange={(e) => setF({ ...f, phone: e.target.value })} autoComplete="tel" placeholder="07XX XXX XXXX" /></label>
            </div>
            <p className="text-xs text-mute">{t("انشر بس تصاميمك أنت: بدون شعارات ماركات أو صور أشخاص بدون إذنهم.", "Only publish your own work: no brand logos or photos of people without their consent.")}</p>
            <button type="submit" disabled={!ok || busy} className="btn btn-brand h-12 w-full text-base">{busy ? <Loader2 className="size-5 animate-spin" /> : <Sparkles className="size-5" />} {t("إرسال للنشر", "Send for publishing")}</button>
          </>
        )}
      </form>
    </div>
  );
}
