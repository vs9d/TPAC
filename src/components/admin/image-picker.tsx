"use client";
import Image from "next/image";
import { useState } from "react";
import { ImagePlus, Loader2, Star, Trash2 } from "lucide-react";
import { useI18n } from "@/components/i18n-provider";
import { adminT } from "@/lib/admin-i18n";
import { createClient } from "@/lib/supabase/client";
import { discardUploadedImage } from "@/lib/actions/admin/products";
import { toast } from "@/components/ui/toast";
import type { Color } from "@/lib/types";

const TYPES = ["image/jpeg", "image/png", "image/webp", "image/avif"];
interface Picked { url: string; storage_path: string; color_id: string }

/** Upload product photos while creating the product (before it exists). Stored under products/<id>/ and linked when saved. */
export function ImagePicker({ productId, colors }: { productId: string; colors: Color[] }) {
  const { locale } = useI18n();
  const t = adminT(locale);
  const [items, setItems] = useState<Picked[]>([]);
  const [busy, setBusy] = useState(0);

  const upload = async (files: FileList | null) => {
    if (!files?.length) return;
    const supabase = createClient();
    const list = Array.from(files).slice(0, 12 - items.length);
    setBusy((n) => n + list.length);
    await Promise.all(
      list.map(async (file) => {
        try {
          if (!TYPES.includes(file.type) || file.size > 8 * 1024 * 1024) throw new Error(`${file.name}: ${t("نوع أو حجم غير مسموح (٨ ميغابايت)", "type or size not allowed (8 MB)")}`);
          const ext = file.type.split("/")[1]!.replace("jpeg", "jpg");
          const path = `products/${productId}/${crypto.randomUUID()}.${ext}`;
          const { error } = await supabase.storage.from("product-images").upload(path, file, { contentType: file.type, cacheControl: "31536000" });
          if (error) throw new Error(error.message);
          const url = supabase.storage.from("product-images").getPublicUrl(path).data.publicUrl;
          setItems((x) => [...x, { url, storage_path: path, color_id: "" }]);
        } catch (e) {
          toast.error(e instanceof Error ? e.message : t("فشل الرفع", "Upload failed"));
        } finally {
          setBusy((n) => n - 1);
        }
      }),
    );
  };

  const remove = (i: number) => {
    const it = items[i]!;
    setItems((x) => x.filter((_, j) => j !== i));
    void discardUploadedImage(it.storage_path);
  };
  const makeMain = (i: number) => setItems((x) => [x[i]!, ...x.filter((_, j) => j !== i)]);

  return (
    <div className="space-y-3">
      <input type="hidden" name="images_json" value={JSON.stringify(items.map(({ url, storage_path, color_id }) => ({ url, storage_path, color_id: color_id || null })))} />
      <div className="grid grid-cols-3 gap-3 sm:grid-cols-4 lg:grid-cols-6">
        {items.map((it, i) => (
          <div key={it.storage_path} className="overflow-hidden rounded-2xl border border-line">
            <div className="relative aspect-[4/5] bg-bone">
              <Image src={it.url} alt="" fill sizes="160px" className="object-cover" unoptimized />
              {i === 0 && <span className="absolute start-1.5 top-1.5 rounded-full bg-pine px-2 py-0.5 text-[10px] font-bold text-white">{t("الرئيسية", "Main")}</span>}
              <div className="absolute end-1.5 top-1.5 flex flex-col gap-1">
                <button type="button" onClick={() => remove(i)} aria-label={t("حذف", "Delete")} className="grid size-7 place-items-center rounded-full bg-night/70 text-snow"><Trash2 className="size-3.5" /></button>
                {i !== 0 && <button type="button" onClick={() => makeMain(i)} aria-label={t("جعلها الرئيسية", "Make main")} className="grid size-7 place-items-center rounded-full bg-night/70 text-snow"><Star className="size-3.5" /></button>}
              </div>
            </div>
            <select value={it.color_id} onChange={(e) => setItems((x) => x.map((y, j) => (j === i ? { ...y, color_id: e.target.value } : y)))} className="field h-9 rounded-none border-0 border-t px-2 text-xs" aria-label={t("اللون", "Colour")}>
              <option value="">{t("كل الألوان", "All colours")}</option>
              {colors.map((c) => <option key={c.id} value={c.id}>{locale === "ar" ? c.name_ar : c.name_en}</option>)}
            </select>
          </div>
        ))}
        {items.length < 12 && (
          <label className="grid aspect-[4/5] cursor-pointer place-items-center rounded-2xl border-2 border-dashed border-line text-center text-xs font-semibold text-mute hover:border-pine hover:text-pine" data-ripple>
            <span className="grid place-items-center gap-1.5 px-2">
              {busy ? <Loader2 className="size-6 animate-spin" /> : <ImagePlus className="size-6" />}
              {busy ? t("جارِ الرفع…", "Uploading…") : t("إضافة صور", "Add photos")}
            </span>
            <input type="file" accept={TYPES.join(",")} multiple className="sr-only" onChange={(e) => { void upload(e.target.files); e.target.value = ""; }} />
          </label>
        )}
      </div>
      <p className="text-xs text-mute">{t("الصورة الأولى تظهر في المتجر. يمكنك ربط كل صورة بلون معيّن. المقاس المفضّل ١٢٠٠×١٥٠٠.", "The first photo is the cover. Link each photo to a colour if you like. Best size 1200×1500.")}</p>
    </div>
  );
}
