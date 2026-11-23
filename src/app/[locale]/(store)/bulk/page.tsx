import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { isLocale } from "@/lib/i18n/config";
import { getDictionary } from "@/lib/i18n";
import { BulkForm } from "@/components/bulk/bulk-form";
import Link from "next/link";
import { getPortfolio } from "@/lib/data/portfolio";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  if (!isLocale(locale)) return {};
  const t = getDictionary(locale);
  return { title: t.bulk.title, description: t.bulk.subtitle, alternates: { canonical: `/${locale}/bulk`, languages: { ar: "/ar/bulk", en: "/en/bulk" } } };
}

export default async function BulkPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const dict = getDictionary(locale);
  const { clients } = await getPortfolio();
  return (
    <div>
      <section className="bg-ink text-paper">
        <div className="container-x py-16 md:py-24">
          <p className="eyebrow mb-4 text-amber">{dict.nav.bulk}</p>
          <h1 className="display max-w-4xl text-5xl md:text-7xl">{dict.bulk.title}</h1>
          <p className="mt-5 max-w-xl text-lg text-paper/70">{dict.bulk.subtitle}</p>
          <ol className="mt-12 grid gap-6 md:grid-cols-3">
            {dict.bulk.steps.map((s, i) => (
              <li key={s} className="border-t border-paper/20 pt-5">
                <span className="display text-4xl text-amber">0{i + 1}</span>
                <p className="mt-2 font-semibold">{s}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>
      <div className="container-x grid gap-14 py-14 md:py-20 lg:grid-cols-12">
        <div className="lg:col-span-5">
          <h2 className="display text-3xl">{locale === "ar" ? "اشتغلنا ويا" : "We've worked with"}</h2>
          <p className="mt-2 text-sm text-mute">{dict.bulk.noPriceNote}</p>
          {clients.length > 0 && (
            <ul className="mt-6 grid grid-cols-3 gap-3">
              {clients.slice(0, 9).map((c) => (
                <li key={c.id} className="relative grid aspect-[4/3] place-items-center rounded-2xl border border-line bg-paper p-3" title={locale === "ar" ? c.name_ar : c.name_en ?? c.name_ar}>
                  {c.logo_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={c.logo_url} alt={locale === "ar" ? c.name_ar : c.name_en ?? c.name_ar} className="absolute inset-3 h-[calc(100%-1.5rem)] w-[calc(100%-1.5rem)] object-contain dark:invert" loading="lazy" />
                  ) : <span className="text-center text-xs font-bold">{locale === "ar" ? c.name_ar : c.name_en ?? c.name_ar}</span>}
                </li>
              ))}
            </ul>
          )}
          <Link href={`/${locale}/portfolio`} className="btn btn-outline mt-6">{locale === "ar" ? "شوف أعمالنا السابقة" : "See our previous work"}</Link>
        </div>
        <div className="lg:col-span-7">
          <h2 className="display mb-6 text-3xl">{dict.bulk.formTitle}</h2>
          <BulkForm />
        </div>
      </div>
    </div>
  );
}
