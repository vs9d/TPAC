"use server";
import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { getSession } from "@/lib/auth";
import { rateLimit } from "@/lib/rate-limit";
import { newsletterSchema, contactSchema, trackSchema, reviewSchema, fieldErrors } from "@/lib/validation";
import { notifyAdmin } from "@/lib/notifications";

export type FormState = { ok: true; exists?: boolean } | { ok: false; error: string; fields?: Record<string, string> } | null;

export async function subscribeNewsletter(_prev: FormState, form: FormData): Promise<FormState> {
  const parsed = newsletterSchema.safeParse({ email: form.get("email"), locale: form.get("locale") });
  if (!parsed.success) return { ok: false, error: "email" };
  if (!(await rateLimit("newsletter"))) return { ok: false, error: "rate_limited" };
  const email = parsed.data.email.toLowerCase();
  const { error } = await createAdminClient().from("newsletter_subscribers").insert({ email, locale: parsed.data.locale });
  if (error?.code === "23505") return { ok: true, exists: true };
  if (error) return { ok: false, error: "generic" };
  return { ok: true };
}

export async function submitContact(_prev: FormState, form: FormData): Promise<FormState> {
  const parsed = contactSchema.safeParse({
    name: form.get("name"),
    phone: form.get("phone") || undefined,
    email: form.get("email") || undefined,
    message: form.get("message"),
  });
  if (!parsed.success) return { ok: false, error: "validation", fields: fieldErrors(parsed.error) };
  if (!(await rateLimit("contact"))) return { ok: false, error: "rate_limited" };
  const { error } = await createAdminClient().from("contact_inquiries").insert({
    name: parsed.data.name,
    phone: parsed.data.phone || null,
    email: parsed.data.email || null,
    message: parsed.data.message,
  });
  if (error) return { ok: false, error: "generic" };
  await notifyAdmin("inquiry.created", `استفسار جديد من ${parsed.data.name}`, parsed.data.message.slice(0, 500), "/ar/admin/inquiries");
  return { ok: true };
}

export interface TrackResult {
  order_number: string;
  status: string;
  created_at: string;
  delivery_method: string;
  governorate: string;
  city: string;
  total: number;
  items: { name_ar: string; name_en: string; quantity: number; size_code: string | null; color_name_ar: string | null; color_name_en: string | null }[];
  history: { status: string; at: string }[];
}

export async function trackOrder(_prev: unknown, form: FormData): Promise<{ ok: true; order: TrackResult } | { ok: false; error: string } | null> {
  const parsed = trackSchema.safeParse({ order_number: form.get("order_number"), phone: form.get("phone") });
  if (!parsed.success) return { ok: false, error: "not_found" };
  if (!(await rateLimit("track"))) return { ok: false, error: "rate_limited" };
  // track_order() requires BOTH the order number and the phone to match.
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("track_order", { p_order_number: parsed.data.order_number, p_phone: parsed.data.phone });
  if (error || !data) return { ok: false, error: "not_found" };
  return { ok: true, order: data as TrackResult };
}

export async function submitReview(_prev: FormState, form: FormData): Promise<FormState> {
  const session = await getSession();
  if (!session) return { ok: false, error: "not_signed_in" };
  const parsed = reviewSchema.safeParse({ product_id: form.get("product_id"), rating: Number(form.get("rating")), body: form.get("body") || undefined });
  if (!parsed.success) return { ok: false, error: "validation", fields: fieldErrors(parsed.error) };
  if (!(await rateLimit("review"))) return { ok: false, error: "rate_limited" };
  const supabase = await createClient();
  const { error } = await supabase.from("reviews").insert({
    product_id: parsed.data.product_id,
    user_id: session.userId,
    rating: parsed.data.rating,
    body: parsed.data.body ?? null,
    author_name: session.profile?.full_name?.split(" ")[0] ?? null,
    is_approved: false,
  });
  if (error?.code === "23505") return { ok: true, exists: true };
  if (error) return { ok: false, error: "generic" };
  return { ok: true };
}

export async function toggleFavorite(productId: string): Promise<{ ok: boolean; favorite?: boolean; error?: string }> {
  const session = await getSession();
  if (!session) return { ok: false, error: "not_signed_in" };
  const supabase = await createClient();
  const { data: existing } = await supabase.from("favorites").select("product_id").eq("user_id", session.userId).eq("product_id", productId).maybeSingle();
  if (existing) {
    await supabase.from("favorites").delete().eq("user_id", session.userId).eq("product_id", productId);
    revalidatePath("/[locale]/account/favorites", "page");
    return { ok: true, favorite: false };
  }
  const { error } = await supabase.from("favorites").insert({ user_id: session.userId, product_id: productId });
  if (error) return { ok: false, error: "generic" };
  revalidatePath("/[locale]/account/favorites", "page");
  return { ok: true, favorite: true };
}
