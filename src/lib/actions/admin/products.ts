"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { assertStaff } from "@/lib/auth";
import { productSchema, variantSchema, fieldErrors } from "@/lib/validation";
import { bool, str, dbError, logActivity, type ActionState } from "./common";
import { copySlug, parseCsv, skuPrefix, slugify, uniqueSlug } from "@/lib/product-tools";
import { z } from "zod";
import { designItem, generatedImage, writeProductPrinting } from "@/lib/printing-write";

type SB = Awaited<ReturnType<typeof createClient>>;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const SIZE = /^[A-Z0-9]{1,6}$/;

function productInput(form: FormData) {
  // Only the Arabic name and the price are required in the form: the English name falls back to the
  // Arabic one and the slug is derived from the English name (or a short random id when it is Arabic-only).
  const nameAr = str(form.get("name_ar")).trim();
  const nameEn = str(form.get("name_en")).trim() || nameAr;
  const slug = str(form.get("slug")).trim() || slugify(nameEn) || `product-${Math.random().toString(36).slice(2, 7)}`;
  return {
    slug,
    name_ar: nameAr,
    name_en: nameEn,
    description_ar: str(form.get("description_ar")),
    description_en: str(form.get("description_en")),
    material_ar: str(form.get("material_ar")),
    material_en: str(form.get("material_en")),
    printing_ar: str(form.get("printing_ar")),
    printing_en: str(form.get("printing_en")),
    category_id: str(form.get("category_id")),
    base_price: form.get("base_price"),
    compare_at_price: str(form.get("compare_at_price")),
    is_published: bool(form.get("is_published")),
    is_featured: bool(form.get("is_featured")),
    is_new_arrival: bool(form.get("is_new_arrival")),
    is_limited: bool(form.get("is_limited")),
    is_customizable: bool(form.get("is_customizable")),
    tags: str(form.get("tags")).split(",").map((s) => s.trim()).filter(Boolean),
    seo_title_ar: str(form.get("seo_title_ar")),
    seo_title_en: str(form.get("seo_title_en")),
    seo_description_ar: str(form.get("seo_description_ar")),
    seo_description_en: str(form.get("seo_description_en")),
    collection_ids: form.getAll("collection_ids").map(String),
  };
}

function revalidateCatalog(slug?: string) {
  revalidatePath("/[locale]", "layout");
  if (slug) revalidatePath(`/[locale]/product/${slug}`, "page");
}

/** Creates size × colour variants (skipping existing ones) with optional starting stock. */
async function makeVariants(supabase: SB, productId: string, slug: string, sizes: string[], colorIds: string[], stock: number): Promise<{ count: number; error?: ActionState }> {
  if (!sizes.length || !colorIds.length) return { count: 0 };
  const [{ data: colors }, { data: existing }] = await Promise.all([
    supabase.from("colors").select("id, code").in("id", colorIds),
    supabase.from("product_variants").select("size_code, color_id").eq("product_id", productId),
  ]);
  const have = new Set((existing ?? []).map((v) => `${v.size_code}:${v.color_id}`));
  const prefix = skuPrefix(slug);
  const rows = (colors ?? []).flatMap((c) =>
    sizes.filter((s) => SIZE.test(s) && !have.has(`${s}:${c.id}`)).map((s) => ({
      product_id: productId,
      size_code: s,
      color_id: c.id,
      sku: `${prefix}-${String(c.code).slice(0, 3).toUpperCase()}-${s}-${Math.random().toString(36).slice(2, 5).toUpperCase()}`,
    })),
  );
  if (!rows.length) return { count: 0 };
  const { data: created, error } = await supabase.from("product_variants").insert(rows).select("id");
  if (error) return { count: 0, error: dbError(error) };
  await supabase.from("inventory").insert((created ?? []).map((v) => ({ variant_id: v.id, quantity: 0 })));
  if (stock > 0) {
    // stock can only be set through adjust_inventory (audited) — never by direct writes
    for (const v of created ?? []) await supabase.rpc("adjust_inventory", { p_variant_id: v.id, p_change: stock, p_reason: "initial", p_note: "Initial stock" });
  }
  return { count: rows.length };
}

