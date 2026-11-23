"use client";
import { useEffect, useRef, useState } from "react";
import { ArrowLeft, ArrowRight, ImagePlus, Loader2, Star, X } from "lucide-react";
import { useI18n } from "@/components/i18n-provider";
import { adminT } from "@/lib/admin-i18n";
import { toast } from "@/components/ui/toast";
import { uploadProductImage } from "@/lib/admin-upload";
import { toWebImage } from "@/components/admin/image-field";

type Photo = { url: string; path?: string | null };

/** Several project photos from the phone's library: upload, reorder (first = cover), remove. Submits `photos_json`. */
export function PhotosField({ initial = [], max = 24 }: { initial?: Photo[]; max?: number }) {
  const { locale } = useI18n();
  const t = adminT(locale);
  const [photos, setPhotos] = useState<Photo[]>(initial);
  const [busy, setBusy] = useState(0);
  const input = useRef<HTMLInputElement>(null);
  const hidden = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const form = hidden.current?.form;
    if (!form) return;
    const onReset = () => setPhotos(initial);
    form.addEventListener("reset", onReset);
    return () => form.removeEventListener("reset", onReset);
  }, [initial]);

  const onFiles = async (list: FileList | null) => {
    const files = Array.from(list ?? []).filter((f) => f.type.startsWith("image/") || /\.(heic|heif)$/i.test(f.name)).slice(0, max - photos.length);
    if (!files.length) return;
    setBusy(files.length);
    for (const f of files) {
      try {
        const blob = await toWebImage(f, 2000);
        const up = await uploadProductImage(blob, `portfolio/${crypto.randomUUID()}.jpg`, "image/jpeg");
        setPhotos((p) => [...p, { url: up.url, path: up.path }]);
      } catch (e) {
        console.error(e);
        toast.error(t(`تعذّر رفع ${f.name}`, `Couldn't upload ${f.name}`));
      } finally {
        setBusy((n) => n - 1);
      }
    }
  };
  const move = (i: number, d: number) => setPhotos((p) => {
    const j = i + d;
    if (j < 0 || j >= p.length) return p;
    const n = [...p];
    [n[i], n[j]] = [n[j]!, n[i]!];
    return n;
  });
  const Prev = locale === "ar" ? ArrowRight : ArrowLeft;
  const Next = locale === "ar" ? ArrowLeft : ArrowRight;

  return (
    <div className="space-y-2">
      <span className="block text-xs font-semibold text-mute">{t("صور المشروع", "Project photos")} ({photos.length}/{max}) — {t("الأولى هي الغلاف", "the first is the cover")}</span>
      <input ref={hidden} type="hidden" name="photos_json" value={JSON.stringify(photos)} />
      <input ref={input} type="file" accept="image/*" multiple className="sr-only" aria-label={t("صور المشروع", "Project photos")} onChange={(e) => { void onFiles(e.target.files); e.target.value = ""; }} />
      <div className="grid grid-cols-3 gap-2 sm:grid-cols-5">
        {photos.map((p, i) => (
          <div key={p.url} className="group relative aspect-square overflow-hidden rounded-xl border border-line bg-bone">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={p.url} alt="" className="size-full object-cover" />
            {i === 0 && <span className="absolute start-1 top-1 flex items-center gap-1 rounded-full bg-amber px-2 py-0.5 text-[10px] font-bold text-ink"><Star className="size-3" /> {t("الغلاف", "Cover")}</span>}
            <div className="absolute inset-x-1 bottom-1 flex justify-between">
              <button type="button" onClick={() => move(i, -1)} disabled={i === 0} className="grid size-7 place-items-center rounded-full bg-paper/90 disabled:opacity-30" aria-label={t("قبل", "Earlier")}><Prev className="size-3.5" /></button>
              <button type="button" onClick={() => setPhotos((x) => x.filter((_, k) => k !== i))} className="grid size-7 place-items-center rounded-full bg-paper/90 text-danger" aria-label={t("إزالة", "Remove")}><X className="size-3.5" /></button>
              <button type="button" onClick={() => move(i, 1)} disabled={i === photos.length - 1} className="grid size-7 place-items-center rounded-full bg-paper/90 disabled:opacity-30" aria-label={t("بعد", "Later")}><Next className="size-3.5" /></button>
            </div>
          </div>
        ))}
        {photos.length < max && (
          <button type="button" onClick={() => input.current?.click()} disabled={busy > 0} className="grid aspect-square place-items-center rounded-xl border border-dashed border-line text-xs font-semibold text-mute hover:border-ink">
            {busy > 0 ? <Loader2 className="size-5 animate-spin" /> : <span className="flex flex-col items-center gap-1"><ImagePlus className="size-6" /> {t("أضف صور", "Add photos")}</span>}
          </button>
        )}
      </div>
    </div>
  );
}
