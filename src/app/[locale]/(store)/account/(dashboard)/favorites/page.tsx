import Link from "next/link";
import { notFound } from "next/navigation";
import { isLocale } from "@/lib/i18n/config";
import { getDictionary } from "@/lib/i18n";
import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { ProductCard } from "@/components/product/product-card";
import type { ProductCard as Card } from "@/lib/types";

export const metadata = { robots: { index: false } };

export default async function FavoritesPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const dict = getDictionary(locale);
  const session = await requireUser(locale);
  const supabase = await createClient();
  const { data } = await supabase
    .from("favorites")
    .select("product:products(id, slug, name_ar, name_en, base_price, compare_at_price, is_new_arrival, is_limited, is_customizable, product_images(url, alt_ar, alt_en, sort_order), product_variants(is_active, inventory(quantity), color:colors(hex)))")
    .eq("user_id", session.userId)
    .order("created_at", { ascending: false });
  type Row = { product: { id: string; slug: string; name_ar: string; name_en: string; base_price: number; compare_at_price: number | null; is_new_arrival: boolean; is_limited: boolean; is_customizable: boolean; product_images: { url: string; alt_ar: string | null; alt_en: string | null; sort_order: number }[]; product_variants: { is_active: boolean; inventory: { quantity: number } | null; color: { hex: string } | null }[] } | null };
  const cards: Card[] = ((data as unknown as Row[]) ?? [])
    .map((r) => r.product)
    .filter((p): p is NonNullable<Row["product"]> => !!p)
    .map((p) => ({
      id: p.id, slug: p.slug, name_ar: p.name_ar, name_en: p.name_en, price: p.base_price, compare_at_price: p.compare_at_price,
      is_new_arrival: p.is_new_arrival, is_limited: p.is_limited, is_customizable: p.is_customizable,
      images: [...p.product_images].sort((a, b) => a.sort_order - b.sort_order).slice(0, 2),
      colors: [...new Set(p.product_variants.map((v) => v.color?.hex).filter(Boolean) as string[])],
      in_stock: p.product_variants.some((v) => v.is_active && (v.inventory?.quantity ?? 0) > 0),
    }));
  return (
    <section>
      <h2 className="display mb-6 text-2xl">{dict.account.favorites}</h2>
      {cards.length === 0 ? (
        <div><p className="text-mute">{dict.account.noFavorites}</p><Link href={`/${locale}/shop`} className="btn btn-primary mt-6">{dict.common.shopNow}</Link></div>
      ) : (
        <div className="grid grid-cols-2 gap-x-3 gap-y-8 md:grid-cols-3">{cards.map((p) => <ProductCard key={p.id} product={p} locale={locale} dict={dict} />)}</div>
      )}
    </section>
  );
}