export async function saveProduct(_prev: ActionState, form: FormData): Promise<ActionState> {
  await assertStaff();
  const parsed = productSchema.safeParse(productInput(form));
  if (!parsed.success) return { ok: false, error: "validation", fields: fieldErrors(parsed.error) };
  const { collection_ids, ...row } = parsed.data;
  const supabase = await createClient();
  const id = str(form.get("id"));
  let productId = id;
  if (id) {
    const { data: existing } = await supabase.from("products").select("published_at").eq("id", id).single();
    const { error } = await supabase
      .from("products")
      .update({ ...row, published_at: row.is_published && !existing?.published_at ? new Date().toISOString() : existing?.published_at })
      .eq("id", id);
    if (error) return dbError(error);
  } else {
    const newId = str(form.get("new_id"));
    // A taken slug is resolved automatically (tee -> tee-2 -> tee-3) instead of blocking the save.
    const { data: same } = await supabase.from("products").select("slug").like("slug", `${row.slug}%`);
    row.slug = uniqueSlug(row.slug, new Set((same ?? []).map((x) => x.slug as string)));
    const { data, error } = await supabase
      .from("products")
      .insert({ ...(UUID.test(newId) ? { id: newId } : {}), ...row, published_at: row.is_published ? new Date().toISOString() : null })
      .select("id")
      .single();
    if (error) return dbError(error);
    productId = data.id;
  }
  await supabase.from("product_collections").delete().eq("product_id", productId);
  if (collection_ids.length) {
    const { error } = await supabase.from("product_collections").insert(collection_ids.map((collection_id) => ({ product_id: productId, collection_id })));
    if (error) return dbError(error);
  }

  // printing template + the official artwork placed by the admin (only on create; the edit page has its own printing tab)
  const typeId = str(form.get("product_type_id"));
  if (!id && UUID.test(typeId)) {
    const parse = <T,>(name: string, schema: z.ZodType<T>): T | null => {
      try {
        const r = schema.safeParse(JSON.parse(str(form.get(name)) || "[]"));
        return r.success ? r.data : null;
      } catch {
        return null;
      }
    };
    const designs = parse("designs_json", z.array(designItem).max(20));
    const generated = parse("generated_json", z.array(generatedImage).max(24));
    if (!designs || !generated) return { ok: false, error: "validation", fields: { designs: "invalid" } };
    const disabled = form.getAll("disabled_print_area_ids").map(String).filter((x) => UUID.test(x));
    await supabase.from("products").update({ product_type_id: typeId, print_enabled: str(form.get("print_enabled")) !== "0", disabled_print_area_ids: disabled }).eq("id", productId);
    const res = await writeProductPrinting(supabase, productId, typeId, designs, generated);
    if (!res?.ok) return res;
  }

  let variantCount = 0;
  if (!id) {
    // Quick-create extras: images uploaded beforehand, variants + starting stock
    let images: { url: string; storage_path: string; color_id?: string | null }[] = [];
    try {
      images = JSON.parse(str(form.get("images_json")) || "[]");
    } catch {
      images = [];
    }
    const valid = images.filter((i) => typeof i.url === "string" && /^(https?:\/\/|\/)/.test(i.url) && typeof i.storage_path === "string" && i.storage_path.startsWith(`products/${productId}/`)).slice(0, 12);
    if (valid.length) {
      await supabase.from("product_images").insert(
        valid.map((i, n) => ({ product_id: productId, url: i.url, storage_path: i.storage_path, color_id: i.color_id && UUID.test(i.color_id) ? i.color_id : null, alt_ar: row.name_ar, alt_en: row.name_en, sort_order: n })),
      );
    }
    const sizes = form.getAll("qs_sizes").map(String);
    const colorIds = form.getAll("qs_colors").map(String).filter((c) => UUID.test(c));
    const stock = Math.max(0, Math.min(100000, Math.trunc(Number(form.get("qs_stock")) || 0)));
    const made = await makeVariants(supabase, productId, row.slug, sizes, colorIds, stock);
    if (made.error) return made.error;
    variantCount = made.count;
  }
  await logActivity(id ? "product.updated" : "product.created", "product", productId, { slug: row.slug, published: row.is_published, variants: variantCount });
  revalidateCatalog(row.slug);
  return { ok: true, id: productId, extra: str(form.get("after")) || undefined };
}

async function deleteProductCore(supabase: SB, id: string) {
  const { data: images } = await supabase.from("product_images").select("storage_path").eq("product_id", id);
  const { error } = await supabase.from("products").delete().eq("id", id);
  if (!error) {
    const paths = (images ?? []).map((i) => i.storage_path).filter(Boolean) as string[];
    if (paths.length) await supabase.storage.from("product-images").remove(paths);
    await logActivity("product.deleted", "product", id);
  }
  return error;
}

