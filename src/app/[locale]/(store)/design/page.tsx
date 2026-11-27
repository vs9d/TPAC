import { getDesignShare } from "@/lib/actions/share";
import { getCommunityDesignForStudio } from "@/lib/data/community";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { isLocale } from "@/lib/i18n/config";
import { getDictionary } from "@/lib/i18n";
import { Designer } from "@/components/designer/designer";
import { adminT } from "@/lib/admin-i18n";
import Link from "next/link";
import { DesignFaq } from "@/components/designer/faq";
import { FONTS, FONT_CLASSES, loadStudioData } from "@/components/designer/studio-data";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  if (!isLocale(locale)) return {};
  const t = getDictionary(locale);
  return { title: t.designer.title, description: t.designer.subtitle, alternates: { canonical: `/${locale}/design`, languages: { ar: "/ar/design", en: "/en/design" } } };
}

export default async function DesignPage({ params, searchParams }: { params: Promise<{ locale: string }>; searchParams: Promise<{ garment?: string; color?: string; couple?: string; share?: string; as?: string; community?: string }> }) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const dict = getDictionary(locale);
  const t = adminT(locale);
  const { garment, color, couple, share, as, community } = await searchParams;
  // a couple design shared by link: the owner (?share=…) or the partner (?share=…&as=partner)
  const shared = share ? await getDesignShare(share) : null;
  const initialShare = shared?.ok ? { token: share!, role: as === "partner" ? ("partner" as const) : ("owner" as const), garment_type: shared.garment_type, pieces: shared.pieces, partner_done_at: shared.partner_done_at, from_name: shared.from_name } : null;
  // a design from the community page, opened to order it (or to change it first)
  const fromCommunity = community && /^[0-9a-f-]{36}$/.test(community) ? await getCommunityDesignForStudio(community) : null;
  const { garments, locations, options, tiers, settings, faq, templates, colors, open } = await loadStudioData();
  return (
    <div className="container-x relative py-8 md:py-12">
      {/* font classes make sure the @font-face rules are emitted for canvas text */}
      <span aria-hidden className={`${FONT_CLASSES} pointer-events-none absolute opacity-0`}>ابجد abc</span>
      <header className="mb-8 max-w-3xl">
        <p className="mb-4 text-xs font-semibold uppercase tracking-[0.32em] text-mute" dir="ltr">TPAC Studio · Print on demand</p>
        <h1 className="display text-[2.05rem] leading-[1.2] sm:text-6xl">
          {t("صمّم قطعتك.", "Design your piece.")}
          <span className="relative mt-1 block w-fit text-pine">
            {t("وإحنا نطبعها ونوصلها.", "We print it and deliver it.")}
            <span className="absolute inset-x-0 -bottom-1 -z-10 h-3 rounded-full bg-pine-soft" aria-hidden />
          </span>
        </h1>
        <p className="mt-5 text-base leading-relaxed text-mute sm:text-lg">{t("ارفع صورتك أو اكتب كلمتك، وشوف شكلها مباشرة على التيشيرت أو الهودي، ونوصلها لباب بيتك بكل محافظات العراق.", "Upload your image or write your words, see them live on the tee or hoodie, and we deliver to your door anywhere in Iraq.")}</p>
        <ol className="mt-7 flex flex-wrap items-center gap-x-6 gap-y-3">
          {[t("اختر القطعة", "Pick the piece"), t("أضف تصميمك", "Add your design"), t("اطلب وتوصلك", "Order & receive")].map((step, i) => (
            <li key={step} className="flex items-center gap-3 text-sm font-semibold sm:text-base">
              <span className="grid size-12 place-items-center rounded-full border border-line text-sm font-bold tabular-nums" dir="ltr">0{i + 1}</span>
              {step}
            </li>
          ))}
        </ol>
      </header>
      {!open ? (
        <div className="studio-card mx-auto max-w-xl p-8 text-center">
          <p className="display text-2xl">{t("الطباعة بتصميمك متوقفة حالياً", "Printing your own design is paused for now")}</p>
          <p className="mt-2 text-mute">{t("تصفّح تصاميمنا الجاهزة، أو تواصل معنا لطلب خاص.", "Browse our ready designs, or contact us for a special request.")}</p>
          <Link href={`/${locale}/shop`} className="btn btn-brand mt-6">{t("تسوّق التصاميم", "Shop the designs")}</Link>
        </div>
      ) : garments.length === 0 ? (
        <p className="py-20 text-center text-mute">{dict.common.serviceUnavailable}</p>
      ) : (
        <Designer garments={garments} locations={locations} colors={colors} fonts={FONTS} options={options} tiers={tiers} settings={settings} initialGarment={initialShare?.garment_type ?? fromCommunity?.garment_type ?? garment} initialColor={color} initialCouple={couple === "1"} initialShare={initialShare} shareMissing={!!share && !initialShare} initialCommunity={fromCommunity} templates={templates} />
      )}
      <DesignFaq items={faq} locale={locale} />
    </div>
  );
}
