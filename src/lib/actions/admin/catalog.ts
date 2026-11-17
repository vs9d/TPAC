"use server";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { assertStaff } from "@/lib/auth";
import { categorySchema, collectionSchema, colorSchema, sizeSchema, inventoryAdjustSchema, fieldErrors } from "@/lib/validation";
import { bool, str, dbError, logActivity, baghdadIso, type ActionState } from "./common";

const refresh = () => revalidatePath("/[locale]", "layout");

export async function adjustInventory(_prev: ActionState, form: FormData): Promise<ActionState> {
  await assertStaff();
  const parsed = inventoryAdjustSchema.safeParse({ variant_id: form.get("variant_id"), change: form.get("change"), reason: form.get("reason"), note: str(form.get("note")) || undefined });
  if (!parsed.success) return { ok: false, error: "validation", fields: fieldErrors(parsed.error) };
  const supabase = await createClient();
  // adjust_inventory(): staff check + row update + audit trail in one transaction; CHECK constraint blocks negative stock.
  const { error } = await supabase.rpc("adjust_inventory", { p_variant_id: parsed.data.variant_id, p_change: parsed.data.change, p_reason: parsed.data.reason, p_note: parsed.data.note ?? null });
  if (error) return error.code === "23514" ? { ok: false, error: "insufficient_stock" } : dbError(error);
  refresh();
  return { ok: true };
}

export async function saveCategory(_prev: ActionState, form: FormData): Promise<ActionState> {
  await assertStaff();
  const parsed = categorySchema.safeParse({
    slug: form.get("slug"), name_ar: form.get("name_ar"), name_en: form.get("name_en"),
    description_ar: str(form.get("description_ar")), description_en: str(form.get("description_en")),
    image_url: str(form.get("image_url")), parent_id: str(form.get("parent_id")), sort_order: form.get("sort_order") || 0, is_active: bool(form.get("is_active")),
  });
  if (!parsed.success) return { ok: false, error: "validation", fields: fieldErrors(parsed.error) };
  const supabase = await createClient();
  const id = str(form.get("id"));
  const { error } = id ? await supabase.from("categories").update(parsed.data).eq("id", id) : await supabase.from("categories").insert(parsed.data);
  if (error) return dbError(error);
  await logActivity(id ? "category.updated" : "category.created", "category", id || parsed.data.slug);
  refresh();
  return { ok: true };
}

export async function deleteCategory(_prev: ActionState, form: FormData): Promise<ActionState> {
  await assertStaff();
  const supabase = await createClient();
  const { error } = await supabase.from("categories").delete().eq("id", str(form.get("id")));
  if (error) return dbError(error);
  await logActivity("category.deleted", "category", str(form.get("id")));
  refresh();
  return { ok: true };
}

export async function saveCollection(_prev: ActionState, form: FormData): Promise<ActionState> {
  await assertStaff();
  const parsed = collectionSchema.safeParse({
    slug: form.get("slug"), name_ar: form.get("name_ar"), name_en: form.get("name_en"),
    description_ar: str(form.get("description_ar")), description_en: str(form.get("description_en")),
    image_url: str(form.get("image_url")), is_active: bool(form.get("is_active")), is_featured: bool(form.get("is_featured")),
    featured_from: str(form.get("featured_from")), featured_until: str(form.get("featured_until")), sort_order: form.get("sort_order") || 0,
  });
  if (!parsed.success) return { ok: false, error: "validation", fields: fieldErrors(parsed.error) };
  const row = { ...parsed.data, featured_from: baghdadIso(parsed.data.featured_from), featured_until: baghdadIso(parsed.data.featured_until) };
  const supabase = await createClient();
  const id = str(form.get("id"));
  const { error } = id ? await supabase.from("collections").update(row).eq("id", id) : await supabase.from("collections").insert(row);
  if (error) return dbError(error);
  await logActivity(id ? "collection.updated" : "collection.created", "collection", id || parsed.data.slug);
  refresh();
  return { ok: true };
}

export async function deleteCollection(_prev: ActionState, form: FormData): Promise<ActionState> {
  await assertStaff();
  const supabase = await createClient();
  const { error } = await supabase.from("collections").delete().eq("id", str(form.get("id")));
  if (error) return dbError(error);
  refresh();
  return { ok: true };
}

export async function saveColor(_prev: ActionState, form: FormData): Promise<ActionState> {
  await assertStaff();
  const parsed = colorSchema.safeParse({ code: form.get("code"), name_ar: form.get("name_ar"), name_en: form.get("name_en"), hex: str(form.get("hex")).toUpperCase(), sort_order: form.get("sort_order") || 0 });
  if (!parsed.success) return { ok: false, error: "validation", fields: fieldErrors(parsed.error) };
  const supabase = await createClient();
  const id = str(form.get("id"));
  const { error } = id ? await supabase.from("colors").update(parsed.data).eq("id", id) : await supabase.from("colors").insert(parsed.data);
  if (error) return dbError(error);
  refresh();
  return { ok: true };
}

export async function deleteColor(_prev: ActionState, form: FormData): Promise<ActionState> {
  await assertStaff();
  const supabase = await createClient();
  const { error } = await supabase.from("colors").delete().eq("id", str(form.get("id")));
  return error ? dbError(error) : { ok: true };
}

