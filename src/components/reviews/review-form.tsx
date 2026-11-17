"use client";
import { useState, useTransition } from "react";
import { CheckCircle2, ImagePlus, Loader2, Star, X } from "lucide-react";
import { useI18n } from "@/components/i18n-provider";
import { submitStoreReview } from "@/lib/actions/reviews";
import { uploadArtwork, ACCEPT_REVIEW } from "@/lib/upload-client";
import { cn } from "@/lib/format";

export function StoreReviewForm({ products }: { products: { id: string; name_ar: string; name_en: string }[] }) {
  const { locale, dict } = useI18n();
  const t = dict.reviews;
  const [rating, setRating] = useState(5);
  const [hover, setHover] = useState(0);
  const [photos, setPhotos] = useState<{ id: string; preview: string }[]>([]);
  const [uploading, setUploading] = useState(false);
  const [avatar, setAvatar] = useState<{ id: string; preview: string } | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [done, setDone] = useState<{ verified: boolean } | null>(null);
  const [pending, start] = useTransition();

  if (done)
    return (
      <div className="flex flex-col items-center gap-4 py-10 text-center">
        <CheckCircle2 className="size-12 text-amber" strokeWidth={1.4} />
        <p className="max-w-sm text-lg font-semibold">{t.thanks}</p>
      </div>
    );

  const addPhotos = async (files: FileList | null) => {
    if (!files) return;
    setUploading(true);
    for (const f of Array.from(files).slice(0, 4 - photos.length)) {
      try {
        const r = await uploadArtwork(f, "review");
        setPhotos((p) => [...p, { id: r.id, preview: URL.createObjectURL(f) }]);
      } catch (e) {
        const k = e instanceof Error ? e.message : "";
        setFormError(k === "fileType" ? dict.validation.fileType : k === "fileSize" ? dict.validation.fileSize : dict.common.somethingWrong);
      }
    }
    setUploading(false);
  };

  const addAvatar = async (file: File | undefined) => {
    if (!file) return;
    setUploading(true);
    try {
      const r = await uploadArtwork(file, "review");
      setAvatar({ id: r.id, preview: URL.createObjectURL(file) });
    } catch (e) {
      const k = e instanceof Error ? e.message : "";
      setFormError(k === "fileType" ? dict.validation.fileType : k === "fileSize" ? dict.validation.fileSize : dict.common.somethingWrong);
    }
    setUploading(false);
  };

  const submit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const errs: Record<string, string> = {};
    if (String(fd.get("author_name") ?? "").trim().length < 2) errs.author_name = "required";
    if (String(fd.get("body") ?? "").trim().length < 10) errs.body = "min";
    setErrors(errs);
    if (Object.keys(errs).length) return;
    setFormError(null);
    start(async () => {
      const res = await submitStoreReview({
        author_name: fd.get("author_name"),
        author_city: fd.get("author_city") || undefined,
        rating,
        body: fd.get("body"),
        product_id: fd.get("product_id") || "",
        photo_ids: photos.map((p) => p.id),
        avatar_id: avatar?.id,
        order_number: fd.get("order_number") || undefined,
        phone: fd.get("phone") || undefined,
      });
      if (res.ok) setDone({ verified: res.verified });
      else {
        if (res.fields) setErrors(res.fields);
        setFormError(res.error === "rate_limited" ? dict.checkout.errors.rate_limited! : res.error === "validation" ? null : dict.common.somethingWrong);
      }
    });
  };
  const fe = (k: string) => errors[k] && <p className="mt-1 text-xs text-red-300">{dict.validation[errors[k] as keyof typeof dict.validation] ?? dict.validation.required}</p>;
  const field = "w-full h-12 border border-paper/20 bg-transparent px-4 text-paper placeholder:text-paper/35 outline-none focus:border-amber";

  return (
    <form onSubmit={submit} noValidate className="grid gap-5 sm:grid-cols-2">
      {formError && <p className="bg-red-500/15 p-3 text-sm text-red-200 sm:col-span-2" role="alert">{formError}</p>}
      <div className="sm:col-span-2">
        <p className="label text-paper/80">{t.rating}</p>
        <div className="flex gap-1.5" role="radiogroup" aria-label={t.rating} onMouseLeave={() => setHover(0)}>
          {[1, 2, 3, 4, 5].map((n) => (
            <button type="button" key={n} role="radio" aria-checked={rating === n} aria-label={String(n)} onClick={() => setRating(n)} onMouseEnter={() => setHover(n)} className="p-0.5">
              <Star className={cn("size-9 transition-transform hover:scale-110", n <= (hover || rating) ? "fill-amber text-amber" : "text-paper/25")} />
            </button>
          ))}
        </div>
      </div>
      <div className="flex items-center gap-4 sm:col-span-2">
        <label className={cn("relative grid size-16 shrink-0 cursor-pointer place-items-center overflow-hidden rounded-full border border-dashed border-paper/30 text-paper/60 hover:border-amber", uploading && "pointer-events-none opacity-50")}>
          {avatar ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={avatar.preview} alt="" className="h-full w-full object-cover" />
          ) : (
            <ImagePlus className="size-5" />
          )}
          <input type="file" accept={ACCEPT_REVIEW} className="sr-only" onChange={(e) => { void addAvatar(e.target.files?.[0]); e.target.value = ""; }} />
        </label>
        <p className="text-sm text-paper/70">{t.avatar}</p>
      </div>
      <div>
        <label htmlFor="r-name" className="label text-paper/80">{t.name}</label>
        <input id="r-name" name="author_name" maxLength={60} autoComplete="name" className={field} aria-invalid={!!errors.author_name} />
        {fe("author_name")}
      </div>
      <div>
        <label htmlFor="r-city" className="label text-paper/80">{t.city}</label>
        <input id="r-city" name="author_city" maxLength={80} placeholder={locale === "ar" ? "بغداد، البصرة…" : "Baghdad, Basra…"} className={field} />
      </div>
      <div className="sm:col-span-2">
        <label htmlFor="r-body" className="label text-paper/80">{t.body}</label>
        <textarea id="r-body" name="body" rows={4} maxLength={1500} placeholder={t.bodyHint} className={cn(field, "h-auto py-3")} aria-invalid={!!errors.body} />
        {fe("body")}
      </div>
      <div className="sm:col-span-2">
        <label htmlFor="r-product" className="label text-paper/80">{t.product}</label>
        <select id="r-product" name="product_id" className={cn(field, "bg-ink")} defaultValue="">
          <option value="">{t.generalStore}</option>
          {products.map((p) => <option key={p.id} value={p.id}>{locale === "ar" ? p.name_ar : p.name_en}</option>)}
        </select>
      </div>
      <div className="sm:col-span-2">
        <p className="label text-paper/80">{t.photos}</p>
        <div className="flex flex-wrap gap-3">
          {photos.map((p) => (
            <div key={p.id} className="relative size-20 overflow-hidden bg-paper/10">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={p.preview} alt="" className="h-full w-full object-cover" />
              <button type="button" onClick={() => setPhotos((x) => x.filter((y) => y.id !== p.id))} className="absolute end-1 top-1 grid size-6 place-items-center rounded-full bg-ink/80 text-paper" aria-label={dict.common.delete}><X className="size-3.5" /></button>
            </div>
          ))}
          {photos.length < 4 && (
            <label className={cn("grid size-20 cursor-pointer place-items-center border border-dashed border-paper/30 text-paper/60 hover:border-amber hover:text-amber", uploading && "pointer-events-none opacity-50")}>
              {uploading ? <Loader2 className="size-5 animate-spin" /> : <ImagePlus className="size-6" />}
              <input type="file" accept={ACCEPT_REVIEW} multiple className="sr-only" onChange={(e) => { void addPhotos(e.target.files); e.target.value = ""; }} />
            </label>
          )}
        </div>
        <p className="mt-2 text-xs text-paper/50">{t.photosHint}</p>
      </div>
      <details className="border border-paper/15 p-4 sm:col-span-2">
        <summary className="cursor-pointer text-sm font-semibold text-paper/80">{t.verifyTitle}</summary>
        <p className="mt-2 text-xs text-paper/50">{t.verifyHint}</p>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <input name="order_number" placeholder="TP100123" dir="ltr" className={cn(field, "uppercase")} aria-label={dict.track.orderNumber} />
          <input name="phone" type="tel" placeholder="07xx xxx xxxx" dir="ltr" className={field} aria-label={dict.track.phone} />
        </div>
      </details>
      <button disabled={pending || uploading} className="btn btn-accent h-14 text-base sm:col-span-2">
        {pending ? <Loader2 className="size-5 animate-spin" /> : t.submit}
      </button>
    </form>
  );
}
