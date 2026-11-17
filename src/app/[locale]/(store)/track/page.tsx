import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { isLocale } from "@/lib/i18n/config";
import { getDictionary } from "@/lib/i18n";
import { TrackForm } from "@/components/account/track-form";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  if (!isLocale(locale)) return {};
  const t = getDictionary(locale);
  return { title: t.track.title, description: t.track.body, alternates: { canonical: `/${locale}/track` } };
}

export default async function TrackPage({ params, searchParams }: { params: Promise<{ locale: string }>; searchParams: Promise<{ order?: string }> }) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const dict = getDictionary(locale);
  const { order } = await searchParams;
  return (
    <div className="container-x max-w-3xl py-14 md:py-20">
      <h1 className="display text-4xl md:text-6xl">{dict.track.title}</h1>
      <p className="mt-3 text-mute">{dict.track.body}</p>
      <TrackForm initialOrder={order && /^TP\d+$/i.test(order) ? order.toUpperCase() : ""} />
    </div>
  );
}
