import "server-only";
import { z } from "zod";
import type { createClient } from "@/lib/supabase/server";
import { dbError, type ActionState } from "@/lib/actions/admin/common";

type SB = Awaited<ReturnType<typeof createClient>>;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const frac = z.number().finite().min(0).max(1);
const url = z.string().max(1000).refine((u) => /^https?:\/\//.test(u) || u.startsWith("/"), "url");
const storagePath = z.string().max(300).regex(/^(mockups|products)\/[0-9a-zA-Z/_.-]+$/).nullable().optional();

export const designItem = z.object({
  id: z.string().regex(UUID).optional(),
  area_id: z.string().regex(UUID),
  artwork_url: url,
  artwork_path: storagePath,
  artwork_width: z.number().int().positive().max(40000).nullable().optional(),
  artwork_height: z.number().int().positive().max(40000).nullable().optional(),
  x: frac, y: frac,
  width: z.number().finite().gt(0).max(1),
  height: z.number().finite().gt(0).max(1),
}).refine((d) => d.x + d.width <= 1.0001 && d.y + d.height <= 1.0001, { message: "outside", path: ["x"] });
export const generatedImage = z.object({
  url,
  storage_path: z.string().max(300),
  color_id: z.string().regex(UUID).nullable().optional(),
  view_id: z.string().regex(UUID),
});

/**
 * Replaces a product's official artwork and the photos generated from it.
 * Designs are matched by id (updated in place), new ones inserted, removed ones deleted.
 * Every area must belong to the product's type, so artwork can only sit inside real printable areas.
 */
export async function writeProductPrinting(supabase: SB, productId: string, typeId: string | null, designs: z.infer<typeof designItem>[], images: z.infer<typeof generatedImage>[] | null): Promise<ActionState> {
  if (typeId && designs.length) {
    const { data: areas } = await supabase.from("product_print_areas").select("id, product_type_views!inner(product_type_id)").in("id", designs.map((d) => d.area_id));
    const valid = new Set((areas ?? []).filter((a) => {
      const v = a.product_type_views as unknown as { product_type_id: string } | { product_type_id: string }[];
      return (Array.isArray(v) ? v[0]?.product_type_id : v?.product_type_id) === typeId;
    }).map((a) => a.id as string));
    if (designs.some((d) => !valid.has(d.area_id))) return { ok: false, error: "validation", fields: { designs: "area" } };
  } else if (!typeId && designs.length) return { ok: false, error: "validation", fields: { designs: "type" } };
  if (designs.some((d) => d.artwork_path && !d.artwork_path.startsWith(`products/${productId}/`))) return { ok: false, error: "validation", fields: { designs: "path" } };

  const { data: existing } = await supabase.from("product_designs").select("id, artwork_path").eq("product_id", productId);
  const keep = new Set(designs.map((d) => d.id).filter(Boolean) as string[]);
  const removed = (existing ?? []).filter((e) => !keep.has(e.id as string));
  if (removed.length) await supabase.from("product_designs").delete().in("id", removed.map((r) => r.id as string));
  const r5 = (n: number) => Math.round(n * 100000) / 100000;
  for (const [i, d] of designs.entries()) {
    const row = { area_id: d.area_id, artwork_url: d.artwork_url, artwork_path: d.artwork_path ?? null, artwork_width: d.artwork_width ?? null, artwork_height: d.artwork_height ?? null, x: r5(d.x), y: r5(d.y), width: r5(Math.min(d.width, 1 - d.x)), height: r5(Math.min(d.height, 1 - d.y)), sort_order: i };
    const known = d.id && (existing ?? []).some((e) => e.id === d.id);
    const { error } = known ? await supabase.from("product_designs").update(row).eq("id", d.id!).eq("product_id", productId) : await supabase.from("product_designs").insert({ ...row, product_id: productId });
    if (error) return dbError(error);
  }
  const stillUsed = new Set(designs.map((d) => d.artwork_path).filter(Boolean));
  const orphanArt = removed.map((r) => r.artwork_path as string | null).filter((p): p is string => !!p && !stillUsed.has(p));

  if (images) {
    const valid = images.filter((im) => im.storage_path.startsWith(`products/${productId}/`)).slice(0, 24);
    const { data: oldGen } = await supabase.from("product_images").select("id, storage_path").eq("product_id", productId).eq("is_generated", true);
    if ((oldGen ?? []).length) await supabase.from("product_images").delete().in("id", (oldGen ?? []).map((g) => g.id as string));
    const { data: product } = await supabase.from("products").select("name_ar, name_en").eq("id", productId).single();
    if (valid.length) {
      const { error } = await supabase.from("product_images").insert(valid.map((im, i) => ({ product_id: productId, url: im.url, storage_path: im.storage_path, color_id: im.color_id ?? null, view_id: im.view_id, is_generated: true, alt_ar: product?.name_ar, alt_en: product?.name_en, sort_order: -100 + i })));
      if (error) return dbError(error);
    }
    const oldPaths = (oldGen ?? []).map((g) => g.storage_path as string | null).filter((p): p is string => !!p && !valid.some((v) => v.storage_path === p));
    orphanArt.push(...oldPaths);
  }
  if (orphanArt.length) await supabase.storage.from("product-images").remove(orphanArt);
  return { ok: true };
}

