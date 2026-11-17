import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { isLocale } from "@/lib/i18n/config";
import { getDictionary } from "@/lib/i18n";
import { getCollections } from "@/lib/data/catalog";
import { Reveal } from "@/components/ui/reveal";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  if (!isLocale(locale)) return {};
  return { title: getDictionary(locale).nav.collections, alternates: { canonical: `/${locale}/collections` } };
}

export default async function CollectionsPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const dict = getDictionary(locale);
  const collections = await getCollections();
  return (
    <div className="container-x py-10 md:py-14">
      <h1 className="display mb-10 text-4xl md:text-6xl">{dict.nav.collections}</h1>
      {collections.length === 0 && <p className="py-20 text-center text-mute">{dict.shop.noResults}</p>}
      <div className="grid gap-6 md:grid-cols-2">
        {collections.map((c, i) => (
          <Reveal key={c.id} delay={i * 0.05}>
            <Link href={`/${locale}/collections/${c.slug}`} className="group relative block aspect-[4/3] overflow-hidden bg-bone">
              {c.image_url && <Image src={c.image_url} alt="" fill sizes="(min-width:768px) 50vw, 100vw" className="object-cover transition-transform duration-700 group-hover:scale-105" />}
              <div className="absolute inset-0 bg-gradient-to-t from-ink/70 via-ink/10 to-transparent" />
              <div className="absolute inset-x-0 bottom-0 p-6 text-paper md:p-8">
                <h2 className="display text-3xl md:text-5xl">{locale === "ar" ? c.name_ar : c.name_en}</h2>
                <p className="mt-2 line-clamp-2 max-w-md text-sm text-paper/75">{locale === "ar" ? c.description_ar : c.description_en}</p>
              </div>
            </Link>
          </Reveal>
        ))}
      </div>
    </div>
  );
}
