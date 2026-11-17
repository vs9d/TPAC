"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { assertStaff } from "@/lib/auth";
import { productSchema, variantSchema, fieldErrors } from "@/lib/validation";
import { bool, str, dbError, logActivity, type ActionState } from "./common";

function productInput(form: FormData) {
  return {
    slug: form.get("slug"),
    name_ar: form.get("name_ar"),
    name_en: form.get("name_en"),
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
    const { data, error } = await supabase.from("products").insert({ ...row, published_at: row.is_published ? new Date().toISOString() : null }).select("id").single();
    if (error) return dbError(error);
    productId = data.id;
  }
  await supabase.from("product_collections").delete().eq("product_id", productId);
  if (collection_ids.length) {
    const { error } = await supabase.from("product_collections").insert(collection_ids.map((collection_id) => ({ product_id: productId, collection_id })));
    if (error) return dbError(error);
  }
  await logActivity(id ? "product.updated" : "product.created", "product", productId, { slug: row.slug, published: row.is_published });
  revalidateCatalog(row.slug);
  return { ok: true, id: productId };
}

export async function deleteProduct(form: FormData) {
  await assertStaff();
  const id = str(form.get("id"));
  const locale = str(form.get("locale")) || "ar";
  const supabase = await createClient();
  const { data: images } = await supabase.from("product_images").select("storage_path").eq("product_id", id);
  const { error } = await supabase.from("products").delete().eq("id", id);
  if (!error) {
    const paths = (images ?? []).map((i) => i.storage_path).filter(Boolean) as string[];
    if (paths.length) await supabase.storage.from("product-images").remove(paths);
    await logActivity("product.deleted", "product", id);
    revalidateCatalog();
    redirect(`/${locale}/admin/products`);
  }
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

/** Creates every missing size × colour combination for a product. */
export async function generateVariants(_prev: ActionState, form: FormData): Promise<ActionState> {
  await assertStaff();
  const productId = str(form.get("product_id"));
  const sizes = form.getAll("sizes").map(String).filter((s) => /^[A-Z0-9]{1,6}$/.test(s));
  const colorIds = form.getAll("color_ids").map(String);
  if (!sizes.length || !colorIds.length) return { ok: false, error: "validation" };
  const supabase = await createClient();
  const [{ data: product }, { data: colors }, { data: existing }] = await Promise.all([
    supabase.from("products").select("slug").eq("id", productId).single(),
    supabase.from("colors").select("id, code").in("id", colorIds),
    supabase.from("product_variants").select("size_code, color_id").eq("product_id", productId),
  ]);
  if (!product) return { ok: false, error: "generic" };
  const have = new Set((existing ?? []).map((v) => `${v.size_code}:${v.color_id}`));
  const prefix = `TP-${product.slug.split("-").map((w: string) => w[0]).join("").toUpperCase()}`;
  const rows = (colors ?? []).flatMap((c) =>
    sizes.filter((s) => !have.has(`${s}:${c.id}`)).map((s) => ({ product_id: productId, size_code: s, color_id: c.id, sku: `${prefix}-${c.code.slice(0, 3).toUpperCase()}-${s}-${Math.random().toString(36).slice(2, 5).toUpperCase()}` })),
  );
  if (!rows.length) return { ok: true };
  const { data: created, error } = await supabase.from("product_variants").insert(rows).select("id");
  if (error) return dbError(error);
  await supabase.from("inventory").insert((created ?? []).map((v) => ({ variant_id: v.id, quantity: 0 })));
  await logActivity("variant.generated", "product", productId, { count: rows.length });
  revalidateCatalog();
  return { ok: true, message: `+${rows.length}` };
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
  if (!/^[0-9a-f-]{36}$/.test(input.product_id) || !input.storage_path.startsWith(`products/${input.product_id}/`)) return { ok: false, error: "validation" };
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
