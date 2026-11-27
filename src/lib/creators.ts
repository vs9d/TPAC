import "server-only";
import { cache } from "react";
import { after } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getSession } from "@/lib/auth";
import { isSupabaseConfigured } from "@/lib/env";

export type CreatorStatus = "pending" | "approved" | "rejected" | "suspended";
export interface Creator {
  user_id: string; username: string; display_name: string; bio: string | null; avatar_url: string | null; cover_url: string | null;
  phone: string | null; email: string | null; email_notifications: boolean; socials: Record<string, string>; status: CreatorStatus; review_note: string | null;
  commission_mode: "percent" | "fixed" | null; commission_value: number | null; created_at: string; approved_at: string | null;
}
export interface CreatorSettings {
  commission_mode: "percent" | "fixed"; commission_value: number; min_withdrawal: number; hold_days: number;
  review_required: boolean; max_markup: number; payout_methods: string[];
}
export const DEFAULT_CREATOR_SETTINGS: CreatorSettings = { commission_mode: "percent", commission_value: 70, min_withdrawal: 25000, hold_days: 7, review_required: true, max_markup: 30000, payout_methods: ["ZainCash", "AsiaPay", "تحويل مصرفي"] };

export const getCreatorSettings = cache(async (): Promise<CreatorSettings> => {
  if (!isSupabaseConfigured()) return DEFAULT_CREATOR_SETTINGS;
  const { data } = await createAdminClient().from("website_settings").select("value").eq("key", "creators").maybeSingle();
  return { ...DEFAULT_CREATOR_SETTINGS, ...((data?.value as Partial<CreatorSettings>) ?? {}) };
});

/** The signed-in person's creator account (any status), or null. */
export const getMyCreator = cache(async (): Promise<Creator | null> => {
  const session = await getSession();
  if (!session) return null;
  const { data } = await createAdminClient().from("creators").select("*").eq("user_id", session.userId).maybeSingle();
  return (data as Creator | null) ?? null;
});

/** Approved creators only: the gate of every creator dashboard action. */
export async function assertCreator(): Promise<Creator> {
  const c = await getMyCreator();
  if (!c || c.status !== "approved") throw new Error("not_authorized");
  return c;
}

export const getCreatorByUsername = cache(async (username: string): Promise<Creator | null> => {
  if (!isSupabaseConfigured() || !/^[a-z0-9][a-z0-9_.]{2,29}$/.test(username)) return null;
  const { data } = await createAdminClient().from("creators").select("*").eq("username", username).eq("status", "approved").maybeSingle();
  return (data as Creator | null) ?? null;
});

export const getCreatorById = cache(async (id: string): Promise<Pick<Creator, "user_id" | "username" | "display_name" | "avatar_url"> | null> => {
  if (!isSupabaseConfigured()) return null;
  const { data } = await createAdminClient().from("creators").select("user_id, username, display_name, avatar_url").eq("user_id", id).eq("status", "approved").maybeSingle();
  return data ?? null;
});

/** Which rule applies to a sale: this creator's own > this garment's > the platform default. */
export function effectiveCommission(c: Pick<Creator, "commission_mode" | "commission_value">, type: { creator_commission_mode?: string | null; creator_commission_value?: number | null } | null, s: CreatorSettings): { mode: "percent" | "fixed"; value: number } {
  if (c.commission_mode) return { mode: c.commission_mode, value: c.commission_value ?? 0 };
  if (type?.creator_commission_mode) return { mode: type.creator_commission_mode as "percent" | "fixed", value: type.creator_commission_value ?? 0 };
  return { mode: s.commission_mode, value: s.commission_value };
}
/** The creator's earning per piece — the same formula as the database trigger. */
export function earningPerPiece(markup: number, rule: { mode: "percent" | "fixed"; value: number }): number {
  return rule.mode === "fixed" ? rule.value : Math.round((markup * Math.min(rule.value, 100)) / 100);
}

export interface Balance { pending: number; cleared_waiting: number; available: number; withdrawn: number; requested: number; total: number }
/** Money: pending (order not complete), waiting (complete, inside the return window), available, paid out. */
export async function creatorBalance(creatorId: string): Promise<Balance> {
  const db = createAdminClient();
  const [{ data: earn }, { data: wd }] = await Promise.all([
    db.from("creator_earnings").select("amount, status, available_at").eq("creator_id", creatorId).neq("status", "void"),
    db.from("creator_withdrawals").select("amount, status").eq("creator_id", creatorId).neq("status", "rejected"),
  ]);
  const now = Date.now();
  let pending = 0, waiting = 0, ready = 0;
  for (const e of (earn ?? []) as { amount: number; status: string; available_at: string | null }[]) {
    if (e.status === "pending") pending += e.amount;
    else if (e.available_at && new Date(e.available_at).getTime() <= now) ready += e.amount;
    else waiting += e.amount;
  }
  let withdrawn = 0, requested = 0;
  for (const w of (wd ?? []) as { amount: number; status: string }[]) (w.status === "paid" ? (withdrawn += w.amount) : (requested += w.amount));
  return { pending, cleared_waiting: waiting, available: Math.max(0, ready - withdrawn - requested), withdrawn, requested, total: pending + waiting + ready };
}

/** In the dashboard, and by email (sent right after the response; failures retried by the next run and the cron route). */
export async function notifyCreator(creatorId: string, title: string, body: string, link?: string, kind = "info") {
  await createAdminClient().from("creator_notifications").insert({ creator_id: creatorId, title, body, link: link ?? null, kind });
  emailCreatorsSoon();
}
/** Runs the creator email queue after the current response (rows are claimed, so overlapping runs never send twice). */
export function emailCreatorsSoon() {
  after(async () => {
    const { processCreatorEmails } = await import("@/lib/notifications/creator-email");
    await processCreatorEmails(100).catch((e) => console.error("creator emails", e));
  });
}

/** How a store order's status reads for a creator (no customer data ever leaves with it). */
export const CREATOR_ORDER_STATUS: Record<string, [string, string]> = {
  received: ["طلب جديد", "New"], confirmed: ["طلب جديد", "New"], preparing: ["قيد التجهيز", "Preparing"], quality_check: ["قيد التجهيز", "Preparing"],
  ready_to_ship: ["قيد التجهيز", "Preparing"], printing: ["قيد الطباعة", "Printing"], shipped: ["تم الشحن", "Shipped"], delivered: ["مكتمل", "Completed"], cancelled: ["ملغي", "Cancelled"],
};
