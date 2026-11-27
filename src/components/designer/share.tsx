"use client";
import { useState } from "react";
import { Check, Copy, HeartHandshake, Loader2, MessageCircle, X } from "lucide-react";
import { useI18n } from "@/components/i18n-provider";
import { toast } from "@/components/ui/toast";
import { adminT } from "@/lib/admin-i18n";
import { cn } from "@/lib/format";

/** The link the owner sends so their partner designs the second piece. */
export function ShareDialog({ href, onClose }: { href: string; onClose: () => void }) {
  const { locale } = useI18n();
  const t = adminT(locale);
  const [copied, setCopied] = useState(false);
  const msg = t(`صمّم القطعة الثانية من هوديات المرتبطين وياي 💞\n${href}`, `Design the second piece of our couple hoodies with me 💞\n${href}`);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(href);
      setCopied(true);
      toast.success(t("انسخ الرابط", "Link copied"));
    } catch {
      toast.error(t("انسخه يدوياً من المربع", "Copy it from the box"));
    }
  };
  return (
    <div className="fixed inset-0 z-[90] grid place-items-end bg-ink/50 sm:place-items-center" role="dialog" aria-modal="true" aria-label={t("صمّموا سوا", "Design it together")}>
      <div className="absolute inset-0" onClick={onClose} />
      <div className="relative w-full max-w-md space-y-4 rounded-t-[2rem] bg-paper p-5 shadow-2xl sm:rounded-[2rem]">
        <header className="flex items-start justify-between gap-3">
          <div>
            <h2 className="display flex items-center gap-2 text-xl"><HeartHandshake className="size-6 text-pine" aria-hidden="true" /> {t("صمّموا سوا", "Design it together")}</h2>
            <p className="mt-1 text-sm text-mute">{t("دز الرابط لشريكك: يفتح القطعة 2 ويصمّمها من جهازه ويرسلها. أول ما يرسلها تطلع عندك هنا وتكمل الطلب.", "Send the link to your partner: they open piece 2, design it on their phone and send it back. It shows up here and you finish the order.")}</p>
          </div>
          <button onClick={onClose} className="grid size-11 shrink-0 place-items-center rounded-full hover:bg-bone" aria-label={t("إغلاق", "Close")}><X className="size-5" /></button>
        </header>
        <label className="block">
          <span className="sr-only">{t("رابط شريكك", "Your partner's link")}</span>
          <input readOnly value={href} dir="ltr" onFocus={(e) => e.currentTarget.select()} className="field w-full text-sm" />
        </label>
        <div className="grid grid-cols-2 gap-2">
          <button type="button" onClick={() => void copy()} className="btn btn-outline h-12">{copied ? <Check className="size-4" /> : <Copy className="size-4" />} {t("نسخ الرابط", "Copy link")}</button>
          <a href={`https://wa.me/?text=${encodeURIComponent(msg)}`} target="_blank" rel="noopener noreferrer" className="btn btn-brand h-12"><MessageCircle className="size-4" /> {t("واتساب", "WhatsApp")}</a>
        </div>
        <p className="text-xs text-mute">{t("الرابط يبقى ٣٠ يوم. تكدر ترجع لتصميمك من نفس عنوان هالصفحة.", "The link lasts 30 days. You can come back to your design from this page's address.")}</p>
      </div>
    </div>
  );
}

/** Tells each side where the shared design stands. */
export function ShareBanner({ role, fromName, partnerDone, sent, onOpen }: { role: "owner" | "partner"; fromName: string | null; partnerDone: boolean; sent: boolean; onOpen: () => void }) {
  const { locale } = useI18n();
  const t = adminT(locale);
  if (role === "partner") {
    return (
      <p className={cn("flex items-start gap-2 rounded-2xl px-4 py-3 text-sm", sent ? "bg-pine-soft text-pine" : "bg-amber/15")} role="status">
        <HeartHandshake className="mt-0.5 size-5 shrink-0" aria-hidden="true" />
        {sent
          ? t("وصل تصميمك! شريكك يشوفه هسه ويكمل الطلب. تكدر تعدّل وترسل مرة ثانية.", "Sent! Your partner sees it now and finishes the order. You can still change it and send again.")
          : t(`${fromName ? `${fromName} يريدك` : "شريكك يريدك"} تصمّم القطعة 2. صمّمها واضغط «إرسال التصميم لشريكك».`, `${fromName ?? "Your partner"} wants you to design piece 2. Design it, then press “Send to your partner”.`)}
      </p>
    );
  }
  return (
    <div className={cn("flex items-center gap-3 rounded-2xl px-4 py-3 text-sm", partnerDone ? "bg-pine-soft text-pine" : "bg-bone")} role="status">
      {partnerDone ? <Check className="size-5 shrink-0" aria-hidden="true" /> : <Loader2 className="size-5 shrink-0 animate-spin text-mute" aria-hidden="true" />}
      <span className="flex-1">{partnerDone ? t("وصل تصميم شريكك للقطعة 2 — شوفه وكمل الطلب.", "Your partner's piece 2 is here — have a look and finish the order.") : t("بانتظار شريكك يصمّم القطعة 2…", "Waiting for your partner to design piece 2…")}</span>
      <button type="button" onClick={onOpen} className="shrink-0 text-xs font-bold underline">{t("الرابط", "Link")}</button>
    </div>
  );
}
