"use client";
import { useCallback, useEffect, useState } from "react";
import { ChevronLeft, ChevronRight, X } from "lucide-react";
import { useI18n } from "@/components/i18n-provider";
import { cn } from "@/lib/format";

/** Responsive photo grid with a full-screen viewer (swipe/arrow keys). */
export function Gallery({ photos, title }: { photos: { url: string }[]; title: string }) {
  const { locale } = useI18n();
  const [open, setOpen] = useState<number | null>(null);
  const go = useCallback((d: number) => setOpen((i) => (i === null ? i : (i + d + photos.length) % photos.length)), [photos.length]);
  useEffect(() => {
    if (open === null) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(null);
      if (e.key === "ArrowRight") go(locale === "ar" ? -1 : 1);
      if (e.key === "ArrowLeft") go(locale === "ar" ? 1 : -1);
    };
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => { document.removeEventListener("keydown", onKey); document.body.style.overflow = ""; };
  }, [open, go, locale]);
  const [touch, setTouch] = useState<number | null>(null);
  return (
    <>
      <ul className="grid grid-cols-2 gap-2 md:grid-cols-3 md:gap-3">
        {photos.map((p, i) => (
          <li key={p.url} className={cn(i === 0 && photos.length > 2 && "col-span-2 row-span-2")}>
            <button type="button" onClick={() => setOpen(i)} className="group block size-full overflow-hidden rounded-2xl bg-bone" aria-label={`${title} — ${i + 1}`}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={p.url} alt={`${title} — ${i + 1}`} loading={i < 3 ? "eager" : "lazy"} className="aspect-square size-full object-cover transition duration-500 group-hover:scale-105" />
            </button>
          </li>
        ))}
      </ul>
      {open !== null && (
        <div role="dialog" aria-modal="true" aria-label={title} className="fixed inset-0 z-[80] flex items-center justify-center bg-black/90 p-4"
          onClick={() => setOpen(null)}
          onTouchStart={(e) => setTouch(e.touches[0]!.clientX)}
          onTouchEnd={(e) => { if (touch === null) return; const dx = e.changedTouches[0]!.clientX - touch; if (Math.abs(dx) > 50) go(dx < 0 === (locale !== "ar") ? 1 : -1); setTouch(null); }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={photos[open]!.url} alt={`${title} — ${open + 1}`} className="max-h-full max-w-full rounded-xl object-contain" onClick={(e) => e.stopPropagation()} />
          <button type="button" onClick={() => setOpen(null)} className="absolute end-4 top-4 grid size-11 place-items-center rounded-full bg-white/15 text-white" aria-label={locale === "ar" ? "إغلاق" : "Close"}><X className="size-5" /></button>
          {photos.length > 1 && <>
            <button type="button" onClick={(e) => { e.stopPropagation(); go(-1); }} className="absolute start-3 top-1/2 grid size-11 -translate-y-1/2 place-items-center rounded-full bg-white/15 text-white" aria-label={locale === "ar" ? "السابقة" : "Previous"}>{locale === "ar" ? <ChevronRight className="size-6" /> : <ChevronLeft className="size-6" />}</button>
            <button type="button" onClick={(e) => { e.stopPropagation(); go(1); }} className="absolute end-3 top-1/2 grid size-11 -translate-y-1/2 place-items-center rounded-full bg-white/15 text-white" aria-label={locale === "ar" ? "التالية" : "Next"}>{locale === "ar" ? <ChevronLeft className="size-6" /> : <ChevronRight className="size-6" />}</button>
            <span className="absolute bottom-4 left-1/2 -translate-x-1/2 rounded-full bg-white/15 px-3 py-1 text-sm text-white tabular-nums">{open + 1} / {photos.length}</span>
          </>}
        </div>
      )}
    </>
  );
}