export async function saveSize(_prev: ActionState, form: FormData): Promise<ActionState> {
  await assertStaff();
  const parsed = sizeSchema.safeParse({ code: form.get("code"), label: form.get("label"), sort_order: form.get("sort_order") || 0 });
  if (!parsed.success) return { ok: false, error: "validation", fields: fieldErrors(parsed.error) };
  const supabase = await createClient();
  const { error } = await supabase.from("sizes").upsert(parsed.data, { onConflict: "code" });
  if (error) return dbError(error);
  refresh();
  return { ok: true };
}

export async function deleteSize(_prev: ActionState, form: FormData): Promise<ActionState> {
  await assertStaff();
  const supabase = await createClient();
  const { error } = await supabase.from("sizes").delete().eq("code", str(form.get("code")));
  return error ? dbError(error) : { ok: true };
}

export async function moderateReview(_prev: ActionState, form: FormData): Promise<ActionState> {
  await assertStaff();
  const supabase = await createClient();
  const id = str(form.get("id"));
  const op = str(form.get("op"));
  const patch = op === "feature" ? { is_featured: true, is_approved: true } : op === "unfeature" ? { is_featured: false } : { is_approved: op === "approve" };
  const { error } = op === "delete" ? await supabase.from("reviews").delete().eq("id", id) : await supabase.from("reviews").update(patch).eq("id", id);
  if (error) return dbError(error);
  refresh();
  return { ok: true };
}

export async function saveGarmentType(_prev: ActionState, form: FormData): Promise<ActionState> {
  await assertStaff();
  const code = str(form.get("code"));
  const base = Number(form.get("base_price"));
  if (!Number.isInteger(base) || base < 0) return { ok: false, error: "validation", fields: { base_price: "required" } };
  const supabase = await createClient();
  const { error } = await supabase.from("custom_garment_types").update({
    base_price: base,
    name_ar: str(form.get("name_ar")).trim() || undefined,
    name_en: str(form.get("name_en")).trim() || undefined,
    color_ids: form.getAll("color_ids").map(String),
    sizes: form.getAll("sizes").map(String).filter((s) => /^[A-Z0-9]{1,6}$/.test(s)),
    print_locations: form.getAll("print_locations").map(String).filter((s) => ["front", "back", "left_chest", "sleeve", "sleeve_left"].includes(s)),
    is_active: bool(form.get("is_active")),
  }).eq("code", code);
  if (error) return dbError(error);
  await logActivity("designer.garment_updated", "garment", code, { base_price: base });
  return { ok: true };
}

export async function savePrintLocation(_prev: ActionState, form: FormData): Promise<ActionState> {
  await assertStaff();
  const price = Number(form.get("price"));
  if (!Number.isInteger(price) || price < 0) return { ok: false, error: "validation", fields: { price: "required" } };
  const supabase = await createClient();
  const { error } = await supabase.from("print_locations").update({ price, is_active: bool(form.get("is_active")) }).eq("code", str(form.get("code")));
  if (error) return dbError(error);
  await logActivity("designer.location_updated", "print_location", str(form.get("code")), { price });
  return { ok: true };
}

/** Staff-added testimonial (e.g. an Instagram/WhatsApp message screenshot). Published immediately. */
export async function addTestimonial(_prev: ActionState, form: FormData): Promise<ActionState> {
  await assertStaff();
  const author = str(form.get("author_name")).trim().slice(0, 60);
  const body = str(form.get("body")).trim().slice(0, 1500);
  const rating = Number(form.get("rating"));
  const source = str(form.get("source"));
  const photo = str(form.get("photo")).trim();
  const avatar = str(form.get("avatar_url")).trim();
  if (avatar && !/^https:\/\//.test(avatar) && !avatar.startsWith("/")) return { ok: false, error: "validation", fields: { avatar_url: "url" } };
  if (!author) return { ok: false, error: "validation", fields: { author_name: "required" } };
  if (!body && !photo) return { ok: false, error: "validation", fields: { body: "required" } };
  if (!(rating >= 1 && rating <= 5)) return { ok: false, error: "validation", fields: { rating: "required" } };
  if (photo && !/^https:\/\//.test(photo) && !photo.startsWith("/")) return { ok: false, error: "validation", fields: { photo: "url" } };
  const supabase = await createClient();
  const { error } = await supabase.from("reviews").insert({
    author_name: author,
    author_city: str(form.get("author_city")).trim().slice(0, 80) || null,
    rating,
    body: body || null,
    photos: photo ? [photo] : [],
    avatar_url: avatar || null,
    label: str(form.get("label")).trim().slice(0, 40) || null,
    source: ["site", "instagram", "whatsapp", "tiktok", "other"].includes(source) ? source : "other",
    product_id: str(form.get("product_id")) || null,
    is_featured: bool(form.get("is_featured")),
    is_approved: true,
  });
  if (error) return dbError(error);
  await logActivity("review.testimonial_added", "review", null, { author, source });
  revalidatePath("/[locale]/reviews", "page");
  return { ok: true };
}
