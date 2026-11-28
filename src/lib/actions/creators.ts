"use server";
import { randomBytes } from "node:crypto";
import { revalidatePath } from "next/cache";
import { after } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getSession } from "@/lib/auth";
import { rateLimit } from "@/lib/rate-limit";
import { publicEnv } from "@/lib/env";
import { phoneSchema, fieldErrors, uuid } from "@/lib/validation";
import { assertCreator, creatorBalance, creatorBasePrice, creatorMaxMarkup, effectiveCommission, earningPerPiece, getCreatorSettings, getMyCreator, MARKUP_CEILING } from "@/lib/creators";
import { designItem, generatedImage, writeProductPrinting } from "@/lib/printing-write";
import { skuPrefix } from "@/lib/product-tools";
import { normalizeSocialLink, type CreatorSocial } from "@/lib/creator-labels";
import { notifyAdmin } from "@/lib/notifications";

type Fail = { ok: false; error: string; fields?: Record<string, string> };
// "@name", "name", "instagram.com/name" or a full link → a clean https link (anything else: "url")
const link = (kind: CreatorSocial) => z.unknown().transform((v, ctx) => {
  const out = normalizeSocialLink(kind, v);
  if (out === null) { ctx.addIssue({ code: "custom", message: "url" }); return z.NEVER; }
  return out || undefined;
}).optional();
const socials = z.object({ instagram: link("instagram"), tiktok: link("tiktok"), facebook: link("facebook"), behance: link("behance"), website: link("website") }).default({ instagram: undefined, tiktok: undefined, facebook: undefined, behance: undefined, website: undefined });
const username = z.string().trim().toLowerCase().regex(/^[a-z0-9][a-z0-9_.]{2,29}$/, "username");
const RESERVED = new Set(["admin", "tpac", "studio", "new", "top", "join", "settings", "support", "help", "creators", "creator"]);
const cleanSocials = (s: Record<string, string | undefined>) => Object.fromEntries(Object.entries(s).filter(([, v]) => v));

/* ------------------------------------------------------------------ sign-up */

const joinSchema = z.object({
  username,
  display_name: z.string().trim().min(2).max(60),
  phone: phoneSchema,
  bio: z.string().trim().max(600).optional(),
  socials,
  // required: the creator's notifications are emailed here (with no account yet, it is also the sign-in email)
  email: z.string().trim().toLowerCase().email().max(200),
  password: z.string().min(8).max(72).optional(),
});

/**
 * Becoming a creator: with an existing TPAC account, or creating one right here.
 * The account waits for staff approval before the creator dashboard opens.
 */
export async function joinCreators(input: unknown): Promise<{ ok: true; needsEmail?: boolean } | Fail> {
  const parsed = joinSchema.safeParse(input);
  if (!parsed.success) {
    const fields = fieldErrors(parsed.error);
    console.warn("joinCreators: invalid fields", Object.keys(fields).join(", "));
    return { ok: false, error: "validation", fields };
  }
  const d = parsed.data;
  if (RESERVED.has(d.username)) return { ok: false, error: "validation", fields: { username: "taken" } };
  if (!(await rateLimit("auth", "creator"))) return { ok: false, error: "rate_limited" };
  const db = createAdminClient();
  const { data: taken } = await db.from("creators").select("user_id").eq("username", d.username).maybeSingle();
  if (taken) return { ok: false, error: "validation", fields: { username: "taken" } };

  let userId: string | null = null;
  let email: string | null = null;
  let needsEmail = false;
  const session = await getSession();
  if (session) {
    userId = session.userId;
    email = d.email;
    if (await getMyCreator()) return { ok: false, error: "already" };
  } else {
    if (!d.password) return { ok: false, error: "validation", fields: { password: "required" } };
    const supabase = await createClient();
    const { data, error } = await supabase.auth.signUp({
      email: d.email, password: d.password,
      options: { data: { full_name: d.display_name, phone: d.phone, locale: "ar" }, emailRedirectTo: `${publicEnv.siteUrl}/ar/auth/callback?next=/ar/creator-studio` },
    });
    if (error || !data.user) {
      if (error && (error.code === "user_already_exists" || /already/i.test(error.message))) return { ok: false, error: "email_taken" };
      if (error?.code === "weak_password") return { ok: false, error: "weak_password" };
      if (error?.code === "email_address_invalid") return { ok: false, error: "validation", fields: { email: "invalid" } };
      if (error?.code === "over_email_send_rate_limit" || error?.code === "over_request_rate_limit" || error?.status === 429) return { ok: false, error: "signup_busy" };
      console.error("joinCreators: sign-up failed", error?.code, error?.message);
      return { ok: false, error: "generic" };
    }
    userId = data.user.id;
    email = d.email;
    needsEmail = !data.session;
  }
  const { error } = await db.from("creators").insert({
    user_id: userId, username: d.username, display_name: d.display_name, phone: d.phone, email,
    bio: d.bio || null, socials: cleanSocials(d.socials),
  });
  if (error) return { ok: false, error: error.code === "23505" ? "already" : "generic" };
  after(() => notifyAdmin("inquiry.created", "طلب انضمام مبدع", `${d.display_name} (@${d.username})`, "/ar/admin/creators"));
  return { ok: true, needsEmail };
}

