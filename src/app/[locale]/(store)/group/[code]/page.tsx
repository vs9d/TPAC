import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { CalendarClock, Users } from "lucide-react";
import { isLocale } from "@/lib/i18n/config";
import { getGroupByCode, getPreviewKits } from "@/lib/data/group";
import { GroupJoinForm } from "@/components/group/join-form";
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
  const kit = g.garment ? (await getPreviewKits().catch(() => [])).find((k) => k.garment === g.garment) ?? null : null;
  const fixed = Object.fromEntries(Object.entries(g.template.fixed).filter(([, v]) => v).map(([k, v]) => [k, `/api/art/${v}?group=${g.code}`]));
  const sizes = g.product?.sizes.length ? BULK_SIZES.filter((s) => g.product!.sizes.includes(s)) : [...BULK_SIZES];
  return (
    <div className="container-x max-w-2xl space-y-6 py-10 md:py-14">
      <header className="space-y-3">
        <p className="eyebrow text-pine">{ar ? "طلب جماعي" : "Group order"}</p>
        <h1 className="display text-3xl md:text-5xl">{g.title}</h1>
        <p className="text-sm text-mute">{ar ? `ينظمه ${g.organizer_name}` : `Organised by ${g.organizer_name}`}</p>
        <div className="flex flex-wrap gap-2 text-sm">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-bone px-3 py-1.5 font-semibold"><Users className="size-4" aria-hidden="true" /> {ar ? `${count} قطعة لحد هسه` : `${count} pieces so far`}</span>
          {g.deadline && <span className="inline-flex items-center gap-1.5 rounded-full bg-bone px-3 py-1.5 font-semibold"><CalendarClock className="size-4" aria-hidden="true" /> {ar ? "آخر موعد:" : "Until"} {formatDate(g.deadline, locale)}</span>}
        </div>
      </header>
      {(g.product || g.idea) && (
        <div className="flex gap-4 rounded-[1.5rem] border border-line bg-paper p-4">
          {g.product?.image && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={g.product.image} alt="" className="size-24 shrink-0 rounded-xl bg-bone object-cover" />
          )}
          <div className="min-w-0 text-sm">
            {g.product && <a href={`/${locale}/product/${g.product.slug}`} target="_blank" className="font-bold underline">{ar ? g.product.name_ar : g.product.name_en}</a>}
            {g.idea && <p className="mt-1 whitespace-pre-line text-mute">{g.idea}</p>}
          </div>
        </div>
      )}
      {g.closed ? (
        <p className="rounded-2xl bg-bone p-5 text-center font-semibold">{g.status === "submitted" ? (ar ? "انرسل الطلب لـ TPAC — التسجيل انتهى." : "The order was sent to TPAC — the list is closed.") : (ar ? "التسجيل انغلق. تواصل ويا المنظّم." : "The list is closed. Contact the organiser.")}</p>
      ) : (
        <GroupJoinForm code={g.code} sizes={sizes} template={g.template} kit={kit} colorId={g.color_id} fixed={fixed} />
      )}
    </div>
  );
}
