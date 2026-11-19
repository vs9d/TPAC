"use client";
import Image from "next/image";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { ImagePlus, Loader2, Trash2 } from "lucide-react";
import { useI18n } from "@/components/i18n-provider";
import { adminT } from "@/lib/admin-i18n";
import { createClient } from "@/lib/supabase/client";
import { addProductImage, updateProductImage, deleteProductImage, setMainImage } from "@/lib/actions/admin/products";
import { toast } from "@/components/ui/toast";
import { AdminForm, Submit } from "./form";
import type { Color, ProductImage } from "@/lib/types";

const TYPES = ["image/jpeg", "image/png", "image/webp", "image/avif"];

export function ProductImages({ productId, images, colors }: { productId: string; images: ProductImage[]; colors: Color[] }) {
  const { locale } = useI18n();
  const t = adminT(locale);
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [colorId, setColorId] = useState("");

  const upload = async (files: FileList | null) => {
    if (!files?.length) return;
    setBusy(true);
    const supabase = createClient();
    for (const file of Array.from(files)) {
      if (!TYPES.includes(file.type) || file.size > 8 * 1024 * 1024) {
        toast.error(`${file.name}: ${t("نوع أو حجم غير مسموح (حد أقصى ٨ ميغابايت)", "type or size not allowed (max 8 MB)")}`);
        continue;
      }
      const ext = file.type.split("/")[1]!.replace("jpeg", "jpg");
      const path = `products/${productId}/${crypto.randomUUID()}.${ext}`;
      // Storage RLS only lets staff write to this bucket.
      const { error } = await supabase.storage.from("product-images").upload(path, file, { contentType: file.type, cacheControl: "31536000" });
      if (error) {
        toast.error(error.message);
        continue;
      }
      const { data } = supabase.storage.from("product-images").getPublicUrl(path);
      const res = await addProductImage({ product_id: productId, url: data.publicUrl, storage_path: path, color_id: colorId || null });
      if (!res?.ok) toast.error(t("تعذر حفظ الصورة", "Could not save image"));
    }
    setBusy(false);
    router.refresh();
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-3">
        <div>
          <label className="label" htmlFor="img-color">{t("ربط الصور بلون", "Link uploads to colour")}</label>
          <select id="img-color" value={colorId} onChange={(e) => setColorId(e.target.value)} className="field h-10 text-sm">
            <option value="">{t("كل الألوان", "All colours")}</option>
            {colors.map((c) => <option key={c.id} value={c.id}>{locale === "ar" ? c.name_ar : c.name_en}</option>)}
          </select>
        </div>
        <label className={`btn btn-outline btn-sm h-10 cursor-pointer ${busy ? "pointer-events-none opacity-50" : ""}`}>
          {busy ? <Loader2 className="size-4 animate-spin" /> : <ImagePlus className="size-4" />} {t("رفع صور", "Upload images")}
          <input type="file" accept={TYPES.join(",")} multiple className="sr-only" onChange={(e) => { void upload(e.target.files); e.target.value = ""; }} />
        </label>
        <p className="text-xs text-mute">{t("يُفضّل ١٢٠٠×١٥٠٠ بكسل (٤:٥)", "Recommended 1200×1500px (4:5)")}</p>
      </div>
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
        {images.map((img) => (
          <div key={img.id} className="border border-line">
            <div className="relative aspect-[4/5] bg-bone"><Image src={img.url} alt="" fill sizes="200px" className="object-cover" />{img.id === images[0]?.id && <span className="absolute start-1.5 top-1.5 rounded-full bg-pine px-2 py-0.5 text-[10px] font-bold text-white">{t("الرئيسية", "Main")}</span>}{img.is_generated && <span className="absolute bottom-1.5 start-1.5 rounded-full bg-amber px-2 py-0.5 text-[10px] font-bold text-ink">{t("مولّدة من الموك أب", "From mockup")}</span>}</div>
            <AdminForm action={updateProductImage} className="space-y-2 p-2">
              <input type="hidden" name="id" value={img.id} />
              <select name="color_id" defaultValue={img.color_id ?? ""} className="field h-8 px-2 text-xs" aria-label={t("اللون", "Colour")}>
                <option value="">{t("كل الألوان", "All colours")}</option>
                {colors.map((c) => <option key={c.id} value={c.id}>{locale === "ar" ? c.name_ar : c.name_en}</option>)}
              </select>
              <div className="flex gap-2">
                <input name="sort_order" type="number" defaultValue={img.sort_order} className="field h-8 w-16 px-2 text-xs" aria-label={t("الترتيب", "Order")} />
                <Submit variant="outline" className="h-8 flex-1">{t("حفظ", "Save")}</Submit>
              </div>
            </AdminForm>
            {img.id !== images[0]?.id && (
              <AdminForm action={setMainImage} className="px-2 pb-1">
                <input type="hidden" name="id" value={img.id} /><input type="hidden" name="product_id" value={productId} />
                <button className="w-full text-xs font-semibold text-pine hover:underline">★ {t("جعلها الرئيسية", "Make main")}</button>
              </AdminForm>
            )}
            <AdminForm action={deleteProductImage} className="px-2 pb-2">
              <input type="hidden" name="id" value={img.id} />
              <button className="flex w-full items-center justify-center gap-1 text-xs text-danger hover:underline" onClick={(e) => { if (!confirm(t("حذف الصورة؟", "Delete image?"))) e.preventDefault(); }}><Trash2 className="size-3.5" /> {t("حذف", "Delete")}</button>
            </AdminForm>
          </div>
        ))}
      </div>
    </div>
  );
}
