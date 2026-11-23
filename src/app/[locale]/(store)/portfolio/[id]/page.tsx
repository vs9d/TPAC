import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ArrowRight } from "lucide-react";
import { isLocale } from "@/lib/i18n/config";
import { CATEGORY_LABEL, getProject } from "@/lib/data/portfolio";
import { Gallery } from "@/components/portfolio/gallery";
import { formatDate } from "@/lib/format";

export async function generateMetadata({ params }: { params: Promise<{ locale: string; id: string }> }): Promise<Metadata> {
  const { locale, id } = await params;
  if (!isLocale(locale)) return {};
  const p = await getProject(id);
  if (!p) return {};
  const ar = locale === "ar";
  const title = ar ? p.title_ar : p.title_en ?? p.title_ar;
  return { title, description: (ar ? p.description_ar : p.description_en ?? p.description_ar) ?? undefined, openGraph: p.photos[0] ? { images: [p.photos[0].url] } : undefined, alternates: { canonical: `/${locale}/portfolio/${id}` } };
}

export default async function ProjectPage({ params }: { params: Promise<{ locale: string; id: string }> }) {
  const { locale, id } = await params;
  if (!isLocale(locale)) notFound();
  const p = await getProject(id);
  if (!p) notFound();
  const ar = locale === "ar";
  const title = ar ? p.title_ar : p.title_en ?? p.title_ar;
  const desc = ar ? p.description_ar : p.description_en ?? p.description_ar;
  const client = p.client ? (ar ? p.client.name_ar : p.client.name_en ?? p.client.name_ar) : null;
  const Back = ar ? ArrowRight : ArrowLeft;
  const Next = ar ? ArrowLeft : ArrowRight;
  return (
    <div className="container-x max-w-6xl py-10 md:py-14">
      <Link href={`/${locale}/portfolio`} className="inline-flex items-center gap-1.5 text-sm font-semibold text-mute hover:text-ink"><Back className="size-4" /> {ar ? "كل الأعمال" : "All work"}</Link>
      <div className="mt-6 flex flex-wrap items-center gap-4">
        {p.client?.logo_url && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={p.client.logo_url} alt={client ?? ""} className="h-14 w-24 object-contain dark:invert" />
        )}
        <div>
          <p className="text-sm text-mute">{[client, ar ? CATEGORY_LABEL[p.category].ar : CATEGORY_LABEL[p.category].en, p.completed_on ? formatDate(p.completed_on, locale) : null].filter(Boolean).join(" · ")}</p>
          <h1 className="display text-3xl md:text-5xl">{title}</h1>
        </div>
      </div>
      {desc && <p className="mt-5 max-w-3xl whitespace-pre-line leading-relaxed text-mute">{desc}</p>}
      <div className="mt-8">{p.photos.length ? <Gallery photos={p.photos} title={title} /> : null}</div>
      <div className="mt-12 flex flex-col items-start gap-3 rounded-[1.75rem] bg-bone p-6 md:flex-row md:items-center md:justify-between md:p-8">
        <p className="font-semibold">{ar ? "تريد نفس الشغل لجهتك؟" : "Want the same for your organisation?"}</p>
        <Link href={`/${locale}/bulk`} className="btn btn-primary">{ar ? "اطلب عرض سعر" : "Request a quotation"} <Next className="size-4" /></Link>
      </div>
    </div>
  );
}
