import "server-only";
import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/env";
import type { Category, Collection, Color, ProductCard, ProductDetail, Size } from "@/lib/types";
import { normDesign, normType } from "@/lib/print-config";

export interface CatalogQuery {
  q?: string;
  category?: string;
  collection?: string;
  sizes?: string[];
  colors?: string[];
  min_price?: number;
  max_price?: number;
  in_stock?: boolean;
  new?: boolean;
  best?: boolean;
  limited?: boolean;
  customizable?: boolean;
  sort?: "newest" | "popular" | "price_asc" | "price_desc";
  limit?: number;
  offset?: number;
  exclude?: string;
}

export async function searchProducts(query: CatalogQuery): Promise<{ total: number; items: ProductCard[] }> {
  if (!isSupabaseConfigured()) return { total: 0, items: [] };
  const supabase = await createClient();
  const p = Object.fromEntries(Object.entries(query).filter(([, v]) => v !== undefined && v !== "" && !(Array.isArray(v) && !v.length)));
  const { data, error } = await supabase.rpc("catalog_search", { p });
  if (error) {
    console.error("catalog_search", error);
    throw new Error("catalog_unavailable");
  }
  return data as { total: number; items: ProductCard[] };
}

export const getCategories = cache(async (): Promise<Category[]> => {
  if (!isSupabaseConfigured()) return [];
  const supabase = await createClient();
  const { data } = await supabase.from("categories").select("*").eq("is_active", true).order("sort_order");
  return (data as Category[]) ?? [];
});

export const getCollections = cache(async (): Promise<Collection[]> => {
  if (!isSupabaseConfigured()) return [];
  const supabase = await createClient();
  const { data } = await supabase.from("collections").select("*").eq("is_active", true).order("sort_order");
  return (data as Collection[]) ?? [];
});

export const getColors = cache(async (): Promise<Color[]> => {
  if (!isSupabaseConfigured()) return [];
  const supabase = await createClient();
  const { data } = await supabase.from("colors").select("*").order("sort_order");
  return (data as Color[]) ?? [];
});

export const getSizes = cache(async (): Promise<Size[]> => {
  if (!isSupabaseConfigured()) return [];
  const supabase = await createClient();
  const { data } = await supabase.from("sizes").select("*").order("sort_order");
  return (data as Size[]) ?? [];
});

export const getProductBySlug = cache(async (slug: string): Promise<ProductDetail | null> => {
  if (!isSupabaseConfigured()) return null;
  const supabase = await createClient();
  const base = "*, category:categories(*), product_images(*), product_variants(*, color:colors(*), inventory(quantity, low_stock_threshold))";
  const printing = ", product_designs(*), product_type:product_types(*, product_type_views(*, product_print_areas(*)))";
  const query = (cols: string) => supabase.from("products").select(cols).eq("slug", slug).eq("is_published", true).maybeSingle();
  let { data, error } = await query(base + printing);
  // a database without add-product-printing-1.sql + -2.sql has no printing tables yet: load the product without them
  if (error) ({ data, error } = await query(base));
  if (error) {
    console.error("getProductBySlug", error);
    return null;
  }
  if (!data) return null;
  const p = data as unknown as ProductDetail;
  p.product_images.sort((a, b) => a.sort_order - b.sort_order);
  p.product_variants = p.product_variants.filter((v) => v.is_active);
  if (p.product_type) p.product_type = normType(p.product_type);
  p.product_designs = (p.product_designs ?? []).map(normDesign).sort((a, b) => a.sort_order - b.sort_order);
  // the same design on other garments (hoodie ⇄ t-shirt …), each with the admin's price
  const group = (p as ProductDetail & { design_group?: string | null }).design_group;
  if (group) {
    const { data: sib } = await supabase.from("products").select("id, slug, base_price, product_type:product_types(name_ar, name_en)").or(`design_group.eq.${group},id.eq.${group}`).eq("is_published", true).neq("id", p.id);
    p.garment_options = ((sib ?? []) as unknown as { slug: string; base_price: number; product_type: { name_ar: string; name_en: string } | { name_ar: string; name_en: string }[] | null }[])
      .map((x) => ({ slug: x.slug, price: x.base_price, type: Array.isArray(x.product_type) ? x.product_type[0] ?? null : x.product_type }))
      .filter((x): x is { slug: string; price: number; type: { name_ar: string; name_en: string } } => !!x.type);
  }
  return p;
});

export async function getReviews(productId: string) {
  if (!isSupabaseConfigured()) return [];
  const supabase = await createClient();
  const { data } = await supabase
    .from("reviews")
    .select("id, rating, body, author_name, created_at")
    .eq("product_id", productId)
    .eq("is_approved", true)
    .order("created_at", { ascending: false })
    .limit(20);
  return data ?? [];
}

export async function getAllProductSlugs(): Promise<{ slug: string; updated_at: string }[]> {
  if (!isSupabaseConfigured()) return [];
  const supabase = await createClient();
  const { data } = await supabase.from("products").select("slug, updated_at").eq("is_published", true);
  return data ?? [];
}
