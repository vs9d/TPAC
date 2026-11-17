import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Camera, PenLine } from "lucide-react";
import { isLocale } from "@/lib/i18n/config";
import { getDictionary } from "@/lib/i18n";
import { getStoreReviews } from "@/lib/data/reviews";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured, publicEnv } from "@/lib/env";
import { ReviewCard } from "@/components/reviews/review-card";
import { StoreReviewForm } from "@/components/reviews/review-form";
import { Stars } from "@/components/reviews/stars";
import { JsonLd } from "@/components/seo/json-ld";
import { fmt } from "@/lib/i18n/fmt";
import { formatNumber, cn } from "@/lib/format";

type Props = { params: Promise<{ locale: string }>; searchParams: Promise<{ filter?: string; page?: string }> };
const PAGE = 24;

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  if (!isLocale(locale)) return {};
  const t = getDictionary(locale).reviews;
  return { title: t.title, description: t.subtitle, alternates: { canonical: `/${locale}/reviews`, languages: { ar: "/ar/reviews", en: "/en/reviews" } } };
}

export default async function ReviewsPage({ params, searchParams }: Props) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const dict = getDictionary(locale);
  const t = dict.reviews;
  const sp = await searchParams;
  const filter = sp.filter === "photos" || sp.filter === "5" || sp.filter === "4" ? sp.filter : undefined;
  const page = Math.min(Math.max(Number(sp.page) || 1, 1), 20);
  const [{ reviews, stats }, products] = await Promise.all([
    getStoreReviews({ filter, limit: PAGE * page }),
    (async () => {
      if (!isSupabaseConfigured()) return [];
      const supabase = await createClient();
      const { data } = await supabase.from("products").select("id, name_ar, name_en").eq("is_published", true).order("name_ar");
      return data ?? [];
    })(),
  ]);
  const max = Math.max(1, ...Object.values(stats.by_rating ?? {}));
  const href = (f?: string, p?: number) => {
    const q = new URLSearchParams();
    if (f) q.set("filter", f);
    if (p && p > 1) q.set("page", String(p));
    const s = q.toString();
    return `/${locale}/reviews${s ? `?${s}` : ""}`;
  };
  const chips = [
    { key: undefined, label: t.all },
    { key: "photos", label: `${t.withPhotos} (${formatNumber(stats.with_photos ?? 0, locale)})` },
    { key: "5", label: fmt(t.stars, { n: formatNumber(5, locale) }) },
    { key: "4", label: fmt(t.stars, { n: formatNumber(4, locale) }) },
  ];

  return (
    <div>
      {stats.count > 0 && (
        <JsonLd data={{ "@context": "https://schema.org", "@type": "Organization", name: "TPAC", url: publicEnv.siteUrl, aggregateRating: { "@type": "AggregateRating", ratingValue: stats.average, reviewCount: stats.count, bestRating: 5 } }} />
      )}

      {/* Header: score + distribution */}
      <section className="bg-bone">
        <div className="container-x grid gap-10 py-14 md:grid-cols-12 md:items-end md:py-20">
          <div className="md:col-span-7">
            <p className="eyebrow mb-3 text-amber-deep">TPAC</p>
            <h1 className="display text-5xl md:text-7xl">{t.title}</h1>
            <p className="mt-4 max-w-lg text-lg text-mute">{t.subtitle}</p>
            <a href="#write" className="btn btn-primary mt-8"><PenLine className="size-4" /> {t.write}</a>
          </div>
          <div className="md:col-span-5">
            <div className="flex items-end gap-5 border-b border-ink/10 pb-6">
              <p className="display text-7xl leading-none tabular-nums md:text-8xl">{formatNumber(stats.average || 0, locale)}</p>
              <div className="pb-2">
                <Stars value={stats.average || 0} className="size-5" />
                <p className="mt-1 text-sm text-mute">{fmt(t.basedOn, { n: formatNumber(stats.count, locale) })}</p>
              </div>
            </div>
            <ul className="mt-6 space-y-2">
              {[5, 4, 3, 2, 1].map((n) => {
                const c = stats.by_rating?.[String(n)] ?? 0;
                return (
                  <li key={n} className="flex items-center gap-3 text-sm">
                    <span className="w-4 tabular-nums">{formatNumber(n, locale)}</span>
                    <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-ink/10">
                      <span className="block h-full rounded-full bg-amber" style={{ width: `${(c / max) * 100}%` }} />
                    </span>
                    <span className="w-8 text-end tabular-nums text-mute">{formatNumber(c, locale)}</span>
                  </li>
                );
              })}
            </ul>
          </div>
        </div>
      </section>

      {/* Filters */}
      <div className="container-x sticky top-16 z-30 -mt-px bg-paper/95 py-4 backdrop-blur md:top-[72px]">
        <div className="-mx-4 flex gap-2 overflow-x-auto px-4 [&::-webkit-scrollbar]:hidden">
          {chips.map((c) => (
            <Link key={c.label} href={href(c.key)} scroll={false} aria-current={filter === c.key ? "page" : undefined} className={cn("inline-flex h-10 shrink-0 items-center gap-2 border px-4 text-sm font-semibold transition-colors", filter === c.key ? "border-ink bg-ink text-paper" : "border-line hover:border-ink")}>
              {c.key === "photos" && <Camera className="size-4" />} {c.label}
            </Link>
          ))}
        </div>
      </div>

      {/* Masonry wall */}
      <section className="container-x pb-16 pt-4">
        {reviews.length === 0 ? (
          <div className="py-24 text-center">
            <p className="display text-2xl">{t.empty}</p>
            <a href="#write" className="btn btn-outline mt-6">{t.write}</a>
          </div>
        ) : (
          <>
            <div className="columns-1 gap-4 sm:columns-2 lg:columns-3">
              {reviews.map((r) => <ReviewCard key={r.id} review={r} locale={locale} dict={dict} />)}
            </div>
            {reviews.length >= PAGE * page && (
              <div className="mt-10 text-center"><Link href={href(filter, page + 1)} scroll={false} className="btn btn-outline min-w-48">{t.loadMore}</Link></div>
            )}
          </>
        )}
      </section>

      {/* Submit */}
      <section id="write" className="scroll-mt-20 bg-ink text-paper">
        <div className="container-x grid gap-10 py-16 md:grid-cols-12 md:py-24">
          <div className="md:col-span-4">
            <p className="eyebrow mb-3 text-amber">{t.write}</p>
            <h2 className="display text-4xl md:text-5xl">{t.formTitle}</h2>
            <p className="mt-4 text-paper/60">{t.formBody}</p>
          </div>
          <div className="md:col-span-8">
            <StoreReviewForm products={products} />
          </div>
        </div>
      </section>
    </div>
  );
}
