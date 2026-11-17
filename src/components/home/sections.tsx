import Image from "next/image";
import Link from "next/link";
import { ArrowLeft, ArrowRight, Upload, Type, Shirt } from "lucide-react";
import type { Locale } from "@/lib/i18n/config";
import type { Dict } from "@/lib/i18n/dictionaries/ar";
import type { Category, Collection, HomepageSection, ProductCard as Card, PromoBanner, SiteSettings } from "@/lib/types";
import { ProductCard } from "@/components/product/product-card";
import { SectionHeading } from "@/components/ui/section-heading";
import { Reveal } from "@/components/ui/reveal";
import { InstagramIcon } from "@/components/ui/social-icons";
import { NewsletterForm } from "./newsletter-form";

type Ctx = { locale: Locale; dict: Dict; section?: HomepageSection };
const pick = (s: HomepageSection | undefined, f: "title" | "subtitle" | "body" | "cta_label", l: Locale) =>
  (s?.[`${f}_${l}` as keyof HomepageSection] as string | null | undefined) || null;
const href = (locale: Locale, link: string | null | undefined, fallback: string) =>
  link ? (link.startsWith("/") ? `/${locale}${link}` : link) : `/${locale}${fallback}`;

export function Hero({ locale, dict, banner }: Ctx & { banner: PromoBanner | null }) {
  const title = (locale === "ar" ? banner?.title_ar : banner?.title_en) || dict.home.heroTitle;
  const subtitle = (locale === "ar" ? banner?.subtitle_ar : banner?.subtitle_en) || dict.home.heroSubtitle;
  const cta = (locale === "ar" ? banner?.cta_label_ar : banner?.cta_label_en) || dict.home.heroCtaPrimary;
  const image = banner?.image_url || "/products/baghdad-nights-hoodie-black-back.webp";
  const Arrow = locale === "ar" ? ArrowLeft : ArrowRight;
  return (
    <section className="relative overflow-hidden bg-ink text-paper">
      <div className="container-x grid min-h-[calc(100svh-6.25rem)] items-center gap-8 py-10 md:min-h-[640px] md:grid-cols-12 md:py-16">
        <div className="relative z-10 order-2 md:order-1 md:col-span-6">
          <Reveal>
            <p className="eyebrow mb-5 flex items-center gap-3 text-amber">
              <span className="h-px w-8 bg-amber" /> {dict.home.heroEyebrow}
            </p>
            <h1 className="display whitespace-pre-line text-[clamp(3.2rem,11vw,8.5rem)]">{title}</h1>
            <p className="mt-6 max-w-md text-base leading-relaxed text-paper/70 md:text-lg">{subtitle}</p>
            <div className="mt-9 flex flex-wrap gap-3">
              <Link href={href(locale, banner?.link, "/shop")} className="btn btn-accent group">
                {cta} <Arrow className="size-4 transition-transform group-hover:translate-x-1 rtl:group-hover:-translate-x-1" />
              </Link>
              <Link href={`/${locale}/design`} className="btn border-paper/30 text-paper hover:bg-paper hover:text-ink">
                {dict.home.heroCtaSecondary}
              </Link>
            </div>
          </Reveal>
        </div>
        <div className="relative order-1 md:order-2 md:col-span-6">
          <div className="relative mx-auto aspect-[4/5] max-h-[46svh] w-full max-w-[560px] overflow-hidden md:max-h-none">
            <Image src={image} alt="" fill priority sizes="(min-width:768px) 50vw, 100vw" className="object-cover" />
            <div className="absolute inset-x-0 bottom-0 flex items-center justify-between bg-gradient-to-t from-ink/70 to-transparent p-5 text-xs font-semibold tracking-[0.25em]">
              <span>TPAC</span>
              <span>BAGHDAD — IRAQ</span>
            </div>
          </div>
          <div aria-hidden className="pointer-events-none absolute -bottom-6 -start-4 hidden select-none font-[family-name:var(--font-display)] text-[9rem] font-black leading-none text-paper/[0.04] md:block">
            TPAC
          </div>
        </div>
      </div>
      <div className="overflow-hidden border-t border-paper/10 py-3" aria-hidden>
        <div className={`flex w-max gap-10 whitespace-nowrap text-sm font-semibold tracking-[0.3em] text-paper/40 ${locale === "ar" ? "animate-marquee-rtl" : "animate-marquee"}`}>
          {Array.from({ length: 2 }).map((_, k) => (
            <div key={k} className="flex gap-10">
              {["STREETWEAR", "بغداد", "CUSTOM PRINT", "TPAC", "عراقي", "HEAVYWEIGHT COTTON", "طباعة حسب الطلب", "MADE IN IRAQ"].map((w, i) => (
                <span key={i} className="flex items-center gap-10">{w}<span className="text-amber">✦</span></span>
              ))}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

export function CategoriesSection({ locale, dict, section, categories }: Ctx & { categories: Category[] }) {
  if (!categories.length) return null;
  return (
    <section className="container-x py-16 md:py-24">
      <SectionHeading locale={locale} title={pick(section, "title", locale) ?? dict.home.shopByCategory} href={`/${locale}/shop`} cta={dict.common.viewAll} />
      <div className="-mx-4 flex snap-x snap-mandatory gap-3 overflow-x-auto px-4 pb-2 md:mx-0 md:grid md:grid-cols-4 md:gap-4 md:overflow-visible md:px-0 lg:grid-cols-7 [&::-webkit-scrollbar]:hidden">
        {categories.map((c, i) => (
          <Reveal key={c.id} delay={i * 0.04} className="w-[42vw] shrink-0 snap-start md:w-auto">
            <Link href={`/${locale}/shop?category=${c.slug}`} className="group block">
              <div className="relative aspect-[3/4] overflow-hidden bg-bone">
                {c.image_url && <Image src={c.image_url} alt="" fill sizes="(min-width:1024px) 14vw, 42vw" className="object-cover transition-transform duration-700 group-hover:scale-105" />}
              </div>
              <p className="mt-3 text-sm font-semibold">{locale === "ar" ? c.name_ar : c.name_en}</p>
            </Link>
          </Reveal>
        ))}
      </div>
    </section>
  );
}

export function ProductRail({ locale, dict, title, eyebrow, items, viewAll }: Ctx & { title: string; eyebrow?: string; items: Card[]; viewAll: string }) {
  if (!items.length) return null;
  return (
    <section className="container-x py-12 md:py-20">
      <SectionHeading locale={locale} title={title} eyebrow={eyebrow} href={viewAll} cta={dict.common.viewAll} />
      <div className="-mx-4 flex snap-x snap-mandatory gap-3 overflow-x-auto px-4 pb-2 md:mx-0 md:grid md:grid-cols-4 md:gap-5 md:overflow-visible md:px-0 [&::-webkit-scrollbar]:hidden">
        {items.slice(0, 8).map((p) => (
          <div key={p.id} className="w-[64vw] shrink-0 snap-start sm:w-[40vw] md:w-auto">
            <ProductCard product={p} locale={locale} dict={dict} sizes="(min-width:768px) 25vw, 64vw" />
          </div>
        ))}
      </div>
    </section>
  );
}

export function FeaturedCollection({ locale, dict, section, collection, items }: Ctx & { collection: Collection | null; items: Card[] }) {
  if (!collection) return null;
  const title = pick(section, "title", locale) ?? (locale === "ar" ? collection.name_ar : collection.name_en);
  const body = pick(section, "body", locale) ?? (locale === "ar" ? collection.description_ar : collection.description_en);
  const Arrow = locale === "ar" ? ArrowLeft : ArrowRight;
  return (
    <section className="bg-bone py-16 md:py-24">
      <div className="container-x grid gap-10 md:grid-cols-12 md:gap-12">
        <Reveal className="md:col-span-5">
          <div className="md:sticky md:top-28">
            <div className="relative aspect-[4/5] overflow-hidden bg-stone">
              {(section?.image_url || collection.image_url) && (
                <Image src={(section?.image_url || collection.image_url)!} alt={title} fill sizes="(min-width:768px) 40vw, 100vw" className="object-cover" />
              )}
            </div>
            <p className="eyebrow mt-8 text-amber-deep">{dict.home.featuredCollection}</p>
            <h2 className="display mt-2 text-4xl md:text-6xl">{title}</h2>
            {body && <p className="mt-4 max-w-md leading-relaxed text-mute">{body}</p>}
            <Link href={`/${locale}/collections/${collection.slug}`} className="btn btn-primary group mt-6">
              {dict.common.shopNow} <Arrow className="size-4 transition-transform group-hover:translate-x-1 rtl:group-hover:-translate-x-1" />
            </Link>
          </div>
        </Reveal>
        <div className="grid grid-cols-2 gap-x-3 gap-y-8 md:col-span-7 md:gap-x-5">
          {items.slice(0, 4).map((p) => (
            <ProductCard key={p.id} product={p} locale={locale} dict={dict} sizes="(min-width:768px) 28vw, 50vw" />
          ))}
        </div>
      </div>
    </section>
  );
}

export function CustomDesignSection({ locale, dict, section }: Ctx) {
  const icons = [Shirt, Upload, Type];
  return (
    <section className="bg-pine text-paper">
      <div className="container-x grid items-center gap-10 py-16 md:grid-cols-2 md:py-24">
        <Reveal>
          <p className="eyebrow mb-3 text-amber">{dict.nav.customDesign}</p>
          <h2 className="display text-5xl md:text-7xl">{pick(section, "title", locale) ?? dict.home.customTitle}</h2>
          <p className="mt-5 max-w-md text-lg leading-relaxed text-paper/75">{pick(section, "body", locale) ?? dict.home.customBody}</p>
          <ol className="mt-8 space-y-4">
            {dict.home.customSteps.map((step, i) => {
              const Icon = icons[i]!;
              return (
                <li key={step} className="flex items-center gap-4">
                  <span className="grid size-11 place-items-center border border-paper/25"><Icon className="size-5 text-amber" /></span>
                  <span className="font-medium"><span className="me-2 text-paper/40">0{i + 1}</span>{step}</span>
                </li>
              );
            })}
          </ol>
          <Link href={`/${locale}/design`} className="btn btn-accent mt-10">{pick(section, "cta_label", locale) ?? dict.home.customCta}</Link>
        </Reveal>
        <Reveal delay={0.1}>
          <div className="relative mx-auto aspect-[4/5] w-full max-w-md">
            <div className="absolute -inset-3 border border-dashed border-amber/50" aria-hidden />
            <div className="relative h-full w-full overflow-hidden bg-bone">
              <Image src={section?.image_url || "/products/custom-print-tee-white-front.webp"} alt="" fill sizes="(min-width:768px) 40vw, 90vw" className="object-cover" />
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  );
}

export function BulkSection({ locale, dict, section }: Ctx) {
  return (
    <section className="container-x py-16 md:py-24">
      <div className="grid gap-10 border border-ink p-6 md:grid-cols-12 md:p-12">
        <div className="md:col-span-7">
          <p className="eyebrow mb-3 text-amber-deep">{dict.nav.bulk}</p>
          <h2 className="display text-4xl md:text-6xl">{pick(section, "title", locale) ?? dict.home.bulkTitle}</h2>
          <p className="mt-5 max-w-xl leading-relaxed text-mute">{pick(section, "body", locale) ?? dict.home.bulkBody}</p>
          <Link href={`/${locale}/bulk`} className="btn btn-primary mt-8">{pick(section, "cta_label", locale) ?? dict.home.bulkCta}</Link>
        </div>
        <dl className="grid grid-cols-3 gap-4 self-end md:col-span-5 md:grid-cols-1 md:gap-6">
          {dict.home.bulkStats.map((s) => (
            <div key={s.label} className="border-t border-line pt-4">
              <dt className="text-xs text-mute md:text-sm">{s.label}</dt>
              <dd className="display mt-1 text-2xl md:text-4xl">{s.value}</dd>
            </div>
          ))}
        </dl>
      </div>
    </section>
  );
}

export function StorySection({ locale, dict, section }: Ctx) {
  return (
    <section className="bg-ink text-paper">
      <div className="container-x grid items-center gap-10 py-16 md:grid-cols-2 md:py-28">
        <Reveal>
          <div className="relative aspect-[4/3] overflow-hidden">
            <Image src={section?.image_url || "/brand/tpac-logo-original.jpg"} alt="TPAC" fill sizes="(min-width:768px) 50vw, 100vw" className="object-cover" />
          </div>
        </Reveal>
        <Reveal delay={0.1}>
          <p className="eyebrow mb-3 text-amber">{dict.home.storyEyebrow}</p>
          <h2 className="display text-4xl md:text-6xl">{pick(section, "title", locale) ?? dict.home.storyTitle}</h2>
          <p className="mt-6 max-w-lg text-lg leading-relaxed text-paper/70">{pick(section, "body", locale) ?? dict.home.storyBody}</p>
          <Link href={`/${locale}/pages/about`} className="mt-8 inline-block border-b border-amber pb-1 font-semibold text-amber">{dict.common.learnMore}</Link>
        </Reveal>
      </div>
    </section>
  );
}

export function SocialSection({ locale, dict, section, settings, fallbackImages }: Ctx & { settings: SiteSettings; fallbackImages: string[] }) {
  const configured = Array.isArray(section?.data?.images) ? (section!.data.images as string[]) : [];
  const images = (configured.length ? configured : fallbackImages).slice(0, 6);
  const handle = (section?.data?.handle as string) || "thetpac";
  const url = settings.social.instagram || `https://instagram.com/${handle}`;
  if (!images.length) return null;
  return (
    <section className="container-x py-16 md:py-24">
      <div className="mb-8 flex flex-col items-center gap-3 text-center">
        <InstagramIcon className="size-7" />
        <h2 className="display text-3xl md:text-5xl">{pick(section, "title", locale) ?? dict.home.socialTitle}</h2>
        <a href={url} target="_blank" rel="noopener noreferrer" className="font-semibold text-amber-deep hover:underline" dir="ltr">@{handle}</a>
      </div>
      <div className="grid grid-cols-3 gap-1 md:grid-cols-6 md:gap-2">
        {images.map((src, i) => (
          <a key={i} href={url} target="_blank" rel="noopener noreferrer" className="group relative aspect-square overflow-hidden bg-bone" aria-label={`Instagram ${i + 1}`}>
            <Image src={src} alt="" fill sizes="(min-width:768px) 16vw, 33vw" className="object-cover transition-transform duration-700 group-hover:scale-110" />
            <div className="absolute inset-0 grid place-items-center bg-ink/0 text-paper opacity-0 transition group-hover:bg-ink/30 group-hover:opacity-100">
              <InstagramIcon className="size-6" />
            </div>
          </a>
        ))}
      </div>
    </section>
  );
}

export function NewsletterSection({ locale, dict, section }: Ctx) {
  return (
    <section className="container-x">
      <div className="grid grid-cols-1 items-center gap-8 bg-amber px-6 py-12 md:grid-cols-2 md:px-12 md:py-16">
        <div>
          <h2 className="display text-4xl md:text-5xl">{pick(section, "title", locale) ?? dict.home.newsletterTitle}</h2>
          <p className="mt-3 max-w-md text-ink/75">{pick(section, "body", locale) ?? dict.home.newsletterBody}</p>
        </div>
        <NewsletterForm />
      </div>
    </section>
  );
}
