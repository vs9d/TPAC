"use server";
import { randomBytes } from "node:crypto";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { rateLimit } from "@/lib/rate-limit";
import { uuid } from "@/lib/validation";

/** One piece of a couple design as the studio keeps it: its Fabric objects, colour and sizes. */
const pieceSchema = z.object({
  objects: z.array(z.record(z.string(), z.unknown())).max(40),
  colorId: uuid,
  sizes: z.record(z.string().regex(/^[A-Z0-9]{1,6}$/), z.number().int().min(0).max(99)),
});
export type SharedPiece = z.infer<typeof pieceSchema>;
const tokenRe = /^[A-Za-z0-9_-]{20,64}$/;
const MAX_BYTES = 700_000;

/**
 * Images point to /api/art/<artwork id>?share=<token> so both people's browsers can load them;
 * anything else that is not a plain web address (blob:, javascript:…) is dropped.
 */
function portable(objects: Record<string, unknown>[], token: string) {
  return objects.flatMap((o) => {
    if (o.type !== "Image" && o.type !== "image") return [o];
    const art = typeof o.tpacArtworkId === "string" && /^[0-9a-f-]{36}$/.test(o.tpacArtworkId) ? o.tpacArtworkId : null;
    if (art) return [{ ...o, src: `/api/art/${art}?share=${token}`, crossOrigin: null }];
    return typeof o.src === "string" && /^data:image\/(png|jpeg|webp);base64,/.test(o.src) ? [o] : [];
  });
}

export type ShareView = { ok: true; garment_type: string; pieces: SharedPiece[]; partner_done_at: string | null; from_name: string | null } | { ok: false; error: string };

/** The owner of a couple design opens it to the partner: returns the link token. */
export async function createDesignShare(input: unknown): Promise<{ ok: true; token: string } | { ok: false; error: string }> {
  const parsed = z.object({
    garment_type: z.enum(["tshirt", "oversized", "hoodie", "sweatshirt", "longsleeve"]),
    pieces: z.array(pieceSchema).length(2),
    from_name: z.string().trim().max(40).optional(),
  }).safeParse(input);
  if (!parsed.success) return { ok: false, error: "validation" };
  if (!(await rateLimit("share"))) return { ok: false, error: "rate_limited" };
  const token = randomBytes(18).toString("base64url");
  const d = parsed.data;
  const data = { pieces: d.pieces.map((p) => ({ ...p, objects: portable(p.objects, token) })), from_name: d.from_name || null };
  if (JSON.stringify(data).length > MAX_BYTES) return { ok: false, error: "too_large" };
  const { error } = await createAdminClient().from("design_drafts").insert({ token, garment_type: d.garment_type, data });
  if (error) {
    console.error("createDesignShare", error);
    return { ok: false, error: "generic" };
  }
  return { ok: true, token };
}

/** Both people read the shared design through its token. */
export async function getDesignShare(token: string): Promise<ShareView> {
  if (typeof token !== "string" || !tokenRe.test(token)) return { ok: false, error: "not_found" };
  const { data } = await createAdminClient().from("design_drafts").select("garment_type, data, partner_done_at, expires_at").eq("token", token).maybeSingle();
  if (!data || new Date(data.expires_at as string) < new Date()) return { ok: false, error: "not_found" };
  const body = data.data as { pieces?: SharedPiece[]; from_name?: string | null };
  return { ok: true, garment_type: data.garment_type as string, pieces: body.pieces ?? [], partner_done_at: (data.partner_done_at as string | null) ?? null, from_name: body.from_name ?? null };
}

/** The partner sends back the second piece. */
export async function savePartnerPiece(token: string, input: unknown): Promise<{ ok: true } | { ok: false; error: string }> {
  if (typeof token !== "string" || !tokenRe.test(token)) return { ok: false, error: "not_found" };
  const parsed = pieceSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "validation" };
  if (!(await rateLimit("share", "save"))) return { ok: false, error: "rate_limited" };
  const db = createAdminClient();
  const { data: row } = await db.from("design_drafts").select("id, data, expires_at").eq("token", token).maybeSingle();
  if (!row || new Date(row.expires_at as string) < new Date()) return { ok: false, error: "not_found" };
  const body = row.data as { pieces: SharedPiece[]; from_name?: string | null };
  const pieces = [body.pieces[0]!, { ...parsed.data, objects: portable(parsed.data.objects, token) }];
  const next = { ...body, pieces };
  if (JSON.stringify(next).length > MAX_BYTES) return { ok: false, error: "too_large" };
  const now = new Date().toISOString();
  const { error } = await db.from("design_drafts").update({ data: next, partner_done_at: now, updated_at: now }).eq("id", row.id);
  if (error) return { ok: false, error: "generic" };
  return { ok: true };
}
