"use server";
import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { assertStaff, assertAdmin } from "@/lib/auth";
import { getCreatorSettings, notifyCreator, emailCreatorsSoon, DEFAULT_CREATOR_SETTINGS } from "@/lib/creators";
import { bool, str, logActivity, type ActionState } from "./common";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const int = (v: FormDataEntryValue | null) => Math.trunc(Number(str(v)) || 0);
const note = (v: FormDataEntryValue | null) => str(v).trim().slice(0, 1000) || null;
const refresh = () => {
  revalidatePath("/[locale]/admin/creators", "layout");
  revalidatePath("/[locale]/creators", "layout");
  revalidatePath("/[locale]/creator/[username]", "page");
};

/* ------------------------------------------------------------------ creators */

export async function setCreatorStatus(_: ActionState, form: FormData): Promise<ActionState> {
  const session = await assertStaff();
  const id = str(form.get("id"));
  const status = str(form.get("status"));
  if (!UUID.test(id) || !["approved", "rejected", "suspended"].includes(status)) return { ok: false, error: "validation" };
  const db = createAdminClient();
  const { data: c } = await db.from("creators").select("user_id, username, status").eq("user_id", id).maybeSingle();
  if (!c) return { ok: false, error: "not_found" };
  await db.from("creators").update({ status, review_note: note(form.get("note")), ...(status === "approved" && !c.status.startsWith("approved") ? { approved_at: new Date().toISOString() } : {}), updated_at: new Date().toISOString() }).eq("user_id", id);
  // a suspended creator's designs leave the store; reactivating brings the approved ones back
  const { data: listings } = await db.from("creator_products").select("product_id").eq("creator_id", id).eq("status", "approved");
  const ids = ((listings ?? []) as { product_id: string }[]).map((l) => l.product_id);
  if (ids.length) await db.from("products").update({ is_published: status === "approved" }).in("id", ids);
  await notifyCreator(id, status === "approved" ? "تفعّل حسابك 🎉" : status === "suspended" ? "انوقف حسابك" : "ما انقبل طلبك",
    status === "approved" ? "هلا بيك بـ TPAC Creators! ارفع أول تصميم من «تصاميمي»." : note(form.get("note")) ?? "تواصل ويا الإدارة للتفاصيل.", status === "approved" ? "/creator-studio/designs" : undefined, "account");
  await logActivity(`creator.${status}`, "creator", id, { by: session.userId });
  refresh();
  return { ok: true, message: "✓" };
}

export async function setCreatorCommission(_: ActionState, form: FormData): Promise<ActionState> {
  await assertAdmin();
  const id = str(form.get("id"));
  const mode = str(form.get("mode"));
  const value = int(form.get("value"));
  if (!UUID.test(id) || !["", "percent", "fixed"].includes(mode) || value < 0 || (mode === "percent" && value > 100)) return { ok: false, error: "validation" };
  await createAdminClient().from("creators").update({ commission_mode: mode || null, commission_value: mode ? value : null }).eq("user_id", id);
  await notifyCreator(id, "تغيّرت نسبة أرباحك", mode ? (mode === "percent" ? `صارت ${value}% من إضافتك على كل قطعة — للمبيعات الجاية فقط.` : `صارت ${value} د.ع لكل قطعة — للمبيعات الجاية فقط.`) : "رجعت للنسبة العامة للمنصة — للمبيعات الجاية فقط.", "/creator-studio", "earning");
  await logActivity("creator.commission", "creator", id, { mode, value });
  refresh();
  return { ok: true, message: "✓" };
}

/** A returned piece: its earning is removed (never edited by the creator). */
export async function voidCreatorEarning(_: ActionState, form: FormData): Promise<ActionState> {
  await assertAdmin();
  const id = str(form.get("id"));
  if (!UUID.test(id)) return { ok: false, error: "validation" };
  const db = createAdminClient();
  const { data: e } = await db.from("creator_earnings").update({ status: "void", void_reason: "returned", updated_at: new Date().toISOString() }).eq("id", id).neq("status", "void").select("creator_id, product_name, order_number").maybeSingle();
  if (e) await notifyCreator(e.creator_id, "قطعة مسترجعة", `${e.product_name} — الطلب ${e.order_number}: انشال الربح بسبب الإرجاع.`, "/creator-studio/orders", "earning");
  await logActivity("creator.earning_void", "creator_earning", id);
  refresh();
  return { ok: true };
}

/* ------------------------------------------------------------------ designs */

export async function reviewCreatorDesign(_: ActionState, form: FormData): Promise<ActionState> {
  await assertStaff();
  const id = str(form.get("id"));
  const action = str(form.get("action"));
  if (!UUID.test(id) || !["approve", "reject", "changes", "hide"].includes(action)) return { ok: false, error: "validation" };
  const db = createAdminClient();
  const { data: cp } = await db.from("creator_products").select("id, creator_id, product_id, title, products(slug)").eq("id", id).maybeSingle();
  if (!cp) return { ok: false, error: "not_found" };
  const status = action === "approve" ? "approved" : action === "reject" ? "rejected" : action === "changes" ? "changes_requested" : "hidden";
  const now = new Date().toISOString();
  await db.from("creator_products").update({ status, review_note: action === "approve" ? null : note(form.get("note")), ...(status === "approved" ? { approved_at: now } : {}), updated_at: now }).eq("id", id);
  await db.from("products").update({ is_published: status === "approved" }).eq("id", cp.product_id);
  const slug = (cp.products as unknown as { slug: string } | null)?.slug;
  await notifyCreator(cp.creator_id,
    status === "approved" ? "انقبل تصميمك ✓" : status === "rejected" ? "ما انقبل التصميم" : status === "changes_requested" ? "مطلوب تعديل على تصميمك" : "انخفى تصميمك",
    status === "approved" ? `«${cp.title}» صار بمتجرك — شاركه هسه!` : `«${cp.title}»: ${note(form.get("note")) ?? "شوف ملاحظة الإدارة."}`,
    status === "approved" && slug ? `/product/${slug}` : `/creator-studio/designs/${cp.id}`, "design");
  await logActivity(`creator_design.${action}`, "creator_product", id);
  refresh();
  return { ok: true, message: "✓" };
}

