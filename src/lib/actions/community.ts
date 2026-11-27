"use server";
import { z } from "zod";
import { after } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getSession } from "@/lib/auth";
import { rateLimit } from "@/lib/rate-limit";
import { phoneSchema, uuid } from "@/lib/validation";
import { notifyAdmin } from "@/lib/notifications";
import { sniffMime } from "@/lib/storage";

const dataImage = z.string().regex(/^data:image\/(jpeg|png);base64,[A-Za-z0-9+/=]+$/).max(2_500_000);
const schema = z.object({
  garment_type: z.enum(["tshirt", "oversized", "hoodie", "sweatshirt", "longsleeve"]),
  color_id: uuid,
  title: z.string().trim().min(2).max(60),
  designer_name: z.string().trim().min(2).max(60),
  designer_phone: phoneSchema.optional(),
  fabric: z.array(z.record(z.string(), z.unknown())).min(1).max(40),
  preview_front: dataImage,
  preview_back: dataImage,
});

function decode(dataUrl: string): { buf: Buffer; mime: string } | null {
  const m = /^data:(image\/(?:jpeg|png));base64,(.+)$/.exec(dataUrl);
  if (!m) return null;
  const buf = Buffer.from(m[2]!, "base64");
  return sniffMime(buf) === m[1] ? { buf, mime: m[1]! } : null;
}

/**
 * A customer sends a design to the community page — on its own, without ordering anything.
 * It waits for the admin's approval. Only images this same person uploaded recently can be
 * part of it (an id alone never publishes someone else's file).
 */
export async function publishCommunityDesign(input: unknown): Promise<{ ok: true } | { ok: false; error: string }> {
  const parsed = schema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "validation" };
  if (!(await rateLimit("community"))) return { ok: false, error: "rate_limited" };
  const d = parsed.data;
  const db = createAdminClient();
  const session = await getSession();

  // keep the layout, never a browser-only address (blob:) — images are served again by /api/art
  const wanted = [...new Set(d.fabric.map((o) => o.tpacArtworkId).filter((x): x is string => typeof x === "string" && /^[0-9a-f-]{36}$/.test(x)))];
  let allowed = new Set<string>();
  if (wanted.length) {
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const { data: art } = await db.from("uploaded_artwork").select("id, uploaded_by, storage_path").in("id", wanted).gte("created_at", since);
    allowed = new Set(((art ?? []) as { id: string; uploaded_by: string | null; storage_path: string }[])
      .filter((a) => a.storage_path.startsWith("uploads/design/") && (a.uploaded_by ?? null) === (session?.userId ?? null))
      .map((a) => a.id));
    if (allowed.size !== wanted.length) return { ok: false, error: "artwork" };
  }
  const fabric = d.fabric.flatMap((o) => {
    if (o.type !== "Image" && o.type !== "image") return [o];
    return typeof o.tpacArtworkId === "string" && allowed.has(o.tpacArtworkId) ? [{ ...o, src: "" }] : [];
  });
  if (!fabric.length) return { ok: false, error: "validation" };
  if (JSON.stringify(fabric).length > 400_000) return { ok: false, error: "too_large" };

  const front = decode(d.preview_front);
  const back = decode(d.preview_back);
  if (!front || !back) return { ok: false, error: "invalid_preview" };
  const id = crypto.randomUUID();
  const ext = (m: string) => (m === "image/png" ? "png" : "jpg");
  const fp = `community/${id}/front.${ext(front.mime)}`;
  const bp = `community/${id}/back.${ext(back.mime)}`;
  const bucket = db.storage.from("design-uploads");
  const [u1, u2] = await Promise.all([
    bucket.upload(fp, front.buf, { contentType: front.mime, upsert: false }),
    bucket.upload(bp, back.buf, { contentType: back.mime, upsert: false }),
  ]);
  if (u1.error || u2.error) return { ok: false, error: "storage_failed" };

  const { error } = await db.from("community_designs").insert({
    id, garment_type: d.garment_type, color_id: d.color_id,
    title: d.title, designer_name: d.designer_name, designer_phone: d.designer_phone ?? null,
    user_id: session?.userId ?? null, fabric, artwork_ids: [...allowed],
    preview_front_path: fp, preview_back_path: bp,
  });
  if (error) {
    console.error("publishCommunityDesign", error);
    return { ok: false, error: "generic" };
  }
  after(() => notifyAdmin("inquiry.created", "تصميم زبون ينتظر الموافقة", `«${d.title}» — ${d.designer_name}`, "/ar/admin/community"));
  return { ok: true };
}
