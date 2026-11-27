"use client";
import Image from "next/image";
import { AlertTriangle, Check, ImagePlus, Loader2, X } from "lucide-react";
import { useI18n } from "@/components/i18n-provider";
import { adminT } from "@/lib/admin-i18n";
import { formatIQD } from "@/lib/format";

export interface ReviewPieceView {
  front: string; back: string; sides: { src: string; label: string }[];
  colorName: string; colorHex?: string; sizes: Record<string, number>; placements: string[];
  unit: number; listUnit: number;
}

/** Last look before the design (or both pieces of a couple design) is saved and added to the bag. */
export function ReviewDialog({ pieces, reference, warnings, saving, garmentName, extras, pct, notice, onClose, onConfirm, onFix }: {
  pieces: ReviewPieceView[]; reference?: { urls: string[]; note: string }; warnings: string[];
 saving: boolean; garmentName: string; extras: string[]; pct: number; notice: string;
  onClose: () => void; onConfirm: () => void; onFix: () => void;
}) {
  const { locale } = useI18n();
  const t = adminT(locale);
  const qty = (p: ReviewPieceView) => Object.values(p.sizes).reduce((n, q) => n + q, 0);
  const total = pieces.reduce((n, p) => n + p.unit * qty(p), 0);
  const totalQty = pieces.reduce((n, p) => n + qty(p), 0);
  const couple = pieces.length > 1;
  return (
    <div className="fixed inset-0 z-[90] grid place-items-end bg-ink/50 sm:place-items-center" role="dialog" aria-modal="true" aria-label={t("مراجعة التصميم", "Review your design")}>
      <div className="absolute inset-0" onClick={saving ? undefined : onClose} />
      <div className="relative flex max-h-[94dvh] w-full max-w-3xl flex-col overflow-hidden rounded-t-[2rem] bg-paper shadow-2xl sm:rounded-[2rem]">
        <header className="flex items-center justify-between border-b border-line px-5 py-4">
          <h2 className="display text-xl">{couple ? t("راجعوا القطعتين قبل الإضافة 💞", "Review both pieces 💞") : t("راجع تصميمك قبل الإضافة", "Review before adding")}</h2>
          <button onClick={onClose} disabled={saving} className="grid size-9 place-items-center rounded-full hover:bg-bone" aria-label={t("إغلاق", "Close")}><X className="size-5" /></button>
        </header>
        <div className="flex-1 space-y-5 overflow-y-auto p-5">
          {pieces.map((p, i) => {
            const shots: [string, string][] = [[p.front, t("الأمام", "Front")], [p.back, t("الخلف", "Back")], ...p.sides.map((s) => [s.src, s.label] as [string, string])];
            const sizeText = Object.entries(p.sizes).filter(([, q]) => q > 0).map(([s, q]) => `${s} × ${q}`).join("  ·  ");
            return (
              <section key={i} className={couple ? "space-y-3 rounded-2xl border border-line p-3" : "space-y-5"} aria-label={couple ? t(`القطعة ${i + 1}`, `Piece ${i + 1}`) : undefined}>
                {couple && <p className="text-sm font-bold">{t(`القطعة ${i + 1}`, `Piece ${i + 1}`)}</p>}
                <div className={shots.length > 2 ? "grid grid-cols-2 gap-3 sm:grid-cols-4" : "grid grid-cols-2 gap-3"}>
                  {shots.map(([src, label]) => (
                    <figure key={label} className="overflow-hidden rounded-2xl bg-bone">
                      <div className="relative aspect-[6/7]"><Image src={src} alt={label} fill sizes="320px" className="object-contain" unoptimized /></div>
                      <figcaption className="py-1.5 text-center text-xs font-bold">{label}</figcaption>
                    </figure>
                  ))}
                </div>
                <dl className="grid gap-x-6 gap-y-2 text-sm sm:grid-cols-2">
                  <Item l={t("القطعة", "Garment")} v={<span className="inline-flex items-center gap-2">{garmentName} <span className="size-3.5 rounded-full border border-line" style={{ background: p.colorHex }} /> {p.colorName}</span>} />
                  <Item l={t("المقاسات", "Sizes")} v={sizeText} />
                  <Item l={t("أماكن الطباعة", "Placements")} v={p.placements.join("، ")} />
                  {!couple && <Item l={t("الخيارات", "Options")} v={extras.join(" · ") || "—"} />}
                </dl>
              </section>
            );
          })}
          {reference && (
            <section className="space-y-2 rounded-2xl border-2 border-amber/60 bg-amber/5 p-3" aria-label={t("طلبك حسب الصورة", "Your photo request")}>
              <p className="flex items-center gap-2 text-sm font-bold"><ImagePlus className="size-4 text-amber-deep" aria-hidden="true" /> {t("نصمّمها لك مثل هذه الصور", "We'll design it like these photos")}</p>
              <div className="flex flex-wrap gap-2">
                {reference.urls.map((u) => <div key={u} className="relative size-20 overflow-hidden rounded-xl bg-bone"><Image src={u} alt={t("صورتك المرجعية", "Your reference photo")} fill sizes="80px" className="object-cover" unoptimized /></div>)}
              </div>
              {reference.note && <p className="whitespace-pre-line text-sm">{reference.note}</p>}
              <p className="text-xs text-mute">{t("نتواصل وياك قبل الطباعة.", "We'll get in touch before printing.")}</p>
            </section>
          )}
          {couple && <dl className="text-sm"><Item l={t("الخيارات (للقطعتين)", "Options (both pieces)")} v={extras.join(" · ") || "—"} /></dl>}
          {warnings.length > 0 && (
            <div className="space-y-1.5 rounded-2xl border border-amber/60 bg-amber/10 p-4">
              {warnings.map((w) => <p key={w} className="flex items-start gap-2 text-sm"><AlertTriangle className="mt-0.5 size-4 shrink-0 text-amber-deep" /> {w}</p>)}
              <button onClick={onFix} className="text-xs font-bold underline">{t("العودة للتعديل", "Go back and fix")}</button>
            </div>
          )}
          <p className="rounded-2xl bg-bone p-4 text-xs leading-relaxed text-mute">{notice}</p>
        </div>
        <footer className="flex items-center gap-3 border-t border-line bg-paper px-5 py-4">
          <div className="shrink-0">
            <p className="text-[11px] text-mute">
              {couple ? t(`${totalQty} قطع`, `${totalQty} pcs`) : <>{totalQty} × {formatIQD(pieces[0]!.unit, locale)}{pct > 0 && <span className="ms-1 line-through">{formatIQD(pieces[0]!.listUnit, locale)}</span>}</>}
            </p>
            <p className="display text-xl tabular-nums">{formatIQD(total, locale)}</p>
          </div>
          <button onClick={onConfirm} disabled={saving} className="btn btn-brand h-12 flex-1 text-base">
            {saving ? <><Loader2 className="size-4 animate-spin" /> {t("جاري الحفظ…", "Saving…")}</> : <><Check className="size-4" /> {couple ? t("تأكيد وإضافة القطعتين", "Confirm & add both") : t("تأكيد وإضافة للسلة", "Confirm & add to bag")}</>}
          </button>
        </footer>
      </div>
    </div>
  );
}

function Item({ l, v }: { l: string; v: React.ReactNode }) {
  return <div><dt className="text-xs font-semibold text-mute">{l}</dt><dd className="font-semibold">{v}</dd></div>;
}
