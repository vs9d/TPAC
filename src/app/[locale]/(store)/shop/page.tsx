import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { isLocale } from "@/lib/i18n/config";
import { getDictionary } from "@/lib/i18n";
import { getCategories } from "@/lib/data/catalog";
import { CatalogView, type SearchParams } from "@/components/product/catalog-view";

type Props = { params: Promise<{ locale: string }>; searchParams: Promise<SearchParams> };

export async function generateMetadata({ params, searchParams }: Props): Promise<Metadata> {
  const { locale } = await params;
  if (!isLocale(locale)) return {};
  const sp = await searchParams;
  const dict = getDictionary(locale);
  const cat = typeof sp.category === "string" ? (await getCategories()).find((c) => c.slug === sp.category) : undefined;
  const title = cat ? (locale === "ar" ? cat.name_ar : cat.name_en) : dict.shop.title;
  const hasFilters = Object.keys(sp).some((k) => k !== "category");
  return {
    title,
    alternates: { canonical: `/${locale}/shop${cat ? `?category=${cat.slug}` : ""}`, languages: { ar: `/ar/shop`, en: `/en/shop` } },
    // filtered/sorted permutations are not indexed to avoid duplicate content
    robots: hasFilters ? { index: false, follow: true } : undefined,
  };
}

export default async function ShopPage({ params, searchParams }: Props) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const dict = getDictionary(locale);
  const sp = await searchParams;
  const q = typeof sp.q === "string" ? sp.q : undefined;
  const cat = typeof sp.category === "string" ? (await getCategories()).find((c) => c.slug === sp.category) : undefined;
  const title = q ? `${dict.shop.searchResultsFor} «${q}»` : cat ? (locale === "ar" ? cat.name_ar : cat.name_en) : sp.new ? dict.nav.newArrivals : dict.shop.allProducts;
  return (
    <div className="container-x py-10 md:py-14">
      <h1 className="display mb-8 text-4xl md:mb-12 md:text-6xl">{title}</h1>
      <CatalogView locale={locale} dict={dict} searchParams={sp} basePath={`/${locale}/shop`} />
    </div>
  );
}
