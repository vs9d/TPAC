"use client";
import { useEffect, useState } from "react";
import { X, ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/format";

/** Photo grid with a full-screen viewer. Uses <img> because private photos come as signed URLs. */
export function ReviewPhotos({ photos, alt }: { photos: string[]; alt: string }) {
  const [open, setOpen] = useState<number | null>(null);
  useEffect(() => {
    if (open === null) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(null);
      if (e.key === "ArrowRight") setOpen((i) => (i! + 1) % photos.length);
      if (e.key === "ArrowLeft") setOpen((i) => (i! - 1 + photos.length) % photos.length);
    };
    window.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [open, photos.length]);
  if (!photos.length) return null;
  const [first, ...rest] = photos;
  return (
    <>
      <button onClick={() => setOpen(0)} className="block w-full overflow-hidden bg-bone" aria-label={alt}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={first} alt={alt} loading="lazy" className="max-h-[520px] w-full object-cover transition-transform duration-700 hover:scale-[1.02]" />
      </button>
      {rest.length > 0 && (
        <div className="grid grid-cols-3 gap-1 pt-1">
          {rest.map((src, i) => (
            <button key={src} onClick={() => setOpen(i + 1)} className="aspect-square overflow-hidden bg-bone" aria-label={`${alt} ${i + 2}`}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={src} alt="" loading="lazy" className="h-full w-full object-cover" />
            </button>
          ))}
        </div>
      )}
      {open !== null && (
        <div className="fixed inset-0 z-[95] flex items-center justify-center bg-ink/95 p-4" role="dialog" aria-modal="true" onClick={() => setOpen(null)}>
          <button className="absolute end-4 top-4 grid size-11 place-items-center text-paper" aria-label="close"><X className="size-6" /></button>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={photos[open]} alt={alt} className="max-h-[88dvh] max-w-full object-contain" onClick={(e) => e.stopPropagation()} />
          {photos.length > 1 && (
            <div className="absolute inset-x-0 bottom-6 flex items-center justify-center gap-4 text-paper" onClick={(e) => e.stopPropagation()}>
              <button onClick={() => setOpen((open - 1 + photos.length) % photos.length)} className="grid size-11 place-items-center border border-paper/30" aria-label="previous"><ChevronRight className="size-5 rtl:hidden" /><ChevronLeft className="hidden size-5 rtl:block" /></button>
              <span className="text-sm tabular-nums">{open + 1} / {photos.length}</span>
              <button onClick={() => setOpen((open + 1) % photos.length)} className="grid size-11 place-items-center border border-paper/30" aria-label="next"><ChevronLeft className="size-5 rtl:hidden" /><ChevronRight className="hidden size-5 rtl:block" /></button>
            </div>
          )}
          <span className={cn("sr-only")}>{open + 1}</span>
        </div>
      )}
    </>
  );
}
