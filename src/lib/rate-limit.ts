import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { clientIp } from "@/lib/request";

export const LIMITS = {
  checkout: { max: 8, window: 600 },
  quote: { max: 120, window: 600 },
  track: { max: 20, window: 600 },
  auth: { max: 10, window: 600 },
  upload: { max: 40, window: 3600 },
  bulk: { max: 5, window: 3600 },
  contact: { max: 5, window: 3600 },
  newsletter: { max: 5, window: 3600 },
  review: { max: 10, window: 3600 },
  design: { max: 30, window: 3600 },
  share: { max: 60, window: 3600 },
  group: { max: 10, window: 3600 },
  groupJoin: { max: 30, window: 3600 },
  community: { max: 10, window: 3600 },
} as const;

/**
 * Fixed-window rate limit stored in Postgres (works across serverless
 * instances). Fails closed for sensitive endpoints if the DB is unreachable.
 */
export async function rateLimit(bucket: keyof typeof LIMITS, extraKey = ""): Promise<boolean> {
  const { max, window } = LIMITS[bucket];
  const ip = await clientIp();
  try {
    const { data, error } = await createAdminClient().rpc("check_rate_limit", {
      p_key: `${bucket}:${ip}${extraKey ? `:${extraKey}` : ""}`,
      p_max: max,
      p_window_seconds: window,
    });
    if (error) throw error;
    return data === true;
  } catch (e) {
    console.error("rate limit check failed", e);
    return bucket === "quote";
  }
}
