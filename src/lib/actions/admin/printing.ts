"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { assertStaff } from "@/lib/auth";
import { slugCode } from "@/lib/print-config";
import { bool, str, dbError, logActivity, type ActionState } from "./common";
import { designItem, generatedImage, writeProductPrinting } from "@/lib/printing-write";

type SB = Awaited<ReturnType<typeof createClient>>;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const code = z.string().trim().toLowerCase().regex(/^[a-z0-9]+([_-][a-z0-9]+)*$/, "code").max(40);
const frac = z.number().finite().min(0).max(1);
const url = z.string().max(1000).refine((u) => /^https?:\/\//.test(u) || u.startsWith("/"), "url");
const storagePath = z.string().max(300).regex(/^(mockups|products)\/[0-9a-zA-Z/_.-]+$/).nullable().optional();
const refresh = () => revalidatePath("/[locale]", "layout");
const bad = (field: string): ActionState => ({ ok: false, error: "validation", fields: { [field]: "required" } });

/* ------------------------------------------------------------------ types */

export async function saveProductType(_prev: ActionState, form: FormData): Promise<ActionState> {
  await assertStaff();
  const id = str(form.get("id"));
  const name_ar = str(form.get("name_ar")).trim().slice(0, 80);
  const name_en = str(form.get("name_en")).trim().slice(0, 80) || name_ar;
  const rawCode = str(form.get("code")).trim() || slugCode(name_en);
  const parsedCode = code.safeParse(rawCode);
  const price = Number(str(form.get("default_price")) || 0);
  const shape = str(form.get("garment_shape"));
  if (!name_ar) return bad("name_ar");
  if (!id && !parsedCode.success) return bad("code");
  if (!Number.isInteger(price) || price < 0 || price > 100_000_000) return bad("default_price");
  const cat = str(form.get("category_id"));
  const row = {
    name_ar, name_en,
    description_ar: str(form.get("description_ar")).trim().slice(0, 500) || null,
    description_en: str(form.get("description_en")).trim().slice(0, 500) || null,
    garment_shape: ["tshirt", "oversized", "hoodie", "sweatshirt", "longsleeve"].includes(shape) ? shape : null,
    default_price: price,
    default_sizes: form.getAll("default_sizes").map(String).filter((s) => /^[A-Z0-9]{1,6}$/.test(s)),
    default_color_ids: form.getAll("default_color_ids").map(String).filter((c) => UUID.test(c)),
    category_id: UUID.test(cat) ? cat : null,
    sort_order: Math.max(0, Math.min(999, Math.trunc(Number(form.get("sort_order")) || 0))),
    is_active: bool(form.get("is_active")),
  };
  const supabase = await createClient();
  let typeId = id;
  if (id) {
    const { error } = await supabase.from("product_types").update(row).eq("id", id);
    if (error) return dbError(error);
  } else {
    const { data, error } = await supabase.from("product_types").insert({ ...row, code: parsedCode.data }).select("id").single();
    if (error) return dbError(error);
    typeId = data.id;
    // every new type starts with a front and a back view, each with a centred print area
    const { data: views, error: vErr } = await supabase.from("product_type_views").insert([
      { product_type_id: typeId, code: "front", name_ar: "الأمام", name_en: "Front", sort_order: 0 },
      { product_type_id: typeId, code: "back", name_ar: "الخلف", name_en: "Back", sort_order: 1 },
    ]).select("id, code");
    if (vErr) return dbError(vErr);
    await supabase.from("product_print_areas").insert((views ?? []).map((v) => ({
      view_id: v.id, code: v.code === "front" ? "front" : "back", name_ar: v.code === "front" ? "وسط الأمام" : "وسط الظهر", name_en: v.code === "front" ? "Front centre" : "Back centre",
      x: 0.3, y: 0.24, width: 0.4, height: 0.4, max_width_cm: 30, max_height_cm: 40,
    })));
  }
  await logActivity(id ? "product_type.updated" : "product_type.created", "product_type", typeId, { code: rawCode });
  refresh();
  return { ok: true, id: typeId };
}

export async function deleteProductType(_prev: ActionState, form: FormData): Promise<ActionState> {
  await assertStaff();
  const id = str(form.get("id"));
  const supabase = await createClient();
  const { count } = await supabase.from("products").select("id", { count: "exact", head: true }).eq("product_type_id", id);
  if ((count ?? 0) > 0) return { ok: false, error: "in_use" };
  const paths = await mockupPathsOfType(supabase, id);
  const { error } = await supabase.from("product_types").delete().eq("id", id);
  if (error) return dbError(error);
  if (paths.length) await supabase.storage.from("product-images").remove(paths);
  await logActivity("product_type.deleted", "product_type", id);
  refresh();
  return { ok: true };
}

async function mockupPathsOfType(supabase: SB, typeId: string): Promise<string[]> {
  const { data } = await supabase.from("product_type_views").select("mockup_path, color_mockups").eq("product_type_id", typeId);
  return (data ?? []).flatMap((v) => [v.mockup_path as string | null, ...Object.values((v.color_mockups ?? {}) as Record<string, { path?: string }>).map((m) => m.path ?? null)]).filter(Boolean) as string[];
}

/* ------------------------------------------------------------------ views + mockups */

const viewSchema = z.object({
  id: z.string().regex(UUID).optional(),
  product_type_id: z.string().regex(UUID),
  code: code.optional(),
  name_ar: z.string().trim().min(1).max(60),
  name_en: z.string().trim().min(1).max(60),
  sort_order: z.number().int().min(0).max(99).default(0),
  is_active: z.boolean().default(true),
});

export async function saveTypeView(input: unknown): Promise<ActionState> {
  await assertStaff();
  const p = viewSchema.safeParse(input);
  if (!p.success) return { ok: false, error: "validation" };
  const v = p.data;
  const supabase = await createClient();
  if (v.id) {
    const { error } = await supabase.from("product_type_views").update({ name_ar: v.name_ar, name_en: v.name_en, sort_order: v.sort_order, is_active: v.is_active }).eq("id", v.id);
    if (error) return dbError(error);
    refresh();
    return { ok: true, id: v.id };
  }
  const { data, error } = await supabase.from("product_type_views").insert({ product_type_id: v.product_type_id, code: v.code ?? (slugCode(v.name_en) || `view-${Date.now().toString(36)}`), name_ar: v.name_ar, name_en: v.name_en, sort_order: v.sort_order }).select("id").single();
  if (error) return dbError(error);
  await logActivity("product_type.view_added", "product_type", v.product_type_id, { view: v.name_en });
  refresh();
  return { ok: true, id: data.id };
}

export async function deleteTypeView(viewId: string): Promise<ActionState> {
  await assertStaff();
  if (!UUID.test(viewId)) return { ok: false, error: "validation" };
  const supabase = await createClient();
  const { data: v } = await supabase.from("product_type_views").select("mockup_path, color_mockups").eq("id", viewId).maybeSingle();
  const { error } = await supabase.from("product_type_views").delete().eq("id", viewId);
  if (error) return dbError(error);
  const paths = [v?.mockup_path as string | null, ...Object.values((v?.color_mockups ?? {}) as Record<string, { path?: string }>).map((m) => m.path ?? null)].filter(Boolean) as string[];
  if (paths.length) await supabase.storage.from("product-images").remove(paths);
  refresh();
  return { ok: true };
}

const mockupSchema = z.object({
  view_id: z.string().regex(UUID),
  color_id: z.string().regex(UUID).nullable(),
  url: url.nullable(),
  path: storagePath,
  width: z.number().int().min(50).max(10000).optional(),
  height: z.number().int().min(50).max(10000).optional(),
});

/** Sets (or clears with url = null) the default mockup of a view, or the mockup for one colour. */
export async function setViewMockup(input: unknown): Promise<ActionState> {
  await assertStaff();
  const p = mockupSchema.safeParse(input);
  if (!p.success) return { ok: false, error: "validation" };
  const m = p.data;
  const supabase = await createClient();
  const { data: v } = await supabase.from("product_type_views").select("mockup_path, color_mockups, mockup_width, mockup_height").eq("id", m.view_id).maybeSingle();
  if (!v) return { ok: false, error: "not_found" };
  const old: string[] = [];
  if (m.color_id) {
    const cm = { ...((v.color_mockups ?? {}) as Record<string, { url: string; path?: string | null }>) };
    if (cm[m.color_id]?.path) old.push(cm[m.color_id]!.path!);
    if (m.url) cm[m.color_id] = { url: m.url, path: m.path ?? null };
    else delete cm[m.color_id];
    const { error } = await supabase.from("product_type_views").update({ color_mockups: cm }).eq("id", m.view_id);
    if (error) return dbError(error);
  } else {
    if (v.mockup_path) old.push(v.mockup_path as string);
    const { error } = await supabase.from("product_type_views").update({
      mockup_url: m.url, mockup_path: m.url ? m.path ?? null : null,
      // the photo's real proportions drive the preview frame; without a photo the vector garment is 600 × 700
      mockup_width: m.url ? m.width ?? v.mockup_width : 600,
      mockup_height: m.url ? m.height ?? v.mockup_height : 700,
    }).eq("id", m.view_id);
    if (error) return dbError(error);
  }
  const stale = old.filter((x) => x !== m.path);
  if (stale.length) await supabase.storage.from("product-images").remove(stale);
  await logActivity("product_type.mockup_updated", "product_type_view", m.view_id, { color: m.color_id, cleared: !m.url });
  refresh();
  return { ok: true };
}

/* ------------------------------------------------------------------ print areas */

const areaSchema = z.object({
  id: z.string().regex(UUID).optional(),
  code: code.max(30),
  name_ar: z.string().trim().min(1).max(60),
  name_en: z.string().trim().min(1).max(60),
  x: frac, y: frac,
  width: z.number().finite().min(0.01).max(1),
  height: z.number().finite().min(0.01).max(1),
  max_width_cm: z.number().finite().gt(0).max(200),
  max_height_cm: z.number().finite().gt(0).max(200),
  sort_order: z.number().int().min(0).max(99).default(0),
  is_active: z.boolean().default(true),
}).refine((a) => a.x + a.width <= 1.0001 && a.y + a.height <= 1.0001, { message: "outside", path: ["x"] });

/** Saves every print area of a view in one go (updates by id, inserts the new ones; never duplicates). */
export async function saveViewAreas(viewId: string, areas: unknown): Promise<ActionState> {
  await assertStaff();
  if (!UUID.test(viewId)) return { ok: false, error: "validation" };
  const p = z.array(areaSchema).max(20).safeParse(areas);
  if (!p.success) return { ok: false, error: "validation", fields: { areas: p.error.issues[0]?.message ?? "invalid" } };
  const codes = p.data.map((a) => a.code);
  if (new Set(codes).size !== codes.length) return { ok: false, error: "duplicate" };
  const supabase = await createClient();
  const r5 = (n: number) => Math.round(n * 100000) / 100000;
  for (const a of p.data) {
    const row = { code: a.code, name_ar: a.name_ar, name_en: a.name_en, x: r5(a.x), y: r5(a.y), width: r5(Math.min(a.width, 1 - a.x)), height: r5(Math.min(a.height, 1 - a.y)), max_width_cm: Math.round(a.max_width_cm * 10) / 10, max_height_cm: Math.round(a.max_height_cm * 10) / 10, sort_order: a.sort_order, is_active: a.is_active };
    const { error } = a.id
      ? await supabase.from("product_print_areas").update(row).eq("id", a.id).eq("view_id", viewId)
      : await supabase.from("product_print_areas").insert({ ...row, view_id: viewId });
    if (error) return dbError(error);
  }
  await logActivity("product_type.areas_saved", "product_type_view", viewId, { areas: p.data.length });
  refresh();
  return { ok: true };
}

export async function deletePrintArea(areaId: string): Promise<ActionState> {
  await assertStaff();
  if (!UUID.test(areaId)) return { ok: false, error: "validation" };
  const supabase = await createClient();
  const { count } = await supabase.from("product_designs").select("id", { count: "exact", head: true }).eq("area_id", areaId);
  if ((count ?? 0) > 0) return { ok: false, error: "in_use" };
  const { error } = await supabase.from("product_print_areas").delete().eq("id", areaId);
  if (error) return dbError(error);
  refresh();
  return { ok: true };
}

/* ------------------------------------------------------------------ product artwork (admin only) */

const printingSchema = z.object({
  product_id: z.string().regex(UUID),
  product_type_id: z.string().regex(UUID).nullable(),
  print_enabled: z.boolean(),
  disabled_print_area_ids: z.array(z.string().regex(UUID)).max(50),
  designs: z.array(designItem).max(20),
  images: z.array(generatedImage).max(24).nullable(),
});

/** Saves the printing tab of an existing product (type, artwork, enabled areas, regenerated previews). */
export async function saveProductPrinting(input: unknown): Promise<ActionState> {
  await assertStaff();
  const p = printingSchema.safeParse(input);
  if (!p.success) return { ok: false, error: "validation" };
  const v = p.data;
  const supabase = await createClient();
  const { data: product, error: pErr } = await supabase.from("products").update({ product_type_id: v.product_type_id, print_enabled: v.print_enabled, disabled_print_area_ids: v.disabled_print_area_ids }).eq("id", v.product_id).select("slug").single();
  if (pErr) return dbError(pErr);
  const res = await writeProductPrinting(supabase, v.product_id, v.product_type_id, v.designs, v.images);
  if (!res?.ok) return res;
  await logActivity("product.printing_saved", "product", v.product_id, { designs: v.designs.length, images: v.images?.length ?? 0 });
  revalidatePath("/[locale]", "layout");
  revalidatePath(`/[locale]/product/${product.slug}`, "page");
  return { ok: true };
}

/** Removes an artwork / preview file uploaded during editing but never saved. */
export async function discardPrintFile(path: string): Promise<void> {
  await assertStaff();
  if (!/^(products\/[0-9a-f-]{36}\/(art|gen)\/|mockups\/[0-9a-f-]{36}\/)[0-9a-zA-Z/_.-]+$/.test(path)) return;
  const supabase = await createClient();
  const [{ data: a }, { data: b }, { data: c }] = await Promise.all([
    supabase.from("product_designs").select("id").eq("artwork_path", path).limit(1),
    supabase.from("product_images").select("id").eq("storage_path", path).limit(1),
    supabase.from("product_type_views").select("id").eq("mockup_path", path).limit(1),
  ]);
  if (!a?.length && !b?.length && !c?.length) await supabase.storage.from("product-images").remove([path]);
}
