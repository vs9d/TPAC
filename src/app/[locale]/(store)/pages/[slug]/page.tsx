import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { isLocale } from "@/lib/i18n/config";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/env";
import { DEFAULT_PAGES, PAGE_SLUGS, type PageSlug } from "@/lib/content/pages";

type Props = { params: Promise<{ locale: string; slug: string }> };

async function getPage(slug: string) {
  if (!(PAGE_SLUGS as readonly string[]).includes(slug)) return null;
  const base = DEFAULT_PAGES[slug as PageSlug];
  if (!isSupabaseConfigured()) return base;
  const supabase = await createClient();
  const { data } = await supabase.from("website_settings").select("value").eq("key", "pages").maybeSingle();
  const override = (data?.value as Record<string, Partial<typeof base>> | undefined)?.[slug];
  return { ...base, ...Object.fromEntries(Object.entries(override ?? {}).filter(([, v]) => typeof v === "string" && v.trim())) } as typeof base;
}

export function generateStaticParams() {
  return PAGE_SLUGS.map((slug) => ({ slug }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale, slug } = await params;
  if (!isLocale(locale)) return {};
  const page = await getPage(slug);
  if (!page) return {};
  const body = locale === "ar" ? page.body_ar : page.body_en;
  return { title: locale === "ar" ? page.title_ar : page.title_en, description: body.slice(0, 155), alternates: { canonical: `/${locale}/pages/${slug}`, languages: { ar: `/ar/pages/${slug}`, en: `/en/pages/${slug}` } } };
}

export default async function InfoPage({ params }: Props) {
  const { locale, slug } = await params;
  if (!isLocale(locale)) notFound();
  const page = await getPage(slug);
  if (!page) notFound();
  const body = locale === "ar" ? page.body_ar : page.body_en;
  return (
    <article className="container-x max-w-3xl py-14 md:py-20">
      <h1 className="display mb-10 text-4xl md:text-6xl">{locale === "ar" ? page.title_ar : page.title_en}</h1>
      <div className="space-y-5 text-lg leading-loose text-ink/85">
        {body.split(/\n{2,}/).map((p, i) => <p key={i} className="whitespace-pre-line">{p}</p>)}
      </div>
    </article>
  );
}
