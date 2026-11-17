import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/env";
import type { Profile } from "@/lib/types";
import type { Locale } from "@/lib/i18n/config";

/** Current user + profile (memoised per request). */
export const getSession = cache(async (): Promise<{ userId: string; email: string | null; profile: Profile | null } | null> => {
  if (!isSupabaseConfigured()) return null;
  const supabase = await createClient();
  // getUser() validates the JWT with Supabase Auth (getSession() would trust the cookie).
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) return null;
  const { data: profile } = await supabase.from("customer_profiles").select("*").eq("id", data.user.id).maybeSingle();
  return { userId: data.user.id, email: data.user.email ?? null, profile: (profile as Profile) ?? null };
});

export async function requireUser(locale: Locale, next?: string) {
  const session = await getSession();
  if (!session) redirect(`/${locale}/account/login${next ? `?next=${encodeURIComponent(next)}` : ""}`);
  return session;
}

export function isStaffRole(role: string | undefined | null): boolean {
  return role === "staff" || role === "admin";
}

/** For admin pages: redirects non-staff away. RLS enforces the same rule in the database. */
export async function requireStaff(locale: Locale) {
  const session = await getSession();
  if (!session) redirect(`/${locale}/account/login?next=/${locale}/admin`);
  if (!isStaffRole(session.profile?.role)) redirect(`/${locale}`);
  return session;
}

/** For server actions: throws instead of redirecting. */
export async function assertStaff() {
  const session = await getSession();
  if (!session || !isStaffRole(session.profile?.role)) throw new Error("not_authorized");
  return session;
}

export async function assertAdmin() {
  const session = await getSession();
  if (!session || session.profile?.role !== "admin") throw new Error("not_authorized");
  return session;
}
