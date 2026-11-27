"use server";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { assertAdmin, assertStaff } from "@/lib/auth";
import { deliveryZoneSchema, fieldErrors } from "@/lib/validation";
import { normalizeIraqiPhone } from "@/lib/phone";
import { PAGE_SLUGS } from "@/lib/content/pages";
import { bool, str, dbError, logActivity, type ActionState } from "./common";

const KEYS = ["brand", "contact", "social", "checkout", "languages", "notifications", "app"] as const;
type Key = (typeof KEYS)[number];

function build(key: Key, f: FormData): Record<string, unknown> | string {
  const s = (k: string, max = 300) => str(f.get(k)).trim().slice(0, max);
  const url = (k: string) => {
    const v = s(k, 500);
    return !v || v.startsWith("https://") ? v : "__invalid__";
  };
  switch (key) {
    case "brand":
      return { name: s("name", 60) || "TPAC", tagline_ar: s("tagline_ar"), tagline_en: s("tagline_en"), logo_url: s("logo_url", 500) };
    case "contact": {
      const phone = s("phone") ? normalizeIraqiPhone(s("phone")) : "";
      const whatsapp = s("whatsapp") ? normalizeIraqiPhone(s("whatsapp")) : "";
      if (phone === null || whatsapp === null) return "phone";
      return { phone, whatsapp, email: s("email", 254), address_ar: s("address_ar"), address_en: s("address_en"), hours_ar: s("hours_ar"), hours_en: s("hours_en") };
    }
    case "social": {
      const v = { instagram: url("instagram"), tiktok: url("tiktok"), facebook: url("facebook"), snapchat: url("snapchat") };
      return Object.values(v).includes("__invalid__") ? "url" : v;
    }
    case "checkout": {
      const min = Number(f.get("min_order_total"));
      if (!Number.isInteger(min) || min < 0) return "min_order_total";
      return { min_order_total: min, allow_guest_checkout: bool(f.get("allow_guest_checkout")), online_payment_enabled: false };
    }
    case "languages":
      return { default: s("default") === "en" ? "en" : "ar", enabled: ["ar", "en"] };
    case "app":
      return { show_install: bool(f.get("show_install")) };
    case "notifications": {
      const wa = s("admin_whatsapp") ? normalizeIraqiPhone(s("admin_whatsapp")) : "";
      if (wa === null) return "phone";
      return {
        admin_email: s("admin_email", 254), admin_whatsapp: wa,
        customer_email: bool(f.get("customer_email")), customer_whatsapp: bool(f.get("customer_whatsapp")),
        admin_new_order: bool(f.get("admin_new_order")), admin_low_stock: bool(f.get("admin_low_stock")), admin_bulk_request: bool(f.get("admin_bulk_request")),
      };
    }
  }
}

export async function saveSettings(_prev: ActionState, form: FormData): Promise<ActionState> {
  const session = await assertAdmin();
  const key = str(form.get("key")) as Key;
  if (!KEYS.includes(key)) return { ok: false, error: "validation" };
  const value = build(key, form);
  if (typeof value === "string") return { ok: false, error: "validation", fields: { [value === "url" ? "instagram" : value]: value === "url" ? "url" : "phone" } };
  const supabase = await createClient();
  const { error } = await supabase.from("website_settings").upsert({ key, value, updated_by: session.userId }, { onConflict: "key" });
  if (error) return dbError(error);
  await logActivity("settings.updated", "settings", key);
  revalidatePath("/[locale]", "layout");
  return { ok: true };
}

export async function savePageContent(_prev: ActionState, form: FormData): Promise<ActionState> {
  const session = await assertAdmin();
  const slug = str(form.get("slug"));
  if (!(PAGE_SLUGS as readonly string[]).includes(slug)) return { ok: false, error: "validation" };
  const supabase = await createClient();
  const { data } = await supabase.from("website_settings").select("value").eq("key", "pages").maybeSingle();
  const pages = (data?.value as Record<string, unknown>) ?? {};
  pages[slug] = { title_ar: str(form.get("title_ar")).slice(0, 200), title_en: str(form.get("title_en")).slice(0, 200), body_ar: str(form.get("body_ar")).slice(0, 20000), body_en: str(form.get("body_en")).slice(0, 20000) };
  const { error } = await supabase.from("website_settings").upsert({ key: "pages", value: pages, updated_by: session.userId }, { onConflict: "key" });
  if (error) return dbError(error);
  await logActivity("page.updated", "page", slug);
  revalidatePath(`/[locale]/pages/${slug}`, "page");
  return { ok: true };
}

export async function saveDeliveryZone(_prev: ActionState, form: FormData): Promise<ActionState> {
  await assertAdmin();
  const parsed = deliveryZoneSchema.safeParse({
    id: form.get("id"), standard_fee: form.get("standard_fee"), express_fee: str(form.get("express_fee")), pickup_available: bool(form.get("pickup_available")),
    estimated_days_min: form.get("estimated_days_min"), estimated_days_max: form.get("estimated_days_max"), free_shipping_threshold: str(form.get("free_shipping_threshold")), is_active: bool(form.get("is_active")),
  });
  if (!parsed.success) return { ok: false, error: "validation", fields: fieldErrors(parsed.error) };
  const { id, ...row } = parsed.data;
  const supabase = await createClient();
  const { error } = await supabase.from("delivery_zones").update(row).eq("id", id);
  if (error) return dbError(error);
  await logActivity("delivery_zone.updated", "delivery_zone", id, row);
  return { ok: true };
}

export async function markAdminNotificationsRead(): Promise<void> {
  await assertStaff();
  const supabase = await createClient();
  await supabase.from("notifications").update({ read_at: new Date().toISOString() }).eq("audience", "admin").is("read_at", null);
  revalidatePath("/[locale]/admin", "layout");
}

export async function resolveInquiry(_prev: ActionState, form: FormData): Promise<ActionState> {
  await assertStaff();
  const supabase = await createClient();
  const { error } = await supabase.from("contact_inquiries").update({ is_resolved: bool(form.get("resolved")) }).eq("id", str(form.get("id")));
  return error ? dbError(error) : { ok: true };
}
