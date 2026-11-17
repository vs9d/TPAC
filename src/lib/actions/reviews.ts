"use server";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { getSession } from "@/lib/auth";
import { rateLimit } from "@/lib/rate-limit";
import { normalizeIraqiPhone } from "@/lib/phone";
import { fieldErrors } from "@/lib/validation";

const schema = z.object({
  author_name: z.string().trim().min(2, "min").max(60, "max"),
  author_city: z.string().trim().max(80, "max").optional(),
  rating: z.coerce.number().int().min(1).max(5),
  body: z.string().trim().min(10, "min").max(1500, "max"),
  product_id: z.union([z.uuid(), z.literal("")]).optional(),
  photo_ids: z.array(z.uuid()).max(4).default([]),
  order_number: z.string().trim().toUpperCase().max(20).optional(),
  phone: z.string().trim().max(30).optional(),
});

export type StoreReviewResult = { ok: true; verified: boolean } | { ok: false; error: string; fields?: Record<string, string> };

/** Public review submission (guests allowed). Always stored unapproved; staff publish it. */
export async function submitStoreReview(input: unknown): Promise<StoreReviewResult> {
  const parsed = schema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "validation", fields: fieldErrors(parsed.error) };
  if (!(await rateLimit("review"))) return { ok: false, error: "rate_limited" };
  const d = parsed.data;
  const db = createAdminClient();
  const session = await getSession();

  // Verified buyer: order number AND phone must match the same order.
  let orderId: string | null = null;
  let productId: string | null = d.product_id || null;
  const phone = normalizeIraqiPhone(d.phone);
  if (d.order_number && phone) {
    const { data: order } = await db.from("orders").select("id, status").eq("order_number", d.order_number).eq("phone", phone).maybeSingle();
    if (order && order.status !== "cancelled") {
      orderId = order.id;
      if (!productId) {
        const { data: item } = await db.from("order_items").select("product_id").eq("order_id", order.id).not("product_id", "is", null).limit(1).maybeSingle();
        productId = item?.product_id ?? null;
      }
    }
  }

  let photos: string[] = [];
  if (d.photo_ids.length) {
    const { data: art } = await db.from("uploaded_artwork").select("id, storage_path").in("id", d.photo_ids).like("storage_path", "uploads/review/%");
    photos = (art ?? []).map((a) => a.storage_path as string);
  }

  const { error } = await db.from("reviews").insert({
    product_id: productId,
    user_id: session?.userId ?? null,
    author_name: d.author_name,
    author_city: d.author_city || null,
    rating: d.rating,
    body: d.body,
    photos,
    source: "site",
    is_verified: !!orderId,
    order_id: orderId,
    is_approved: false,
  });
  if (error) {
    // one review per customer per product
    if (error.code === "23505") return { ok: false, error: "duplicate" };
    console.error("submitStoreReview", error);
    return { ok: false, error: "generic" };
  }
  return { ok: true, verified: !!orderId };
}

