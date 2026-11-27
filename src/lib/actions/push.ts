"use server";
import { z } from "zod";
import { getSession } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { rateLimit } from "@/lib/rate-limit";
import { getVapidKeys, pushToUsers } from "@/lib/notifications/push";

/** The public key a device needs to subscribe (safe to share). */
export async function pushPublicKey(): Promise<string | null> {
  try {
    return (await getVapidKeys()).publicKey;
  } catch {
    return null;
  }
}

const subSchema = z.object({
  endpoint: z.string().url().max(1000).refine((u) => u.startsWith("https://"), "https"),
  keys: z.object({ p256dh: z.string().min(20).max(200), auth: z.string().min(8).max(100) }),
  locale: z.enum(["ar", "en"]).default("ar"),
});

/** Saves this device for the signed-in account (a device belongs to one account: the last one to sign in on it). */
export async function savePushSubscription(input: unknown): Promise<{ ok: boolean; error?: string }> {
  const session = await getSession();
  if (!session) return { ok: false, error: "not_signed_in" };
  const parsed = subSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "validation" };
  if (!(await rateLimit("share", "push"))) return { ok: false, error: "rate_limited" };
  const d = parsed.data;
  const { error } = await createAdminClient().from("push_subscriptions").upsert({
    user_id: session.userId, endpoint: d.endpoint, p256dh: d.keys.p256dh, auth: d.keys.auth, locale: d.locale, failures: 0,
  }, { onConflict: "endpoint" });
  return error ? { ok: false, error: "generic" } : { ok: true };
}

export async function deletePushSubscription(endpoint: string): Promise<{ ok: boolean }> {
  const session = await getSession();
  if (!session || typeof endpoint !== "string") return { ok: false };
  await createAdminClient().from("push_subscriptions").delete().eq("endpoint", endpoint).eq("user_id", session.userId);
  return { ok: true };
}

/** "Send me a test": confirms notifications reach this account's devices. */
export async function sendTestPush(locale: "ar" | "en" = "ar"): Promise<{ ok: boolean; sent: number }> {
  const session = await getSession();
  if (!session) return { ok: false, sent: 0 };
  if (!(await rateLimit("share", "push-test"))) return { ok: false, sent: 0 };
  const r = await pushToUsers([session.userId], (l) => ({
    title: l === "ar" ? "الإشعارات شغّالة ✓" : "Notifications are on ✓",
    body: l === "ar" ? "راح توصلك هنا أخبار طلباتك من TPAC." : "Your TPAC order updates will appear here.",
    url: `/${locale}/account`, tag: "tpac-test",
  }));
  return { ok: r.sent > 0, sent: r.sent };
}
