import "server-only";
import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/env";
import type { Category, Collection, Color, ProductCard, ProductDetail, Size } from "@/lib/types";

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
  const { data, error } = await supabase
    .from("products")
    .select("*, category:categories(*), product_images(*), product_variants(*, color:colors(*), inventory(quantity, low_stock_threshold))")
    .eq("slug", slug)
    .eq("is_published", true)
    .maybeSingle();
  if (error) {
    console.error("getProductBySlug", error);
    return null;
  }
  if (!data) return null;
  const p = data as unknown as ProductDetail;
  p.product_images.sort((a, b) => a.sort_order - b.sort_order);
  p.product_variants = p.product_variants.filter((v) => v.is_active);
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