/* ------------------------------------------------------------------ profile */

const profileSchema = z.object({
  display_name: z.string().trim().min(2).max(60),
  bio: z.string().trim().max(600).optional(),
  phone: phoneSchema,
  email: z.string().trim().toLowerCase().email().max(200),
  email_notifications: z.boolean().default(true),
  socials,
  avatar_url: z.string().max(1000).nullable().optional(),
  cover_url: z.string().max(1000).nullable().optional(),
});
const ownImage = (u: string | null | undefined, uid: string) => !u || u.includes(`/product-images/creators/${uid}/`);

export async function updateCreatorProfile(input: unknown): Promise<{ ok: true } | Fail> {
  const c = await getMyCreator();
  if (!c || c.status === "rejected") return { ok: false, error: "not_authorized" };
  const parsed = profileSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "validation", fields: fieldErrors(parsed.error) };
  const d = parsed.data;
  // pictures must be the creator's own uploads
  if (!ownImage(d.avatar_url, c.user_id) || !ownImage(d.cover_url, c.user_id)) return { ok: false, error: "validation" };
  await createAdminClient().from("creators").update({
    display_name: d.display_name, bio: d.bio || null, phone: d.phone, email: d.email, email_notifications: d.email_notifications, socials: cleanSocials(d.socials),
    ...(d.avatar_url !== undefined ? { avatar_url: d.avatar_url } : {}), ...(d.cover_url !== undefined ? { cover_url: d.cover_url } : {}),
    updated_at: new Date().toISOString(),
  }).eq("user_id", c.user_id);
  revalidatePath(`/[locale]/creator/${c.username}`, "page");
  return { ok: true };
}

/* ------------------------------------------------------------------ uploads (signed, to the public product-images bucket) */

const signSchema = z.object({
  kind: z.enum(["avatar", "cover", "art", "gen"]),
  path: z.string().max(300).optional(),
  type: z.enum(["image/png", "image/jpeg", "image/webp"]),
  size: z.number().int().positive().max(12 * 1024 * 1024),
});

/**
 * A creator uploads straight to storage with a one-time signed URL — only to their own folder
 * (profile pictures) or to the folder of one of their own unpublished listings (artwork, mockups).
 */
export async function signCreatorUpload(input: unknown): Promise<{ ok: true; path: string; token: string; url: string } | Fail> {
  const parsed = signSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "validation" };
  const c = await getMyCreator();
  if (!c || c.status === "rejected" || c.status === "suspended") return { ok: false, error: "not_authorized" };
  if (!(await rateLimit("upload", "creator"))) return { ok: false, error: "rate_limited" };
  const d = parsed.data;
  const ext = d.type === "image/png" ? "png" : d.type === "image/webp" ? "webp" : "jpg";
  let path: string;
  const db = createAdminClient();
  if (d.kind === "avatar" || d.kind === "cover") {
    path = `creators/${c.user_id}/${d.kind}-${crypto.randomUUID()}.${ext}`;
  } else {
    if (c.status !== "approved") return { ok: false, error: "not_authorized" };
    const m = /^products\/([0-9a-f-]{36})\/(art|gen)\/[0-9a-f-]{36}\.(png|jpg|webp)$/.exec(d.path ?? "");
    if (!m || m[2] !== d.kind) return { ok: false, error: "validation" };
    const { data: cp } = await db.from("creator_products").select("status").eq("product_id", m[1]!).eq("creator_id", c.user_id).maybeSingle();
    if (!cp || cp.status === "hidden") return { ok: false, error: "not_authorized" };
    path = d.path!;
  }
  const { data, error } = await db.storage.from("product-images").createSignedUploadUrl(path);
  if (error || !data) return { ok: false, error: "sign_failed" };
  return { ok: true, path: data.path, token: data.token, url: db.storage.from("product-images").getPublicUrl(path).data.publicUrl };
}

