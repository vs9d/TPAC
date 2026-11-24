import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Cairo, Tajawal, Almarai, Changa, Lalezar, Reem_Kufi, Aref_Ruqaa, Amiri, El_Messiri, Marhey, Rakkas, Alexandria, Noto_Kufi_Arabic, Bebas_Neue, Anton, Oswald, Montserrat, Playfair_Display, Pacifico, Lobster, Permanent_Marker, Bangers, Black_Ops_One, Staatliches, Righteous } from "next/font/google";
import { isLocale } from "@/lib/i18n/config";
import { getDictionary } from "@/lib/i18n";
import { createClient } from "@/lib/supabase/server";
import { getColors } from "@/lib/data/catalog";
import { isSupabaseConfigured } from "@/lib/env";
import { Designer } from "@/components/designer/designer";
import { adminT } from "@/lib/admin-i18n";
import { customerUploadsEnabled } from "@/lib/designer-settings";
import Link from "next/link";
import { faqFrom, type FaqItem } from "@/lib/design-faq";
import { DesignFaq } from "@/components/designer/faq";
import type { DesignerFont } from "@/lib/design-assets";
import { normType, type ProductTypeRow } from "@/lib/print-config";
import { podTemplate, type PodTemplate } from "@/lib/pod-templates";
import type { DesignerOptionRow, DesignerSettings, DesignerTierRow, GarmentTypeRow, PrintLocationRow } from "@/lib/types";

// Fonts are only fetched when a design actually uses them (preload: false), so the page stays light.
const cairo = Cairo({ subsets: ["arabic", "latin"], weight: ["400", "700"], display: "swap", preload: false });
const tajawal = Tajawal({ subsets: ["arabic", "latin"], weight: ["400", "700"], display: "swap", preload: false });
const almarai = Almarai({ subsets: ["arabic", "latin"], weight: ["400", "700"], display: "swap", preload: false });
const changa = Changa({ subsets: ["arabic", "latin"], weight: ["400", "700"], display: "swap", preload: false });
const lalezar = Lalezar({ subsets: ["arabic", "latin"], weight: ["400"], display: "swap", preload: false });
const reem_kufi = Reem_Kufi({ subsets: ["arabic", "latin"], weight: ["400", "700"], display: "swap", preload: false });
const aref_ruqaa = Aref_Ruqaa({ subsets: ["arabic", "latin"], weight: ["400", "700"], display: "swap", preload: false });
const amiri = Amiri({ subsets: ["arabic", "latin"], weight: ["400", "700"], display: "swap", preload: false });
const el_messiri = El_Messiri({ subsets: ["arabic", "latin"], weight: ["400", "700"], display: "swap", preload: false });
const marhey = Marhey({ subsets: ["arabic", "latin"], weight: ["400", "700"], display: "swap", preload: false });
const rakkas = Rakkas({ subsets: ["arabic", "latin"], weight: ["400"], display: "swap", preload: false });
const alexandria = Alexandria({ subsets: ["arabic", "latin"], weight: ["400", "700"], display: "swap", preload: false });
const noto_kufi_arabic = Noto_Kufi_Arabic({ subsets: ["arabic", "latin"], weight: ["400", "700"], display: "swap", preload: false });
const bebas_neue = Bebas_Neue({ subsets: ["latin"], weight: ["400"], display: "swap", preload: false });
const anton = Anton({ subsets: ["latin"], weight: ["400"], display: "swap", preload: false });
const oswald = Oswald({ subsets: ["latin"], weight: ["400", "700"], display: "swap", preload: false });
const montserrat = Montserrat({ subsets: ["latin"], weight: ["400", "700"], display: "swap", preload: false });
const playfair_display = Playfair_Display({ subsets: ["latin"], weight: ["400", "700"], display: "swap", preload: false });
const pacifico = Pacifico({ subsets: ["latin"], weight: ["400"], display: "swap", preload: false });
const lobster = Lobster({ subsets: ["latin"], weight: ["400"], display: "swap", preload: false });
const permanent_marker = Permanent_Marker({ subsets: ["latin"], weight: ["400"], display: "swap", preload: false });
const bangers = Bangers({ subsets: ["latin"], weight: ["400"], display: "swap", preload: false });
const black_ops_one = Black_Ops_One({ subsets: ["latin"], weight: ["400"], display: "swap", preload: false });
const staatliches = Staatliches({ subsets: ["latin"], weight: ["400"], display: "swap", preload: false });
const righteous = Righteous({ subsets: ["latin"], weight: ["400"], display: "swap", preload: false });

