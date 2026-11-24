import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import { notFound } from "next/navigation";
import { ArrowLeft, ArrowRight, HeartHandshake } from "lucide-react";
import { isLocale } from "@/lib/i18n/config";
import { getDictionary } from "@/lib/i18n";
import { getCollections } from "@/lib/data/catalog";
import { CatalogView, type SearchParams } from "@/components/product/catalog-view";

/** The products the admin puts in the collection «للمرتبطين» (slug "couples"). */
const SLUG = "couples";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  if (!isLocale(locale)) return {};
  const c = (await getCollections()).find((x) => x.slug === SLUG);
  const ar = locale === "ar";
  return {
    title: ar ? "هوديات للمرتبطين" : "Hoodies for couples",
    description: (ar ? c?.description_ar : c?.description_en) ?? (ar ? "هوديات بالأزواج لك ولشريكك من TPAC." : "Matching hoodies for couples by TPAC."),
    alternates: { canonical: `/${locale}/couples`, languages: { ar: "/ar/couples", en: "/en/couples" } },
    openGraph: c?.image_url ? { images: [c.image_url] } : undefined,
  };
}

export default async function CouplesPage({ params, searchParams }: { params: Promise<{ locale: string }>; searchParams: Promise<SearchParams> }) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const dict = getDictionary(locale);
  const ar = locale === "ar";
  const c = (await getCollections()).find((x) => x.slug === SLUG);
  const Arrow = ar ? ArrowLeft : ArrowRight;
  const desc = (ar ? c?.description_ar : c?.description_en) ?? (ar ? "هوديات بالأزواج لك ولشريكك — تصاميم تكمّل بعض." : "Matching hoodies for you and your other half.");
  return (
    <div>
      <section className="relative overflow-hidden bg-ink text-paper">
        {c?.image_url && <Image src={c.image_url} alt="" fill priority sizes="100vw" className="object-cover opacity-45" />}
        <div className="container-x relative py-16 md:py-24">
          <p className="eyebrow mb-4 flex items-center gap-2 text-amber"><HeartHandshake className="size-4" /> {ar ? "للمرتبطين" : "For couples"}</p>
          <h1 className="display max-w-3xl text-5xl md:text-7xl">{ar ? (c?.name_ar ?? "للمرتبطين") : (c?.name_en ?? "For couples")} 💞</h1>
          <p className="mt-5 max-w-xl text-lg text-paper/80">{desc}</p>
          <div className="mt-8 flex flex-wrap gap-3">
            <a href="#couples-products" className="btn btn-brand h-12 px-6">{ar ? "شوف الهوديات" : "See the hoodies"}</a>
            <Link href={`/${locale}/design?garment=hoodie&couple=1`} className="btn h-12 border border-paper/40 px-6 text-paper hover:bg-paper/10">
              {ar ? "صمّموا طقمكم بنفسكم" : "Design your own pair"} <Arrow className="size-4" />
            </Link>
          </div>
        </div>
      </section>
      <div id="couples-products" className="container-x scroll-mt-24 py-10 md:py-14">
        {c ? (
          <CatalogView locale={locale} dict={dict} searchParams={await searchParams} fixed={{ collection: SLUG }} basePath={`/${locale}/couples`} />
        ) : (
          <p className="py-16 text-center text-mute">{ar ? "الهوديات جاية قريباً — وبهالوقت تگدرون تصمّمون طقمكم بنفسكم." : "Hoodies are coming soon — meanwhile, design your own pair."}</p>
        )}
      </div>
    </div>
  );
}
