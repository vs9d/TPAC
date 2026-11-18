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
import type { DesignerFont } from "@/lib/design-assets";
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

export default async function DesignPage({ params, searchParams }: { params: Promise<{ locale: string }>; searchParams: Promise<{ garment?: string; color?: string }> }) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const dict = getDictionary(locale);
  const t = adminT(locale);
  const { garment, color } = await searchParams;
  let garments: GarmentTypeRow[] = [];
  let locations: PrintLocationRow[] = [];
  let options: DesignerOptionRow[] = [];
  let tiers: DesignerTierRow[] = [];
  let settings = DEFAULT_SETTINGS;
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
  }
  const colors = await getColors();
  return (
    <div className="container-x relative py-6 md:py-10">
      {/* font classes make sure the @font-face rules are emitted for canvas text */}
      <span aria-hidden className={`${cairo.className} ${tajawal.className} ${almarai.className} ${changa.className} ${lalezar.className} ${reem_kufi.className} ${aref_ruqaa.className} ${amiri.className} ${el_messiri.className} ${marhey.className} ${rakkas.className} ${alexandria.className} ${noto_kufi_arabic.className} ${bebas_neue.className} ${anton.className} ${oswald.className} ${montserrat.className} ${playfair_display.className} ${pacifico.className} ${lobster.className} ${permanent_marker.className} ${bangers.className} ${black_ops_one.className} ${staatliches.className} ${righteous.className} pointer-events-none absolute opacity-0`}>ابجد abc</span>
      <div className="mb-6 max-w-2xl">
        <p className="eyebrow mb-2 text-amber-deep">TPAC Studio</p>
        <h1 className="display text-3xl md:text-5xl">{dict.designer.title}</h1>
        <p className="mt-2 text-sm text-mute md:text-base">{dict.designer.subtitle}</p>
        <ul className="mt-4 flex flex-wrap gap-2 text-xs font-semibold">
          {[t("٢٥ خطاً عربياً ولاتينياً", "25 Arabic & Latin fonts"), t("أشكال وقوالب جاهزة", "Shapes & ready layouts"), t("٥ أماكن طباعة", "5 print placements"), t("خصم على الكميات", "Quantity discounts"), t("معاينة أمام وخلف", "Front & back preview")].map((x) => (
            <li key={x} className="rounded-full border border-line px-3 py-1">{x}</li>
          ))}
        </ul>
      </div>
      {garments.length === 0 ? (
        <p className="py-20 text-center text-mute">{dict.common.serviceUnavailable}</p>
      ) : (
        <Designer garments={garments} locations={locations} colors={colors} fonts={FONTS} options={options} tiers={tiers} settings={settings} initialGarment={garment} initialColor={color} />
      )}
    </div>
  );
}
