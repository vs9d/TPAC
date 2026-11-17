import "server-only";
import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/env";
import type { HomepageSection, PromoBanner, SiteSettings, DeliveryZone } from "@/lib/types";

export const DEFAULT_SETTINGS: SiteSettings = {
  brand: { name: "TPAC", tagline_ar: "ستريت وير عراقي بهوية عربية", tagline_en: "Iraqi streetwear with an Arabic identity", logo_url: "/brand/tpac-logo-black.png" },
  contact: { phone: "", whatsapp: "", email: "", address_ar: "بغداد، العراق", address_en: "Baghdad, Iraq", hours_ar: "", hours_en: "" },
  social: { instagram: "https://instagram.com/thetpac", tiktok: "", facebook: "", snapchat: "" },
  checkout: { min_order_total: 0, allow_guest_checkout: true, online_payment_enabled: false },
  currency: { code: "IQD", symbol_ar: "د.ع", symbol_en: "IQD" },
  languages: { default: "ar", enabled: ["ar", "en"] },
  notifications: { admin_email: "", admin_whatsapp: "", customer_email: true, customer_whatsapp: true, admin_new_order: true, admin_low_stock: true, admin_bulk_request: true },
};

export const getSettings = cache(async (): Promise<SiteSettings> => {
  if (!isSupabaseConfigured()) return DEFAULT_SETTINGS;
  const supabase = await createClient();
  const { data } = await supabase.from("website_settings").select("key, value");
  const out = structuredClone(DEFAULT_SETTINGS) as unknown as Record<string, Record<string, unknown>>;
  for (const row of data ?? []) {
    if (row.key in out) out[row.key] = { ...out[row.key], ...(row.value as Record<string, unknown>) };
  }
  return out as unknown as SiteSettings;
});

export const getHomepageSections = cache(async (): Promise<HomepageSection[]> => {
  if (!isSupabaseConfigured()) return [];
  const supabase = await createClient();
  const { data } = await supabase.from("homepage_sections").select("*").eq("is_visible", true).order("sort_order");
  return (data as HomepageSection[]) ?? [];
});

export const getBanners = cache(async (placement: PromoBanner["placement"]): Promise<PromoBanner[]> => {
  if (!isSupabaseConfigured()) return [];
  const supabase = await createClient();
  const { data } = await supabase.from("promo_banners").select("*").eq("placement", placement).order("sort_order");
  return (data as PromoBanner[]) ?? [];
});

export const getDeliveryZones = cache(async (): Promise<DeliveryZone[]> => {
  if (!isSupabaseConfigured()) return [];
  const supabase = await createClient();
  const { data } = await supabase.from("delivery_zones").select("*").eq("is_active", true).order("sort_order");
  return (data as DeliveryZone[]) ?? [];
});
