import Link from "next/link";
import { Suspense } from "react";
import type { Locale } from "@/lib/i18n/config";
import type { Dict } from "@/lib/i18n/dictionaries/ar";
import { searchProducts, getCategories, getCollections, getColors, getSizes, type CatalogQuery } from "@/lib/data/catalog";
import { ProductCard } from "./product-card";
import { CatalogFilters, SortSelect } from "./filters";
import { formatNumber } from "@/lib/format";

export type SearchParams = Record<string, string | string[] | undefined>;
const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);
const many = (v: string | string[] | undefined) => (v === undefined ? [] : Array.isArray(v) ? v : [v]);
const PAGE = 24;

export function queryFromParams(sp: SearchParams, fixed: Partial<CatalogQuery> = {}): CatalogQuery & { page: number } {
  const sort = one(sp.sort);
  const num = (v: string | undefined) => (v && /^\d+$/.test(v) ? Number(v) : undefined);
  const page = Math.min(Math.max(num(one(sp.page)) ?? 1, 1), 20);
  return {
    q: one(sp.q)?.slice(0, 80),
    category: one(sp.category),
    collection: one(sp.collection),
    sizes: many(sp.size).slice(0, 10),
    colors: many(sp.color).slice(0, 10),
    min_price: num(one(sp.min)),
    max_price: num(one(sp.max)),
    in_stock: one(sp.stock) === "1" || undefined,
    new: one(sp.new) === "1" || undefined,
    best: one(sp.best) === "1" || undefined,
    sort: sort === "popular" || sort === "price_asc" || sort === "price_desc" ? sort : "newest",
    limit: PAGE * page,
    offset: 0,
    page,
    ...fixed,
  };
}

export async function CatalogView({ locale, dict, searchParams, fixed = {}, basePath }: { locale: Locale; dict: Dict; searchParams: SearchParams; fixed?: Partial<CatalogQuery>; basePath: string }) {
  const { page, ...query } = queryFromParams(searchParams, fixed);
  const [result, categories, collections, colors, sizes] = await Promise.all([
    searchProducts(query).catch(() => null),
    getCategories(),
    getCollections(),
    getColors(),
    getSizes(),
  ]);

  if (!result) {
    return <p className="py-24 text-center text-mute">{dict.common.somethingWrong}</p>;
  }
  const nextParams = new URLSearchParams();
  for (const [k, v] of Object.entries(searchParams)) for (const x of many(v)) nextParams.append(k, x);
  nextParams.set("page", String(page + 1));

  return (
    <div className="grid gap-8 lg:grid-cols-[220px_1fr] lg:gap-12">
      <aside className="lg:sticky lg:top-28 lg:self-start">
        <Suspense fallback={null}>
          <CatalogFilters
            total={result.total}
            hideCategory={!!fixed.category}
            hideCollection={!!fixed.collection}
            categories={categories.map((c) => ({ value: c.slug, ar: c.name_ar, en: c.name_en }))}
            collections={collections.map((c) => ({ value: c.slug, ar: c.name_ar, en: c.name_en }))}
            sizes={sizes.map((s) => s.code)}
            colors={colors.map((c) => ({ value: c.code, ar: c.name_ar, en: c.name_en, hex: c.hex }))}
          />
        </Suspense>
      </aside>
      <div>
        <div className="mb-6 flex items-center justify-between gap-4 border-b border-line pb-4">
          <p className="text-sm text-mute">
            {formatNumber(result.total, locale)} {dict.shop.results}
          </p>
          <Suspense fallback={null}>
            <SortSelect />
          </Suspense>
        </div>
        {result.items.length === 0 ? (
          <div className="py-24 text-center">
            <p className="display text-2xl">{dict.shop.noResults}</p>
            <p className="mt-2 text-mute">{dict.shop.noResultsBody}</p>
            <Link href={basePath} className="btn btn-outline mt-6">{dict.shop.clearFilters}</Link>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-2 gap-x-3 gap-y-10 md:grid-cols-3 md:gap-x-5">
              {result.items.map((p, i) => (
                <ProductCard key={p.id} product={p} locale={locale} dict={dict} priority={i < 3} sizes="(min-width:1024px) 26vw, (min-width:768px) 33vw, 50vw" />
              ))}
            </div>
            {result.total > result.items.length && (
              <div className="mt-14 text-center">
                <Link href={`${basePath}?${nextParams.toString()}`} scroll={false} className="btn btn-outline min-w-48">{dict.shop.loadMore}</Link>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
