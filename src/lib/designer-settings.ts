import "server-only";
import { cache } from "react";
import { createAdminClient } from "@/lib/supabase/admin";
import { isSupabaseConfigured } from "@/lib/env";

/**
 * Whether customers may upload THEIR OWN artwork in the print studio (/design).
 * The admin switches it off in Dashboard → Print designer → Settings; official product artwork is always admin-only.
 */
export const customerUploadsEnabled = cache(async (): Promise<boolean> => {
  if (!isSupabaseConfigured()) return true;
  const { data } = await createAdminClient().from("website_settings").select("value").eq("key", "designer").maybeSingle();
  return (data?.value as { customer_uploads?: boolean } | null)?.customer_uploads !== false;
});