/* ------------------------------------------------------------------ designs (listings) */

/** Starts a listing on one of the garments open to creators: an unpublished product the creator then designs. */
export async function createCreatorDraft(productTypeId: string): Promise<{ ok: true; id: string; product_id: string } | Fail> {
  const c = await assertCreator().catch(() => null);
  if (!c) return { ok: false, error: "not_authorized" };
  if (!uuid.safeParse(productTypeId).success) return { ok: false, error: "validation" };
  if (!(await rateLimit("design", "creator-draft"))) return { ok: false, error: "rate_limited" };
  const db = createAdminClient();
  const { data: type } = await db.from("product_types").select("id, default_price, creator_base_price, category_id, creator_enabled, is_active, name_ar, name_en").eq("id", productTypeId).maybeSingle();
  if (!type || !type.creator_enabled || !type.is_active) return { ok: false, error: "type_unavailable" };
  const base = creatorBasePrice(type);
  const slug = `c-${c.username.replace(/[^a-z0-9]/g, "")}-${randomBytes(4).toString("hex")}`;
  const { data: p, error } = await db.from("products").insert({
    slug, name_ar: `${type.name_ar} — ${c.display_name}`, name_en: `${type.name_en} — ${c.display_name}`,
    base_price: base, category_id: type.category_id, product_type_id: type.id, print_enabled: true,
    is_published: false, creator_id: c.user_id, tags: ["creators", c.username],
  }).select("id").single();
  if (error || !p) {
    console.error("createCreatorDraft", error);
    return { ok: false, error: "generic" };
  }
  const { data: cp, error: e2 } = await db.from("creator_products").insert({
    creator_id: c.user_id, product_id: p.id, product_type_id: type.id, title: `${type.name_ar}`, base_price: base,
  }).select("id").single();
  if (e2 || !cp) return { ok: false, error: "generic" };
  return { ok: true, id: cp.id as string, product_id: p.id as string };
}

const saveSchema = z.object({
  id: uuid,
  title: z.string().trim().min(2).max(80),
  description: z.string().trim().max(2000).optional(),
  category: z.string().trim().max(40).optional(),
  tags: z.array(z.string().trim().min(1).max(30)).max(15).default([]),
  color_ids: z.array(uuid).min(1).max(20),
  sizes: z.array(z.string().regex(/^[A-Z0-9]{1,6}$/)).min(1).max(12),
  cover_color: uuid.nullable().optional(),
  markup: z.number().int().min(0).max(MARKUP_CEILING),
  designs: z.array(designItem).min(1).max(20),
  images: z.array(generatedImage).max(40),
  submit: z.boolean(),
});

/**
 * Saves a listing: artwork placement, generated mockups, colours, sizes and the creator's markup.
 * The price is always the admin's garment price for creators + the markup (within the admin's cap, if any) — computed here, never sent.
 * Submitting sends it for review (or publishes it straight away when review is off).
 */
