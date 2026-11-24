"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Check, ExternalLink, ImagePlus, Loader2, RotateCcw, ScanLine, Trash2, X } from "lucide-react";
import { useI18n } from "@/components/i18n-provider";
import { adminT } from "@/lib/admin-i18n";
import { toast } from "@/components/ui/toast";
import { extOf, imageSize, uploadProductImage } from "@/lib/admin-upload";
import { discardPrintFile, setViewMockup } from "@/lib/actions/admin/printing";
import { garmentDataUrl, type GarmentType } from "@/lib/garments";
import type { ProductTypeRow, TypeViewRow } from "@/lib/print-config";
import { cn } from "@/lib/format";
import type { Color, GarmentTypeRow } from "@/lib/types";

const ACCEPT = ["image/png", "image/jpeg", "image/webp"];
const MAX = 8 * 1024 * 1024;

/**
 * The images customers design on in the print studio (/design): one blank garment photo per view,
 * optionally one per colour. Stored on the garment's product type (product_type_views), so the studio,
 * the catalog and the production sheet all use the same image and print areas.
 */
export function PodImages({ garments, types, colors }: { garments: GarmentTypeRow[]; types: ProductTypeRow[]; colors: Color[] }) {
  const { locale } = useI18n();
  const t = adminT(locale);
  const [code, setCode] = useState(garments[0]?.code ?? "");
  const garment = garments.find((g) => g.code === code);
  const type = types.find((x) => x.code === code);
  const [viewCode, setViewCode] = useState<string>("front");
  const view = type?.product_type_views?.find((v) => v.code === viewCode);
  const gColors = colors.filter((c) => garment?.color_ids.includes(c.id));

  return (
    <div className="space-y-5">
      <p className="rounded-2xl bg-bone p-4 text-sm text-mute">
        {t("هذه الصور يراها الزبون في صفحة «صمّم قطعتك» ويضع تصميمه عليها. أي تغيير هنا يظهر للزبائن فوراً بعد الحفظ — بدون تعديل كود أو إعادة نشر. الصيغ: PNG, JPG, JPEG, WEBP (حتى ٨ ميغابايت).", "Customers see these images on the “Design your piece” page and place their design on them. Changes show to customers as soon as you save — no code change or redeploy. Formats: PNG, JPG, JPEG, WEBP (up to 8 MB).")}
      </p>

      <div className="flex flex-wrap gap-2" role="tablist" aria-label={t("القطعة", "Garment")}>
        {garments.map((g) => (
          <button key={g.code} role="tab" aria-selected={g.code === code} onClick={() => setCode(g.code)} className="chip h-10 px-4">
            {locale === "ar" ? g.name_ar : g.name_en}{!g.is_active && <span className="text-xs opacity-60"> · {t("مخفية", "hidden")}</span>}
          </button>
        ))}
      </div>

      {!type ? (
        <p className="rounded-2xl border border-amber bg-amber/10 p-4 text-sm">{t("لا يوجد قالب صور لهذه القطعة بعد — شغّل الملف supabase/add-product-printing-1.sql ثم -2.sql في Supabase مرة واحدة.", "No image template for this garment yet — run supabase/add-product-printing-1.sql then -2.sql in Supabase once.")}</p>
      ) : (
        <>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex rounded-full border border-line p-1">
              {(["front", "back", "right", "left", "hood"] as const).filter((v) => v === "front" || v === "back" || type.product_type_views?.some((x) => x.code === v)).map((v) => (
                <button key={v} onClick={() => setViewCode(v)} aria-pressed={viewCode === v} className={cn("rounded-full px-4 py-2 text-sm font-bold transition", viewCode === v ? "bg-pine text-white dark:text-night" : "hover:bg-bone")}>
                  {{ front: t("الأمام", "Front"), back: t("الخلف", "Back"), right: t("الكم الأيمن", "Right sleeve"), left: t("الكم الأيسر", "Left sleeve"), hood: t("داخل القبعة", "Inside the hood") }[v]}
                </button>
              ))}
            </div>
            <div className="flex flex-wrap gap-2">
              <Link href={`/${locale}/admin/product-types/${type.id}`} className="btn btn-outline btn-sm"><ScanLine className="size-4" /> {t("ضبط مناطق الطباعة", "Adjust print areas")}</Link>
              <Link href={`/${locale}/design?garment=${code}`} target="_blank" className="btn btn-outline btn-sm"><ExternalLink className="size-4" /> {t("كما يراها الزبون", "As customers see it")}</Link>
            </div>
          </div>

          {view ? (
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              <Slot key={`${view.id}-default`} view={view} type={type} colorId={null} label={t("الصورة الأساسية (لكل الألوان)", "Default image (all colours)")} hex={gColors[0]?.hex ?? "#111111"} />
              {gColors.map((c) => (
                <Slot key={`${view.id}-${c.id}`} view={view} type={type} colorId={c.id} label={locale === "ar" ? c.name_ar : c.name_en} hex={c.hex} />
              ))}
            </div>
          ) : (
            <p className="text-sm text-mute">{t("هذه الزاوية غير موجودة في القالب.", "This view isn't in the template.")}</p>
          )}
          <p className="text-xs text-mute">{t("بعد رفع صورة جديدة اضغط «ضبط مناطق الطباعة» وحرّك المستطيلات لمكانها على الصورة. صورة كل لون يُفضّل أن تكون بنفس أبعاد الصورة الأساسية.", "After uploading a new photo, open “Adjust print areas” and drag the rectangles onto it. Each colour's photo should have the same dimensions as the default one.")}</p>
        </>
      )}
    </div>
  );
}

