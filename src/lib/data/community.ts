import "server-only";
import { cache } from "react";
import { createAdminClient } from "@/lib/supabase/admin";
import { isSupabaseConfigured } from "@/lib/env";

/** A design a customer chose to share, approved by the admin (public fields only). */
export interface CommunityDesign {
  id: string; title: string; designer_name: string; garment_type: string; color_id: string | null;
  image_front: string | null; image_back: string | null; approved_at: string | null;
}

/** The studio layout of an approved community design, with its images served by /api/art. */
export interface CommunityForStudio { id: string; title: string; designer_name: string; garment_type: string; color_id: string | null; objects: Record<string, unknown>[] }

/** The approved designs, newest first. The table has no public policy: only these fields leave the server. */
export const listCommunityDesigns = cache(async (garment?: string): Promise<CommunityDesign[]> => {
  if (!isSupabaseConfigured()) return [];
  let q = createAdminClient()
    .from("community_designs")
    .select("id, title, designer_name, garment_type, color_id, image_front, image_back, approved_at")
    .eq("status", "approved")
    .order("approved_at", { ascending: false })
    .limit(120);
  if (garment) q = q.eq("garment_type", garment);
  const { data, error } = await q;
  if (error) return []; // before add-share-group-community.sql
  return (data ?? []) as CommunityDesign[];
});

export async function getCommunityDesignForStudio(id: string): Promise<CommunityForStudio | null> {
  if (!isSupabaseConfigured()) return null;
  const { data } = await createAdminClient()
    .from("community_designs")
    .select("id, title, designer_name, garment_type, color_id, fabric, status")
    .eq("id", id).maybeSingle();
  if (!data || data.status !== "approved") return null;
  const objects = ((data.fabric as Record<string, unknown>[]) ?? []).map((o) =>
    typeof o.tpacArtworkId === "string" ? { ...o, src: `/api/art/${o.tpacArtworkId}?community=${data.id}`, crossOrigin: null } : o,
  );
  return { id: data.id, title: data.title, designer_name: data.designer_name, garment_type: data.garment_type, color_id: data.color_id, objects };
}
