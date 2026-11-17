import "server-only";
import { createClient } from "@/lib/supabase/server";

export type ActionState = { ok: true; message?: string; id?: string } | { ok: false; error: string; fields?: Record<string, string> } | null;

export const bool = (v: FormDataEntryValue | null) => v === "on" || v === "true" || v === "1";
export const str = (v: FormDataEntryValue | null) => (typeof v === "string" ? v : "");

/** Records an admin action (the DB function itself re-checks staff status). */
export async function logActivity(action: string, entityType: string, entityId: string | null, details: Record<string, unknown> = {}) {
  const supabase = await createClient();
  await supabase.rpc("log_admin_activity", { p_action: action, p_entity_type: entityType, p_entity_id: entityId, p_details: details });
}

export function dbError(e: { code?: string; message?: string } | null): ActionState {
  if (!e) return { ok: false, error: "generic" };
  if (e.code === "23505") return { ok: false, error: "duplicate" };
  if (e.code === "42501") return { ok: false, error: "not_authorized" };
  if (e.code === "23503") return { ok: false, error: "in_use" };
  if (e.code === "23514") return { ok: false, error: "constraint" };
  console.error("admin db error", e);
  return { ok: false, error: "generic" };
}

/** datetime-local inputs carry no zone: interpret them as Baghdad time (UTC+3, no DST). */
export function baghdadIso(v: string | null | undefined): string | null {
  if (!v) return null;
  const withZone = /[zZ]|[+-]\d{2}:\d{2}$/.test(v) ? v : `${v.length === 16 ? `${v}:00` : v}+03:00`;
  const d = new Date(withZone);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}
