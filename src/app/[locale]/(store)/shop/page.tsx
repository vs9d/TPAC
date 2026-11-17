import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { isLocale } from "@/lib/i18n/config";
import { getDictionary } from "@/lib/i18n";
import { getCategories } from "@/lib/data/catalog";
import Link from "next/link";
import { CatalogView, type SearchParams } from "@/components/product/catalog-view";
import { cn } from "@/lib/format";

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
  const allCats = (await getCategories()).filter((c) => !c.parent_id).map((c) => ({ slug: c.slug as string | undefined, ar: c.name_ar, en: c.name_en }));
  const title = q ? `${dict.shop.searchResultsFor} «${q}»` : cat ? (locale === "ar" ? cat.name_ar : cat.name_en) : sp.new ? dict.nav.newArrivals : dict.shop.allProducts;
  return (
    <div className="container-x py-10 md:py-14">
      <h1 className="display mb-6 text-4xl md:mb-8 md:text-6xl">{title}</h1>
      <nav aria-label={dict.shop.category} className="-mx-4 mb-8 flex gap-2 overflow-x-auto px-4 pb-1 md:mx-0 md:mb-10 md:px-0 [&::-webkit-scrollbar]:hidden">
        {[{ slug: undefined as string | undefined, ar: dict.common.all, en: dict.common.all }, ...allCats].map((c) => {
          const on = (sp.category ?? undefined) === c.slug;
          return (
            <Link key={c.slug ?? "all"} href={`/${locale}/shop${c.slug ? `?category=${c.slug}` : ""}`} aria-current={on ? "page" : undefined} className={cn("inline-flex h-11 shrink-0 items-center rounded-full border px-5 text-sm font-bold transition-colors", on ? "border-pine bg-pine text-white dark:text-night" : "border-line hover:border-ink")}>
              {locale === "ar" ? c.ar : c.en}
            </Link>
          );
        })}
      </nav>
      <CatalogView locale={locale} dict={dict} searchParams={sp} basePath={`/${locale}/shop`} />
    </div>
  );
}