export async function deleteProduct(form: FormData) {
  await assertStaff();
  const id = str(form.get("id"));
  const locale = str(form.get("locale")) || "ar";
  const supabase = await createClient();
  if (!(await deleteProductCore(supabase, id))) {
    revalidateCatalog();
    redirect(`/${locale}/admin/products`);
  }
}

/** Clones a product (details, collections, images, variants) as an unpublished draft. */
async function cloneProduct(supabase: SB, id: string, copyStock: boolean): Promise<{ ok: true; id: string } | { ok: false; error: string }> {
  const { data: p } = await supabase.from("products").select("*").eq("id", id).maybeSingle();
  if (!p) return { ok: false, error: "not_found" };
  const { data: slugs } = await supabase.from("products").select("slug").like("slug", `${String(p.slug).replace(/-copy(-\d+)?$/, "")}-copy%`);
  const slug = copySlug(p.slug, new Set((slugs ?? []).map((s) => s.slug as string)));
  const { id: _id, created_at: _c, updated_at: _u, published_at: _p, sales_count: _s, ...rest } = p;
  void _id; void _c; void _u; void _p; void _s;
  const { data: created, error } = await supabase
    .from("products")
    .insert({ ...rest, slug, name_ar: `${p.name_ar} (نسخة)`, name_en: `${p.name_en} (copy)`, is_published: false, is_featured: false, sales_count: 0, published_at: null })
    .select("id")
    .single();
  if (error || !created) return { ok: false, error: error?.code === "23505" ? "duplicate" : "generic" };
  const newId = created.id as string;

  const [{ data: cols }, { data: imgs }, { data: variants }] = await Promise.all([
    supabase.from("product_collections").select("collection_id, sort_order").eq("product_id", id),
    supabase.from("product_images").select("*").eq("product_id", id).order("sort_order"),
    supabase.from("product_variants").select("size_code, color_id, price_override, is_active, color:colors(code), inventory(quantity, low_stock_threshold)").eq("product_id", id),
  ]);
  if (cols?.length) await supabase.from("product_collections").insert(cols.map((c) => ({ product_id: newId, collection_id: c.collection_id, sort_order: c.sort_order })));

  // Images: give the copy its own storage files, so deleting one product's photo never breaks the other.
  for (const img of imgs ?? []) {
    let url = img.url as string;
    let storagePath: string | null = null;
    if (img.storage_path) {
      const ext = String(img.storage_path).split(".").pop() ?? "jpg";
      const target = `products/${newId}/${crypto.randomUUID()}.${ext}`;
      const { error: copyErr } = await supabase.storage.from("product-images").copy(img.storage_path, target);
      if (!copyErr) {
        url = supabase.storage.from("product-images").getPublicUrl(target).data.publicUrl;
        storagePath = target;
      }
    }
    await supabase.from("product_images").insert({ product_id: newId, url, storage_path: storagePath, alt_ar: img.alt_ar, alt_en: img.alt_en, color_id: img.color_id, sort_order: img.sort_order, view_id: img.view_id ?? null, is_generated: !!img.is_generated });
  }

  // Official artwork placed on the printing template: own copies of the files, same positions.
  const { data: designs } = await supabase.from("product_designs").select("*").eq("product_id", id).order("sort_order");
  for (const d of designs ?? []) {
    let url = d.artwork_url as string;
    let path: string | null = null;
    if (d.artwork_path) {
      const target = `products/${newId}/art/${crypto.randomUUID()}.${String(d.artwork_path).split(".").pop() ?? "png"}`;
      const { error: copyErr } = await supabase.storage.from("product-images").copy(d.artwork_path, target);
      if (!copyErr) {
        url = supabase.storage.from("product-images").getPublicUrl(target).data.publicUrl;
        path = target;
      }
    }
    await supabase.from("product_designs").insert({ product_id: newId, area_id: d.area_id, artwork_url: url, artwork_path: path, artwork_width: d.artwork_width, artwork_height: d.artwork_height, x: d.x, y: d.y, width: d.width, height: d.height, sort_order: d.sort_order });
  }

  type V = { size_code: string; color_id: string; price_override: number | null; is_active: boolean; color: { code: string } | { code: string }[] | null; inventory: { quantity: number; low_stock_threshold: number } | { quantity: number; low_stock_threshold: number }[] | null };
  const prefix = skuPrefix(slug);
  for (const v of (variants ?? []) as unknown as V[]) {
    const color = Array.isArray(v.color) ? v.color[0] : v.color;
    const inv = Array.isArray(v.inventory) ? v.inventory[0] : v.inventory;
    const { data: nv } = await supabase
      .from("product_variants")
      .insert({ product_id: newId, size_code: v.size_code, color_id: v.color_id, price_override: v.price_override, is_active: v.is_active, sku: `${prefix}-${String(color?.code ?? "X").slice(0, 3).toUpperCase()}-${v.size_code}-${Math.random().toString(36).slice(2, 5).toUpperCase()}` })
      .select("id")
      .single();
    if (!nv) continue;
    await supabase.from("inventory").insert({ variant_id: nv.id, quantity: 0, low_stock_threshold: inv?.low_stock_threshold ?? 5 });
    if (copyStock && (inv?.quantity ?? 0) > 0) await supabase.rpc("adjust_inventory", { p_variant_id: nv.id, p_change: inv!.quantity, p_reason: "initial", p_note: "Copied from duplicate" });
  }
  await logActivity("product.duplicated", "product", newId, { from: id, slug });
  return { ok: true, id: newId };
}