/* ------------------------------------------------------------------ withdrawals */

export async function processWithdrawal(_: ActionState, form: FormData): Promise<ActionState> {
  const session = await assertAdmin();
  const id = str(form.get("id"));
  const action = str(form.get("action"));
  if (!UUID.test(id) || !["approve", "paid", "reject"].includes(action)) return { ok: false, error: "validation" };
  const db = createAdminClient();
  const status = action === "approve" ? "approved" : action === "paid" ? "paid" : "rejected";
  const { data: w } = await db.from("creator_withdrawals").update({ status, admin_note: note(form.get("note")), processed_by: session.userId, processed_at: new Date().toISOString() })
    .eq("id", id).in("status", action === "paid" ? ["requested", "approved"] : ["requested"]).select("creator_id, amount, method").maybeSingle();
  if (!w) return { ok: false, error: "not_found" };
  await notifyCreator(w.creator_id, status === "paid" ? "تم تحويل أرباحك 💸" : status === "approved" ? "انقبل طلب السحب" : "انرفض طلب السحب",
    `${w.amount} د.ع — ${w.method}${note(form.get("note")) ? ` — ${note(form.get("note"))}` : ""}`, "/creator-studio/wallet", "wallet");
  await logActivity(`creator_withdrawal.${action}`, "creator_withdrawal", id, { amount: w.amount });
  refresh();
  return { ok: true, message: "✓" };
}

/* ------------------------------------------------------------------ settings */

export async function saveCreatorSettings(_: ActionState, form: FormData): Promise<ActionState> {
  await assertAdmin();
  const before = await getCreatorSettings();
  const mode = str(form.get("commission_mode")) === "fixed" ? "fixed" : "percent";
  const value = int(form.get("commission_value"));
  if (value < 0 || (mode === "percent" && value > 100)) return { ok: false, error: "validation", fields: { commission_value: "range" } };
  const methods = str(form.get("payout_methods")).split(/[,\n،]/).map((x) => x.trim()).filter((x) => x.length >= 2 && x.length <= 40).slice(0, 10);
  const next = {
    ...DEFAULT_CREATOR_SETTINGS, ...before,
    commission_mode: mode, commission_value: value,
    min_withdrawal: Math.max(0, int(form.get("min_withdrawal"))), hold_days: Math.max(0, Math.min(90, int(form.get("hold_days")))),
    max_markup: Math.max(0, int(form.get("max_markup"))), review_required: bool(form.get("review_required")),
    payout_methods: methods.length ? methods : before.payout_methods,
  };
  const db = createAdminClient();
  await db.from("website_settings").upsert({ key: "creators", value: next }, { onConflict: "key" });
  if (before.commission_mode !== next.commission_mode || before.commission_value !== next.commission_value) {
    // tell creators on the platform rule (their past earnings keep the rule they were made with)
    const { data: list } = await db.from("creators").select("user_id").eq("status", "approved").is("commission_mode", null);
    const text = next.commission_mode === "percent" ? `صارت ${next.commission_value}% من إضافتك على كل قطعة` : `صارت ${next.commission_value} د.ع لكل قطعة`;
    if ((list ?? []).length) await db.from("creator_notifications").insert(((list ?? []) as { user_id: string }[]).map((c) => ({ creator_id: c.user_id, kind: "earning", title: "تحديث نسبة الأرباح", body: `${text} — للمبيعات الجاية فقط، أرباحك السابقة ما تتغير.`, link: "/creator-studio" })));
    emailCreatorsSoon();
  }
  await logActivity("creator.settings", "website_settings", null, next);
  refresh();
  return { ok: true, message: "انحفظ ✓" };
}

export async function saveCreatorTypeOptions(_: ActionState, form: FormData): Promise<ActionState> {
  await assertAdmin();
  const id = str(form.get("id"));
  const mode = str(form.get("mode"));
  if (!UUID.test(id) || !["", "percent", "fixed"].includes(mode)) return { ok: false, error: "validation" };
  const max = str(form.get("max_markup")).trim();
  await createAdminClient().from("product_types").update({
    creator_enabled: bool(form.get("creator_enabled")),
    creator_max_markup: max === "" ? null : Math.max(0, int(form.get("max_markup"))),
    creator_commission_mode: mode || null,
    creator_commission_value: mode ? Math.max(0, int(form.get("value"))) : null,
  }).eq("id", id);
  await logActivity("creator.type_options", "product_type", id);
  refresh();
  return { ok: true, message: "✓" };
}

export async function broadcastToCreators(_: ActionState, form: FormData): Promise<ActionState> {
  await assertStaff();
  const title = str(form.get("title")).trim().slice(0, 120);
  const body = str(form.get("body")).trim().slice(0, 1000);
  if (title.length < 2) return { ok: false, error: "validation", fields: { title: "required" } };
  const db = createAdminClient();
  const { data } = await db.from("creators").select("user_id").eq("status", "approved");
  const rows = ((data ?? []) as { user_id: string }[]).map((c) => ({ creator_id: c.user_id, kind: "admin", title, body: body || null }));
  if (rows.length) await db.from("creator_notifications").insert(rows);
  emailCreatorsSoon();
  await logActivity("creator.broadcast", "creator", null, { title, count: rows.length });
  return { ok: true, message: `انرسل لـ ${rows.length}` };
}
