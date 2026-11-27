import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Trophy } from "lucide-react";
import { isLocale } from "@/lib/i18n/config";
import { topCreators } from "@/lib/data/creators";
import { CreatorCardView } from "@/components/creators/creator-card";
import { cn } from "@/lib/format";

export const revalidate = 300;
export const metadata: Metadata = { title: "Top Creators — TPAC" };

export default async function TopCreatorsPage({ params, searchParams }: { params: Promise<{ locale: string }>; searchParams: Promise<{ range?: string }> }) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const ar = locale === "ar";
  const range = (await searchParams).range === "all" ? "all" : "month";
  const list = await topCreators(range, 48);
  return (
    <div className="container-x space-y-8 py-10 md:py-14">
      <header className="space-y-3">
        <p className="eyebrow flex items-center gap-2 text-pine"><Trophy className="size-4" aria-hidden="true" /> Top Creators</p>
        <h1 className="display text-3xl md:text-5xl">{ar ? "أفضل مبدعين TPAC" : "TPAC's top creators"}</h1>
        <p className="max-w-2xl text-mute">{ar ? "الترتيب حسب القطع المباعة، ثم الطلبات المكتملة، ثم المشاهدات. ادعم مبدعك المفضل بطلب قطعة من تصاميمه." : "Ranked by pieces sold, then completed orders, then views. Back your favourite with a piece from their designs."}</p>
        <nav className="flex gap-1 rounded-full border border-line bg-bone p-1 text-sm font-bold sm:w-fit">
          {([["month", ar ? "هذا الشهر" : "This month"], ["all", ar ? "كل الوقت" : "All time"]] as const).map(([k, l]) => (
            <Link key={k} href={`/${locale}/creators/top?range=${k}`} className={cn("rounded-full px-4 py-2", range === k ? "bg-ink text-paper" : "text-mute")}>{l}</Link>
          ))}
        </nav>
      </header>
      {list.length === 0 ? <p className="rounded-[1.5rem] bg-bone p-8 text-center text-mute">{ar ? "قريباً." : "Coming soon."}</p> : (
        <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
          {list.map((c, i) => <CreatorCardView key={c.user_id} c={c} locale={locale} rank={i + 1} stat={ar ? `${c.pieces} قطعة · ${c.orders} طلب مكتمل · ${c.views} مشاهدة` : `${c.pieces} pcs · ${c.orders} completed · ${c.views} views`} />)}
        </div>
      )}
    </div>
  );
}