/** Called from buttons (list row / edit page). Returns the new product id so the client can open it. */
export async function duplicateProductAction(id: string, copyStock = false): Promise<{ ok: boolean; id?: string; error?: string }> {
  await assertStaff();
  if (!UUID.test(id)) return { ok: false, error: "validation" };
  const supabase = await createClient();
  const r = await cloneProduct(supabase, id, copyStock);
  revalidateCatalog();
  return r.ok ? { ok: true, id: r.id } : { ok: false, error: r.error };
}

/** Bulk edits from the product list. */
export async function bulkProducts(_prev: ActionState, form: FormData): Promise<ActionState> {
  await assertStaff();
  const ids = form.getAll("ids").map(String).filter((i) => UUID.test(i)).slice(0, 200);
  const op = str(form.get("op"));
  const value = str(form.get("value")).trim();
  if (!ids.length) return { ok: false, error: "validation" };
  const supabase = await createClient();
  let done = 0;
  const patch = async (p: Record<string, unknown>) => {
    const { error, count } = await supabase.from("products").update(p, { count: "exact" }).in("id", ids);
    if (error) return dbError(error);
    done = count ?? ids.length;
    return null;
  };
  let err: ActionState = null;
  switch (op) {
    case "publish": err = await patch({ is_published: true, published_at: new Date().toISOString() }); break;
    case "hide": err = await patch({ is_published: false }); break;
    case "feature": err = await patch({ is_featured: true }); break;
    case "unfeature": err = await patch({ is_featured: false }); break;
    case "new_on": err = await patch({ is_new_arrival: true }); break;
    case "new_off": err = await patch({ is_new_arrival: false }); break;
    case "category": err = await patch({ category_id: UUID.test(value) ? value : null }); break;
    case "collection": {
      if (!UUID.test(value)) return { ok: false, error: "validation" };
      const { error } = await supabase.from("product_collections").upsert(ids.map((product_id) => ({ product_id, collection_id: value })), { onConflict: "product_id,collection_id" });
      if (error) return dbError(error);
      done = ids.length;
      break;
    }
    case "price_set": {
      const n = Math.trunc(Number(value));
      if (!Number.isFinite(n) || n < 0 || n > 100_000_000) return { ok: false, error: "validation" };
      err = await patch({ base_price: n });
      break;
    }
    case "price_percent": {
      const pct = Number(value);
      if (!Number.isFinite(pct) || pct < -90 || pct > 500) return { ok: false, error: "validation" };
      const { data: rows } = await supabase.from("products").select("id, base_price").in("id", ids);
      for (const r of rows ?? []) {
        const next = Math.max(0, Math.round((r.base_price * (1 + pct / 100)) / 250) * 250);
        const { error } = await supabase.from("products").update({ base_price: next }).eq("id", r.id);
        if (error) return dbError(error);
        done++;
      }
      break;
    }
    case "duplicate": {
      for (const id of ids) {
        const r = await cloneProduct(supabase, id, false);
        if (r.ok) done++;
      }
      break;
    }
    case "delete": {
      for (const id of ids) if (!(await deleteProductCore(supabase, id))) done++;
      break;
    }
    default:
      return { ok: false, error: "validation" };
  }
  if (err) return err;
  await logActivity("product.bulk", "product", null, { op, count: done });
  revalidateCatalog();
  return { ok: true, message: `${done}`, extra: op };
}

