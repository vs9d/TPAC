"use client";
import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Save } from "lucide-react";
import { useI18n } from "@/components/i18n-provider";
import { adminT } from "@/lib/admin-i18n";
import { toast } from "@/components/ui/toast";
import { saveProductPrinting } from "@/lib/actions/admin/printing";
import type { ProductDesignRow, ProductTypeRow } from "@/lib/print-config";
import type { Color } from "@/lib/types";
import { ProductStudio, type StudioHandle } from "./product-studio";

/** Printing tab of an existing product: template, official artwork, enabled areas; saving regenerates the photos. */
export function ProductPrintingPanel({ productId, typeId, printEnabled, disabledAreas, designs, types, colors, variantColorIds, coverColorId = null }: {
  productId: string; typeId: string | null; printEnabled: boolean; disabledAreas: string[]; designs: ProductDesignRow[];
  types: ProductTypeRow[]; colors: Color[]; variantColorIds: string[]; coverColorId?: string | null;
}) {
  const { locale } = useI18n();
  const t = adminT(locale);
  const router = useRouter();
  const [current, setCurrent] = useState(typeId ?? "");
  const type = types.find((x) => x.id === current) ?? null;
  const studio = useRef<StudioHandle>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const save = () => start(async () => {
    const s = studio.current;
    try {
      const list = s?.designs() ?? [];
      setStatus(t("جارِ تجهيز صور المنتج…", "Preparing product photos…"));
      const images = s && list.length && s.printEnabled() ? await s.generate(productId, variantColorIds, (d, n) => setStatus(t(`جارِ تجهيز صور المنتج ${d}/${n}…`, `Preparing product photos ${d}/${n}…`))) : [];
      setStatus(t("جارِ الحفظ…", "Saving…"));
      const r = await saveProductPrinting({
        product_id: productId,
        product_type_id: type?.id ?? null,
        print_enabled: s?.printEnabled() ?? printEnabled,
        disabled_print_area_ids: s?.disabledAreas() ?? [],
        designs: list.map((d) => ({ ...d, artwork_width: Math.round(d.artwork_width), artwork_height: Math.round(d.artwork_height) })),
        images: type ? images : [],
      });
      if (!r?.ok) throw new Error(r && !r.ok ? r.error : "save");
      toast.success(t("تم حفظ الطباعة وتحديث صور المنتج", "Printing saved and product photos updated"));
      router.refresh();
    } catch (e) {
      console.error(e);
      toast.error(t("تعذّر الحفظ — حاول مرة ثانية", "Couldn't save — try again"));
    } finally {
      setStatus(null);
    }
  });

  return (
    <div className="relative space-y-4">
      <div className="flex flex-wrap items-end gap-3">
        <label className="block min-w-56">
          <span className="mb-1 block text-xs font-semibold text-mute">{t("قالب الطباعة (نوع المنتج)", "Print template (product type)")}</span>
          <select className="field h-11" value={current} onChange={(e) => { if (designs.length && !confirm(t("تغيير النوع يزيل التصاميم الحالية من هذا المنتج. المتابعة؟", "Changing the type removes this product's current artwork. Continue?"))) return; setCurrent(e.target.value); }}>
            <option value="">{t("بدون قالب", "No template")}</option>
            {types.map((x) => <option key={x.id} value={x.id}>{locale === "ar" ? x.name_ar : x.name_en}{x.is_active ? "" : ` (${t("مخفي", "hidden")})`}</option>)}
          </select>
        </label>
        <button type="button" onClick={save} disabled={pending} className="btn btn-brand h-11">{pending ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />} {t("حفظ الطباعة والصور", "Save printing & photos")}</button>
      </div>
      {type ? (
        <ProductStudio key={type.id} ref={studio} type={type} colors={colors} productId={productId} previewColorIds={variantColorIds} initialDesigns={type.id === typeId ? designs : []} initialDisabled={type.id === typeId ? disabledAreas : []} initialEnabled={printEnabled} initialCover={coverColorId} />
      ) : (
        <p className="rounded-2xl bg-bone p-4 text-sm text-mute">{t("هذا المنتج بدون قالب طباعة — صوره هي الصور العادية فقط. اختر نوعاً لوضع التصميم على موك أب.", "This product has no print template — it only shows its regular photos. Choose a type to place artwork on a mockup.")}</p>
      )}
      {status && <div className="absolute inset-0 z-20 grid place-items-center rounded-2xl bg-paper/80"><p className="flex items-center gap-2 text-sm font-semibold"><Loader2 className="size-4 animate-spin" /> {status}</p></div>}
      <p className="text-xs text-mute">{t("الحفظ يحدّث التصاميم الحالية بدون تكرار، ويستبدل الصور المولّدة القديمة بالجديدة. الصور التي رفعتها يدوياً تبقى كما هي.", "Saving updates the existing artwork in place (no duplicates) and replaces the old generated photos. Photos you uploaded yourself stay as they are.")}</p>
    </div>
  );
}
