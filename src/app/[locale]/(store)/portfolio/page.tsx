import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ArrowRight, Images, Star, Camera } from "lucide-react";
import { isLocale } from "@/lib/i18n/config";
import { CATEGORY_LABEL, PORTFOLIO_CATEGORIES, getPortfolio, type PortfolioCategory } from "@/lib/data/portfolio";
import { formatDate } from "@/lib/format";
import { cn } from "@/lib/format";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  if (!isLocale(locale)) return {};
  const ar = locale === "ar";
  return {
    title: ar ? "أعمالنا — جامعات وشركات اشتغلنا وياها" : "Our work — universities & companies",
    description: ar ? "مشاريع TPAC السابقة ويا الجامعات والكليات والشركات والمنظمات: هوديات وتيشيرتات بتصاميمهم." : "TPAC's previous projects with universities, colleges, companies and organizations.",
    alternates: { canonical: `/${locale}/portfolio` },
  };
}

export default async function PortfolioPage({ params, searchParams }: { params: Promise<{ locale: string }>; searchParams: Promise<{ category?: string }> }) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const ar = locale === "ar";
  const { category } = await searchParams;
  const active = PORTFOLIO_CATEGORIES.includes(category as PortfolioCategory) ? (category as PortfolioCategory) : null;
  const { clients, projects } = await getPortfolio();
  const shown = active ? projects.filter((p) => p.category === active) : projects;
  const used = PORTFOLIO_CATEGORIES.filter((c) => projects.some((p) => p.category === c));
  const Arrow = ar ? ArrowLeft : ArrowRight;
  const label = (c: PortfolioCategory) => (ar ? CATEGORY_LABEL[c].ar : CATEGORY_LABEL[c].en);
  return (
    <div>
      <section className="bg-ink text-paper">
        <div className="container-x py-16 md:py-24">
          <p className="eyebrow mb-4 text-amber">{ar ? "أعمالنا" : "Our work"}</p>
          <h1 className="display max-w-4xl text-5xl md:text-7xl">{ar ? "جهات وثقت بـ TPAC" : "Trusted by"}</h1>
          <p className="mt-5 max-w-xl text-lg text-paper/70">{ar ? "جامعات، كليات، شركات ومنظمات — جهّزنالهم هوديات وتيشيرتات بتصاميمهم." : "Universities, colleges, companies and organizations — hoodies and tees made with their designs."}</p>
          {clients.length > 0 && (
            <ul className="mt-12 grid grid-cols-3 gap-3 sm:grid-cols-4 lg:grid-cols-6" aria-label={ar ? "عملاؤنا" : "Our clients"}>
              {clients.map((c) => (
                <li key={c.id} className="relative grid aspect-[4/3] place-items-center rounded-2xl bg-paper/[.06] p-4" title={ar ? c.name_ar : c.name_en ?? c.name_ar}>
                  {c.logo_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={c.logo_url} alt={ar ? c.name_ar : c.name_en ?? c.name_ar} className="absolute inset-4 h-[calc(100%-2rem)] w-[calc(100%-2rem)] object-contain invert" loading="lazy" />
                  ) : <span className="text-center text-sm font-bold">{ar ? c.name_ar : c.name_en ?? c.name_ar}</span>}
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>

      <div className="container-x py-12 md:py-16">
        {projects.length > 0 ? (
          <>
            {used.length > 1 && (
              <nav className="-mx-4 mb-8 flex gap-2 overflow-x-auto px-4 pb-1" aria-label={ar ? "التصنيفات" : "Categories"}>
                <Link href={`/${locale}/portfolio`} aria-current={!active ? "page" : undefined} className={cn("chip h-10 shrink-0 px-4", !active && "border-ink bg-ink text-paper")}>{ar ? "الكل" : "All"}</Link>
                {used.map((c) => (
                  <Link key={c} href={`/${locale}/portfolio?category=${c}`} aria-current={active === c ? "page" : undefined} className={cn("chip h-10 shrink-0 px-4", active === c && "border-ink bg-ink text-paper")}>{label(c)}</Link>
                ))}
              </nav>
            )}
            <ul className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {shown.map((p) => {
                const title = ar ? p.title_ar : p.title_en ?? p.title_ar;
                return (
                  <li key={p.id}>
                    <Link href={`/${locale}/portfolio/${p.id}`} className="group block overflow-hidden rounded-[1.75rem] border border-line bg-paper transition hover:-translate-y-0.5 hover:shadow-lg">
                      <div className="relative aspect-[4/3] bg-bone">
                        {p.photos[0] ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={p.photos[0].url} alt={title} loading="lazy" className="size-full object-cover transition duration-500 group-hover:scale-105" />
                        ) : p.instagram_url ? (
                          <span className="absolute inset-0 grid place-items-center bg-gradient-to-br from-[#833ab4] via-[#e1306c] to-[#f77737] text-white">
                            <span className="flex flex-col items-center gap-2 text-sm font-bold"><Camera className="size-9" aria-hidden /> {ar ? "شوف الصور على إنستغرام" : "See the photos on Instagram"}</span>
                          </span>
                        ) : <Images className="absolute inset-0 m-auto size-10 text-mute" />}
                        {p.is_featured && <span className="absolute start-3 top-3 flex items-center gap-1 rounded-full bg-amber px-2.5 py-1 text-xs font-bold text-ink"><Star className="size-3.5" /> {ar ? "مميّز" : "Featured"}</span>}
                        {p.photos.length > 1 && <span className="absolute bottom-3 end-3 flex items-center gap-1 rounded-full bg-paper/85 px-2.5 py-1 text-xs font-semibold backdrop-blur"><Images className="size-3.5" /> {p.photos.length}</span>}
                      </div>
                      <div className="flex items-center gap-3 p-4">
                        {p.client?.logo_url && (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={p.client.logo_url} alt="" className="h-10 w-14 shrink-0 object-contain dark:invert" />
                        )}
                        <div className="min-w-0 flex-1">
                          <p className="truncate font-bold">{title}</p>
                          <p className="truncate text-xs text-mute">{[p.client ? (ar ? p.client.name_ar : p.client.name_en ?? p.client.name_ar) : null, label(p.category), p.completed_on ? formatDate(p.completed_on, locale) : null].filter(Boolean).join(" · ")}</p>
                        </div>
                        <Arrow className="size-4 shrink-0 text-mute transition group-hover:text-ink" />
                      </div>
                    </Link>
                  </li>
                );
              })}
            </ul>
            {!shown.length && <p className="py-10 text-center text-mute">{ar ? "ماكو مشاريع بهذا التصنيف بعد." : "No projects in this category yet."}</p>}
          </>
        ) : (
          <div className="grid place-items-center rounded-[1.75rem] border border-dashed border-line px-6 py-16 text-center">
            <Images className="mb-3 size-10 text-pine" />
            <p className="font-semibold">{ar ? "صور المشاريع جاية قريباً." : "Project photos are coming soon."}</p>
          </div>
        )}

        <div className="mt-14 flex flex-col items-center gap-4 rounded-[1.75rem] bg-bone p-8 text-center md:p-12">
          <h2 className="display text-3xl md:text-4xl">{ar ? "تريد شغل مثلهم لجهتكم؟" : "Want the same for your team?"}</h2>
          <p className="max-w-lg text-mute">{ar ? "أرسل طلب عرض سعر وراح نتواصل وياك على الواتساب." : "Send a quotation request and we'll get back to you on WhatsApp."}</p>
          <Link href={`/${locale}/bulk`} className="btn btn-primary h-14 px-8 text-base">{ar ? "اطلب عرض سعر" : "Request a quotation"} <Arrow className="size-4" /></Link>
        </div>
      </div>
    </div>
  );
}
