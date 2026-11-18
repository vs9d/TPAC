import Image from "next/image";
import { notFound } from "next/navigation";
import { isLocale } from "@/lib/i18n/config";
import { getDictionary } from "@/lib/i18n";
import { adminT } from "@/lib/admin-i18n";
import { createClient } from "@/lib/supabase/server";
import { PrintButton } from "@/components/admin/print-button";
import { describeObject, groupDesigns, loadArtwork, objectCm, optionList, optionNames, type DesignRow } from "@/lib/design-admin";
import { GARMENTS, type GarmentType } from "@/lib/garments";
import { formatDate } from "@/lib/format";
import { formatIraqiPhone } from "@/lib/phone";
import { governorateName } from "@/lib/iraq";
import type { Order, OrderItem } from "@/lib/types";

/** Printable shop-floor sheet: previews, exact placements and sizes in cm, colours, fonts, options, files and quantities per size. */
export default async function ProductionSheet({ params }: { params: Promise<{ locale: string; id: string }> }) {
  const { locale, id } = await params;
  if (!isLocale(locale) || !/^[0-9a-f-]{36}$/.test(id)) notFound();
  const t = adminT(locale);
  const dict = getDictionary(locale);
  const supabase = await createClient();
  const { data: order } = await supabase.from("orders").select("*").eq("id", id).maybeSingle<Order>();
  if (!order) notFound();
  const { data: items } = await supabase.from("order_items").select("*").eq("order_id", id).not("custom_design_id", "is", null).returns<OrderItem[]>();
  const qtyByDesign = new Map((items ?? []).map((i) => [i.custom_design_id as string, i]));
  const { data: designs } = qtyByDesign.size ? await supabase.from("custom_designs").select("*").in("id", [...qtyByDesign.keys()]).returns<DesignRow[]>() : { data: [] as DesignRow[] };
  const groups = groupDesigns(designs ?? []);
  const [{ art, urls }, names, { data: colors }] = await Promise.all([
    loadArtwork(supabase, designs ?? []),
    optionNames(supabase),
    supabase.from("colors").select("id, name_ar, name_en, hex"),
  ]);
  const colorById = new Map((colors ?? []).map((c) => [c.id as string, c]));

  return (
    <div className="mx-auto max-w-4xl bg-paper p-6 print:max-w-none print:p-0">
      <div className="no-print mb-4 flex justify-end"><PrintButton label={t("طباعة", "Print")} /></div>
      <header className="flex flex-wrap items-start justify-between gap-4 border-b-2 border-ink pb-4">
        <div>
          <p className="text-2xl font-extrabold">{t("ورقة التصنيع", "PRODUCTION SHEET")}</p>
          <p className="text-sm text-mute">{t("الطلب", "Order")} <b dir="ltr">{order.order_number}</b> · {formatDate(order.created_at, locale, true)}</p>
        </div>
        <div className="text-sm">
          <p className="font-semibold">{order.customer_name} — <span dir="ltr">{formatIraqiPhone(order.phone)}</span></p>
          <p>{governorateName(order.governorate, locale)} — {order.city}</p>
        </div>
      </header>

      {groups.length === 0 && <p className="py-10 text-center text-mute">{t("لا توجد قطع مطبوعة في هذا الطلب", "No printed pieces in this order")}</p>}
      {groups.map((g, gi) => {
        const d = g.primary;
        const c = colorById.get(d.color_id);
        const total = g.rows.reduce((n, r) => n + (qtyByDesign.get(r.id)?.quantity ?? 0), 0);
        const objs = d.config.objects ?? [];
        const areas = GARMENTS[d.garment_type as GarmentType]?.printAreas;
        const fileIds = [...new Set(objs.map((o) => o.artwork_id).filter(Boolean) as string[])];
        return (
          <section key={g.key} className="break-inside-avoid-page border-b border-line py-6 [page-break-inside:avoid]">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-lg font-extrabold">#{gi + 1} {d.name || t("تصميم خاص", "Custom design")}</h2>
              <p className="rounded-full bg-ink px-3 py-1 text-sm font-bold text-paper">{total} {t("قطعة", "pcs")}</p>
            </div>
            <div className="grid gap-4 sm:grid-cols-5">
              <div className="grid grid-cols-2 gap-2 sm:col-span-3">
                {[d.preview_front_path, d.preview_back_path].map((p, i) => (
                  <figure key={i} className="overflow-hidden rounded-lg border border-line bg-bone">
                    <div className="relative aspect-[6/7]">{p && urls[p] && <Image src={urls[p]!} alt={i ? "back" : "front"} fill sizes="320px" className="object-contain" unoptimized />}</div>
                    <figcaption className="py-1 text-center text-xs font-bold">{i ? t("الخلف", "BACK") : t("الأمام", "FRONT")}</figcaption>
                  </figure>
                ))}
              </div>
              <div className="space-y-3 text-sm sm:col-span-2">
                <dl className="space-y-1">
                  <div className="flex justify-between"><dt className="text-mute">{t("القطعة", "Garment")}</dt><dd className="font-semibold">{d.garment_type}</dd></div>
                  <div className="flex items-center justify-between"><dt className="text-mute">{t("اللون", "Colour")}</dt><dd className="flex items-center gap-2 font-semibold"><span className="size-4 rounded-full border" style={{ background: c?.hex as string }} />{c ? (locale === "ar" ? c.name_ar : c.name_en) : ""}</dd></div>
                  {optionList(d, names, locale).map((o) => <div key={o} className="flex justify-between"><dt className="text-mute">·</dt><dd className="font-semibold">{o}</dd></div>)}
                </dl>
                <table className="w-full border-collapse text-center text-sm">
                  <thead><tr className="border-y border-ink"><th className="py-1 text-start">{t("المقاس", "Size")}</th><th>{t("الكمية", "Qty")}</th></tr></thead>
                  <tbody>{g.rows.map((r) => <tr key={r.id} className="border-b border-line"><td className="py-1 text-start font-bold">{r.size_code}</td><td className="tabular-nums">{qtyByDesign.get(r.id)?.quantity ?? 0}</td></tr>)}</tbody>
                </table>
                {d.notes && <p className="rounded-lg border border-amber p-2 text-xs"><b>{t("ملاحظات الزبون", "Customer notes")}:</b> {d.notes}</p>}
              </div>
            </div>

            <table className="mt-4 w-full border-collapse text-xs">
              <thead><tr className="border-y border-ink text-start"><th className="py-1 text-start">{t("المكان", "Placement")}</th><th className="text-start">{t("العنصر", "Element")}</th><th className="text-start">{t("التفاصيل", "Details")}</th><th className="text-end">{t("القياس (سم)", "Size (cm)")}</th></tr></thead>
              <tbody>
                {objs.map((o, i) => {
                  const cm = objectCm(d.garment_type, o);
                  const detail = o.type === "text"
                    ? [o.fontLabel ?? o.fontFamily, o.fill ? o.fill : t("مفرّغ", "outline"), o.fontWeight && Number(o.fontWeight) >= 600 ? t("عريض", "bold") : "", o.fontStyle === "italic" ? t("مائل", "italic") : "", o.stroke && (o.strokeWidth ?? 0) > 0 ? `${t("حد", "stroke")} ${o.stroke}` : ""].filter(Boolean).join(" · ")
                    : o.type === "shape" ? [o.fill, o.stroke && (o.strokeWidth ?? 0) > 0 ? `${t("حد", "stroke")} ${o.stroke}` : ""].filter(Boolean).join(" · ")
                    : [o.filters?.grayscale ? t("أبيض وأسود", "B&W") : "", o.filters?.invert ? t("معكوس", "inverted") : ""].filter(Boolean).join(" · ");
                  const swatch = o.fill && /^#/.test(o.fill) ? o.fill : null;
                  return (
                    <tr key={i} className="border-b border-line align-top">
                      <td className="py-1.5 font-semibold">{dict.designer.locations[o.location]} <span className="text-mute">({areas?.[o.location].cm.width}×{areas?.[o.location].cm.height})</span></td>
                      <td className="py-1.5" dir="auto">{describeObject(o, locale, art)}</td>
                      <td className="py-1.5"><span className="inline-flex items-center gap-1.5">{swatch && <span className="size-3 rounded-full border" style={{ background: swatch }} />}{detail}{(o.opacity ?? 1) < 1 ? ` · ${Math.round((o.opacity ?? 1) * 100)}%` : ""}{o.angle ? ` · ${Math.round(o.angle)}°` : ""}</span></td>
                      <td className="py-1.5 text-end tabular-nums" dir="ltr">{cm.w.toFixed(1)} × {cm.h.toFixed(1)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {fileIds.length > 0 && (
              <p className="mt-3 text-xs"><b>{t("الملفات الأصلية", "Original files")}:</b> {fileIds.map((fid) => art.get(fid)?.original_name ?? art.get(fid)?.storage_path.split("/").pop()).filter(Boolean).join(" ، ")} <span className="no-print text-mute">— {t("تنزيل من صفحة الطلب", "download from the order page")}</span></p>
            )}
          </section>
        );
      })}
    </div>
  );
}