/** Saves the whole stock matrix at once: only cells that changed are applied (as audited adjustments). */
export async function saveStockGrid(_prev: ActionState, form: FormData): Promise<ActionState> {
  await assertStaff();
  const supabase = await createClient();
  let changed = 0;
  for (const [k, v] of form.entries()) {
    if (!k.startsWith("qty_")) continue;
    const id = k.slice(4);
    if (!UUID.test(id)) continue;
    const next = Number(v);
    const orig = Number(form.get(`orig_${id}`));
    if (!Number.isInteger(next) || next < 0 || next > 100000 || !Number.isInteger(orig)) return { ok: false, error: "validation" };
    const delta = next - orig;
    if (delta === 0) continue;
    const { error } = await supabase.rpc("adjust_inventory", { p_variant_id: id, p_change: delta, p_reason: delta > 0 ? "restock" : "adjustment", p_note: "Stock grid" });
    if (error) return error.code === "23514" ? { ok: false, error: "insufficient_stock" } : dbError(error);
    changed++;
  }
  revalidateCatalog();
  return { ok: true, message: `${changed}` };
}

export async function setMainImage(_prev: ActionState, form: FormData): Promise<ActionState> {
  await assertStaff();
  const supabase = await createClient();
  const id = str(form.get("id"));
  const productId = str(form.get("product_id"));
  const { data: first } = await supabase.from("product_images").select("sort_order").eq("product_id", productId).order("sort_order").limit(1).maybeSingle();
  const { error } = await supabase.from("product_images").update({ sort_order: (first?.sort_order ?? 0) - 1 }).eq("id", id);
  if (error) return dbError(error);
  revalidateCatalog();
  return { ok: true };
}

export async function saveVariant(_prev: ActionState, form: FormData): Promise<ActionState> {
  await assertStaff();
  const parsed = variantSchema.safeParse({
    id: str(form.get("id")) || undefined,
    sku: form.get("sku"),
    size_code: form.get("size_code"),
    color_id: form.get("color_id"),
    price_override: str(form.get("price_override")),
    is_active: bool(form.get("is_active")),
    low_stock_threshold: form.get("low_stock_threshold") ?? 5,
  });
  if (!parsed.success) return { ok: false, error: "validation", fields: fieldErrors(parsed.error) };
  const productId = str(form.get("product_id"));
  const { id, low_stock_threshold, ...row } = parsed.data;
  const supabase = await createClient();
  let variantId = id;
  if (id) {
    const { error } = await supabase.from("product_variants").update(row).eq("id", id);
    if (error) return dbError(error);
  } else {
    const { data, error } = await supabase.from("product_variants").insert({ ...row, product_id: productId }).select("id").single();
    if (error) return dbError(error);
    variantId = data.id;
    await supabase.from("inventory").insert({ variant_id: variantId, quantity: 0, low_stock_threshold });
  }
  await supabase.from("inventory").update({ low_stock_threshold }).eq("variant_id", variantId!);
  await logActivity(id ? "variant.updated" : "variant.created", "variant", variantId!, { sku: row.sku });
  revalidateCatalog();
  return { ok: true };
}

/** Creates every missing size × colour combination for a product (optionally with starting stock). */
export async function generateVariants(_prev: ActionState, form: FormData): Promise<ActionState> {
  await assertStaff();
  const productId = str(form.get("product_id"));
  const sizes = form.getAll("sizes").map(String).filter((s) => SIZE.test(s));
  const colorIds = form.getAll("color_ids").map(String).filter((c) => UUID.test(c));
  if (!sizes.length || !colorIds.length) return { ok: false, error: "validation" };
  const supabase = await createClient();
  const { data: product } = await supabase.from("products").select("slug").eq("id", productId).single();
  if (!product) return { ok: false, error: "generic" };
  const stock = Math.max(0, Math.min(100000, Math.trunc(Number(form.get("stock")) || 0)));
  const made = await makeVariants(supabase, productId, product.slug, sizes, colorIds, stock);
  if (made.error) return made.error;
  await logActivity("variant.generated", "product", productId, { count: made.count });
  revalidateCatalog();
  return { ok: true, message: made.count ? `+${made.count}` : undefined };
}

