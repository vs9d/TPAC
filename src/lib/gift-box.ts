import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { isSupabaseConfigured } from "@/lib/env";
import type { GiftOption } from "@/components/designer/gift-box";

/**
 * The gift box offered on every product page: the paid packaging option of the print designer
 * (Dashboard → Print designer → Options), so its name and price are set in one place.
 * Read through the same database function quote_cart prices it with — so until
 * add-gift-box-all-products.sql has run, the box is simply not offered (never shown at a
 * price the checkout would not charge).
 */
export async function getGiftBox(): Promise<GiftOption | null> {
  if (!isSupabaseConfigured()) return null;
  const { data, error } = await createAdminClient().rpc("gift_box_option");
  if (error || !data) return null;
  const o = data as { name_ar?: string; name_en?: string; price?: number };
  return o.name_ar && o.price ? { name_ar: o.name_ar, name_en: o.name_en ?? o.name_ar, price: o.price } : null;
}