const FONTS: DesignerFont[] = [
  { label: "Cairo", labelAr: "كايرو", family: cairo.style.fontFamily, group: "arabic", weights: 2 },
  { label: "Tajawal", labelAr: "تجوال", family: tajawal.style.fontFamily, group: "arabic", weights: 2 },
  { label: "Almarai", labelAr: "المراعي", family: almarai.style.fontFamily, group: "arabic", weights: 2 },
  { label: "Changa", labelAr: "شانغا", family: changa.style.fontFamily, group: "arabic", weights: 2 },
  { label: "Lalezar", labelAr: "لاله زار", family: lalezar.style.fontFamily, group: "arabic", weights: 1 },
  { label: "Reem Kufi", labelAr: "ريم كوفي", family: reem_kufi.style.fontFamily, group: "arabic", weights: 2 },
  { label: "Aref Ruqaa", labelAr: "عارف رقعة", family: aref_ruqaa.style.fontFamily, group: "arabic", weights: 2 },
  { label: "Amiri", labelAr: "أميري", family: amiri.style.fontFamily, group: "arabic", weights: 2 },
  { label: "El Messiri", labelAr: "المسيري", family: el_messiri.style.fontFamily, group: "arabic", weights: 2 },
  { label: "Marhey", labelAr: "مرحي", family: marhey.style.fontFamily, group: "arabic", weights: 2 },
  { label: "Rakkas", labelAr: "رقّاص", family: rakkas.style.fontFamily, group: "arabic", weights: 1 },
  { label: "Alexandria", labelAr: "الإسكندرية", family: alexandria.style.fontFamily, group: "arabic", weights: 2 },
  { label: "Noto Kufi Arabic", labelAr: "نوتو كوفي", family: noto_kufi_arabic.style.fontFamily, group: "arabic", weights: 2 },
  { label: "Bebas Neue", family: bebas_neue.style.fontFamily, group: "latin", weights: 1 },
  { label: "Anton", family: anton.style.fontFamily, group: "latin", weights: 1 },
  { label: "Oswald", family: oswald.style.fontFamily, group: "latin", weights: 2 },
  { label: "Montserrat", family: montserrat.style.fontFamily, group: "latin", weights: 2 },
  { label: "Playfair Display", family: playfair_display.style.fontFamily, group: "latin", weights: 2 },
  { label: "Pacifico", family: pacifico.style.fontFamily, group: "latin", weights: 1 },
  { label: "Lobster", family: lobster.style.fontFamily, group: "latin", weights: 1 },
  { label: "Permanent Marker", family: permanent_marker.style.fontFamily, group: "latin", weights: 1 },
  { label: "Bangers", family: bangers.style.fontFamily, group: "latin", weights: 1 },
  { label: "Black Ops One", family: black_ops_one.style.fontFamily, group: "latin", weights: 1 },
  { label: "Staatliches", family: staatliches.style.fontFamily, group: "latin", weights: 1 },
  { label: "Righteous", family: righteous.style.fontFamily, group: "latin", weights: 1 },
];

