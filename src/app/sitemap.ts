import type { MetadataRoute } from "next";
import { publicEnv } from "@/lib/env";
import { createClient } from "@supabase/supabase-js";
import { PAGE_SLUGS } from "@/lib/content/pages";
import { isSupabaseConfigured } from "@/lib/env";

export const revalidate = 3600;

function entry(path: string, lastModified?: string | Date, priority = 0.6): MetadataRoute.Sitemap[number] {
  return {
    url: `${publicEnv.siteUrl}/ar${path}`,
    lastModified: lastModified ?? new Date(),
    priority,
    alternates: { languages: { ar: `${publicEnv.siteUrl}/ar${path}`, en: `${publicEnv.siteUrl}/en${path}` } },
  };
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const out: MetadataRoute.Sitemap = [
    entry("", undefined, 1),
    entry("/shop", undefined, 0.9),
    entry("/collections", undefined, 0.7),
    entry("/design", undefined, 0.8),
    entry("/bulk", undefined, 0.8),
    entry("/track", undefined, 0.3),
    entry("/contact", undefined, 0.4),
    ...PAGE_SLUGS.map((s) => entry(`/pages/${s}`, undefined, 0.3)),
  ];
  if (!isSupabaseConfigured()) return out;
  // Anonymous client (no cookies): RLS limits results to published content.
  const db = createClient(publicEnv.supabaseUrl, publicEnv.supabaseAnonKey, { auth: { persistSession: false } });
  const [products, collections, categories] = await Promise.all([
    db.from("products").select("slug, updated_at").eq("is_published", true),
    db.from("collections").select("slug, updated_at").eq("is_active", true),
    db.from("categories").select("slug, updated_at").eq("is_active", true),
  ]);
  for (const p of products.data ?? []) out.push(entry(`/product/${p.slug}`, p.updated_at, 0.8));
  for (const c of collections.data ?? []) out.push(entry(`/collections/${c.slug}`, c.updated_at, 0.7));
  for (const c of categories.data ?? []) out.push({ ...entry(`/shop?category=${c.slug}`, c.updated_at, 0.7) });
  return out;
}
