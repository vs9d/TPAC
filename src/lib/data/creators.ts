import "server-only";
import { cache } from "react";
import { createAdminClient } from "@/lib/supabase/admin";
import { isSupabaseConfigured } from "@/lib/env";
import type { Creator } from "@/lib/creators";

export interface CreatorListing {
  id: string; product_id: string; title: string; status: string; markup: number; base_price: number; view_count: number;
  slug: string; price: number; image: string | null; is_published: boolean; created_at: string; review_note: string | null; type_name: string | null;
}

/** A creator's listings with their product's price, slug and first photo. */
export async function creatorListings(creatorId: string, opts: { publishedOnly?: boolean } = {}): Promise<CreatorListing[]> {
  if (!isSupabaseConfigured()) return [];
  const db = createAdminClient();
  let q = db.from("creator_products")
    .select("id, product_id, title, status, markup, base_price, view_count, created_at, review_note, product_types(name_ar), products!inner(slug, base_price, is_published, product_images(url, sort_order))")
    .eq("creator_id", creatorId).order("created_at", { ascending: false }).limit(300);
  if (opts.publishedOnly) q = q.eq("status", "approved").eq("products.is_published", true);
  const { data } = await q;
  type Row = { id: string; product_id: string; title: string; status: string; markup: number; base_price: number; view_count: number; created_at: string; review_note: string | null; product_types: { name_ar: string } | null; products: { slug: string; base_price: number; is_published: boolean; product_images: { url: string; sort_order: number }[] } };
  return ((data ?? []) as unknown as Row[]).map((r) => ({
    id: r.id, product_id: r.product_id, title: r.title, status: r.status, markup: r.markup, base_price: r.base_price, view_count: r.view_count,
    slug: r.products.slug, price: r.products.base_price, is_published: r.products.is_published, created_at: r.created_at, review_note: r.review_note,
    image: [...(r.products.product_images ?? [])].sort((a, b) => a.sort_order - b.sort_order)[0]?.url ?? null, type_name: r.product_types?.name_ar ?? null,
  }));
}

export interface CreatorCard { user_id: string; username: string; display_name: string; avatar_url: string | null; cover_url: string | null; bio: string | null; pieces: number; orders: number; views: number; designs: number }

/** Ranking of approved creators: pieces sold (this month or all time), completed orders, page + product views. */
export const topCreators = cache(async (range: "month" | "all" = "month", limit = 24): Promise<CreatorCard[]> => {
  if (!isSupabaseConfigured()) return [];
  const db = createAdminClient();
  const since = range === "month" ? new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString() : "2000-01-01";
  const [{ data: creators }, { data: earn }, { data: stats }, { data: listings }] = await Promise.all([
    db.from("creators").select("user_id, username, display_name, avatar_url, cover_url, bio").eq("status", "approved"),
    db.from("creator_earnings").select("creator_id, quantity, order_id, status").neq("status", "void").gte("created_at", since),
    db.from("creator_stats_daily").select("creator_id, page_views, product_views").gte("day", since.slice(0, 10)),
    db.from("creator_products").select("creator_id").eq("status", "approved"),
  ]);
  const agg = new Map<string, { pieces: number; orders: Set<string>; views: number; designs: number }>();
  const get = (id: string) => agg.get(id) ?? (agg.set(id, { pieces: 0, orders: new Set(), views: 0, designs: 0 }), agg.get(id)!);
  for (const e of (earn ?? []) as { creator_id: string; quantity: number; order_id: string; status: string }[]) {
    const a = get(e.creator_id);
    a.pieces += e.quantity;
    if (e.status === "cleared") a.orders.add(e.order_id);
  }
  for (const s of (stats ?? []) as { creator_id: string; page_views: number; product_views: number }[]) get(s.creator_id).views += s.page_views + s.product_views;
  for (const l of (listings ?? []) as { creator_id: string }[]) get(l.creator_id).designs += 1;
  return ((creators ?? []) as Omit<CreatorCard, "pieces" | "orders" | "views" | "designs">[])
    .map((c) => { const a = get(c.user_id); return { ...c, pieces: a.pieces, orders: a.orders.size, views: a.views, designs: a.designs }; })
    .sort((a, b) => b.pieces - a.pieces || b.orders - a.orders || b.views - a.views || b.designs - a.designs)
    .slice(0, limit);
});

export interface EarningRow {
  id: string; order_id: string; order_number: string; product_name: string; size_code: string | null; quantity: number; amount: number;
  status: string; void_reason: string | null; available_at: string | null; created_at: string; order_status: string | null; creator_product_id: string | null;
}
export async function creatorEarnings(creatorId: string, limit = 500): Promise<EarningRow[]> {
  const db = createAdminClient();
  const { data } = await db.from("creator_earnings").select("id, order_id, order_number, product_name, size_code, quantity, amount, status, void_reason, available_at, created_at, creator_product_id").eq("creator_id", creatorId).order("created_at", { ascending: false }).limit(limit);
  const rows = (data ?? []) as Omit<EarningRow, "order_status">[];
  // only the order's status — never the customer, phone or address
  const { data: orders } = rows.length ? await db.from("orders").select("id, status").in("id", [...new Set(rows.map((r) => r.order_id))]) : { data: [] };
  const st = new Map(((orders ?? []) as { id: string; status: string }[]).map((o) => [o.id, o.status]));
  return rows.map((r) => ({ ...r, order_status: st.get(r.order_id) ?? null }));
}

export async function creatorDaily(creatorId: string, days = 120): Promise<{ day: string; page_views: number; product_views: number }[]> {
  const since = new Date(Date.now() - days * 86400000).toISOString().slice(0, 10);
  const { data } = await createAdminClient().from("creator_stats_daily").select("day, page_views, product_views").eq("creator_id", creatorId).gte("day", since).order("day");
  return (data ?? []) as { day: string; page_views: number; product_views: number }[];
}

export async function creatorFollowers(creatorId: string): Promise<number> {
  const { count } = await createAdminClient().from("creator_follows").select("user_id", { count: "exact", head: true }).eq("creator_id", creatorId);
  return count ?? 0;
}

export type { Creator };