export async function saveCreatorDesign(input: unknown): Promise<{ ok: true; status: string; price: number; earning: number } | Fail> {
  const c = await assertCreator().catch(() => null);
  if (!c) return { ok: false, error: "not_authorized" };
  const parsed = saveSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "validation", fields: fieldErrors(parsed.error) };
  const d = parsed.data;
  const db = createAdminClient();
  const { data: cp } = await db.from("creator_products").select("id, product_id, product_type_id, status").eq("id", d.id).eq("creator_id", c.user_id).maybeSingle();
  if (!cp) return { ok: false, error: "not_found" };
  if (cp.status === "hidden") return { ok: false, error: "hidden" };
  const [{ data: type }, settings, { data: product }] = await Promise.all([
    db.from("product_types").select("id, default_price, creator_base_price, default_sizes, default_color_ids, creator_max_markup, creator_commission_mode, creator_commission_value, creator_enabled").eq("id", cp.product_type_id).maybeSingle(),
    getCreatorSettings(),
    db.from("products").select("slug").eq("id", cp.product_id).single(),
  ]);
  if (!type || !type.creator_enabled || !product) return { ok: false, error: "type_unavailable" };
  // only the colours and sizes TPAC offers on this garment
  const allowedColors = new Set((type.default_color_ids as string[]) ?? []);
  const allowedSizes = new Set((type.default_sizes as string[]) ?? []);
  if ((allowedColors.size && d.color_ids.some((x) => !allowedColors.has(x))) || (allowedSizes.size && d.sizes.some((x) => !allowedSizes.has(x)))) return { ok: false, error: "validation", fields: { color_ids: "unavailable" } };
  const maxMarkup = creatorMaxMarkup(type, settings);
  if (maxMarkup !== null && d.markup > maxMarkup) return { ok: false, error: "validation", fields: { markup: "max" } };
  // the images must be this listing's own files
  if (d.designs.some((x) => x.artwork_path && !x.artwork_path.startsWith(`products/${cp.product_id}/art/`)) || d.images.some((x) => !x.storage_path.startsWith(`products/${cp.product_id}/gen/`))) return { ok: false, error: "validation" };

  const base = creatorBasePrice(type as { default_price: number; creator_base_price: number | null });
  const price = base + d.markup;
  const res = await writeProductPrinting(db as never, cp.product_id, type.id, d.designs, d.images);
  if (!res?.ok) return { ok: false, error: "validation", fields: (res as { fields?: Record<string, string> }).fields };

  // variants: every chosen colour × size; others switched off (never deleted: old orders point to them)
  const [{ data: colors }, { data: existing }] = await Promise.all([
    db.from("colors").select("id, code").in("id", d.color_ids),
    db.from("product_variants").select("id, size_code, color_id").eq("product_id", cp.product_id),
  ]);
  const want = new Set(d.color_ids.flatMap((cid) => d.sizes.map((s) => `${s}:${cid}`)));
  const have = new Map(((existing ?? []) as { id: string; size_code: string; color_id: string }[]).map((v) => [`${v.size_code}:${v.color_id}`, v.id]));
  const prefix = skuPrefix(product.slug as string);
  const rows = ((colors ?? []) as { id: string; code: string }[]).flatMap((col) => d.sizes.filter((s) => !have.has(`${s}:${col.id}`)).map((s) => ({
    product_id: cp.product_id, size_code: s, color_id: col.id,
    sku: `${prefix}-${String(col.code).slice(0, 3).toUpperCase()}-${s}-${randomBytes(2).toString("hex").toUpperCase()}`,
  })));
  if (rows.length) {
    const { data: created, error } = await db.from("product_variants").insert(rows).select("id");
    if (error) return { ok: false, error: "generic" };
    // printed to order: always available
    await db.from("inventory").insert(((created ?? []) as { id: string }[]).map((v) => ({ variant_id: v.id, quantity: 100000 })));
  }
  const on = [...have.entries()].filter(([k]) => want.has(k)).map(([, id]) => id);
  const off = [...have.entries()].filter(([k]) => !want.has(k)).map(([, id]) => id);
  if (on.length) await db.from("product_variants").update({ is_active: true }).in("id", on);
  if (off.length) await db.from("product_variants").update({ is_active: false }).in("id", off);

  // review: submitting sends it to staff; changing a published design sends it back (unless review is off)
  const publishNow = !settings.review_required && (d.submit || cp.status === "approved");
  const status = publishNow ? "approved" : d.submit || cp.status === "approved" || cp.status === "pending" ? "pending" : cp.status;
  const now = new Date().toISOString();
  await db.from("products").update({
    name_ar: d.title, name_en: d.title, description_ar: d.description || null, description_en: d.description || null,
    base_price: price, tags: [...new Set(["creators", c.username, ...d.tags])].slice(0, 30),
    is_published: status === "approved",
  }).eq("id", cp.product_id);
  if (d.cover_color) {
    // the cover colour's photos first
    const { data: imgs } = await db.from("product_images").select("id, color_id").eq("product_id", cp.product_id).eq("is_generated", true);
    for (const [i, im] of ((imgs ?? []) as { id: string; color_id: string | null }[]).sort((a, b) => Number(b.color_id === d.cover_color) - Number(a.color_id === d.cover_color)).entries()) await db.from("product_images").update({ sort_order: i }).eq("id", im.id);
  }
  await db.from("creator_products").update({
    title: d.title, description: d.description || null, category: d.category || null, tags: d.tags, markup: d.markup, base_price: base,
    status, ...(status === "pending" ? { submitted_at: now, review_note: null } : {}), ...(publishNow ? { approved_at: now } : {}), updated_at: now,
  }).eq("id", cp.id);
  if (status === "pending") after(() => notifyAdmin("inquiry.created", "تصميم مبدع ينتظر المراجعة", `«${d.title}» — @${c.username}`, "/ar/admin/creators/designs"));
  revalidatePath(`/[locale]/creator/${c.username}`, "page");
  const rule = effectiveCommission(c, type, settings);
  return { ok: true, status, price, earning: earningPerPiece(d.markup, rule) };
}

