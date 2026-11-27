"use server";
import { z } from "zod";
import { after } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getSession } from "@/lib/auth";
import { rateLimit } from "@/lib/rate-limit";
import { phoneSchema, uuid } from "@/lib/validation";
import { notifyAdmin } from "@/lib/notifications";

const schema = z.object({
  design_id: uuid,
  title: z.string().trim().min(2).max(60),
  designer_name: z.string().trim().min(2).max(60),
  designer_phone: phoneSchema.optional(),
  fabric: z.array(z.record(z.string(), z.unknown())).min(1).max(40),
});

/**
 * A customer offers the design they just saved to the community page. It waits for the
 * admin's approval; only the person who just saved it (same account, or within the hour for
 * guests) can offer it, and only with the images that design really uses.
 */
export async function publishCommunityDesign(input: unknown): Promise<{ ok: true } | { ok: false; error: string }> {
  const parsed = schema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "validation" };
  if (!(await rateLimit("community"))) return { ok: false, error: "rate_limited" };
  const d = parsed.data;
  const db = createAdminClient();
  const session = await getSession();
  const { data: design } = await db.from("custom_designs").select("id, user_id, garment_type, color_id, config, preview_front_path, preview_back_path, created_at").eq("id", d.design_id).maybeSingle();
  if (!design) return { ok: false, error: "not_found" };
  const fresh = Date.now() - new Date(design.created_at as string).getTime() < 60 * 60 * 1000;
  const mine = design.user_id ? design.user_id === session?.userId : fresh;
  if (!mine) return { ok: false, error: "not_found" };
  const used = new Set(((design.config as { objects?: { artwork_id?: string }[] }).objects ?? []).map((o) => o.artwork_id).filter(Boolean) as string[]);
  // keep the layout, never a browser-only address (blob:) — images are served again by /api/art
  const fabric = d.fabric.flatMap((o) => {
    if (o.type !== "Image" && o.type !== "image") return [o];
    const art = typeof o.tpacArtworkId === "string" ? o.tpacArtworkId : "";
    return used.has(art) ? [{ ...o, src: "" }] : [];
  });
  const artwork_ids = [...new Set(fabric.map((o) => o.tpacArtworkId).filter((x): x is string => typeof x === "string" && used.has(x)))];
  if (JSON.stringify(fabric).length > 400_000) return { ok: false, error: "too_large" };
  const { error } = await db.from("community_designs").insert({
    custom_design_id: design.id, garment_type: design.garment_type, color_id: design.color_id,
    title: d.title, designer_name: d.designer_name, designer_phone: d.designer_phone ?? null,
    user_id: session?.userId ?? null, fabric, artwork_ids,
    preview_front_path: design.preview_front_path, preview_back_path: design.preview_back_path,
  });
  if (error) {
    console.error("publishCommunityDesign", error);
    return { ok: false, error: "generic" };
  }
  after(() => notifyAdmin("inquiry.created", "تصميم زبون ينتظر الموافقة", `«${d.title}» — ${d.designer_name}`, "/ar/admin/community"));
  return { ok: true };
}
