import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Sparkles } from "lucide-react";
import { isLocale } from "@/lib/i18n/config";
import { Designer } from "@/components/designer/designer";
import { FONTS, FONT_CLASSES, loadStudioData } from "@/components/designer/studio-data";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const ar = locale === "ar";
  return {
    title: ar ? "صمّم وانشر تصميمك" : "Design and publish",
    description: ar ? "صمّم بالاستوديو وانشر تصميمك بصفحة تصاميم الزبائن — بدون طلب." : "Design in the studio and publish it on Customer designs — no order needed.",
    alternates: { canonical: `/${locale}/community/new` },
  };
}

/** The studio for publishing only: pick the garment and colour, design, then send it for approval. Nothing is ordered. */
export default async function CommunityNewPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const ar = locale === "ar";
  const studio = await loadStudioData();
  return (
    <div className="container-x relative py-8 md:py-12">
      <span aria-hidden className={`${FONT_CLASSES} pointer-events-none absolute opacity-0`}>ابجد abc</span>
      <header className="mb-8 max-w-3xl space-y-3">
        <p className="eyebrow flex items-center gap-2 text-pine"><Sparkles className="size-4" aria-hidden="true" /> {ar ? "تصاميم الزبائن" : "Customer designs"}</p>
        <h1 className="display text-[2.05rem] leading-[1.2] sm:text-5xl">{ar ? "صمّم وانشر تصميمك" : "Design and publish"}</h1>
        <p className="text-base leading-relaxed text-mute">{ar ? "عندك فكرة؟ هسه وقتها 🎨 صمّم براحتك واضغط «انشر تصميمي». بعد موافقتنا يظهر بصفحة تصاميم الزبائن، والناس تلبسه بكل العراق، وأنت تاخذ مكافأة على كل قطعة تنباع — إحنا نطبع ونوصّل، أنت بس أبدع. هذي الصفحة للنشر بس — ما ينطلب شي ولا ينضاف للسلة." : "Design freely, then press “Publish my design”. Once approved it appears on Customer designs, others can order it, and you get a reward for every piece. This page is only for publishing — nothing is ordered or added to a bag."}</p>
        <Link href={`/${locale}/community`} className="inline-block text-sm font-semibold underline">{ar ? "شوف تصاميم الزبائن" : "See customer designs"}</Link>
      </header>
      {studio.garments.length > 0 && (
        <Designer
          mode="publish"
          garments={studio.garments} locations={studio.locations} colors={studio.colors} fonts={FONTS} options={studio.options} tiers={studio.tiers}
          settings={studio.settings} templates={studio.templates}
        />
      )}
    </div>
  );
}
