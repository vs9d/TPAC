import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { isLocale } from "@/lib/i18n/config";
import { SizeFinder } from "@/components/size/size-finder";
import type { FinderProduct } from "@/lib/size-chart";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  if (!isLocale(locale)) return {};
  const ar = locale === "ar";
  return {
    title: ar ? "اعرف قياسك" : "Find your size",
    description: ar ? "اكتب طولك ووزنك واختار القصّة، ونقترح عليك قياس TPAC المناسب للهودي والتيشيرت." : "Enter your height and weight, choose a fit, and get your TPAC size for hoodies and t-shirts.",
    alternates: { canonical: `/${locale}/size-finder` },
  };
}

const PRODUCTS: FinderProduct[] = ["hoodie", "sweatshirt", "tshirt", "kids"];

export default async function SizeFinderPage({ params, searchParams }: { params: Promise<{ locale: string }>; searchParams: Promise<{ product?: string }> }) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const { product } = await searchParams;
  const ar = locale === "ar";
  return (
    <div className="container-x max-w-5xl py-14 md:py-20">
      <p className="eyebrow text-amber-deep">TPAC</p>
      <h1 className="display mt-2 text-4xl md:text-6xl">{ar ? "اعرف قياسك" : "Find your size"}</h1>
      <p className="mt-3 max-w-2xl text-mute">{ar ? "اكتب طولك ووزنك، واختار القطعة وشلون تحبها — ضيقة، طبيعية، أو واسعة — ونگلك قياسك حسب جدول قياسات TPAC." : "Enter your height and weight, choose the garment and how you like it to fit — and we'll match you to TPAC's size chart."}</p>
      <SizeFinder initialProduct={PRODUCTS.includes(product as FinderProduct) ? (product as FinderProduct) : undefined} />
    </div>
  );
}
