import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { isLocale } from "@/lib/i18n/config";
import { getDictionary } from "@/lib/i18n";
import { getCollections } from "@/lib/data/catalog";
import { CatalogView, type SearchParams } from "@/components/product/catalog-view";

type Props = { params: Promise<{ locale: string; slug: string }>; searchParams: Promise<SearchParams> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale, slug } = await params;
  if (!isLocale(locale)) return {};
  const c = (await getCollections()).find((x) => x.slug === slug);
  if (!c) return {};
  return {
    title: locale === "ar" ? c.name_ar : c.name_en,
    description: (locale === "ar" ? c.description_ar : c.description_en) ?? undefined,
    alternates: { canonical: `/${locale}/collections/${slug}`, languages: { ar: `/ar/collections/${slug}`, en: `/en/collections/${slug}` } },
    openGraph: c.image_url ? { images: [c.image_url] } : undefined,
  };
}

export default async function CollectionPage({ params, searchParams }: Props) {
  const { locale, slug } = await params;
  if (!isLocale(locale)) notFound();
  const dict = getDictionary(locale);
  const c = (await getCollections()).find((x) => x.slug === slug);
  if (!c) notFound();
  return (
    <div className="container-x py-10 md:py-14">
      <div className="mb-10 max-w-2xl md:mb-14">
        <p className="eyebrow mb-3 text-amber-deep">{dict.shop.collection}</p>
        <h1 className="display text-5xl md:text-7xl">{locale === "ar" ? c.name_ar : c.name_en}</h1>
        {(locale === "ar" ? c.description_ar : c.description_en) && <p className="mt-4 text-lg leading-relaxed text-mute">{locale === "ar" ? c.description_ar : c.description_en}</p>}
      </div>
      <CatalogView locale={locale} dict={dict} searchParams={await searchParams} fixed={{ collection: slug }} basePath={`/${locale}/collections/${slug}`} />
    </div>
  );
}
