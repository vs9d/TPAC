"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { assertStaff } from "@/lib/auth";
import { fieldErrors } from "@/lib/validation";
import { bool, str, dbError, logActivity, type ActionState } from "./common";

const CATEGORIES = ["university", "college", "company", "organization", "custom"] as const;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const opt = (max: number) => z.string().trim().max(max).optional().transform((v) => (v ? v : null));
/** images live in the public product-images bucket under portfolio/ (staff-only uploads) or ship with the site (/clients/…) */
const imageUrl = z.string().trim().max(1000).refine((u) => u.startsWith("/") || /^https:\/\//.test(u) || /^http:\/\/(localhost|127\.0\.0\.1)/.test(u), "url");
const photo = z.object({ url: imageUrl, path: z.string().regex(/^portfolio\/[0-9a-zA-Z/_.-]+$/).nullable().optional() });

const refresh = () => {
  revalidatePath("/[locale]/portfolio", "layout");
  revalidatePath("/[locale]/bulk", "page");
  revalidatePath("/[locale]/admin/portfolio", "page");
};

const clientSchema = z.object({
  id: z.string().regex(UUID).optional(),
  name_ar: z.string().trim().min(1, "required").max(120, "max"),
  name_en: opt(120),
  category: z.enum(CATEGORIES),
  logo_url: z.union([imageUrl, z.literal("")]).transform((v) => v || null),
  sort_order: z.coerce.number().int().min(-1000).max(100000),
  is_active: z.boolean(),
});

export async function savePortfolioClient(_prev: ActionState, form: FormData): Promise<ActionState> {
  await assertStaff();
  const p = clientSchema.safeParse({
    id: str(form.get("id")) || undefined, name_ar: form.get("name_ar"), name_en: str(form.get("name_en")), category: form.get("category"),
    logo_url: str(form.get("logo_url")), sort_order: form.get("sort_order") || 0, is_active: bool(form.get("is_active")),
  });
  if (!p.success) return { ok: false, error: "validation", fields: fieldErrors(p.error) };
  const { id, ...row } = p.data;
  const logo_path = row.logo_url?.includes("/product-images/portfolio/") ? decodeURIComponent(row.logo_url.split("/product-images/")[1]!) : null;
  const supabase = await createClient();
  const { error } = id ? await supabase.from("portfolio_clients").update({ ...row, logo_path }).eq("id", id) : await supabase.from("portfolio_clients").insert({ ...row, logo_path });
  if (error) return dbError(error);
  await logActivity(id ? "portfolio.client_updated" : "portfolio.client_created", "portfolio_client", id ?? null, { name: row.name_ar });
  refresh();
  return { ok: true };
}

export async function deletePortfolioClient(_prev: ActionState, form: FormData): Promise<ActionState> {
  await assertStaff();
  const id = str(form.get("id"));
  if (!UUID.test(id)) return { ok: false, error: "validation" };
  const supabase = await createClient();
  const { data: row } = await supabase.from("portfolio_clients").select("logo_path").eq("id", id).maybeSingle();
  const { error } = await supabase.from("portfolio_clients").delete().eq("id", id);
  if (error) return dbError(error);
  if (row?.logo_path) await supabase.storage.from("product-images").remove([row.logo_path]);
  await logActivity("portfolio.client_deleted", "portfolio_client", id);
  refresh();
  return { ok: true };
}

const projectSchema = z.object({
  id: z.string().regex(UUID).optional(),
  client_id: z.union([z.string().regex(UUID), z.literal("")]).transform((v) => v || null),
  title_ar: z.string().trim().min(1, "required").max(160, "max"),
  title_en: opt(160),
  description_ar: opt(2000),
  description_en: opt(2000),
  category: z.enum(CATEGORIES),
  photos: z.array(photo).max(24),
  completed_on: z.union([z.string().regex(/^\d{4}-\d{2}-\d{2}$/), z.literal("")]).transform((v) => v || null),
  is_featured: z.boolean(),
  is_active: z.boolean(),
  sort_order: z.coerce.number().int().min(-1000).max(100000),
});

export async function savePortfolioProject(_prev: ActionState, form: FormData): Promise<ActionState> {
  await assertStaff();
  let photos: unknown = [];
  try { photos = JSON.parse(str(form.get("photos_json")) || "[]"); } catch { return { ok: false, error: "validation" }; }
  const p = projectSchema.safeParse({
    id: str(form.get("id")) || undefined, client_id: str(form.get("client_id")), title_ar: form.get("title_ar"), title_en: str(form.get("title_en")),
    description_ar: str(form.get("description_ar")), description_en: str(form.get("description_en")), category: form.get("category"), photos,
    completed_on: str(form.get("completed_on")), is_featured: bool(form.get("is_featured")), is_active: bool(form.get("is_active")), sort_order: form.get("sort_order") || 0,
  });
  if (!p.success) return { ok: false, error: "validation", fields: fieldErrors(p.error) };
  const { id, ...row } = p.data;
  const supabase = await createClient();
  let removed: string[] = [];
  if (id) {
    const { data: old } = await supabase.from("portfolio_projects").select("photos").eq("id", id).maybeSingle();
    const keep = new Set(row.photos.map((x) => x.path).filter(Boolean));
    removed = ((old?.photos ?? []) as { path?: string | null }[]).map((x) => x.path).filter((x): x is string => !!x && !keep.has(x));
  }
  const { data, error } = id
    ? await supabase.from("portfolio_projects").update(row).eq("id", id).select("id").single()
    : await supabase.from("portfolio_projects").insert(row).select("id").single();
  if (error) return dbError(error);
  if (removed.length) await supabase.storage.from("product-images").remove(removed);
  await logActivity(id ? "portfolio.project_updated" : "portfolio.project_created", "portfolio_project", data.id, { title: row.title_ar, photos: row.photos.length });
  refresh();
  return { ok: true, id: data.id };
}

export async function deletePortfolioProject(_prev: ActionState, form: FormData): Promise<ActionState> {
  await assertStaff();
  const id = str(form.get("id"));
  if (!UUID.test(id)) return { ok: false, error: "validation" };
  const supabase = await createClient();
  const { data: row } = await supabase.from("portfolio_projects").select("photos").eq("id", id).maybeSingle();
  const { error } = await supabase.from("portfolio_projects").delete().eq("id", id);
  if (error) return dbError(error);
  const paths = ((row?.photos ?? []) as { path?: string | null }[]).map((x) => x.path).filter((x): x is string => !!x);
  if (paths.length) await supabase.storage.from("product-images").remove(paths);
  await logActivity("portfolio.project_deleted", "portfolio_project", id);
  refresh();
  return { ok: true };
}

/** Moves an item one place up or down (swaps sort_order with its neighbour). */
export async function movePortfolioItem(_prev: ActionState, form: FormData): Promise<ActionState> {
  await assertStaff();
  const table = str(form.get("table")) === "clients" ? "portfolio_clients" : "portfolio_projects";
  const id = str(form.get("id"));
  const dir = str(form.get("dir")) === "up" ? -1 : 1;
  const supabase = await createClient();
  const { data: rows } = await supabase.from(table).select("id, sort_order").order("sort_order").order("created_at");
  const list = (rows ?? []) as { id: string; sort_order: number }[];
  const i = list.findIndex((r) => r.id === id);
  const j = i + dir;
  if (i < 0 || j < 0 || j >= list.length) return { ok: true };
  // renumber so neighbours always differ, then swap
  const order = list.map((r) => r.id);
  [order[i], order[j]] = [order[j]!, order[i]!];
  for (const [k, rid] of order.entries()) if (list.find((r) => r.id === rid)!.sort_order !== k + 1) await supabase.from(table).update({ sort_order: k + 1 }).eq("id", rid);
  refresh();
  return { ok: true };
}
