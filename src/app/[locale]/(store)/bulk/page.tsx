import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { isLocale } from "@/lib/i18n/config";
import { getDictionary } from "@/lib/i18n";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/env";
import { BulkForm } from "@/components/bulk/bulk-form";
import { formatIQD, formatNumber } from "@/lib/format";

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
  let rules: { product_type: string; min_quantity: number; max_quantity: number | null; unit_price: number }[] = [];
  if (isSupabaseConfigured()) {
    const supabase = await createClient();
    const { data } = await supabase.from("bulk_pricing_rules").select("product_type, min_quantity, max_quantity, unit_price").eq("is_active", true).order("product_type").order("min_quantity");
    rules = data ?? [];
  }
  const byType = rules.reduce<Record<string, typeof rules>>((m, r) => ((m[r.product_type] ??= []).push(r), m), {});
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
          <h2 className="display text-3xl">{dict.bulk.pricingTitle}</h2>
          <p className="mt-2 text-sm text-mute">{dict.bulk.pricingNote}</p>
          <div className="mt-6 space-y-6">
            {Object.entries(byType).map(([type, tiers]) => (
              <div key={type}>
                <p className="mb-2 font-semibold">{dict.bulk.productTypes[type] ?? type}</p>
                <table className="w-full text-sm">
                  <tbody>
                    {tiers.map((t) => (
                      <tr key={t.min_quantity} className="border-b border-line">
                        <td className="py-2 tabular-nums">{formatNumber(t.min_quantity, locale)}{t.max_quantity ? `–${formatNumber(t.max_quantity, locale)}` : "+"} {dict.common.pieces}</td>
                        <td className="py-2 text-end font-semibold tabular-nums">{formatIQD(t.unit_price, locale)} <span className="text-xs font-normal text-mute">/ {dict.bulk.perPiece}</span></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ))}
          </div>
        </div>
        <div className="lg:col-span-7">
          <h2 className="display mb-6 text-3xl">{dict.bulk.formTitle}</h2>
          <BulkForm />
        </div>
      </div>
    </div>
  );
}
