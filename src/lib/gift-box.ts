import "server-only";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/env";
import type { GiftOption } from "@/components/designer/gift-box";

/**
 * The gift box offered on every product page: the paid packaging option of the print designer
 * (Dashboard → Print designer → Options), so its name and price are set in one place.
 * The cart price itself is always recomputed by quote_cart in the database.
 */
export async function getGiftBox(): Promise<GiftOption | null> {
  if (!isSupabaseConfigured()) return null;
  const supabase = await createClient();
  const { data } = await supabase
    .from("designer_options")
    .select("code, name_ar, name_en, price, sort_order")
    .eq("group_code", "package").eq("is_active", true).gt("price", 0)
    .order("sort_order");
  const list = (data ?? []) as (GiftOption & { code: string })[];
  const hit = list.find((o) => o.code === "gift") ?? list[0];
  return hit ? { name_ar: hit.name_ar, name_en: hit.name_en, price: hit.price } : null;
}
