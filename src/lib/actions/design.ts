"use server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getSession } from "@/lib/auth";
import { rateLimit } from "@/lib/rate-limit";
import { designSchema, fieldErrors } from "@/lib/validation";
import { sniffMime, signedUrl } from "@/lib/storage";
import { resolveOptions, type OptionLite } from "@/lib/design-pricing";

export interface SavedDesignLine { design_id: string; size: string; quantity: number }
export type SaveDesignResult =
  | { ok: true; batch_id: string; lines: SavedDesignLine[]; unit_price: number; options_price: number; print_locations: string[]; preview_url: string | null }
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
 *
 * One design is ordered in several sizes at once: a saved design (and a cart
 * line) is created per size, all sharing one `batch_id` and the same previews.
 * The quantity discount itself is applied by quote_cart on the whole cart.
 */
export async function saveDesign(input: unknown): Promise<SaveDesignResult> {
  const parsed = designSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "validation", fields: fieldErrors(parsed.error) };
  if (!(await rateLimit("design"))) return { ok: false, error: "rate_limited" };
  const d = parsed.data;
  const db = createAdminClient();
  const session = await getSession();

  const [{ data: garment }, { data: locations }, { data: opts }] = await Promise.all([
    db.from("custom_garment_types").select("*").eq("code", d.garment_type).eq("is_active", true).maybeSingle(),
    db.from("print_locations").select("code, price").eq("is_active", true),
    db.from("designer_options").select("id, group_code, code, price, is_default").eq("is_active", true).order("sort_order"),
  ]);
  if (!garment) return { ok: false, error: "garment_unavailable" };
  if (!(garment.color_ids as string[]).includes(d.color_id)) return { ok: false, error: "color_unavailable" };
  const sizeEntries = Object.entries(d.sizes);
  if (sizeEntries.some(([s]) => !(garment.sizes as string[]).includes(s))) return { ok: false, error: "size_unavailable" };

  const used = [...new Set(d.objects.map((o) => o.location))];
  const priceByLoc = new Map((locations ?? []).map((l) => [l.code as string, l.price as number]));
  if (used.some((l) => !priceByLoc.has(l) || !(garment.print_locations as string[]).includes(l))) return { ok: false, error: "location_unavailable" };

  // Unknown option codes are rejected (not silently ignored) so the customer never pays for something that does not exist.
  const known = (opts ?? []) as OptionLite[];
  const wanted: [OptionLite["group_code"], string | undefined][] = [["method", d.options.method], ["finish", d.options.finish], ["fabric", d.options.fabric], ["package", d.options.package], ...(d.options.addons ?? []).map((a): [OptionLite["group_code"], string] => ["addon", a])];
  if (wanted.some(([g, c]) => c && !known.some((o) => o.group_code === g && o.code === c))) return { ok: false, error: "option_unavailable" };
  const chosen = resolveOptions(known, d.options);
  const optionsPrice = chosen.price;
  const unitPrice = (garment.base_price as number) + used.reduce((n, l) => n + (priceByLoc.get(l) ?? 0), 0) + optionsPrice;

  const artworkIds = [...new Set(d.objects.map((o) => o.artwork_id).filter(Boolean) as string[])];
  if (artworkIds.length) {
    const { data: art } = await db.from("uploaded_artwork").select("id, custom_design_id").in("id", artworkIds);
    if ((art ?? []).length !== artworkIds.length) return { ok: false, error: "artwork_missing" };
  }

  const front = decodeImage(d.preview_front);
  const back = decodeImage(d.preview_back);
  if (!front || !back) return { ok: false, error: "invalid_preview" };

  const batchId = crypto.randomUUID();
  const ext = (m: string) => (m === "image/png" ? "png" : "jpg");
  const frontPath = `designs/${batchId}/front.${ext(front.mime)}`;
  const backPath = `designs/${batchId}/back.${ext(back.mime)}`;
  const bucket = db.storage.from("design-uploads");
  const [u1, u2] = await Promise.all([
    bucket.upload(frontPath, front.buf, { contentType: front.mime, upsert: false }),
    bucket.upload(backPath, back.buf, { contentType: back.mime, upsert: false }),
  ]);
  if (u1.error || u2.error) return { ok: false, error: "storage_failed" };

  const config = {
    version: 2,
    artboard: { width: 600, height: 700 },
    objects: d.objects,
    options: chosen.choice,
    sizes: d.sizes,
  };
  const rows = sizeEntries.map(([size, quantity]) => ({ id: crypto.randomUUID(), size, quantity }));
  const { error } = await db.from("custom_designs").insert(
    rows.map((r) => ({
      id: r.id,
      batch_id: batchId,
      name: d.name ?? null,
      user_id: session?.userId ?? null,
      garment_type: d.garment_type,
      color_id: d.color_id,
      size_code: r.size,
      print_locations: used,
      config,
      options: chosen.choice,
      options_price: optionsPrice,
      preview_front_path: frontPath,
      preview_back_path: backPath,
      unit_price: unitPrice,
      notes: d.notes ?? null,
    })),
  );
  if (error) {
    console.error("saveDesign", error);
    return { ok: false, error: "save_failed" };
  }
  if (artworkIds.length) await db.from("uploaded_artwork").update({ custom_design_id: rows[0]!.id }).in("id", artworkIds).is("custom_design_id", null);

  return {
    ok: true,
    batch_id: batchId,
    lines: rows.map((r) => ({ design_id: r.id, size: r.size, quantity: r.quantity })),
    unit_price: unitPrice,
    options_price: optionsPrice,
    print_locations: used,
    preview_url: await signedUrl(frontPath),
  };
}
