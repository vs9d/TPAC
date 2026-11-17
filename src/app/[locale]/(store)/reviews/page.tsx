import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { PenLine } from "lucide-react";
import { isLocale } from "@/lib/i18n/config";
import { getDictionary } from "@/lib/i18n";
import { getStoreReviews } from "@/lib/data/reviews";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured, publicEnv } from "@/lib/env";
import { ReviewCard, QuoteMark } from "@/components/reviews/review-card";
import { StoreReviewForm } from "@/components/reviews/review-form";
import { Stars } from "@/components/reviews/stars";
import { JsonLd } from "@/components/seo/json-ld";
import { fmt } from "@/lib/i18n/fmt";
import { RevealCard, CountUp, FadeUp } from "@/components/reviews/motion";

type Props = { params: Promise<{ locale: string }>; searchParams: Promise<{ page?: string }> };
const PAGE = 30;

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  if (!isLocale(locale)) return {};
  const t = getDictionary(locale).reviews;
  return { title: t.title, description: t.subtitle, alternates: { canonical: `/${locale}/reviews`, languages: { ar: "/ar/reviews", en: "/en/reviews" } } };
}

/** Decorative flowing lines behind the hero, in TPAC pine. */
function Waves() {
  const paths = Array.from({ length: 9 }, (_, i) => {
    const y = 40 + i * 70;
    return `M-100 ${y} C 100 ${y - 120}, 250 ${y + 120}, 450 ${y} S 800 ${y - 120}, 1000 ${y} S 1350 ${y + 120}, 1600 ${y}`;
  });
  return (
    <svg className="pointer-events-none absolute inset-0 h-full w-full" viewBox="0 0 1440 640" preserveAspectRatio="xMidYMid slice" aria-hidden>
      <g fill="none" stroke="currentColor" strokeWidth="2.5" className="animate-[waves_18s_ease-in-out_infinite_alternate] text-pine/30">
        {paths.map((d, i) => <path key={i} d={d} transform={`rotate(-14 720 320) translate(0 ${i % 2 ? 8 : 0})`} />)}
      </g>
    </svg>
  );
}

export default async function ReviewsPage({ params, searchParams }: Props) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const dict = getDictionary(locale);
  const t = dict.reviews;
  const sp = await searchParams;
  const page = Math.min(Math.max(Number(sp.page) || 1, 1), 20);
  const [{ reviews, stats }, products] = await Promise.all([
    getStoreReviews({ limit: PAGE * page }),
    (async () => {
      if (!isSupabaseConfigured()) return [];
      const supabase = await createClient();
      const { data } = await supabase.from("products").select("id, name_ar, name_en").eq("is_published", true).order("name_ar");
      return data ?? [];
    })(),
  ]);
  const highlight = reviews.find((r) => r.is_featured && r.body && r.body.length <= 120) ?? reviews.find((r) => r.body && r.body.length <= 90 && r.rating === 5);

  return (
    <div>
      {stats.count > 0 && (
        <JsonLd data={{ "@context": "https://schema.org", "@type": "Organization", name: "TPAC", url: publicEnv.siteUrl, aggregateRating: { "@type": "AggregateRating", ratingValue: stats.average, reviewCount: stats.count, bestRating: 5 } }} />
      )}

      {/* Hero */}
      <section className="relative overflow-hidden">
        <Waves />
        <div className="container-x relative flex flex-col items-center py-16 text-center md:py-24">
          <FadeUp className="flex flex-col items-center">
            <Image src="/brand/tpac-logo-pine.png" alt="TPAC" width={1512} height={806} priority className="h-auto w-64 md:w-96" />
            <p className="mt-5 text-xs font-semibold tracking-[0.45em] text-pine md:text-sm" dir="ltr">{t.tagline}</p>
          </FadeUp>
          <FadeUp delay={0.15}><h1 className="mt-8 font-[family-name:var(--font-display)] text-2xl font-bold text-ink/60 md:text-4xl">{t.heroTitle}</h1></FadeUp>
          <FadeUp delay={0.25} className="mt-8 grid w-full max-w-xl grid-cols-2 gap-3 md:gap-5">
            <div className="flex flex-col items-center justify-center rounded-3xl bg-pine px-3 py-6 text-paper md:py-8">
              <p className="font-[family-name:var(--font-display)] text-5xl font-extrabold tabular-nums md:text-6xl" dir="ltr">
                <CountUp value={stats.satisfaction ?? 0} /><span className="text-xl">%</span>
              </p>
              <p className="mt-3 text-sm text-paper/85">{t.satisfaction}</p>
            </div>
            <div className="rounded-3xl border border-line bg-paper/90 px-3 py-6 backdrop-blur md:py-8">
              <p className="font-[family-name:var(--font-display)] text-5xl font-extrabold tabular-nums md:text-6xl" dir="ltr">
                <CountUp value={stats.average || 0} decimals={1} /><span className="text-xl text-ink/60">/5</span>
              </p>
              <div className="mt-3 flex justify-center"><Stars value={stats.average || 0} tone="pine" className="size-5" /></div>
              <p className="mt-2 text-sm text-mute">{t.avgLabel}</p>
            </div>
          </FadeUp>
          {stats.count > 0 && <p className="mt-4 text-xs text-mute">{fmt(t.basedOn, { n: stats.count })}</p>}
        </div>
      </section>

      {/* Reviews wall — two columns even on phones */}
      <section className="container-x pb-12">
        {reviews.length === 0 ? (
          <div className="py-16 text-center">
            <p className="text-lg text-mute">{t.empty}</p>
            <a href="#write" className="btn btn-primary mt-6 rounded-full"><PenLine className="size-4" /> {t.write}</a>
          </div>
        ) : (
          <>
            <div className="columns-2 gap-3 sm:gap-4 lg:columns-3">
              {reviews.map((r, i) => <RevealCard key={r.id} index={i}><ReviewCard review={r} locale={locale} dict={dict} /></RevealCard>)}
            </div>
            {reviews.length >= PAGE * page && (
              <div className="mt-8 text-center"><Link href={`/${locale}/reviews?page=${page + 1}`} scroll={false} className="btn btn-outline min-w-48 rounded-full">{t.loadMore}</Link></div>
            )}
          </>
        )}
      </section>

      {/* Highlighted quote */}
      {highlight?.body && (
        <section className="container-x py-12 text-center md:py-20">
          <FadeUp>
            <QuoteMark className="mx-auto h-8 w-11 text-pine" />
            <blockquote className="mx-auto mt-6 max-w-3xl font-[family-name:var(--font-display)] text-3xl font-extrabold leading-snug md:text-5xl">{highlight.body}</blockquote>
          </FadeUp>
        </section>
      )}

      {/* Submit */}
      <section id="write" className="scroll-mt-20 bg-ink text-paper">
        <div className="container-x grid gap-10 py-16 md:grid-cols-12 md:py-24">
          <div className="md:col-span-4">
            <p className="eyebrow mb-3 text-amber">{t.write}</p>
            <h2 className="display text-4xl md:text-5xl">{t.formTitle}</h2>
            <p className="mt-4 text-paper/60">{t.formBody}</p>
          </div>
          <div className="md:col-span-8"><StoreReviewForm products={products} /></div>
        </div>
      </section>
    </div>
  );
}
