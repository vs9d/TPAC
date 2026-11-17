"use server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getSession } from "@/lib/auth";
import { rateLimit } from "@/lib/rate-limit";
import { designSchema, fieldErrors } from "@/lib/validation";
import { sniffMime, signedUrl } from "@/lib/storage";

export type SaveDesignResult =
  | { ok: true; design_id: string; unit_price: number; preview_url: string | null; print_locations: string[] }
  | { ok: false; error: string; fields?: Record<string, string> };

function decodeImage(dataUrl: string): { buf: Buffer; mime: string } | null {
  const m = /^data:(image\/(?:jpeg|png));base64,(.+)$/.exec(dataUrl);
  if (!m) return null;
  const buf = Buffer.from(m[2]!, "base64");
  const mime = sniffMime(buf);
  return mime === m[1] ? { buf, mime } : null;
}

/**
 * Persists a customer's design: validates the editor state, recomputes the
 * price from the database (never trusting the browser), stores the preview
 * renders privately and links the original uploaded artwork to the design.
 */
export async function saveDesign(input: unknown): Promise<SaveDesignResult> {
  const parsed = designSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "validation", fields: fieldErrors(parsed.error) };
  if (!(await rateLimit("design"))) return { ok: false, error: "rate_limited" };
  const d = parsed.data;
  const db = createAdminClient();
  const session = await getSession();

  const [{ data: garment }, { data: locations }] = await Promise.all([
    db.from("custom_garment_types").select("*").eq("code", d.garment_type).eq("is_active", true).maybeSingle(),
    db.from("print_locations").select("code, price").eq("is_active", true),
  ]);
  if (!garment) return { ok: false, error: "garment_unavailable" };
  if (!(garment.color_ids as string[]).includes(d.color_id)) return { ok: false, error: "color_unavailable" };
  if (!(garment.sizes as string[]).includes(d.size_code)) return { ok: false, error: "size_unavailable" };

  const used = [...new Set(d.objects.map((o) => o.location))];
  const priceByLoc = new Map((locations ?? []).map((l) => [l.code as string, l.price as number]));
  if (used.some((l) => !priceByLoc.has(l) || !(garment.print_locations as string[]).includes(l))) return { ok: false, error: "location_unavailable" };
  const unitPrice = (garment.base_price as number) + used.reduce((n, l) => n + (priceByLoc.get(l) ?? 0), 0);

  const artworkIds = [...new Set(d.objects.map((o) => o.artwork_id).filter(Boolean) as string[])];
  if (artworkIds.length) {
    const { data: art } = await db.from("uploaded_artwork").select("id, custom_design_id").in("id", artworkIds);
    if ((art ?? []).length !== artworkIds.length) return { ok: false, error: "artwork_missing" };
  }

  const front = decodeImage(d.preview_front);
  const back = decodeImage(d.preview_back);
  if (!front || !back) return { ok: false, error: "invalid_preview" };

  const id = crypto.randomUUID();
  const ext = (m: string) => (m === "image/png" ? "png" : "jpg");
  const frontPath = `designs/${id}/front.${ext(front.mime)}`;
  const backPath = `designs/${id}/back.${ext(back.mime)}`;
  const bucket = db.storage.from("design-uploads");
  const [u1, u2] = await Promise.all([
    bucket.upload(frontPath, front.buf, { contentType: front.mime, upsert: false }),
    bucket.upload(backPath, back.buf, { contentType: back.mime, upsert: false }),
  ]);
  if (u1.error || u2.error) return { ok: false, error: "storage_failed" };

  const { error } = await db.from("custom_designs").insert({
    id,
    user_id: session?.userId ?? null,
    garment_type: d.garment_type,
    color_id: d.color_id,
    size_code: d.size_code,
    print_locations: used,
    config: { version: 1, artboard: { width: 600, height: 700 }, objects: d.objects },
    preview_front_path: frontPath,
    preview_back_path: backPath,
    unit_price: unitPrice,
    notes: d.notes ?? null,
  });
  if (error) {
    console.error("saveDesign", error);
    return { ok: false, error: "save_failed" };
  }
  if (artworkIds.length) await db.from("uploaded_artwork").update({ custom_design_id: id }).in("id", artworkIds).is("custom_design_id", null);

  return { ok: true, design_id: id, unit_price: unitPrice, preview_url: await signedUrl(frontPath), print_locations: used };
}
