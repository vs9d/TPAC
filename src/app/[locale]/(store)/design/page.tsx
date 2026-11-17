import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Aref_Ruqaa, Reem_Kufi, Alexandria, IBM_Plex_Sans_Arabic } from "next/font/google";
import { isLocale } from "@/lib/i18n/config";
import { getDictionary } from "@/lib/i18n";
import { createClient } from "@/lib/supabase/server";
import { getColors } from "@/lib/data/catalog";
import { isSupabaseConfigured } from "@/lib/env";
import { Designer } from "@/components/designer/designer";
import type { GarmentTypeRow, PrintLocationRow } from "@/lib/types";

const ruqaa = Aref_Ruqaa({ subsets: ["arabic", "latin"], weight: ["700"], display: "swap" });
const kufi = Reem_Kufi({ subsets: ["arabic", "latin"], weight: ["700"], display: "swap" });
const alex = Alexandria({ subsets: ["arabic", "latin"], weight: ["800"], display: "swap" });
const plex = IBM_Plex_Sans_Arabic({ subsets: ["arabic", "latin"], weight: ["700"], display: "swap" });

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
  const { garment, color } = await searchParams;
  let garments: GarmentTypeRow[] = [];
  let locations: PrintLocationRow[] = [];
  if (isSupabaseConfigured()) {
    const supabase = await createClient();
    const [g, l] = await Promise.all([
      supabase.from("custom_garment_types").select("*").eq("is_active", true).order("sort_order"),
      supabase.from("print_locations").select("*").eq("is_active", true).order("sort_order"),
    ]);
    garments = (g.data as GarmentTypeRow[]) ?? [];
    locations = (l.data as PrintLocationRow[]) ?? [];
  }
  const colors = await getColors();
  const fonts = [
    { label: "Alexandria", family: alex.style.fontFamily },
    { label: "رقعة — Ruqaa", family: ruqaa.style.fontFamily },
    { label: "كوفي — Kufi", family: kufi.style.fontFamily },
    { label: "Plex Arabic", family: plex.style.fontFamily },
  ];
  return (
    <div className="container-x relative py-8 md:py-12">
      {/* font classes ensure the @font-face rules are emitted for canvas text */}
      <span aria-hidden className={`${ruqaa.className} ${kufi.className} ${alex.className} ${plex.className} pointer-events-none absolute opacity-0`}>ابجد abc</span>
      <div className="mb-8 max-w-2xl">
        <p className="eyebrow mb-2 text-amber-deep">TPAC Studio</p>
        <h1 className="display text-4xl md:text-6xl">{dict.designer.title}</h1>
        <p className="mt-3 text-mute">{dict.designer.subtitle}</p>
      </div>
      {garments.length === 0 ? (
        <p className="py-20 text-center text-mute">{dict.common.serviceUnavailable}</p>
      ) : (
        <Designer garments={garments} locations={locations} colors={colors} fonts={fonts} initialGarment={garment} initialColor={color} />
      )}
    </div>
  );
}
