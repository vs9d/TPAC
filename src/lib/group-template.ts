import { z } from "zod";

/** Where a group's fixed design or each member's name / design can go. */
export const GROUP_PLACEMENTS = ["front", "back", "left_chest"] as const;
export type GroupPlacement = (typeof GROUP_PLACEMENTS)[number];
export const PLACEMENT_LABEL: Record<GroupPlacement, [string, string]> = { front: ["الأمام", "Front"], back: ["الخلف", "Back"], left_chest: ["الصدر الأيسر", "Left chest"] };
export const PLACEMENT_VIEW: Record<GroupPlacement, "front" | "back"> = { front: "front", back: "back", left_chest: "front" };
export const NAME_FONTS = [
  // the fonts come from the group pages' layout (next/font variables)
  { id: "block", label: ["عريض", "Block"], family: "var(--g-block), var(--g-block-ar), Impact, sans-serif" },
  { id: "kufi", label: ["كوفي", "Kufi"], family: "var(--g-kufi), sans-serif" },
  { id: "script", label: ["رقعة", "Script"], family: "var(--g-script), serif" },
] as const;
export type NameFont = (typeof NAME_FONTS)[number]["id"];

const placement = z.enum(GROUP_PLACEMENTS);
const id = z.string().regex(/^[0-9a-f-]{36}$/);
export const groupTemplateSchema = z.object({
  fixed: z.object({ front: id.optional(), back: id.optional(), left_chest: id.optional() }).default({}),
  member: z.object({
    kind: z.enum(["none", "name", "design"]),
    placement: placement.default("back"),
    font: z.enum(["block", "kufi", "script"]).default("block"),
    color: z.string().regex(/^#[0-9a-fA-F]{6}$/).default("#FFFFFF"),
  }).default({ kind: "name", placement: "back", font: "block", color: "#FFFFFF" }),
});
export type GroupTemplate = z.infer<typeof groupTemplateSchema>;

export function parseTemplate(raw: unknown): GroupTemplate {
  const r = groupTemplateSchema.safeParse(raw ?? {});
  return r.success ? r.data : groupTemplateSchema.parse({});
}

/** What the preview needs to draw the garment: its photos (or the built-in drawing) and print areas. */
export interface KitView { mockup_url: string | null; color_mockups: Record<string, string>; width: number; height: number }
export interface PreviewKit {
  garment: string;
  colors: { id: string; name_ar: string; name_en: string; hex: string }[];
  views: Partial<Record<"front" | "back", KitView>>;
  areas: Record<GroupPlacement, { x: number; y: number; width: number; height: number }>;
}

/** What the studio needs to open a group's piece for one member. */
export interface GroupStudio {
  code: string; title: string; organizer: string; garment: string; colorId: string | null;
  template: GroupTemplate; fixedUrls: Partial<Record<GroupPlacement, string>>; sizes: string[];
}
/** The studio text style the organiser's name font maps to. */
export const NAME_PRESET: Record<NameFont, [string, string]> = { block: ["lalezar", "impact"], kufi: ["kufi", "kufi"], script: ["ruqaa", "ruqaa"] };