/* ------------------------------------------------------------------ wallet */

const withdrawSchema = z.object({ amount: z.number().int().positive(), method: z.string().trim().min(2).max(40), account: z.string().trim().min(3).max(200) });

export async function requestWithdrawal(input: unknown): Promise<{ ok: true } | Fail> {
  const c = await assertCreator().catch(() => null);
  if (!c) return { ok: false, error: "not_authorized" };
  const parsed = withdrawSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "validation", fields: fieldErrors(parsed.error) };
  const d = parsed.data;
  const s = await getCreatorSettings();
  if (!s.payout_methods.includes(d.method)) return { ok: false, error: "validation", fields: { method: "unavailable" } };
  if (d.amount < s.min_withdrawal) return { ok: false, error: "min" };
  const b = await creatorBalance(c.user_id);
  if (d.amount > b.available) return { ok: false, error: "balance" };
  const { error } = await createAdminClient().from("creator_withdrawals").insert({ creator_id: c.user_id, amount: d.amount, method: d.method, account: d.account });
  if (error) return { ok: false, error: "generic" };
  after(() => notifyAdmin("inquiry.created", "طلب سحب أرباح", `@${c.username} — ${d.amount} د.ع — ${d.method}`, "/ar/admin/creators/withdrawals"));
  return { ok: true };
}

export async function markCreatorNotificationsRead(): Promise<void> {
  const c = await getMyCreator();
  if (!c) return;
  await createAdminClient().from("creator_notifications").update({ read_at: new Date().toISOString() }).eq("creator_id", c.user_id).is("read_at", null);
}

/* ------------------------------------------------------------------ public side */

export async function toggleFollow(creatorId: string): Promise<{ ok: true; following: boolean } | Fail> {
  const session = await getSession();
  if (!session) return { ok: false, error: "login" };
  if (!uuid.safeParse(creatorId).success) return { ok: false, error: "validation" };
  const db = createAdminClient();
  const { data } = await db.from("creator_follows").select("user_id").eq("user_id", session.userId).eq("creator_id", creatorId).maybeSingle();
  if (data) await db.from("creator_follows").delete().eq("user_id", session.userId).eq("creator_id", creatorId);
  else await db.from("creator_follows").insert({ user_id: session.userId, creator_id: creatorId });
  return { ok: true, following: !data };
}

/** Counts a visit to a creator's page or to one of their products (once per browser session, see the client). */
export async function trackCreatorView(creatorId: string, productId?: string): Promise<void> {
  if (!uuid.safeParse(creatorId).success || (productId && !uuid.safeParse(productId).success)) return;
  if (!(await rateLimit("quote", "creator-view"))) return;
  await createAdminClient().rpc("creator_track", { p_creator: creatorId, p_kind: productId ? "product" : "page", p_product: productId ?? null });
}
