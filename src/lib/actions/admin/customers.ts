"use server";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { assertAdmin } from "@/lib/auth";
import { normalizeIraqiPhone } from "@/lib/phone";
import { str, dbError, logActivity, type ActionState } from "./common";

export async function updateCustomer(_prev: ActionState, form: FormData): Promise<ActionState> {
  await assertAdmin(); // profile edits by staff go through admins only (RLS: profiles_update_own allows admins)
  const id = str(form.get("id"));
  const phone = normalizeIraqiPhone(str(form.get("phone")));
  const full_name = str(form.get("full_name")).trim();
  if (!full_name) return { ok: false, error: "validation", fields: { full_name: "required" } };
  if (str(form.get("phone")) && !phone) return { ok: false, error: "validation", fields: { phone: "phone" } };
  const supabase = await createClient();
  const { error } = await supabase.from("customer_profiles").update({ full_name, phone }).eq("id", id);
  if (error) return dbError(error);
  await logActivity("customer.updated", "customer", id);
  revalidatePath(`/[locale]/admin/customers/${id}`, "page");
  return { ok: true };
}

export async function setRole(_prev: ActionState, form: FormData): Promise<ActionState> {
  const session = await assertAdmin();
  const id = str(form.get("id"));
  const role = str(form.get("role"));
  if (!["customer", "staff", "admin"].includes(role)) return { ok: false, error: "validation" };
  if (id === session.userId) return { ok: false, error: "not_authorized" };
  const supabase = await createClient();
  // The protect_profile_role trigger re-checks that the caller is an admin.
  const { error } = await supabase.from("customer_profiles").update({ role }).eq("id", id);
  if (error) return dbError(error);
  await logActivity("customer.role_changed", "customer", id, { role });
  return { ok: true };
}

