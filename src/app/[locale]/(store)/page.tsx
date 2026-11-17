import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { isLocale } from "@/lib/i18n/config";
import { getDictionary } from "@/lib/i18n";
import { getBanners, getHomepageSections, getSettings } from "@/lib/data/content";
import { getCategories, getCollections, searchProducts } from "@/lib/data/catalog";
import { Hero, CategoriesSection, CollectionsRail, ProductRail, FeaturedCollection, CustomDesignSection, ReviewsTeaser, BulkSection, StorySection, SocialSection, NewsletterSection } from "@/components/home/sections";
import { getStoreReviews } from "@/lib/data/reviews";
import { JsonLd } from "@/components/seo/json-ld";
import { publicEnv } from "@/lib/env";
import { inWindow } from "@/lib/format";
import type { HomepageSection } from "@/lib/types";

const DEFAULT_ORDER = ["hero", "categories", "collections", "new_arrivals", "featured_collection", "best_sellers", "custom_design", "reviews", "bulk", "story", "social", "newsletter"];

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  if (!isLocale(locale)) return {};
  return { alternates: { canonical: `/${locale}`, languages: { ar: "/ar", en: "/en" } } };
}

const empty = { total: 0, items: [] };

export default async function HomePage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const dict = getDictionary(locale);
  const [sections, heroBanners, categories, collections, settings] = await Promise.all([
    getHomepageSections(),
    getBanners("hero"),
    getCategories(),
    getCollections(),
    getSettings(),
  ]);
  const byKey = new Map<string, HomepageSection>(sections.map((s) => [s.key, s]));
  const order = sections.length ? sections.map((s) => s.key) : [...DEFAULT_ORDER];
  // Sections added after the CMS rows were created (not in the DB list) are slotted in at sensible positions.
  const slot = (key: string, after: string) => {
    if (order.includes(key)) return;
    const i = order.indexOf(after);
    order.splice(i < 0 ? order.length : i + 1, 0, key);
  };
  slot("collections", "categories");
  slot("reviews", "custom_design");
  // A collection scheduled as featured (within its window) takes precedence over the section default.
  const scheduled = collections.find((c) => c.is_featured && (c.featured_from || c.featured_until) && inWindow(c.featured_from, c.featured_until));
  const featuredSlug = scheduled?.slug ?? (byKey.get("featured_collection")?.data?.collection_slug as string) ?? collections.find((c) => c.is_featured && inWindow(c.featured_from, c.featured_until))?.slug;
  const featured = collections.find((c) => c.slug === featuredSlug) ?? null;

  const [newArrivals, bestSellers, featuredItems] = await Promise.all([
    order.includes("new_arrivals") ? searchProducts({ new: true, sort: "newest", limit: 8 }).catch(() => empty) : empty,
    order.includes("best_sellers") ? searchProducts({ sort: "popular", limit: 8 }).catch(() => empty) : empty,
    featured ? searchProducts({ collection: featured.slug, limit: 4, sort: "popular" }).catch(() => empty) : empty,
  ]);
  const { stats: reviewStats } = await getStoreReviews({ limit: 1 });
  const ctx = { locale, dict };
  const igFallback = bestSellers.items.flatMap((p) => p.images.map((i) => i.url)).slice(0, 6);

  const render = (key: string) => {
    const section = byKey.get(key);
    switch (key) {
      case "hero":
        return <Hero key={key} {...ctx} section={section} banner={heroBanners[0] ?? null} stats={reviewStats} />;
      case "categories":
        return <CategoriesSection key={key} {...ctx} section={section} categories={categories} />;
      case "new_arrivals":
        return <ProductRail key={key} {...ctx} title={(locale === "ar" ? section?.title_ar : section?.title_en) || dict.home.newArrivals} items={newArrivals.items} viewAll={`/${locale}/shop?new=1`} />;
      case "best_sellers":
        return <ProductRail key={key} {...ctx} title={(locale === "ar" ? section?.title_ar : section?.title_en) || dict.home.bestSellers} items={bestSellers.items} viewAll={`/${locale}/shop?sort=popular`} />;
      case "collections":
        return <CollectionsRail key={key} {...ctx} collections={collections} />;
      case "reviews":
        return <ReviewsTeaser key={key} {...ctx} stats={reviewStats} />;
      case "featured_collection":
        return <FeaturedCollection key={key} {...ctx} section={section} collection={featured} items={featuredItems.items} />;
      case "custom_design":
        return <CustomDesignSection key={key} {...ctx} section={section} />;
      case "bulk":
        return <BulkSection key={key} {...ctx} section={section} />;
      case "story":
        return <StorySection key={key} {...ctx} section={section} />;
      case "social":
        return <SocialSection key={key} {...ctx} section={section} settings={settings} fallbackImages={igFallback} />;
      case "newsletter":
        return <NewsletterSection key={key} {...ctx} section={section} />;
      default:
        return null;
    }
  };

  return (
    <>
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "Organization",
          name: "TPAC",
          url: publicEnv.siteUrl,
          logo: `${publicEnv.siteUrl}/brand/icon-512.png`,
          sameAs: [settings.social.instagram, settings.social.tiktok, settings.social.facebook].filter(Boolean),
          address: { "@type": "PostalAddress", addressLocality: "Baghdad", addressCountry: "IQ" },
        }}
      />
      {order.map(render)}
    </>
  );
}
