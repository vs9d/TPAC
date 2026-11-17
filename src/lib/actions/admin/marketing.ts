"use server";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { assertStaff } from "@/lib/auth";
import { discountSchema, bannerSchema, homepageSectionSchema, fieldErrors } from "@/lib/validation";
import { bool, str, dbError, logActivity, baghdadIso, type ActionState } from "./common";

const refresh = () => revalidatePath("/[locale]", "layout");
const isoOrNull = (v: string | null) => baghdadIso(v);

export async function saveDiscount(_prev: ActionState, form: FormData): Promise<ActionState> {
  await assertStaff();
  const parsed = discountSchema.safeParse({
    code: form.get("code"), description: str(form.get("description")), type: form.get("type"), value: form.get("value") || 0,
    min_order_total: form.get("min_order_total") || 0, max_discount: str(form.get("max_discount")), max_uses: str(form.get("max_uses")),
    max_uses_per_customer: str(form.get("max_uses_per_customer")), starts_at: str(form.get("starts_at")), ends_at: str(form.get("ends_at")), is_active: bool(form.get("is_active")),
  });
  if (!parsed.success) return { ok: false, error: "validation", fields: fieldErrors(parsed.error) };
  const row = { ...parsed.data, starts_at: isoOrNull(parsed.data.starts_at), ends_at: isoOrNull(parsed.data.ends_at) };
  const supabase = await createClient();
  const id = str(form.get("id"));
  const { error } = id ? await supabase.from("discount_codes").update(row).eq("id", id) : await supabase.from("discount_codes").insert(row);
  if (error) return dbError(error);
  await logActivity(id ? "discount.updated" : "discount.created", "discount", id || row.code, { code: row.code });
  return { ok: true };
}

export async function deleteDiscount(_prev: ActionState, form: FormData): Promise<ActionState> {
  await assertStaff();
  const supabase = await createClient();
  const id = str(form.get("id"));
  const { error } = await supabase.from("discount_codes").delete().eq("id", id);
  if (error) {
    const { error: e2 } = await supabase.from("discount_codes").update({ is_active: false }).eq("id", id);
    if (e2) return dbError(e2);
  }
  await logActivity("discount.deleted", "discount", id);
  return { ok: true };
}

export async function saveBanner(_prev: ActionState, form: FormData): Promise<ActionState> {
  await assertStaff();
  const parsed = bannerSchema.safeParse({
    placement: form.get("placement"), title_ar: str(form.get("title_ar")), title_en: str(form.get("title_en")), subtitle_ar: str(form.get("subtitle_ar")), subtitle_en: str(form.get("subtitle_en")),
    cta_label_ar: str(form.get("cta_label_ar")), cta_label_en: str(form.get("cta_label_en")), link: str(form.get("link")), image_url: str(form.get("image_url")), video_url: str(form.get("video_url")),
    starts_at: str(form.get("starts_at")), ends_at: str(form.get("ends_at")), is_active: bool(form.get("is_active")), sort_order: form.get("sort_order") || 0,
  });
  if (!parsed.success) return { ok: false, error: "validation", fields: fieldErrors(parsed.error) };
  const row = { ...parsed.data, starts_at: isoOrNull(parsed.data.starts_at), ends_at: isoOrNull(parsed.data.ends_at) };
  const supabase = await createClient();
  const id = str(form.get("id"));
  const { error } = id ? await supabase.from("promo_banners").update(row).eq("id", id) : await supabase.from("promo_banners").insert(row);
  if (error) return dbError(error);
  await logActivity(id ? "banner.updated" : "banner.created", "banner", id || null, { placement: row.placement });
  refresh();
  return { ok: true };
}

export async function deleteBanner(_prev: ActionState, form: FormData): Promise<ActionState> {
  await assertStaff();
  const supabase = await createClient();
  const { error } = await supabase.from("promo_banners").delete().eq("id", str(form.get("id")));
  if (error) return dbError(error);
  refresh();
  return { ok: true };
}

export async function saveCampaign(_prev: ActionState, form: FormData): Promise<ActionState> {
  await assertStaff();
  const name = str(form.get("name")).trim();
  if (!name) return { ok: false, error: "validation", fields: { name: "required" } };
  const row = {
    name: name.slice(0, 200),
    description: str(form.get("description")).slice(0, 2000) || null,
    collection_id: str(form.get("collection_id")) || null,
    discount_code_id: str(form.get("discount_code_id")) || null,
    banner_id: str(form.get("banner_id")) || null,
    starts_at: isoOrNull(str(form.get("starts_at")) || null),
    ends_at: isoOrNull(str(form.get("ends_at")) || null),
    is_active: bool(form.get("is_active")),
  };
  const supabase = await createClient();
  const id = str(form.get("id"));
  const { error } = id ? await supabase.from("campaigns").update(row).eq("id", id) : await supabase.from("campaigns").insert(row);
  if (error) return dbError(error);
  // Keep linked assets in sync with the campaign schedule.
  if (row.banner_id) await supabase.from("promo_banners").update({ starts_at: row.starts_at, ends_at: row.ends_at, is_active: row.is_active }).eq("id", row.banner_id);
  if (row.collection_id) await supabase.from("collections").update({ is_featured: row.is_active, featured_from: row.starts_at, featured_until: row.ends_at }).eq("id", row.collection_id);
  if (row.discount_code_id) await supabase.from("discount_codes").update({ starts_at: row.starts_at, ends_at: row.ends_at, is_active: row.is_active }).eq("id", row.discount_code_id);
  await logActivity(id ? "campaign.updated" : "campaign.created", "campaign", id || null, { name });
  refresh();
  return { ok: true };
}

export async function deleteCampaign(_prev: ActionState, form: FormData): Promise<ActionState> {
  await assertStaff();
  const supabase = await createClient();
  const { error } = await supabase.from("campaigns").delete().eq("id", str(form.get("id")));
  return error ? dbError(error) : { ok: true };
}

export async function removeSubscriber(_prev: ActionState, form: FormData): Promise<ActionState> {
  await assertStaff();
  const supabase = await createClient();
  const { error } = await supabase.from("newsletter_subscribers").update({ is_active: false }).eq("id", str(form.get("id")));
  return error ? dbError(error) : { ok: true };
}

export async function saveHomepageSection(_prev: ActionState, form: FormData): Promise<ActionState> {
  await assertStaff();
  const parsed = homepageSectionSchema.safeParse({
    key: form.get("key"), title_ar: str(form.get("title_ar")), title_en: str(form.get("title_en")), subtitle_ar: str(form.get("subtitle_ar")), subtitle_en: str(form.get("subtitle_en")),
    body_ar: str(form.get("body_ar")), body_en: str(form.get("body_en")), image_url: str(form.get("image_url")), cta_label_ar: str(form.get("cta_label_ar")), cta_label_en: str(form.get("cta_label_en")),
    cta_href: str(form.get("cta_href")), data: str(form.get("data")), sort_order: form.get("sort_order") || 0, is_visible: bool(form.get("is_visible")),
  });
  if (!parsed.success) return { ok: false, error: "validation", fields: fieldErrors(parsed.error) };
  const supabase = await createClient();
  const { error } = await supabase.from("homepage_sections").upsert(parsed.data, { onConflict: "key" });
  if (error) return dbError(error);
  await logActivity("homepage.section_updated", "homepage_section", parsed.data.key);
  refresh();
  return { ok: true };
}
