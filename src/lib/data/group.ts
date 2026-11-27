import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { isSupabaseConfigured } from "@/lib/env";
import { getColors } from "@/lib/data/catalog";
import { normType, type ProductTypeRow } from "@/lib/print-config";
import { podAreas, podTemplate } from "@/lib/pod-templates";
import { GROUP_PLACEMENTS, parseTemplate, type GroupTemplate, type PreviewKit } from "@/lib/group-template";
import type { GarmentType } from "@/lib/garments";

export interface GroupProduct { name_ar: string; name_en: string; slug: string; image: string | null; sizes: string[] }
export interface GroupMember { id: string; name: string; size_code: string; quantity: number; print_name: string | null; note: string | null; created_at: string; artwork_id: string | null }
export interface GroupOrder {
  id: string; code: string; title: string; organizer_name: string; organizer_phone: string; product_type: string;
  idea: string | null; allow_names: boolean; deadline: string | null; status: "open" | "closed" | "submitted";
  product: GroupProduct | null; closed: boolean;
  garment: string | null; color_id: string | null; template: GroupTemplate;
}

/**
 * The garments the organiser can choose, each with its colours, photos and print areas
 * (the same photos and areas the studio uses).
 */
export async function getPreviewKits(): Promise<PreviewKit[]> {
  if (!isSupabaseConfigured()) return [];
  const db = createAdminClient();
  const [{ data: garments }, colors] = await Promise.all([
    db.from("custom_garment_types").select("code, color_ids, sort_order").eq("is_active", true).in("code", ["hoodie", "tshirt", "sweatshirt", "oversized"]).order("sort_order"),
    getColors(),
  ]);
  const list = (garments ?? []) as { code: string; color_ids: string[] }[];
  if (!list.length) return [];
  const { data: types } = await db.from("product_types").select("*, product_type_views(*, product_print_areas(*))").in("code", list.map((g) => g.code));
  const tpl = new Map(((types as ProductTypeRow[]) ?? []).map((t) => [t.code, podTemplate(normType(t))]));
  return list.map((g) => {
    const t = tpl.get(g.code) ?? null;
    const areas = podAreas(t, g.code as GarmentType);
    const views: PreviewKit["views"] = {};
    for (const v of ["front", "back"] as const) {
      const tv = t?.views[v];
      if (tv) views[v] = { mockup_url: tv.mockup_url, color_mockups: Object.fromEntries(Object.entries(tv.color_mockups).map(([k, x]) => [k, x.url])), width: tv.width, height: tv.height };
    }
    const photographed = Object.keys(views.front?.color_mockups ?? {});
    const own = colors.filter((c) => g.color_ids.includes(c.id));
    const shown = photographed.length ? own.filter((c) => photographed.includes(c.id)) : own;
    return {
      garment: g.code,
      colors: (shown.length ? shown : own).map((c) => ({ id: c.id, name_ar: c.name_ar, name_en: c.name_en, hex: c.hex })),
      views,
      areas: Object.fromEntries(GROUP_PLACEMENTS.map((p) => [p, { x: areas[p].x, y: areas[p].y, width: areas[p].width, height: areas[p].height }])) as PreviewKit["areas"],
    };
  });
}

async function product(id: string | null): Promise<GroupProduct | null> {
  if (!id) return null;
  const { data } = await createAdminClient()
    .from("products")
    .select("name_ar, name_en, slug, product_images(url, sort_order), product_variants(size_code)")
    .eq("id", id).maybeSingle();
  if (!data) return null;
  const imgs = ((data.product_images ?? []) as { url: string; sort_order: number }[]).sort((a, b) => a.sort_order - b.sort_order);
  const sizes = [...new Set(((data.product_variants ?? []) as { size_code: string }[]).map((v) => v.size_code))];
  return { name_ar: data.name_ar, name_en: data.name_en, slug: data.slug, image: imgs[0]?.url ?? null, sizes };
}

function shape(g: Record<string, unknown>, p: GroupProduct | null): GroupOrder {
  const deadline = (g.deadline as string | null) ?? null;
  const late = !!deadline && new Date(`${deadline}T23:59:59`) < new Date();
  return {
    id: g.id as string, code: g.code as string, title: g.title as string, organizer_name: g.organizer_name as string,
    organizer_phone: g.organizer_phone as string, product_type: g.product_type as string, idea: (g.idea as string | null) ?? null,
    allow_names: !!g.allow_names, deadline, status: g.status as GroupOrder["status"], product: p, closed: g.status !== "open" || late,
    garment: (g.garment as string | null) ?? null, color_id: (g.color_id as string | null) ?? null, template: parseTemplate(g.template),
  };
}

/** What a member sees through the group link: the group, and only how many have joined (no one's details). */
export async function getGroupByCode(code: string): Promise<{ group: GroupOrder; count: number } | null> {
  if (!isSupabaseConfigured() || !/^[a-z0-9]{6,16}$/.test(code)) return null;
  const db = createAdminClient();
  const { data } = await db.from("group_orders").select("*").eq("code", code).maybeSingle();
  if (!data) return null;
  const { data: m } = await db.from("group_order_members").select("quantity").eq("group_id", data.id);
  const count = ((m ?? []) as { quantity: number }[]).reduce((n, x) => n + x.quantity, 0);
  return { group: shape(data, await product(data.product_id as string | null)), count };
}

/** The organiser's view: everything, through their own token. */
export async function getGroupByToken(token: string): Promise<{ group: GroupOrder; members: GroupMember[]; request_number: string | null } | null> {
  if (!isSupabaseConfigured() || !/^[A-Za-z0-9_-]{20,64}$/.test(token)) return null;
  const db = createAdminClient();
  const { data } = await db.from("group_orders").select("*").eq("admin_token", token).maybeSingle();
  if (!data) return null;
  const [{ data: members }, req] = await Promise.all([
    db.from("group_order_members").select("id, name, size_code, quantity, print_name, note, created_at, artwork_id").eq("group_id", data.id).order("created_at"),
    data.bulk_request_id ? db.from("bulk_order_requests").select("request_number").eq("id", data.bulk_request_id).maybeSingle() : Promise.resolve({ data: null }),
  ]);
  return { group: shape(data, await product(data.product_id as string | null)), members: (members ?? []) as GroupMember[], request_number: (req.data?.request_number as string | undefined) ?? null };
}