/** One image slot: current image → pick a file → preview → save (or cancel); delete returns to the fallback. */
function Slot({ view, type, colorId, label, hex }: { view: TypeViewRow; type: ProductTypeRow; colorId: string | null; label: string; hex: string }) {
  const { locale } = useI18n();
  const t = adminT(locale);
  const router = useRouter();
  const current = colorId ? view.color_mockups?.[colorId]?.url ?? null : view.mockup_url;
  // what the customer sees today for this slot when nothing is uploaded here
  const fallback = colorId ? view.mockup_url ?? (type.garment_shape ? garmentDataUrl(type.garment_shape as GarmentType, view.code === "back" ? "back" : "front", hex) : null) : type.garment_shape ? garmentDataUrl(type.garment_shape as GarmentType, view.code === "back" ? "back" : "front", hex) : null;
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [busy, setBusy] = useState<"save" | "delete" | null>(null);
  useEffect(() => () => { if (preview) URL.revokeObjectURL(preview); }, [preview]);

  const pick = (f: File | undefined) => {
    if (!f) return;
    if (!ACCEPT.includes(f.type)) return toast.error(t("الصيغ المسموحة: PNG, JPG, JPEG, WEBP", "Allowed formats: PNG, JPG, JPEG, WEBP"));
    if (f.size > MAX) return toast.error(t("حجم الصورة أكبر من ٨ ميغابايت", "The image is larger than 8 MB"));
    setFile(f);
    setPreview(URL.createObjectURL(f));
  };
  const cancel = () => { setFile(null); setPreview(null); };

  const save = async () => {
    if (!file) return;
    setBusy("save");
    let path: string | null = null;
    try {
      const size = await imageSize(file);
      const up = await uploadProductImage(file, `mockups/${type.id}/${view.id}/${crypto.randomUUID()}.${extOf(file.type)}`, file.type);
      path = up.path;
      const r = await setViewMockup({ view_id: view.id, color_id: colorId, url: up.url, path: up.path, width: size.width, height: size.height });
      if (!r?.ok) throw new Error(r && !r.ok ? r.error : "save");
      toast.success(t("تم حفظ الصورة — تظهر الآن للزبائن", "Image saved — customers see it now"));
      cancel();
      router.refresh();
    } catch (e) {
      if (path) void discardPrintFile(path);
      toast.error(e instanceof Error && e.message === "not_authorized" ? t("ليست لديك صلاحية", "Not authorised") : t("تعذّر حفظ الصورة — حاول مرة ثانية", "Couldn't save the image — try again"));
    } finally {
      setBusy(null);
    }
  };

  const remove = async () => {
    if (!confirm(t("حذف هذه الصورة؟ سيرى الزبائن الصورة الاحتياطية بدلها.", "Delete this image? Customers will see the fallback instead."))) return;
    setBusy("delete");
    try {
      const r = await setViewMockup({ view_id: view.id, color_id: colorId, url: null, path: null });
      if (!r?.ok) throw new Error("delete");
      toast.success(t("تم حذف الصورة", "Image deleted"));
      router.refresh();
    } catch {
      toast.error(t("تعذّر الحذف", "Couldn't delete"));
    } finally {
      setBusy(null);
    }
  };

  const shown = preview ?? current ?? fallback;
  return (
    <div className={cn("overflow-hidden rounded-2xl border bg-paper", preview ? "border-amber" : "border-line")}>
      <div className="relative aspect-[6/7] bg-bone">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        {shown && <img src={shown} alt={label} className="absolute inset-0 size-full object-contain p-2" />}
        <span className={cn("absolute start-2 top-2 rounded-full px-2 py-0.5 text-[10px] font-bold", preview ? "bg-amber text-ink" : current ? "bg-pine text-white" : "bg-paper text-mute")}>
          {preview ? t("معاينة — لم تُحفظ", "Preview — not saved") : current ? t("الصورة الحالية", "Current image") : colorId && view.mockup_url ? t("تستخدم الصورة الأساسية", "Uses the default image") : t("الرسم المدمج", "Built-in drawing")}
        </span>
        {busy && <span className="absolute inset-0 grid place-items-center bg-paper/70"><Loader2 className="size-6 animate-spin text-pine" /></span>}
      </div>
      <div className="space-y-2 p-3">
        <p className="flex items-center gap-2 text-sm font-bold"><span className="size-3.5 rounded-full border border-ink/20" style={{ background: hex }} />{label}</p>
        {preview ? (
          <div className="grid grid-cols-2 gap-2">
            <button type="button" onClick={save} disabled={!!busy} className="btn btn-brand btn-sm">{busy === "save" ? <Loader2 className="size-4 animate-spin" /> : <Check className="size-4" />} {t("حفظ", "Save")}</button>
            <button type="button" onClick={cancel} disabled={!!busy} className="btn btn-outline btn-sm"><X className="size-4" /> {t("إلغاء", "Cancel")}</button>
          </div>
        ) : (
          <div className="flex flex-wrap gap-2">
            <label className={cn("btn btn-outline btn-sm cursor-pointer", busy && "pointer-events-none opacity-50")}>
              {current ? <RotateCcw className="size-4" /> : <ImagePlus className="size-4" />} {current ? t("استبدال", "Replace") : t("رفع صورة", "Upload")}
              <input type="file" accept="image/png,image/jpeg,image/webp" className="sr-only" aria-label={`${t("صورة", "Image")} ${label}`} onChange={(e) => { pick(e.target.files?.[0]); e.target.value = ""; }} />
            </label>
            {current && <button type="button" onClick={remove} disabled={!!busy} className="btn btn-sm border border-danger text-danger"><Trash2 className="size-4" /> {t("حذف", "Delete")}</button>}
          </div>
        )}
        {current && !preview && colorId === null && <p className="text-[11px] text-mute tabular-nums" dir="ltr">{view.mockup_width}×{view.mockup_height}px</p>}
      </div>
    </div>
  );
}
