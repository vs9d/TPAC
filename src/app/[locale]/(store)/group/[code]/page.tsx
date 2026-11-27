import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { CalendarClock, Users } from "lucide-react";
import { isLocale } from "@/lib/i18n/config";
import { getGroupByCode } from "@/lib/data/group";
import { GroupJoinForm } from "@/components/group/join-form";
import { Designer } from "@/components/designer/designer";
import { FONTS, FONT_CLASSES, loadStudioData } from "@/components/designer/studio-data";
import { BULK_SIZES } from "@/lib/validation";
import { formatDate } from "@/lib/format";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { robots: { index: false, follow: false } };

export default async function GroupJoinPage({ params }: { params: Promise<{ locale: string; code: string }> }) {
  const { locale, code } = await params;
  if (!isLocale(locale)) notFound();
  const ar = locale === "ar";
  const found = await getGroupByCode(code);
  if (!found) notFound();
  const { group: g, count } = found;
  const fixedUrls = Object.fromEntries(Object.entries(g.template.fixed).filter(([, v]) => v).map(([k, v]) => [k, `/api/art/${v}?group=${g.code}`]));
  const studio = g.garment && !g.closed ? await loadStudioData() : null;
  const garment = studio?.garments.find((x) => x.code === g.garment) ?? null;
  const sizes = garment ? BULK_SIZES.filter((s) => garment.sizes.includes(s)) : g.product?.sizes.length ? BULK_SIZES.filter((s) => g.product!.sizes.includes(s)) : [...BULK_SIZES];

  const header = (
    <header className="space-y-3">
      <p className="eyebrow text-pine">{ar ? "طلب جماعي" : "Group order"}</p>
      <h1 className="display text-3xl md:text-5xl">{g.title}</h1>
      <div className="flex flex-wrap gap-2 text-sm">
        <span className="inline-flex items-center gap-1.5 rounded-full bg-bone px-3 py-1.5 font-semibold"><Users className="size-4" aria-hidden="true" /> {ar ? `${count} قطعة لحد هسه` : `${count} pieces so far`}</span>
        {g.deadline && <span className="inline-flex items-center gap-1.5 rounded-full bg-bone px-3 py-1.5 font-semibold"><CalendarClock className="size-4" aria-hidden="true" /> {ar ? "آخر موعد:" : "Until"} {formatDate(g.deadline, locale)}</span>}
      </div>
      {g.idea && <p className="max-w-2xl whitespace-pre-line text-sm text-mute">{g.idea}</p>}
    </header>
  );

  if (g.closed) {
    return (
      <div className="container-x max-w-2xl space-y-6 py-10 md:py-14">
        {header}
        <p className="rounded-2xl bg-bone p-5 text-center font-semibold">{g.status === "submitted" ? (ar ? "انرسل الطلب لـ TPAC — التسجيل انتهى." : "The order was sent to TPAC — the list is closed.") : (ar ? "التسجيل انغلق. تواصل ويا المنظّم." : "The list is closed. Contact the organiser.")}</p>
      </div>
    );
  }

  // the organiser's own design: every member designs their piece in the full studio
  if (studio && garment) {
    return (
      <div className="container-x relative space-y-6 py-8 md:py-12">
        <span aria-hidden className={`${FONT_CLASSES} pointer-events-none absolute opacity-0`}>ابجد abc</span>
        {header}
        <Designer
          mode="group"
          group={{ code: g.code, title: g.title, organizer: g.organizer_name, garment: garment.code, colorId: g.color_id, template: g.template, fixedUrls, sizes }}
          garments={[garment]} locations={studio.locations} colors={studio.colors} fonts={FONTS} options={studio.options} tiers={studio.tiers}
          settings={studio.settings} initialGarment={garment.code} templates={studio.templates}
        />
      </div>
    );
  }

  // a store product: name and size (and the name to print) only
  return (
    <div className="container-x max-w-2xl space-y-6 py-10 md:py-14">
      {header}
      {g.product && (
        <div className="flex gap-4 rounded-[1.5rem] border border-line bg-paper p-4">
          {g.product.image && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={g.product.image} alt="" className="size-24 shrink-0 rounded-xl bg-bone object-cover" />
          )}
          <a href={`/${locale}/product/${g.product.slug}`} target="_blank" className="text-sm font-bold underline">{ar ? g.product.name_ar : g.product.name_en}</a>
        </div>
      )}
      <GroupJoinForm code={g.code} sizes={sizes} template={g.template} kit={null} colorId={g.color_id} fixed={{}} />
    </div>
  );
}
