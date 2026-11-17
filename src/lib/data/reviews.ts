import "server-only";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/env";
import { signedUrls } from "@/lib/storage";

export interface PublicReview {
  id: string;
  rating: number;
  body: string | null;
  author_name: string | null;
  author_city: string | null;
  photos: string[];
  source: "site" | "instagram" | "whatsapp" | "tiktok" | "other";
  is_verified: boolean;
  is_featured: boolean;
  created_at: string;
  product: { slug: string; name_ar: string; name_en: string } | null;
}

export interface ReviewStats { count: number; average: number; with_photos: number; by_rating: Record<string, number> }

/** Private customer uploads are served through short-lived signed URLs; admin screenshots are public URLs. */
export async function resolvePhotos(reviews: { photos: string[] }[]) {
  const priv = reviews.flatMap((r) => r.photos).filter((p) => !/^https?:\/\//.test(p) && !p.startsWith("/"));
  const urls = await signedUrls(priv, "design-uploads", 3600);
  for (const r of reviews) r.photos = r.photos.map((p) => urls[p] ?? (/^https?:\/\//.test(p) || p.startsWith("/") ? p : "")).filter(Boolean);
}

export async function getStoreReviews(opts: { filter?: "photos" | "5" | "4"; limit: number }): Promise<{ reviews: PublicReview[]; stats: ReviewStats }> {
  const empty = { reviews: [], stats: { count: 0, average: 0, with_photos: 0, by_rating: {} } };
  if (!isSupabaseConfigured()) return empty;
  const supabase = await createClient();
  let q = supabase
    .from("reviews")
    .select("id, rating, body, author_name, author_city, photos, source, is_verified, is_featured, created_at, product:products(slug, name_ar, name_en)")
    .eq("is_approved", true)
    .order("is_featured", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(opts.limit);
  if (opts.filter === "photos") q = q.neq("photos", "{}");
  if (opts.filter === "5" || opts.filter === "4") q = q.eq("rating", Number(opts.filter));
  const [{ data, error }, { data: stats }] = await Promise.all([q, supabase.rpc("review_stats")]);
  if (error) {
    console.error("getStoreReviews", error);
    return empty;
  }
  const reviews = (data ?? []) as unknown as PublicReview[];
  await resolvePhotos(reviews);
  return { reviews, stats: (stats as ReviewStats) ?? empty.stats };
}
