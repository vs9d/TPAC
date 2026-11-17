import Image from "next/image";
import Link from "next/link";
import { ArrowLeft, ArrowRight, Banknote, Paintbrush, Shirt, Star, Truck, Type, Upload } from "lucide-react";
import type { Locale } from "@/lib/i18n/config";
import type { Dict } from "@/lib/i18n/dictionaries/ar";
import type { Category, Collection, HomepageSection, ProductCard as Card, PromoBanner, SiteSettings } from "@/lib/types";
import type { ReviewStats } from "@/lib/data/reviews";
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
const arrowOf = (l: Locale) => (l === "ar" ? ArrowLeft : ArrowRight);
const arrowMove = "transition-transform group-hover:-translate-x-1 ltr:group-hover:translate-x-1";
/** horizontal snap carousel that becomes a grid on desktop */
const rail = "-mx-4 flex snap-x snap-mandatory gap-3 overflow-x-auto px-4 pb-3 md:mx-0 md:grid md:gap-5 md:overflow-visible md:px-0 [&::-webkit-scrollbar]:hidden";

export function Hero({ locale, dict, banner, stats }: Ctx & { banner: PromoBanner | null; stats: ReviewStats | null }) {
  const title = (locale === "ar" ? banner?.title_ar : banner?.title_en) || dict.home.heroTitle;
  const subtitle = (locale === "ar" ? banner?.subtitle_ar : banner?.subtitle_en) || dict.home.heroSubtitle;
  const cta = (locale === "ar" ? banner?.cta_label_ar : banner?.cta_label_en) || dict.home.heroCtaPrimary;
  const image = banner?.image_url || "/products/baghdad-nights-hoodie-black-back.webp";
  const Arrow = arrowOf(locale);
  const chips = [Truck, Banknote, Paintbrush];
  return (
    <section className="container-x pt-3 md:pt-5">
      <div className="relative isolate overflow-hidden rounded-[2rem] bg-night text-snow ring-1 ring-black/5 dark:ring-snow/10 md:rounded-[2.75rem]">
        {/* ambient light */}
        <div aria-hidden className="absolute -start-24 -top-24 -z-10 size-[26rem] rounded-full bg-pine/50 blur-[90px]" />
        <div aria-hidden className="absolute -bottom-32 -end-16 -z-10 size-[22rem] rounded-full bg-amber/25 blur-[100px]" />
        <div aria-hidden className="absolute inset-0 -z-10 opacity-[0.07] [background-image:radial-gradient(circle,#fff_1px,transparent_1px)] [background-size:22px_22px]" />

        <div className="grid items-center gap-8 px-5 pb-8 pt-9 md:grid-cols-12 md:gap-6 md:px-14 md:pb-14 md:pt-14">
          <div className="relative z-10 md:col-span-7">
            <Reveal>
              <p className="inline-flex items-center gap-2 rounded-full border border-snow/20 bg-snow/10 px-3.5 py-1.5 text-xs font-bold backdrop-blur">
                <span className="size-2 rounded-full bg-amber" /> {dict.home.heroEyebrow}
              </p>
              <h1 className="display mt-5 whitespace-pre-line text-[clamp(2.9rem,10.5vw,7.6rem)]">{title}</h1>
              <p className="mt-5 max-w-md text-[0.98rem] leading-relaxed text-snow/70 md:text-lg">{subtitle}</p>
              <div className="mt-7 flex flex-wrap gap-3">
                <Link href={href(locale, banner?.link, "/shop")} className="btn btn-accent group h-14 px-7 text-base">
                  {cta} <Arrow className={`size-4 ${arrowMove}`} />
                </Link>
                <Link href={`/${locale}/design`} className="btn btn-glass h-14 px-7 text-base">
                  <Paintbrush className="size-4" /> {dict.home.heroCtaSecondary}
                </Link>
              </div>
              <ul className="mt-7 flex flex-wrap gap-2">
                {dict.home.heroChips.map((c, i) => {
                  const Icon = chips[i] ?? Truck;
                  return (
                    <li key={c} className="inline-flex items-center gap-2 rounded-full border border-snow/15 px-3.5 py-2 text-xs font-semibold text-snow/85">
                      <Icon className="size-3.5 text-amber" /> {c}
                    </li>
                  );
                })}
              </ul>
            </Reveal>
          </div>

          <div className="relative md:col-span-5">
            <div className="relative mx-auto aspect-[4/5] max-h-[52svh] w-full max-w-[430px] overflow-hidden rounded-[1.75rem] bg-[#ebe7de] shadow-[0_30px_60px_-30px_rgba(0,0,0,.8)] md:max-h-none md:-rotate-2 md:rtl:rotate-2">
              <Image src={image} alt="" fill priority sizes="(min-width:768px) 36vw, 90vw" className="object-cover" />
            </div>
            {stats && stats.count > 0 && (
              <Link href={`/${locale}/reviews`} className="absolute -bottom-3 start-4 flex items-center gap-2 rounded-full border border-snow/20 bg-night/80 px-4 py-2.5 text-sm font-bold shadow-xl backdrop-blur-md md:start-0">
                <Star className="size-4 fill-amber text-amber" />
                <span className="tabular-nums" dir="ltr">{stats.average.toFixed(1)}</span>
                <span className="text-xs font-medium text-snow/65">{dict.reviews.navLabel}</span>
              </Link>
            )}
          </div>
        </div>

        <div className="overflow-hidden border-t border-snow/10 py-3.5" aria-hidden>
          <div className={`flex w-max gap-10 whitespace-nowrap text-sm font-bold tracking-[0.25em] text-snow/35 ${locale === "ar" ? "animate-marquee-rtl" : "animate-marquee"}`}>
            {Array.from({ length: 2 }).map((_, k) => (
              <div key={k} className="flex gap-10">
                {["STREETWEAR", "بغداد", "CUSTOM PRINT", "TPAC", "عراقي", "HEAVYWEIGHT COTTON", "طباعة حسب الطلب", "MADE IN IRAQ"].map((w, i) => (
                  <span key={i} className="flex items-center gap-10">{w}<span className="text-amber">✦</span></span>
                ))}
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

export function CategoriesSection({ locale, dict, section, categories }: Ctx & { categories: Category[] }) {
  if (!categories.length) return null;
  return (
    <section className="container-x pt-14 md:pt-24">
      <SectionHeading locale={locale} title={pick(section, "title", locale) ?? dict.home.shopByCategory} href={`/${locale}/shop`} cta={dict.common.viewAll} />
      <div className={`${rail} md:grid-cols-4 lg:grid-cols-7`}>
        {categories.map((c, i) => (
          <Reveal key={c.id} delay={i * 0.04} className="w-[40vw] shrink-0 snap-start sm:w-[28vw] md:w-auto">
            <Link href={`/${locale}/shop?category=${c.slug}`} className="group relative block aspect-[3/4] overflow-hidden rounded-[1.5rem] bg-[#ebe7de]">
              {c.image_url && <Image src={c.image_url} alt="" fill sizes="(min-width:1024px) 14vw, 40vw" className="object-cover transition-transform duration-700 group-hover:scale-105" />}
              <div className="absolute inset-0 bg-gradient-to-t from-night/80 via-night/10 to-transparent" />
              <p className="absolute inset-x-3 bottom-3 font-[family-name:var(--font-display)] text-[0.95rem] font-extrabold leading-tight text-snow">{locale === "ar" ? c.name_ar : c.name_en}</p>
            </Link>
          </Reveal>
        ))}
      </div>
    </section>
  );
}

export function CollectionsRail({ locale, dict, collections }: Ctx & { collections: Collection[] }) {
  if (!collections.length) return null;
  const Arrow = arrowOf(locale);
  return (
    <section className="container-x pt-14 md:pt-24">
      <SectionHeading locale={locale} title={dict.home.collectionsTitle} href={`/${locale}/collections`} cta={dict.common.viewAll} />
      <div className={`${rail} md:grid-cols-2 xl:grid-cols-4`}>
        {collections.map((c, i) => (
          <Reveal key={c.id} delay={i * 0.05} className="w-[78vw] shrink-0 snap-start sm:w-[46vw] md:w-auto">
            <Link href={`/${locale}/collections/${c.slug}`} className="group relative block aspect-[4/5] overflow-hidden rounded-[1.75rem] bg-night">
              {c.image_url && <Image src={c.image_url} alt="" fill sizes="(min-width:1280px) 24vw, (min-width:768px) 46vw, 78vw" className="object-cover transition-transform duration-700 group-hover:scale-105" />}
              <div className="absolute inset-0 bg-gradient-to-t from-night/95 via-night/35 to-transparent" />
              <div className="absolute inset-x-0 bottom-0 p-5 text-snow">
                <h3 className="font-[family-name:var(--font-display)] text-2xl font-extrabold leading-tight">{locale === "ar" ? c.name_ar : c.name_en}</h3>
                <p className="mt-1 line-clamp-2 text-sm text-snow/70">{locale === "ar" ? c.description_ar : c.description_en}</p>
                <span className="mt-4 inline-flex items-center gap-2 text-sm font-bold text-amber">
                  {dict.home.shopCollection} <Arrow className={`size-4 ${arrowMove}`} />
                </span>
              </div>
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
    <section className="container-x pt-14 md:pt-24">
      <SectionHeading locale={locale} title={title} eyebrow={eyebrow} href={viewAll} cta={dict.common.viewAll} />
      <div className={`${rail} md:grid-cols-4`}>
        {items.slice(0, 8).map((p) => (
          <div key={p.id} className="w-[62vw] shrink-0 snap-start sm:w-[38vw] md:w-auto">
            <ProductCard product={p} locale={locale} dict={dict} sizes="(min-width:768px) 25vw, 62vw" />
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
  const Arrow = arrowOf(locale);
  return (
    <section className="container-x pt-14 md:pt-24">
      <div className="surface grid gap-8 p-4 md:grid-cols-12 md:gap-10 md:p-8">
        <Reveal className="md:col-span-5">
          <div className="md:sticky md:top-28">
            <div className="relative aspect-[4/5] overflow-hidden rounded-[1.5rem] bg-stone">
              {(section?.image_url || collection.image_url) && (
                <Image src={(section?.image_url || collection.image_url)!} alt={title} fill sizes="(min-width:768px) 40vw, 90vw" className="object-cover" />
              )}
            </div>
            <p className="eyebrow mt-7 text-pine">{dict.home.featuredCollection}</p>
            <h2 className="display mt-2 text-4xl md:text-6xl">{title}</h2>
            {body && <p className="mt-4 max-w-md leading-relaxed text-mute">{body}</p>}
            <Link href={`/${locale}/collections/${collection.slug}`} className="btn btn-brand group mt-6 h-14 px-7 text-base">
              {dict.common.shopNow} <Arrow className={`size-4 ${arrowMove}`} />
            </Link>
          </div>
        </Reveal>
        <div className="grid grid-cols-2 gap-3 md:col-span-7 md:gap-5">
          {items.slice(0, 4).map((p) => (
            <ProductCard key={p.id} product={p} locale={locale} dict={dict} sizes="(min-width:768px) 28vw, 45vw" />
          ))}
        </div>
      </div>
    </section>
  );
}

export function CustomDesignSection({ locale, dict, section }: Ctx) {
  const icons = [Shirt, Upload, Type];
  return (
    <section className="container-x pt-14 md:pt-24">
      <div className="relative isolate overflow-hidden rounded-[2rem] bg-night text-snow ring-1 ring-black/5 dark:ring-snow/10 md:rounded-[2.75rem]">
        <div aria-hidden className="absolute -start-20 -top-20 -z-10 size-80 rounded-full bg-pine/60 blur-[90px]" />
        <div className="grid items-center gap-8 p-6 md:grid-cols-2 md:gap-12 md:p-14">
          <Reveal>
            <p className="eyebrow text-amber">{dict.nav.customDesign}</p>
            <h2 className="display mt-3 text-[2.5rem] md:text-7xl">{pick(section, "title", locale) ?? dict.home.customTitle}</h2>
            <p className="mt-4 max-w-md leading-relaxed text-snow/70 md:text-lg">{pick(section, "body", locale) ?? dict.home.customBody}</p>
            <ol className="mt-6 flex flex-wrap gap-2">
              {dict.home.customSteps.map((step, i) => {
                const Icon = icons[i]!;
                return (
                  <li key={step} className="inline-flex items-center gap-2.5 rounded-full border border-snow/15 bg-snow/5 py-1.5 pe-4 ps-1.5 text-sm font-semibold">
                    <span className="grid size-8 place-items-center rounded-full bg-snow/10"><Icon className="size-4 text-amber" /></span>
                    <span className="text-snow/40 tabular-nums">0{i + 1}</span> {step}
                  </li>
                );
              })}
            </ol>
            <Link href={`/${locale}/design`} className="btn btn-light mt-8 h-14 px-8 text-base">{pick(section, "cta_label", locale) ?? dict.home.customCta}</Link>
          </Reveal>
          <Reveal delay={0.1}>
            <div className="relative mx-auto aspect-[4/5] w-full max-w-sm">
              <div className="absolute -inset-3 rounded-[2.2rem] border border-dashed border-amber/50" aria-hidden />
              <div className="relative h-full w-full overflow-hidden rounded-[1.8rem] bg-[#ebe7de]">
                <Image src={section?.image_url || "/products/custom-print-tee-white-front.webp"} alt="" fill sizes="(min-width:768px) 35vw, 80vw" className="object-cover" />
              </div>
            </div>
          </Reveal>
        </div>
      </div>
    </section>
  );
}

export function ReviewsTeaser({ locale, dict, stats }: Ctx & { stats: ReviewStats | null }) {
  const Arrow = arrowOf(locale);
  return (
    <section className="container-x pt-8 md:pt-10">
      <Link href={`/${locale}/reviews`} className="group relative flex flex-col gap-5 overflow-hidden rounded-[2rem] border border-line bg-bone p-6 transition-colors hover:border-pine/50 md:flex-row md:items-center md:justify-between md:p-10">
        <div>
          <div className="flex items-center gap-3">
            <span className="inline-flex gap-0.5" aria-hidden>{[1, 2, 3, 4, 5].map((n) => <Star key={n} className="size-5 fill-amber text-amber" />)}</span>
            {stats && stats.count > 0 && <span className="font-[family-name:var(--font-display)] text-lg font-extrabold tabular-nums" dir="ltr">{stats.average.toFixed(1)} / 5</span>}
          </div>
          <h2 className="display mt-3 text-3xl md:text-5xl">{dict.home.reviewsTeaserTitle}</h2>
          <p className="mt-2 text-mute">{dict.home.reviewsTeaserBody}</p>
        </div>
        <span className="btn btn-brand h-14 shrink-0 self-start px-7 text-base md:self-center">
          {dict.home.reviewsTeaserCta} <Arrow className={`size-4 ${arrowMove}`} />
        </span>
      </Link>
    </section>
  );
}

export function BulkSection({ locale, dict, section }: Ctx) {
  return (
    <section className="container-x pt-14 md:pt-24">
      <div className="grid gap-8 rounded-[2rem] border border-line p-6 md:grid-cols-12 md:rounded-[2.75rem] md:p-12">
        <div className="md:col-span-7">
          <p className="eyebrow text-pine">{dict.nav.bulk}</p>
          <h2 className="display mt-3 text-4xl md:text-6xl">{pick(section, "title", locale) ?? dict.home.bulkTitle}</h2>
          <p className="mt-4 max-w-xl leading-relaxed text-mute">{pick(section, "body", locale) ?? dict.home.bulkBody}</p>
          <Link href={`/${locale}/bulk`} className="btn btn-primary mt-7 h-14 px-8 text-base">{pick(section, "cta_label", locale) ?? dict.home.bulkCta}</Link>
        </div>
        <dl className="grid grid-cols-3 gap-2.5 self-end md:col-span-5 md:grid-cols-1 md:gap-3">
          {dict.home.bulkStats.map((s) => (
            <div key={s.label} className="rounded-2xl bg-bone px-3 py-4 md:flex md:items-center md:justify-between md:px-5 md:py-4">
              <dd className="font-[family-name:var(--font-display)] text-xl font-extrabold md:order-2 md:text-3xl">{s.value}</dd>
              <dt className="mt-1 text-xs text-mute md:order-1 md:mt-0 md:text-sm">{s.label}</dt>
            </div>
          ))}
        </dl>
      </div>
    </section>
  );
}

export function StorySection({ locale, dict, section }: Ctx) {
  return (
    <section className="container-x pt-14 md:pt-24">
      <div className="grid items-center gap-8 overflow-hidden rounded-[2rem] bg-pine p-5 text-white md:grid-cols-2 md:gap-12 md:rounded-[2.75rem] md:p-12 dark:text-night">
        <Reveal>
          <div className="relative aspect-[4/3] overflow-hidden rounded-[1.5rem]">
            <Image src={section?.image_url || "/brand/tpac-logo-original.jpg"} alt="TPAC" fill sizes="(min-width:768px) 45vw, 90vw" className="object-cover" />
          </div>
        </Reveal>
        <Reveal delay={0.1}>
          <p className="eyebrow opacity-80">{dict.home.storyEyebrow}</p>
          <h2 className="display mt-3 text-4xl md:text-6xl">{pick(section, "title", locale) ?? dict.home.storyTitle}</h2>
          <p className="mt-5 max-w-lg text-lg leading-relaxed opacity-85">{pick(section, "body", locale) ?? dict.home.storyBody}</p>
          <Link href={`/${locale}/pages/about`} className="btn mt-7 border-current text-current hover:bg-white/15">{dict.common.learnMore}</Link>
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
    <section className="container-x pt-14 md:pt-24">
      <div className="mb-7 flex flex-col items-center gap-3 text-center">
        <span className="grid size-12 place-items-center rounded-full bg-bone"><InstagramIcon className="size-6" /></span>
        <h2 className="display text-3xl md:text-5xl">{pick(section, "title", locale) ?? dict.home.socialTitle}</h2>
        <a href={url} target="_blank" rel="noopener noreferrer" className="btn btn-outline btn-sm" dir="ltr">@{handle}</a>
      </div>
      <div className="grid grid-cols-3 gap-2 md:grid-cols-6 md:gap-3">
        {images.map((src, i) => (
          <a key={i} href={url} target="_blank" rel="noopener noreferrer" className="group relative aspect-square overflow-hidden rounded-2xl bg-[#ebe7de] md:rounded-3xl" aria-label={`Instagram ${i + 1}`}>
            <Image src={src} alt="" fill sizes="(min-width:768px) 16vw, 33vw" className="object-cover transition-transform duration-700 group-hover:scale-110" />
            <div className="absolute inset-0 grid place-items-center bg-night/0 text-snow opacity-0 transition group-hover:bg-night/40 group-hover:opacity-100">
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
    <section className="container-x pt-14 md:pt-24">
      <div className="grid grid-cols-1 items-center gap-6 rounded-[2rem] bg-amber p-6 text-[#1a1208] md:grid-cols-2 md:gap-10 md:rounded-[2.75rem] md:p-14">
        <div>
          <h2 className="display text-3xl md:text-5xl">{pick(section, "title", locale) ?? dict.home.newsletterTitle}</h2>
          <p className="mt-3 max-w-md opacity-75">{pick(section, "body", locale) ?? dict.home.newsletterBody}</p>
        </div>
        <NewsletterForm onAccent />
      </div>
    </section>
  );
}