export async function deleteVariant(_prev: ActionState, form: FormData): Promise<ActionState> {
  await assertStaff();
  const supabase = await createClient();
  const id = str(form.get("id"));
  const { error } = await supabase.from("product_variants").delete().eq("id", id);
  if (error) {
    // Variant has order history: deactivate instead of deleting.
    const { error: e2 } = await supabase.from("product_variants").update({ is_active: false }).eq("id", id);
    if (e2) return dbError(e2);
  }
  await logActivity("variant.deleted", "variant", id);
  revalidateCatalog();
  return { ok: true };
}

export async function addProductImage(input: { product_id: string; url: string; storage_path: string; color_id?: string | null }): Promise<ActionState> {
  await assertStaff();
  if (!UUID.test(input.product_id) || !input.storage_path.startsWith(`products/${input.product_id}/`)) return { ok: false, error: "validation" };
  const supabase = await createClient();
  const { count } = await supabase.from("product_images").select("id", { count: "exact", head: true }).eq("product_id", input.product_id);
  const { error } = await supabase.from("product_images").insert({ product_id: input.product_id, url: input.url, storage_path: input.storage_path, color_id: input.color_id || null, sort_order: count ?? 0 });
  if (error) return dbError(error);
  revalidateCatalog();
  return { ok: true };
}

export async function updateProductImage(_prev: ActionState, form: FormData): Promise<ActionState> {
  await assertStaff();
  const supabase = await createClient();
  const { error } = await supabase
    .from("product_images")
    .update({ color_id: str(form.get("color_id")) || null, sort_order: Number(form.get("sort_order")) || 0, alt_ar: str(form.get("alt_ar")) || null, alt_en: str(form.get("alt_en")) || null })
    .eq("id", str(form.get("id")));
  if (error) return dbError(error);
  revalidateCatalog();
  return { ok: true };
}

export async function deleteProductImage(_prev: ActionState, form: FormData): Promise<ActionState> {
  await assertStaff();
  const supabase = await createClient();
  const id = str(form.get("id"));
  const { data } = await supabase.from("product_images").select("storage_path").eq("id", id).single();
  const { error } = await supabase.from("product_images").delete().eq("id", id);
  if (error) return dbError(error);
  if (data?.storage_path) await supabase.storage.from("product-images").remove([data.storage_path]);
  revalidateCatalog();
  return { ok: true };
}

/** Removes an image that was uploaded in the quick-create form but not saved yet. */
export async function discardUploadedImage(path: string): Promise<void> {
  await assertStaff();
  if (!/^products\/[0-9a-f-]{36}\/[0-9a-f-]{36}\.(jpg|png|webp|avif)$/.test(path)) return;
  const supabase = await createClient();
  const { data } = await supabase.from("product_images").select("id").eq("storage_path", path).maybeSingle();
  if (!data) await supabase.storage.from("product-images").remove([path]);
}

/* ------------------------------ CSV import ------------------------------ */

const HEADER_ALIASES: Record<string, string> = {
  "الاسم": "name_ar", "الاسم بالعربي": "name_ar", "الاسم بالانكليزي": "name_en", "السعر": "price", "الفئة": "category", "المقاسات": "sizes", "الألوان": "colors", "الالوان": "colors", "الكمية": "stock", "المخزون": "stock", "منشور": "published", "الوصف": "description_ar",
  name: "name_en", title: "name_en", category_slug: "category", size: "sizes", color: "colors", qty: "stock", quantity: "stock", visible: "published", price_iqd: "price", compare_price: "compare_at_price",
};

export interface ImportLine { row: number; name: string; status: "created" | "error"; message: string }

