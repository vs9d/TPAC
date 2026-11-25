"use client";
import { useRef, useState } from "react";
import Image from "next/image";
import { Check, ImagePlus, Loader2, Plus, X } from "lucide-react";
import { useI18n } from "@/components/i18n-provider";
import { toast } from "@/components/ui/toast";
import { adminT } from "@/lib/admin-i18n";
import { ACCEPT_REVIEW, uploadArtwork } from "@/lib/upload-client";
import { cn } from "@/lib/format";
import type { PrintLocation } from "@/lib/garments";

export const MAX_REFERENCE_PHOTOS = 4;

/** "I don't have the design": photos of a piece the customer saw somewhere + what they want. */
export interface ReferenceState {
  items: { id: string; url: string }[];
  note: string;
  locations: PrintLocation[];
}
export const emptyReference = (): ReferenceState => ({ items: [], note: "", locations: ["front"] });

export function ReferencePanel({ value, onChange, locations, locationName, disabled }: {
  value: ReferenceState;
  onChange: (next: ReferenceState) => void;
  /** placements this garment can be printed on */
  locations: PrintLocation[];
  locationName: (code: PrintLocation) => string;
  disabled?: boolean;
}) {
  const { locale } = useI18n();
  const t = adminT(locale);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  // keep the latest value while several photos upload one after another
  const live = useRef(value);
  live.current = value;
  const set = (patch: Partial<ReferenceState>) => onChange({ ...live.current, ...patch });

  const has = value.items.length > 0;
  const picked = value.locations.filter((l) => locations.includes(l));

  const add = async (files: FileList | null) => {
    const list = [...(files ?? [])].slice(0, MAX_REFERENCE_PHOTOS - live.current.items.length);
    if (!list.length) return;
    setBusy(true);
    try {
      for (const f of list) {
        try {
          const { id } = await uploadArtwork(f, "design");
          set({ items: [...live.current.items, { id, url: URL.createObjectURL(f) }] });
        } catch (e) {
          const code = e instanceof Error ? e.message : "";
          toast.error(
            code === "fileType" ? t("ارفع صورة JPG أو PNG أو WEBP", "Upload a JPG, PNG or WEBP photo")
              : code === "fileSize" ? t("الصورة كبيرة — الحد 15 ميغا", "The photo is too large — 15 MB max")
                : code === "uploads_disabled" ? t("رفع الصور متوقف حالياً", "Photo uploads are paused right now")
                  : t("تعذّر رفع الصورة — حاول مرة ثانية", "Couldn't upload the photo — try again"),
          );
        }
      }
    } finally {
      setBusy(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const remove = (id: string) => set({ items: live.current.items.filter((x) => x.id !== id) });
  const toggleLoc = (l: PrintLocation) => {
    const on = picked.includes(l);
    if (on && picked.length === 1) return; // at least one placement
    set({ locations: on ? picked.filter((x) => x !== l) : [...picked, l] });
  };

  if (!open && !has) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        disabled={disabled}
        className="flex w-full items-center gap-3 rounded-2xl border-2 border-dashed border-line bg-paper px-4 py-3.5 text-start transition hover:border-pine active:scale-[.99]"
      >
        <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-amber/15 text-amber-deep"><ImagePlus className="size-5" aria-hidden="true" /></span>
        <span className="min-w-0">
          <span className="block text-[15px] font-bold">{t("ما عندك تصميم؟", "Don't have a design?")}</span>
          <span className="block text-sm leading-snug text-mute">{t("شفت هودي عجبك بأي مكان؟ ارفع صورته واكتب «أريد مثله» — ونصمّمه إلك.", "Saw a hoodie you liked somewhere? Upload a photo, say “I want one like this” — we'll design it for you.")}</span>
        </span>
      </button>
    );
  }

  return (
    <section className="space-y-4 rounded-2xl border-2 border-amber/60 bg-amber/5 p-4" aria-label={t("تصميم حسب صورة", "Design from a photo")}>
      <header className="flex items-start justify-between gap-3">
        <div>
          <h3 className="flex items-center gap-2 text-base font-bold"><ImagePlus className="size-5 text-amber-deep" aria-hidden="true" /> {t("أريد مثل هذه الصورة", "I want one like this photo")}</h3>
          <p className="mt-0.5 text-sm text-mute">{t("ارفع صورة أو أكثر للقطعة اللي عجبتك (لغاية ٤ صور).", "Upload one or more photos of the piece you liked (up to 4).")}</p>
        </div>
        <button
          type="button"
          onClick={() => { onChange(emptyReference()); setOpen(false); }}
          className="grid size-11 shrink-0 place-items-center rounded-full hover:bg-bone"
          aria-label={t("إلغاء الطلب حسب الصورة", "Cancel the photo request")}
        ><X className="size-5" /></button>
      </header>

      <div className="grid grid-cols-4 gap-2">
        {value.items.map((it) => (
          <div key={it.id} className="relative aspect-square overflow-hidden rounded-xl bg-bone">
            <Image src={it.url} alt={t("صورتك المرجعية", "Your reference photo")} fill sizes="120px" className="object-cover" unoptimized />
            <button type="button" onClick={() => remove(it.id)} className="absolute end-1 top-1 grid size-8 place-items-center rounded-full bg-ink/70 text-white" aria-label={t("حذف الصورة", "Remove photo")}><X className="size-4" /></button>
          </div>
        ))}
        {value.items.length < MAX_REFERENCE_PHOTOS && (
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            disabled={busy || disabled}
            className={cn("grid aspect-square place-items-center rounded-xl border-2 border-dashed border-line bg-paper text-sm font-semibold text-mute transition hover:border-pine hover:text-pine", !has && "col-span-2 aspect-[2/1]")}
          >
            {busy ? <Loader2 className="size-6 animate-spin" /> : <span className="flex flex-col items-center gap-1"><Plus className="size-6" aria-hidden="true" />{has ? t("صورة ثانية", "Another") : t("ارفع الصورة", "Upload photo")}</span>}
          </button>
        )}
      </div>
      <input ref={fileRef} type="file" accept={ACCEPT_REVIEW} multiple className="hidden" onChange={(e) => void add(e.target.files)} />

      <div>
        <label htmlFor="ref-note" className="text-sm font-bold">{t("شنو تريد بالضبط؟", "What exactly do you want?")}</label>
        <textarea
          id="ref-note"
          value={value.note}
          maxLength={1000}
          onChange={(e) => set({ note: e.target.value })}
          rows={3}
          placeholder={t("مثلاً: أريد نفس الرسمة على الظهر بالضبط، بس الكتابة تصير اسمي", "e.g. Same artwork on the back, but with my name instead of the text")}
          className="mt-1.5 w-full rounded-xl border border-line bg-paper px-3 py-2.5 text-[15px] leading-relaxed outline-none focus:border-pine"
        />
      </div>

      <fieldset>
        <legend className="text-sm font-bold">{t("وين ينطبع؟", "Where should it be printed?")}</legend>
        <div className="mt-1.5 flex flex-wrap gap-2">
          {locations.map((l) => {
            const on = picked.includes(l);
            return (
              <button key={l} type="button" aria-pressed={on} onClick={() => toggleLoc(l)} className={cn("flex min-h-11 items-center gap-1.5 rounded-full border px-4 text-sm font-semibold transition", on ? "border-pine bg-pine-soft text-pine" : "border-line bg-paper text-ink/80")}>
                {on && <Check className="size-4" aria-hidden="true" />}{locationName(l)}
              </button>
            );
          })}
        </div>
      </fieldset>

      <p className="rounded-xl bg-paper p-3 text-xs leading-relaxed text-mute">
        {t("فريق TPAC يصمّم القطعة حسب صورتك، ويتواصل وياك قبل الطباعة. السعر حسب أماكن الطباعة اللي اخترتها. تكدر كمان تضيف كتابة أو صورة بالاستوديو فوق.", "The TPAC team recreates the design from your photo and gets in touch before printing. The price follows the placements you picked. You can still add text or images in the studio above.")}
      </p>
    </section>
  );
}
