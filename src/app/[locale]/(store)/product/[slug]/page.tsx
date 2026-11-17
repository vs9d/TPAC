import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { Star } from "lucide-react";
import { isLocale } from "@/lib/i18n/config";
import { getDictionary } from "@/lib/i18n";
import { getProductBySlug, getReviews, getSizes, searchProducts } from "@/lib/data/catalog";
import { getSession } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { ProductView } from "@/components/product/product-view";
import { ProductCard } from "@/components/product/product-card";
import { ReviewForm } from "@/components/product/review-form";
import { JsonLd } from "@/components/seo/json-ld";
import { publicEnv } from "@/lib/env";
import { formatDate } from "@/lib/format";

type Props = { params: Promise<{ locale: string; slug: string }> };

const GARMENT_BY_CATEGORY: Record<string, string> = {
  "oversized-t-shirts": "oversized",
  hoodies: "hoodie",
  sweatshirts: "sweatshirt",
  "long-sleeve": "longsleeve",
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale, slug } = await params;
  if (!isLocale(locale)) return {};
  const p = await getProductBySlug(slug);
  if (!p) return {};
  const title = (locale === "ar" ? p.seo_title_ar : p.seo_title_en) || (locale === "ar" ? p.name_ar : p.name_en);
  const description = ((locale === "ar" ? p.seo_description_ar : p.seo_description_en) || (locale === "ar" ? p.description_ar : p.description_en) || "").slice(0, 160);
  const image = p.product_images[0]?.url;
  return {
    title,
    description,
    alternates: { canonical: `/${locale}/product/${slug}`, languages: { ar: `/ar/product/${slug}`, en: `/en/product/${slug}` } },
    openGraph: { type: "website", title, description, images: image ? [{ url: image, width: 1200, height: 1500 }] : undefined },
  };
}

export default async function ProductPage({ params }: Props) {
  const { locale, slug } = await params;
  if (!isLocale(locale)) notFound();
  const dict = getDictionary(locale);
  const product = await getProductBySlug(slug);
  if (!product) notFound();
  const [sizes, reviews, related, session] = await Promise.all([
    getSizes(),
    getReviews(product.id),
    searchProducts({ category: product.category?.slug, exclude: product.id, limit: 4, sort: "popular" }).catch(() => ({ total: 0, items: [] })),
    getSession(),
  ]);
  let favorite = false;
  if (session) {
    const supabase = await createClient();
    const { data } = await supabase.from("favorites").select("product_id").eq("user_id", session.userId).eq("product_id", product.id).maybeSingle();
    favorite = !!data;
  }
  const garment = GARMENT_BY_CATEGORY[product.category?.slug ?? ""] ?? "tshirt";
  const name = locale === "ar" ? product.name_ar : product.name_en;
  const prices = product.product_variants.map((v) => v.price_override ?? product.base_price);
  const inStock = product.product_variants.some((v) => (v.inventory?.quantity ?? 0) > 0);
  const avg = reviews.length ? reviews.reduce((n, r) => n + r.rating, 0) / reviews.length : null;

  return (
    <div className="container-x py-6 md:py-10">
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "Product",
          name,
          description: locale === "ar" ? product.description_ar : product.description_en,
          image: product.product_images.slice(0, 6).map((i) => (i.url.startsWith("http") ? i.url : `${publicEnv.siteUrl}${i.url}`)),
          sku: product.product_variants[0]?.sku,
          brand: { "@type": "Brand", name: "TPAC" },
          category: product.category ? (locale === "ar" ? product.category.name_ar : product.category.name_en) : undefined,
          offers: {
            "@type": "AggregateOffer",
            priceCurrency: "IQD",
            lowPrice: Math.min(...prices, product.base_price),
            highPrice: Math.max(...prices, product.base_price),
            offerCount: product.product_variants.length,
            availability: inStock ? "https://schema.org/InStock" : "https://schema.org/OutOfStock",
            url: `${publicEnv.siteUrl}/${locale}/product/${slug}`,
          },
          ...(avg ? { aggregateRating: { "@type": "AggregateRating", ratingValue: avg.toFixed(1), reviewCount: reviews.length } } : {}),
        }}
      />
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "BreadcrumbList",
          itemListElement: [
            { "@type": "ListItem", position: 1, name: "TPAC", item: `${publicEnv.siteUrl}/${locale}` },
            ...(product.category ? [{ "@type": "ListItem", position: 2, name: locale === "ar" ? product.category.name_ar : product.category.name_en, item: `${publicEnv.siteUrl}/${locale}/shop?category=${product.category.slug}` }] : []),
            { "@type": "ListItem", position: product.category ? 3 : 2, name },
          ],
        }}
      />
      <nav className="mb-6 text-xs text-mute" aria-label="breadcrumb">
        <Link href={`/${locale}`} className="hover:text-ink">{dict.nav.home}</Link>
        <span className="mx-2">/</span>
        {product.category && (
          <>
            <Link href={`/${locale}/shop?category=${product.category.slug}`} className="hover:text-ink">{locale === "ar" ? product.category.name_ar : product.category.name_en}</Link>
            <span className="mx-2">/</span>
          </>
        )}
        <span className="text-ink">{name}</span>
      </nav>

      <ProductView product={product} sizeOrder={sizes.map((s) => s.code)} garment={garment} initialFavorite={favorite} signedIn={!!session} />

      <section className="mt-20 border-t border-line pt-12" aria-labelledby="reviews">
        <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
          <h2 id="reviews" className="display text-3xl">{dict.product.reviews} {avg && <span className="text-lg text-mute">({avg.toFixed(1)} / 5)</span>}</h2>
        </div>
        {reviews.length === 0 && <p className="mb-6 text-mute">{dict.product.noReviews}</p>}
        <ul className="mb-8 grid gap-6 md:grid-cols-2">
          {reviews.map((r) => (
            <li key={r.id} className="border border-line p-5">
              <div className="flex items-center gap-1" aria-label={`${r.rating}/5`}>
                {Array.from({ length: 5 }).map((_, i) => <Star key={i} className={`size-4 ${i < r.rating ? "fill-amber text-amber" : "text-line"}`} />)}
              </div>
              {r.body && <p className="mt-3 text-sm leading-relaxed">{r.body}</p>}
              <p className="mt-3 text-xs text-mute">{r.author_name ?? "TPAC"} — {formatDate(r.created_at, locale)}</p>
            </li>
          ))}
        </ul>
        <ReviewForm productId={product.id} signedIn={!!session} slug={slug} />
      </section>

      {related.items.length > 0 && (
        <section className="mt-20">
          <h2 className="display mb-8 text-3xl md:text-4xl">{dict.product.related}</h2>
          <div className="grid grid-cols-2 gap-x-3 gap-y-10 md:grid-cols-4 md:gap-x-5">
            {related.items.map((p) => <ProductCard key={p.id} product={p} locale={locale} dict={dict} />)}
          </div>
        </section>
      )}
    </div>
  );
}