/** Creates many products at once from CSV text (paste or file). Each row reports its own result. */
export async function importProducts(_prev: ActionState, form: FormData): Promise<ActionState> {
  await assertStaff();
  const file = form.get("file");
  let text = str(form.get("csv"));
  if (!text && file instanceof File && file.size > 0) {
    if (file.size > 2_000_000) return { ok: false, error: "validation" };
    text = await file.text();
  }
  const rows = parseCsv(text);
  if (rows.length < 2) return { ok: false, error: "validation" };
  if (rows.length > 201) return { ok: false, error: "too_many_rows" };
  const header = rows[0]!.map((h) => { const k = h.toLowerCase().trim().replace(/\s+/g, "_"); return HEADER_ALIASES[h.trim()] ?? HEADER_ALIASES[k] ?? k; });
  const col = (r: string[], name: string) => { const i = header.indexOf(name); return i < 0 ? "" : (r[i] ?? "").trim(); };
  if (!header.includes("price") || (!header.includes("name_ar") && !header.includes("name_en"))) return { ok: false, error: "missing_columns" };

  const supabase = await createClient();
  const [{ data: cats }, { data: colors }, { data: sizes }, { data: slugRows }] = await Promise.all([
    supabase.from("categories").select("id, slug, name_ar, name_en"),
    supabase.from("colors").select("id, code, name_ar, name_en"),
    supabase.from("sizes").select("code"),
    supabase.from("products").select("slug"),
  ]);
  const taken = new Set((slugRows ?? []).map((s) => s.slug as string));
  const sizeSet = new Set((sizes ?? []).map((s) => s.code as string));
  const findCat = (v: string) => { const t = v.toLowerCase(); return (cats ?? []).find((c) => c.slug === t || c.name_ar === v || String(c.name_en).toLowerCase() === t); };
  const findColor = (v: string) => { const t = v.toLowerCase(); return (colors ?? []).find((c) => c.code === t || c.name_ar === v || String(c.name_en).toLowerCase() === t); };
  const split = (v: string) => v.split(/[|;,/\n]+/).map((x) => x.trim()).filter(Boolean);
  const yes = (v: string) => /^(1|yes|y|true|نعم|منشور|ظاهر)$/i.test(v.trim());

  const report: ImportLine[] = [];
  for (let i = 1; i < rows.length; i++) {
    const r = rows[i]!;
    const nameAr = col(r, "name_ar") || col(r, "name_en");
    const nameEn = col(r, "name_en") || col(r, "name_ar");
    const label = nameAr || `#${i}`;
    const fail = (message: string) => report.push({ row: i + 1, name: label, status: "error", message });
    if (!nameAr) { fail("name"); continue; }
    const price = Math.trunc(Number(col(r, "price").replace(/[,\s]/g, "")));
    if (!Number.isFinite(price) || price < 0) { fail("price"); continue; }
    const catRaw = col(r, "category");
    const cat = catRaw ? findCat(catRaw) : undefined;
    if (catRaw && !cat) { fail(`category: ${catRaw}`); continue; }
    const colorList = split(col(r, "colors"));
    const colorIds: string[] = [];
    let bad = "";
    for (const c of colorList) { const f = findColor(c); if (!f) { bad = `color: ${c}`; break; } colorIds.push(f.id as string); }
    if (bad) { fail(bad); continue; }
    const sizeList = split(col(r, "sizes")).map((s) => s.toUpperCase());
    const unknownSize = sizeList.find((s) => !sizeSet.has(s));
    if (unknownSize) { fail(`size: ${unknownSize}`); continue; }
    const slug = uniqueSlug(slugify(col(r, "slug")) || slugify(nameEn) || `product-${Math.random().toString(36).slice(2, 7)}`, taken);
    const compare = Math.trunc(Number(col(r, "compare_at_price").replace(/[,\s]/g, "")));
    const published = yes(col(r, "published"));
    const { data: created, error } = await supabase
      .from("products")
      .insert({
        slug, name_ar: nameAr.slice(0, 200), name_en: nameEn.slice(0, 200),
        description_ar: col(r, "description_ar") || null, description_en: col(r, "description_en") || null,
        category_id: cat?.id ?? null, base_price: price, compare_at_price: Number.isFinite(compare) && compare > price ? compare : null,
        is_published: published, published_at: published ? new Date().toISOString() : null,
      })
      .select("id")
      .single();
    if (error || !created) { fail(error?.code === "23505" ? "duplicate" : "db"); continue; }
    taken.add(slug);
    const stock = Math.max(0, Math.min(100000, Math.trunc(Number(col(r, "stock")) || 0)));
    const made = await makeVariants(supabase, created.id as string, slug, sizeList, colorIds, stock);
    if (made.error) { report.push({ row: i + 1, name: label, status: "created", message: "variants_failed" }); continue; }
    report.push({ row: i + 1, name: label, status: "created", message: made.count ? `${made.count}` : "" });
  }
  const created = report.filter((l) => l.status === "created").length;
  await logActivity("product.imported", "product", null, { created, errors: report.length - created });
  revalidateCatalog();
  return { ok: true, message: `${created}`, extra: JSON.stringify(report) };
}
