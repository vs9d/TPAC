import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendEmail, emailConfigured } from "./email";
import { creatorEmail } from "./email-templates";
import { emailContext } from "./index";
import { pushToUsers } from "./push";

/** Account and payout emails are always sent; the rest follow the creator's email setting. */
const ALWAYS = new Set(["account", "wallet"]);
const MAX_ATTEMPTS = 5;

interface Row { id: string; creator_id: string; kind: string; title: string; body: string | null; link: string | null; email_attempts: number }
interface CreatorRow { user_id: string; username: string; display_name: string; email: string | null; email_notifications: boolean }

/**
 * Emails pending creator notifications — the ones written by the app and the ones written by the
 * earnings triggers inside the database (a new sale, a completed or cancelled order).
 * Each row is claimed before sending so two runs never send it twice; a failed send is retried
 * (up to 5 times) by the next run: after any creator notification, after an order, and from the cron route.
 * Without an email provider the rows are marked "skipped" — never reported as sent.
 */
export async function processCreatorEmails(limit = 30): Promise<{ sent: number; skipped: number; failed: number }> {
  await pushCreatorNotifications().catch((e) => console.error("creator push", e));
  const out = { sent: 0, skipped: 0, failed: 0 };
  const db = createAdminClient();
  const stale = new Date(Date.now() - 10 * 60_000).toISOString();
  const since = new Date(Date.now() - 3 * 86_400_000).toISOString();
  const { data } = await db.from("creator_notifications")
    .select("id, creator_id, kind, title, body, link, email_attempts, email_status, email_claimed_at")
    .in("email_status", ["pending", "sending"]).gte("created_at", since).order("created_at").limit(limit);
  const due = ((data ?? []) as (Row & { email_status: string; email_claimed_at: string | null })[])
    .filter((r) => r.email_status === "pending" || !r.email_claimed_at || r.email_claimed_at < stale);
  if (!due.length) return out;

  const ids = [...new Set(due.map((r) => r.creator_id))];
  const { data: cs } = await db.from("creators").select("user_id, username, display_name, email, email_notifications").in("user_id", ids);
  const creators = new Map(((cs ?? []) as CreatorRow[]).map((c) => [c.user_id, c]));
  const configured = emailConfigured();
  const ctx = configured ? await emailContext() : null;

  for (const r of due) {
    const c = creators.get(r.creator_id);
    const skip = !configured ? "provider_not_configured" : !c?.email ? "no_email" : !c.email_notifications && !ALWAYS.has(r.kind) ? "turned_off" : null;
    if (skip) {
      await db.from("creator_notifications").update({ email_status: "skipped", email_error: skip }).eq("id", r.id).in("email_status", ["pending", "sending"]);
      out.skipped++;
      continue;
    }
    // claim it (only one run wins)
    const { data: claimed } = await db.from("creator_notifications")
      .update({ email_status: "sending", email_claimed_at: new Date().toISOString(), email_attempts: r.email_attempts + 1 })
      .eq("id", r.id).eq("email_attempts", r.email_attempts).in("email_status", ["pending", "sending"]).select("id").maybeSingle();
    if (!claimed) continue;
    try {
      const m = creatorEmail({ name: c!.display_name, username: c!.username, title: r.title, body: r.body, link: r.link, kind: r.kind }, ctx!);
      await sendEmail({ to: c!.email!, subject: m.subject, text: m.text, html: m.html });
      await db.from("creator_notifications").update({ email_status: "sent", emailed_at: new Date().toISOString(), email_error: null }).eq("id", r.id);
      out.sent++;
    } catch (e) {
      const last = r.email_attempts + 1 >= MAX_ATTEMPTS;
      await db.from("creator_notifications").update({ email_status: last ? "failed" : "pending", email_error: String((e as Error).message ?? e).slice(0, 300) }).eq("id", r.id);
      out.failed++;
    }
  }
  return out;
}

/** Each new creator notification also goes to the creator's phone once (claimed by setting pushed_at first). */
async function pushCreatorNotifications(limit = 50) {
  const db = createAdminClient();
  const since = new Date(Date.now() - 86_400_000).toISOString();
  const { data } = await db.from("creator_notifications").select("id").is("pushed_at", null).gte("created_at", since).order("created_at").limit(limit);
  const ids = ((data ?? []) as { id: string }[]).map((r) => r.id);
  if (!ids.length) return;
  const { data: claimed } = await db.from("creator_notifications").update({ pushed_at: new Date().toISOString() }).in("id", ids).is("pushed_at", null).select("id, creator_id, title, body, link");
  for (const n of (claimed ?? []) as { id: string; creator_id: string; title: string; body: string | null; link: string | null }[]) {
    const path = n.link && n.link.startsWith("/") && !n.link.startsWith("//") ? n.link : "/creator-studio/notifications";
    await pushToUsers([n.creator_id], { title: n.title, body: n.body ?? "", url: `/ar${path}`, tag: `creator-${n.id}` });
  }
}
