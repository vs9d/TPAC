"use client";
import { useEffect, useRef, useState } from "react";
import { ImagePlus, Link2, Loader2, Trash2 } from "lucide-react";
import { useI18n } from "@/components/i18n-provider";
import { adminT } from "@/lib/admin-i18n";
import { toast } from "@/components/ui/toast";
import { uploadProductImage } from "@/lib/admin-upload";
import { cn } from "@/lib/format";

/** Shrinks a photo (iPhone HEIC/JPEG/PNG …) to a web-friendly JPEG, max `max` px on the long side. */
async function toWebImage(file: File, max = 2000): Promise<Blob> {
  const bmp = await createImageBitmap(file);
  const k = Math.min(1, max / Math.max(bmp.width, bmp.height));
  const c = document.createElement("canvas");
  c.width = Math.round(bmp.width * k);
  c.height = Math.round(bmp.height * k);
  c.getContext("2d")!.drawImage(bmp, 0, 0, c.width, c.height);
  return new Promise((res, rej) => c.toBlob((b) => (b ? res(b) : rej(new Error("jpeg"))), "image/jpeg", 0.86));
}

/**
 * Image picker for admin forms: upload from the phone's photo library / files (or paste a link).
 * Submits the public URL in a hidden input named `name`.
 */
export function ImageField({ name, label, defaultValue, folder, className }: { name: string; label: string; defaultValue?: string | null; folder: string; className?: string }) {
  const { locale } = useI18n();
  const t = adminT(locale);
  const [url, setUrl] = useState(defaultValue ?? "");
  const [busy, setBusy] = useState(false);
  const [asLink, setAsLink] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  const hidden = useRef<HTMLInputElement>(null);

  // a "new item" form that resets after saving clears the picture too
  useEffect(() => {
    const form = hidden.current?.form;
    if (!form) return;
    const onReset = () => setUrl(defaultValue ?? "");
    form.addEventListener("reset", onReset);
    return () => form.removeEventListener("reset", onReset);
  }, [defaultValue]);

  const onFile = async (file: File) => {
    if (!file.type.startsWith("image/") && !/\.(heic|heif)$/i.test(file.name)) { toast.error(t("اختار صورة", "Choose an image")); return; }
    if (file.size > 25 * 1024 * 1024) { toast.error(t("الصورة كبيرة جداً (الحد ٢٥ ميغا)", "Image too large (25 MB max)")); return; }
    setBusy(true);
    try {
      const blob = await toWebImage(file);
      const up = await uploadProductImage(blob, `${folder}/${crypto.randomUUID()}.jpg`, "image/jpeg");
      setUrl(up.url);
      toast.success(t("تم رفع الصورة — اضغط حفظ", "Image uploaded — press Save"));
    } catch (e) {
      console.error(e);
      toast.error(t("تعذّر رفع الصورة", "Upload failed"));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className={cn("space-y-2", className)}>
      <span className="block text-xs font-semibold text-mute">{label}</span>
      <input ref={hidden} type="hidden" name={name} value={url} />
      <input ref={input} type="file" accept="image/*" className="sr-only" aria-label={label} onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ""; if (f) void onFile(f); }} />
      <div className="flex flex-wrap items-center gap-3">
        <button type="button" onClick={() => input.current?.click()} disabled={busy} className="relative grid aspect-[16/10] w-44 place-items-center overflow-hidden rounded-2xl border border-dashed border-line bg-bone text-mute transition hover:border-ink">
          {url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={url} alt="" className="absolute inset-0 size-full object-cover" />
          ) : (
            <span className="flex flex-col items-center gap-1 text-xs font-semibold"><ImagePlus className="size-6" /> {t("اختر صورة", "Choose image")}</span>
          )}
          {busy && <span className="absolute inset-0 grid place-items-center bg-paper/70"><Loader2 className="size-5 animate-spin" /></span>}
        </button>
        <div className="flex flex-col gap-2">
          <button type="button" onClick={() => input.current?.click()} disabled={busy} className="btn btn-outline btn-sm"><ImagePlus className="size-4" /> {url ? t("تغيير الصورة", "Change image") : t("رفع من الجهاز", "Upload from device")}</button>
          {url && <button type="button" onClick={() => setUrl("")} className="btn btn-sm border border-danger text-danger"><Trash2 className="size-4" /> {t("إزالة", "Remove")}</button>}
          <button type="button" onClick={() => setAsLink((v) => !v)} className="flex items-center gap-1 text-xs text-mute underline"><Link2 className="size-3.5" /> {t("أو الصق رابط", "or paste a link")}</button>
        </div>
      </div>
      {asLink && <input type="url" dir="ltr" value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://…" className="field h-10 w-full" aria-label={t("رابط الصورة", "Image URL")} />}
    </div>
  );
}
