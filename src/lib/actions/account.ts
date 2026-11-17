"use server";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getSession } from "@/lib/auth";
import { rateLimit } from "@/lib/rate-limit";
import { publicEnv } from "@/lib/env";
import { isLocale } from "@/lib/i18n/config";
import { loginSchema, registerSchema, profileSchema, addressSchema, fieldErrors } from "@/lib/validation";

export type AuthState = { ok: true; message?: string } | { ok: false; error: string; fields?: Record<string, string> } | null;

const safeNext = (v: FormDataEntryValue | null, locale: string) => {
  const s = typeof v === "string" ? v : "";
  // only allow same-site relative paths (prevents open redirects)
  return s.startsWith("/") && !s.startsWith("//") && !s.includes("\\") ? s : `/${locale}/account`;
};
const localeOf = (form: FormData) => {
  const l = form.get("locale");
  return isLocale(l) ? l : "ar";
};

export async function signIn(_prev: AuthState, form: FormData): Promise<AuthState> {
  const locale = localeOf(form);
  const parsed = loginSchema.safeParse({ email: form.get("email"), password: form.get("password") });
  if (!parsed.success) return { ok: false, error: "invalid_credentials" };
  if (!(await rateLimit("auth", parsed.data.email))) return { ok: false, error: "rate_limited" };
  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword(parsed.data);
  if (error) return { ok: false, error: error.code === "email_not_confirmed" ? "email_not_confirmed" : "invalid_credentials" };
  redirect(safeNext(form.get("next"), locale));
}

export async function signUp(_prev: AuthState, form: FormData): Promise<AuthState> {
  const locale = localeOf(form);
  const parsed = registerSchema.safeParse({
    full_name: form.get("full_name"),
    email: form.get("email"),
    phone: form.get("phone"),
    password: form.get("password"),
    confirm: form.get("confirm"),
  });
  if (!parsed.success) return { ok: false, error: "validation", fields: fieldErrors(parsed.error) };
  if (!(await rateLimit("auth"))) return { ok: false, error: "rate_limited" };
  const supabase = await createClient();
  const { data, error } = await supabase.auth.signUp({
    email: parsed.data.email,
    password: parsed.data.password,
    options: {
      data: { full_name: parsed.data.full_name, phone: parsed.data.phone, locale },
      emailRedirectTo: `${publicEnv.siteUrl}/${locale}/auth/callback?next=/${locale}/account`,
    },
  });
  if (error) {
    if (error.code === "user_already_exists" || /already/i.test(error.message)) return { ok: false, error: "email_taken" };
    if (error.code === "weak_password") return { ok: false, error: "weak_password" };
    return { ok: false, error: "generic" };
  }
  if (data.session) redirect(safeNext(form.get("next"), locale));
  return { ok: true, message: "check_email" };
}

export async function requestPasswordReset(_prev: AuthState, form: FormData): Promise<AuthState> {
  const locale = localeOf(form);
  const email = String(form.get("email") ?? "").trim();
  if (!(await rateLimit("auth", email))) return { ok: false, error: "rate_limited" };
  const supabase = await createClient();
  // Always report success so this endpoint can't be used to discover accounts.
  await supabase.auth.resetPasswordForEmail(email, { redirectTo: `${publicEnv.siteUrl}/${locale}/auth/callback?next=/${locale}/account/reset-password` });
  return { ok: true };
}

export async function updatePassword(_prev: AuthState, form: FormData): Promise<AuthState> {
  const password = String(form.get("password") ?? "");
  if (password.length < 8) return { ok: false, error: "validation", fields: { password: "min" } };
  if (password !== form.get("confirm")) return { ok: false, error: "validation", fields: { confirm: "mismatch" } };
  const session = await getSession();
  if (!session) return { ok: false, error: "not_signed_in" };
  const supabase = await createClient();
  const { error } = await supabase.auth.updateUser({ password });
  if (error) return { ok: false, error: error.code === "weak_password" ? "weak_password" : "generic" };
  return { ok: true };
}

export async function signOut(form: FormData) {
  const locale = localeOf(form);
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect(`/${locale}`);
}

export async function updateProfile(_prev: AuthState, form: FormData): Promise<AuthState> {
  const session = await getSession();
  if (!session) return { ok: false, error: "not_signed_in" };
  const parsed = profileSchema.safeParse({
    full_name: form.get("full_name"),
    phone: form.get("phone"),
    preferred_locale: form.get("preferred_locale"),
    marketing_opt_in: form.get("marketing_opt_in") === "on",
  });
  if (!parsed.success) return { ok: false, error: "validation", fields: fieldErrors(parsed.error) };
  const supabase = await createClient();
  // RLS: customers can only update their own row; a trigger blocks role changes.
  const { error } = await supabase.from("customer_profiles").update(parsed.data).eq("id", session.userId);
  if (error) return { ok: false, error: "generic" };
  revalidatePath("/[locale]/account", "layout");
  return { ok: true };
}

export async function saveAddress(_prev: AuthState, form: FormData): Promise<AuthState> {
  const session = await getSession();
  if (!session) return { ok: false, error: "not_signed_in" };
  const parsed = addressSchema.safeParse({
    label: form.get("label") || undefined,
    full_name: form.get("full_name"),
    phone: form.get("phone"),
    governorate: form.get("governorate"),
    city: form.get("city"),
    address_line: form.get("address_line"),
    notes: form.get("notes") || undefined,
    is_default: form.get("is_default") === "on",
  });
  if (!parsed.success) return { ok: false, error: "validation", fields: fieldErrors(parsed.error) };
  const supabase = await createClient();
  const id = form.get("id");
  if (parsed.data.is_default) await supabase.from("addresses").update({ is_default: false }).eq("user_id", session.userId);
  const row = { ...parsed.data, label: parsed.data.label ?? null, notes: parsed.data.notes ?? null, is_default: !!parsed.data.is_default, user_id: session.userId };
  const { error } = typeof id === "string" && id
    ? await supabase.from("addresses").update(row).eq("id", id).eq("user_id", session.userId)
    : await supabase.from("addresses").insert(row);
  if (error) return { ok: false, error: "generic" };
  revalidatePath("/[locale]/account/addresses", "page");
  return { ok: true };
}

export async function deleteAddress(id: string) {
  const session = await getSession();
  if (!session) return;
  const supabase = await createClient();
  await supabase.from("addresses").delete().eq("id", id).eq("user_id", session.userId);
  revalidatePath("/[locale]/account/addresses", "page");
}

export async function markNotificationsRead() {
  const session = await getSession();
  if (!session) return;
  const supabase = await createClient();
  await supabase.from("notifications").update({ read_at: new Date().toISOString() }).eq("user_id", session.userId).is("read_at", null);
  revalidatePath("/[locale]/account", "layout");
}