const DEFAULT_SETTINGS: DesignerSettings = { lead_days_min: 3, lead_days_max: 5, rush_days: 2, notice_ar: "كل قطعة تُطبع حسب الطلب ولا يمكن إرجاعها بعد الطباعة.", notice_en: "Every piece is printed to order and cannot be returned after printing.", min_dpi: 150 };

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  if (!isLocale(locale)) return {};
  const t = getDictionary(locale);
  return { title: t.designer.title, description: t.designer.subtitle, alternates: { canonical: `/${locale}/design`, languages: { ar: "/ar/design", en: "/en/design" } } };
}

export default async function DesignPage({ params, searchParams }: { params: Promise<{ locale: string }>; searchParams: Promise<{ garment?: string; color?: string; couple?: string }> }) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const dict = getDictionary(locale);
  const t = adminT(locale);
  const { garment, color, couple } = await searchParams;
  let garments: GarmentTypeRow[] = [];
  let locations: PrintLocationRow[] = [];
  let options: DesignerOptionRow[] = [];
  let tiers: DesignerTierRow[] = [];
  let settings = DEFAULT_SETTINGS;
  let templates: Record<string, PodTemplate | null> = {};
  let faq: FaqItem[] = faqFrom(null, DEFAULT_SETTINGS);
  if (isSupabaseConfigured()) {
    const supabase = await createClient();
    const [g, l, o, tr, s] = await Promise.all([
      supabase.from("custom_garment_types").select("*").eq("is_active", true).order("sort_order"),
      supabase.from("print_locations").select("*").eq("is_active", true).order("sort_order"),
      // these two tables arrive with add-designer-pro.sql: an older database simply returns nothing
      supabase.from("designer_options").select("*").eq("is_active", true).order("sort_order"),
      supabase.from("designer_tiers").select("*").eq("is_active", true).order("min_qty"),
      supabase.from("website_settings").select("value").eq("key", "designer").maybeSingle(),
    ]);
    garments = (g.data as GarmentTypeRow[]) ?? [];
    locations = (l.data as PrintLocationRow[]) ?? [];
    options = (o.data as DesignerOptionRow[]) ?? [];
    tiers = (tr.data as DesignerTierRow[]) ?? [];
    settings = { ...DEFAULT_SETTINGS, ...((s.data?.value as Partial<DesignerSettings>) ?? {}) };
    const { data: faqRow } = await supabase.from("website_settings").select("value").eq("key", "design_faq").maybeSingle();
    faq = faqFrom(faqRow?.value, settings);
    // photos + print areas the admin manages for each garment (same records as catalog product types)
    if (garments.length) {
      const { data: types } = await supabase.from("product_types").select("*, product_type_views(*, product_print_areas(*))").in("code", garments.map((x) => x.code));
      templates = Object.fromEntries(((types as ProductTypeRow[]) ?? []).map((ty) => [ty.code, podTemplate(normType(ty))]));
    }
  }
  const [colors, open] = await Promise.all([getColors(), customerUploadsEnabled()]);
  return (
    <div className="container-x relative py-8 md:py-12">
      {/* font classes make sure the @font-face rules are emitted for canvas text */}
      <span aria-hidden className={`${cairo.className} ${tajawal.className} ${almarai.className} ${changa.className} ${lalezar.className} ${reem_kufi.className} ${aref_ruqaa.className} ${amiri.className} ${el_messiri.className} ${marhey.className} ${rakkas.className} ${alexandria.className} ${noto_kufi_arabic.className} ${bebas_neue.className} ${anton.className} ${oswald.className} ${montserrat.className} ${playfair_display.className} ${pacifico.className} ${lobster.className} ${permanent_marker.className} ${bangers.className} ${black_ops_one.className} ${staatliches.className} ${righteous.className} pointer-events-none absolute opacity-0`}>ابجد abc</span>
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
        <Designer garments={garments} locations={locations} colors={colors} fonts={FONTS} options={options} tiers={tiers} settings={settings} initialGarment={garment} initialColor={color} initialCouple={couple === "1"} templates={templates} />
      )}
      <DesignFaq items={faq} locale={locale} />
    </div>
  );
}
