"use server";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { assertAdmin, assertStaff } from "@/lib/auth";
import { bool, str, dbError, logActivity, type ActionState } from "./common";

const GROUPS = ["method", "finish", "fabric", "package", "addon"];
const int = (v: FormDataEntryValue | null) => Number(str(v));
const bad = (field: string): ActionState => ({ ok: false, error: "validation", fields: { [field]: "required" } });
const refresh = () => revalidatePath("/[locale]/design", "page");

/** Create or update one print option (method / finish / fabric / package / add-on). */
export async function saveDesignerOption(_prev: ActionState, form: FormData): Promise<ActionState> {
  await assertStaff();
  const id = str(form.get("id"));
  const group = str(form.get("group_code"));
  const code = str(form.get("code")).trim().toLowerCase();
  const name_ar = str(form.get("name_ar")).trim();
  const name_en = str(form.get("name_en")).trim();
  const price = int(form.get("price"));
  if (!GROUPS.includes(group)) return bad("group_code");
  if (!id && !/^[a-z0-9_]{2,32}$/.test(code)) return bad("code");
  if (!name_ar) return bad("name_ar");
  if (!name_en) return bad("name_en");
  if (!Number.isInteger(price) || price < 0 || price > 1_000_000) return bad("price");
  const row = {
    name_ar, name_en,
    description_ar: str(form.get("description_ar")).trim().slice(0, 200) || null,
    description_en: str(form.get("description_en")).trim().slice(0, 200) || null,
    price,
    is_default: group !== "addon" && bool(form.get("is_default")),
    sort_order: Math.max(0, Math.min(999, Math.trunc(int(form.get("sort_order")) || 0))),
    is_active: bool(form.get("is_active")),
  };
  const supabase = await createClient();
  let optionId = id;
  if (id) {
    const { error } = await supabase.from("designer_options").update(row).eq("id", id);
    if (error) return dbError(error);
  } else {
    const { data, error } = await supabase.from("designer_options").insert({ ...row, group_code: group, code }).select("id").single();
    if (error) return dbError(error);
    optionId = data.id;
  }
  // exactly one default per single-choice group
  if (row.is_default) await supabase.from("designer_options").update({ is_default: false }).eq("group_code", group).neq("id", optionId);
  await logActivity(id ? "designer.option_updated" : "designer.option_created", "designer_option", optionId, { group, price });
  refresh();
  return { ok: true, id: optionId };
}

export async function deleteDesignerOption(_prev: ActionState, form: FormData): Promise<ActionState> {
  await assertStaff();
  const id = str(form.get("id"));
  const supabase = await createClient();
  const { error } = await supabase.from("designer_options").delete().eq("id", id);
  if (error) return dbError(error);
  await logActivity("designer.option_deleted", "designer_option", id);
  refresh();
  return { ok: true };
}

/** Quantity discount tier: "from N pieces, X% off every custom piece". */
export async function saveDesignerTier(_prev: ActionState, form: FormData): Promise<ActionState> {
  await assertStaff();
  const min = int(form.get("min_qty"));
  const pct = int(form.get("discount_percent"));
  const old = str(form.get("original_min_qty"));
  if (!Number.isInteger(min) || min < 2 || min > 10000) return bad("min_qty");
  if (!Number.isInteger(pct) || pct < 1 || pct > 60) return bad("discount_percent");
  const supabase = await createClient();
  if (old && Number(old) !== min) await supabase.from("designer_tiers").delete().eq("min_qty", Number(old));
  const { error } = await supabase.from("designer_tiers").upsert({ min_qty: min, discount_percent: pct, is_active: bool(form.get("is_active")) }, { onConflict: "min_qty" });
  if (error) return dbError(error);
  await logActivity("designer.tier_saved", "designer_tier", String(min), { pct });
  refresh();
  return { ok: true };
}

export async function deleteDesignerTier(_prev: ActionState, form: FormData): Promise<ActionState> {
  await assertStaff();
  const supabase = await createClient();
  const { error } = await supabase.from("designer_tiers").delete().eq("min_qty", int(form.get("min_qty")));
  if (error) return dbError(error);
  await logActivity("designer.tier_deleted", "designer_tier", str(form.get("min_qty")));
  refresh();
  return { ok: true };
}

/** Lead times, notices and print-quality threshold shown in the designer (admins only). */
export async function saveDesignerSettings(_prev: ActionState, form: FormData): Promise<ActionState> {
  const session = await assertAdmin();
  const num = (k: string, lo: number, hi: number) => {
    const n = int(form.get(k));
    return Number.isInteger(n) && n >= lo && n <= hi ? n : null;
  };
  const min = num("lead_days_min", 0, 60);
  const max = num("lead_days_max", 0, 90);
  const rush = num("rush_days", 0, 30);
  const dpi = num("min_dpi", 72, 600);
  if (min === null) return bad("lead_days_min");
  if (max === null || max < min) return bad("lead_days_max");
  if (rush === null) return bad("rush_days");
  if (dpi === null) return bad("min_dpi");
  const value = { lead_days_min: min, lead_days_max: max, rush_days: rush, min_dpi: dpi, notice_ar: str(form.get("notice_ar")).trim().slice(0, 600), notice_en: str(form.get("notice_en")).trim().slice(0, 600) };
  const supabase = await createClient();
  const { error } = await supabase.from("website_settings").upsert({ key: "designer", value, updated_by: session.userId }, { onConflict: "key" });
  if (error) return dbError(error);
  await logActivity("designer.settings_updated", "settings", "designer");
  refresh();
  return { ok: true };
}
