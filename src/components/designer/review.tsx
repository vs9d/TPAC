"use client";
import Image from "next/image";
import { AlertTriangle, Check, Loader2, X } from "lucide-react";
import { useI18n } from "@/components/i18n-provider";
import { adminT } from "@/lib/admin-i18n";
import { formatIQD } from "@/lib/format";

/** Last look before the design is saved and added to the bag: previews, spec, warnings and the printing notice. */
export function ReviewDialog({ front, back, sides = [], warnings, saving, garmentName, colorName, colorHex, sizes, placements, extras, unit, listUnit, pct, totalQty, notice, onClose, onConfirm, onFix }: {
  front: string; back: string; sides?: string[]; warnings: string[]; saving: boolean; garmentName: string; colorName: string; colorHex?: string;
  sizes: Record<string, number>; placements: string[]; extras: string[]; unit: number; listUnit: number; pct: number; totalQty: number; notice: string;
  onClose: () => void; onConfirm: () => void; onFix: () => void;
}) {
  const { locale } = useI18n();
  const t = adminT(locale);
  const sizeText = Object.entries(sizes).filter(([, q]) => q > 0).map(([s, q]) => `${s} × ${q}`).join("  ·  ");
  return (
    <div className="fixed inset-0 z-[90] grid place-items-end bg-ink/50 sm:place-items-center" role="dialog" aria-modal="true" aria-label={t("مراجعة التصميم", "Review your design")}>
      <div className="absolute inset-0" onClick={saving ? undefined : onClose} />
      <div className="relative flex max-h-[94dvh] w-full max-w-3xl flex-col overflow-hidden rounded-t-[2rem] bg-paper shadow-2xl sm:rounded-[2rem]">
        <header className="flex items-center justify-between border-b border-line px-5 py-4">
          <h2 className="display text-xl">{t("راجع تصميمك قبل الإضافة", "Review before adding")}</h2>
          <button onClick={onClose} disabled={saving} className="grid size-9 place-items-center rounded-full hover:bg-bone" aria-label={t("إغلاق", "Close")}><X className="size-5" /></button>
        </header>
        <div className="flex-1 space-y-5 overflow-y-auto p-5">
          <div className={sides.length ? "grid grid-cols-2 gap-3 sm:grid-cols-4" : "grid grid-cols-2 gap-3"}>
            {[[front, t("الأمام", "Front")], [back, t("الخلف", "Back")], ...sides.map((src, i) => [src, sides.length === 2 ? (i ? t("الكم الأيسر", "Left sleeve") : t("الكم الأيمن", "Right sleeve")) : t("الكم", "Sleeve")])].map(([src, label]) => (
              <figure key={label} className="overflow-hidden rounded-2xl bg-bone">
                <div className="relative aspect-[6/7]"><Image src={src!} alt={label!} fill sizes="320px" className="object-contain" unoptimized /></div>
                <figcaption className="py-1.5 text-center text-xs font-bold">{label}</figcaption>
              </figure>
            ))}
          </div>
          <dl className="grid gap-x-6 gap-y-2 text-sm sm:grid-cols-2">
            <Item l={t("القطعة", "Garment")} v={<span className="inline-flex items-center gap-2">{garmentName} <span className="size-3.5 rounded-full border border-line" style={{ background: colorHex }} /> {colorName}</span>} />
            <Item l={t("المقاسات", "Sizes")} v={sizeText} />
            <Item l={t("أماكن الطباعة", "Placements")} v={placements.join("، ")} />
            <Item l={t("الخيارات", "Options")} v={extras.join(" · ") || "—"} />
          </dl>
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
            <p className="text-[11px] text-mute">{totalQty} × {formatIQD(unit, locale)}{pct > 0 && <span className="ms-1 line-through">{formatIQD(listUnit, locale)}</span>}</p>
            <p className="display text-xl tabular-nums">{formatIQD(unit * totalQty, locale)}</p>
          </div>
          <button onClick={onConfirm} disabled={saving} className="btn btn-brand h-12 flex-1 text-base">
            {saving ? <><Loader2 className="size-4 animate-spin" /> {t("جاري الحفظ…", "Saving…")}</> : <><Check className="size-4" /> {t("تأكيد وإضافة للسلة", "Confirm & add to bag")}</>}
          </button>
        </footer>
      </div>
    </div>
  );
}

function Item({ l, v }: { l: string; v: React.ReactNode }) {
  return <div><dt className="text-xs font-semibold text-mute">{l}</dt><dd className="font-semibold">{v}</dd></div>;
}
