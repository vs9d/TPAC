import "server-only";
import webpush from "web-push";
import { createAdminClient } from "@/lib/supabase/admin";
import { publicEnv } from "@/lib/env";

/**
 * Push notifications to the phones (and browsers) where a signed-in person allowed them.
 * Keys: VAPID_PUBLIC_KEY + VAPID_PRIVATE_KEY from the environment if set; otherwise a key pair is
 * created once and kept in app_secrets (server-only table), so it works without any setup.
 */

interface Vapid { publicKey: string; privateKey: string }
let cached: Vapid | null = null;

export async function getVapidKeys(): Promise<Vapid> {
  if (cached) return cached;
  if (process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY) {
    cached = { publicKey: process.env.VAPID_PUBLIC_KEY, privateKey: process.env.VAPID_PRIVATE_KEY };
    return cached;
  }
  const db = createAdminClient();
  const { data } = await db.from("app_secrets").select("value").eq("key", "vapid").maybeSingle();
  if (data?.value) return (cached = data.value as Vapid);
  const keys = webpush.generateVAPIDKeys();
  // two first requests at once: only one pair is kept, both read it back
  await db.from("app_secrets").upsert({ key: "vapid", value: keys }, { onConflict: "key", ignoreDuplicates: true });
  const { data: saved } = await db.from("app_secrets").select("value").eq("key", "vapid").single();
  return (cached = saved!.value as Vapid);
}

export interface PushMessage { title: string; body?: string; url?: string; tag?: string }
type Sub = { id: string; endpoint: string; p256dh: string; auth: string; locale: string; failures: number };

/** Sends to every device of these accounts. Gone devices (404/410) are removed; others retried next time. */
export async function pushToUsers(userIds: (string | null | undefined)[], msg: PushMessage | ((locale: "ar" | "en") => PushMessage)): Promise<{ sent: number; removed: number }> {
  const ids = [...new Set(userIds.filter((x): x is string => !!x))];
  const out = { sent: 0, removed: 0 };
  if (!ids.length) return out;
  const db = createAdminClient();
  const { data } = await db.from("push_subscriptions").select("id, endpoint, p256dh, auth, locale, failures").in("user_id", ids).limit(200);
  const subs = (data ?? []) as Sub[];
  if (!subs.length) return out;
  const keys = await getVapidKeys();
  const subject = publicEnv.siteUrl.startsWith("https://") ? publicEnv.siteUrl : "mailto:hello@thetpac.com";
  await Promise.all(subs.map(async (s) => {
    const m = typeof msg === "function" ? msg(s.locale === "en" ? "en" : "ar") : msg;
    const payload = JSON.stringify({ title: m.title.slice(0, 120), body: (m.body ?? "").slice(0, 300), url: m.url, tag: m.tag, lang: s.locale });
    try {
      await webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, payload, {
        vapidDetails: { subject, publicKey: keys.publicKey, privateKey: keys.privateKey }, TTL: 60 * 60 * 24, timeout: 8000,
      });
      out.sent++;
      await db.from("push_subscriptions").update({ last_used_at: new Date().toISOString(), failures: 0 }).eq("id", s.id);
    } catch (e) {
      const code = (e as { statusCode?: number }).statusCode;
      if (code === 404 || code === 410 || s.failures >= 9) {
        await db.from("push_subscriptions").delete().eq("id", s.id);
        out.removed++;
      } else {
        await db.from("push_subscriptions").update({ failures: s.failures + 1 }).eq("id", s.id);
      }
    }
  }));
  return out;
}

/** Everyone on the team (admin + staff). */
export async function staffUserIds(): Promise<string[]> {
  const { data } = await createAdminClient().from("customer_profiles").select("id, role").in("role", ["admin", "staff"]);
  return ((data ?? []) as { id: string }[]).map((r) => r.id);
}
