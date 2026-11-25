import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { signedUrls } from "@/lib/storage";
import { GARMENTS, type GarmentType, type PrintLocation } from "@/lib/garments";
import { shapeById } from "@/lib/design-assets";

export interface DesignObjectCfg {
  type: "image" | "text" | "shape";
  location: PrintLocation;
  width: number; height: number; scaleX: number; scaleY: number; angle?: number;
  artwork_id?: string; shape_id?: string; filters?: { grayscale?: boolean; invert?: boolean };
  text?: string; fill?: string | null; stroke?: string | null; strokeWidth?: number;
  fontFamily?: string; fontLabel?: string; fontSize?: number; fontWeight?: string | number; fontStyle?: string; underline?: boolean; charSpacing?: number;
  opacity?: number;
}
export interface DesignRow {
  id: string; batch_id: string | null; name: string | null; user_id: string | null;
  garment_type: string; color_id: string; size_code: string; print_locations: string[];
  config: { version?: number; objects?: DesignObjectCfg[]; sizes?: Record<string, number>; options?: Record<string, unknown>; areas?: Record<string, { x: number; y: number; width: number; height: number; cm: { width: number; height: number } }>; previews?: { right?: string; left?: string; hood?: string }; reference?: DesignReferenceCfg };
  options: { method?: string; finish?: string; fabric?: string; package?: string; addons?: string[] } | null;
  options_price: number; preview_front_path: string | null; preview_back_path: string | null;
  unit_price: number; notes: string | null; created_at: string;
}
/** "Make it like this photo": the customer's photos, what they wrote, and where it should be printed. */
export interface DesignReferenceCfg { artwork_ids: string[]; note: string | null; locations: string[] }
export interface ArtworkRow { id: string; storage_path: string; mime_type: string; original_name: string | null; width: number | null; height: number | null }
export interface DesignGroup { key: string; rows: DesignRow[]; primary: DesignRow }

/** One group per saved design: the rows of a batch (one per size) share the same artwork and previews. */
export function groupDesigns(rows: DesignRow[]): DesignGroup[] {
  const map = new Map<string, DesignRow[]>();
  for (const r of rows) {
    const k = r.batch_id ?? r.id;
    map.set(k, [...(map.get(k) ?? []), r]);
  }
  return [...map.entries()].map(([key, rs]) => ({ key, rows: rs, primary: rs[0]! }));
}

export type SB = SupabaseClient;

/** Option code → localized-name lookup (inactive options included, so old designs still read well). */
export async function optionNames(supabase: SB): Promise<Map<string, { ar: string; en: string }>> {
  const { data } = await supabase.from("designer_options").select("group_code, code, name_ar, name_en");
  // keyed "group:code" — the same code (e.g. "standard") can exist in several groups
  return new Map((data ?? []).map((o) => [`${o.group_code}:${o.code}`, { ar: o.name_ar as string, en: o.name_en as string }]));
}

export function optionList(d: Pick<DesignRow, "options">, names: Map<string, { ar: string; en: string }>, locale: "ar" | "en"): string[] {
  const o = d.options ?? {};
  const keyed: [string, string | undefined][] = [["method", o.method], ["finish", o.finish], ["fabric", o.fabric], ["package", o.package], ...(o.addons ?? []).map((a): [string, string] => ["addon", a])];
  return keyed.filter(([, c]) => c).map(([g, c]) => names.get(`${g}:${c}`)?.[locale] ?? String(c));
}

export async function loadArtwork(supabase: SB, rows: DesignRow[]): Promise<{ art: Map<string, ArtworkRow>; urls: Record<string, string> }> {
  const ids = [...new Set(rows.flatMap((r) => [...((r.config.objects ?? []).map((o) => o.artwork_id).filter(Boolean) as string[]), ...(r.config.reference?.artwork_ids ?? [])]))];
  const { data } = ids.length ? await supabase.from("uploaded_artwork").select("id, storage_path, mime_type, original_name, width, height").in("id", ids) : { data: [] };
  const art = new Map(((data as ArtworkRow[]) ?? []).map((a) => [a.id, a]));
  const urls = await signedUrls([...rows.flatMap((r) => previewPaths(r).map((p) => p.path)), ...[...art.values()].map((a) => a.storage_path)]);
  return { art, urls };
}

/** Physical size (cm) of an element on its placement. */
export function objectCm(garment: string, o: DesignObjectCfg, saved?: DesignRow["config"]["areas"]): { w: number; h: number } {
  const a = saved?.[o.location] ?? GARMENTS[garment as GarmentType]?.printAreas[o.location];
  if (!a) return { w: 0, h: 0 };
  const rad = ((o.angle ?? 0) * Math.PI) / 180;
  const w = Math.abs(o.width * o.scaleX);
  const h = Math.abs(o.height * o.scaleY);
  const bw = Math.abs(w * Math.cos(rad)) + Math.abs(h * Math.sin(rad));
  const bh = Math.abs(w * Math.sin(rad)) + Math.abs(h * Math.cos(rad));
  return { w: (bw * a.cm.width) / a.width, h: (bh * a.cm.height) / a.height };
}

export function describeObject(o: DesignObjectCfg, locale: "ar" | "en", art: Map<string, ArtworkRow>): string {
  if (o.type === "text") return `«${o.text ?? ""}»`;
  if (o.type === "shape") {
    const s = shapeById(o.shape_id ?? "");
    return s ? (locale === "ar" ? s.ar : s.en) : (o.shape_id ?? "shape");
  }
  const a = o.artwork_id ? art.get(o.artwork_id) : undefined;
  return a ? `${a.original_name ?? a.storage_path.split("/").pop()}${a.width ? ` (${a.width}×${a.height}px)` : ""}` : "image";
}

/** Every preview image of a design: front, back, and the sleeve close-ups when it has them. */
export function previewPaths(d: Pick<DesignRow, "preview_front_path" | "preview_back_path" | "config">): { key: "front" | "back" | "right" | "left" | "hood"; path: string }[] {
  const list: { key: "front" | "back" | "right" | "left" | "hood"; path: string | null | undefined }[] = [
    { key: "front", path: d.preview_front_path },
    { key: "back", path: d.preview_back_path },
    { key: "right", path: d.config?.previews?.right },
    { key: "left", path: d.config?.previews?.left },
    { key: "hood", path: d.config?.previews?.hood },
  ];
  return list.filter((x): x is { key: "front" | "back" | "right" | "left"; path: string } => !!x.path);
}

export const previewLabel = (key: string, locale: "ar" | "en") =>
  ({ front: ["الأمام", "FRONT"], back: ["الخلف", "BACK"], right: ["الكم الأيمن", "RIGHT SLEEVE"], left: ["الكم الأيسر", "LEFT SLEEVE"], hood: ["داخل القبعة", "INSIDE HOOD"] } as Record<string, [string, string]>)[key]?.[locale === "ar" ? 0 : 1] ?? key;
