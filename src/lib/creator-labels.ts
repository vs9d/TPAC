/** How a listing's review status reads, with its badge colour. */
export const STATUS_LABEL: Record<string, [string, string, string]> = {
  draft: ["مسودة", "Draft", "bg-bone"], pending: ["قيد المراجعة", "In review", "bg-amber/20"], approved: ["منشور", "Published", "bg-pine-soft text-pine"],
  rejected: ["مرفوض", "Rejected", "bg-danger/10 text-danger"], changes_requested: ["مطلوب تعديل", "Changes requested", "bg-amber/20"], hidden: ["مخفي", "Hidden", "bg-bone text-mute"],
};

/** Hard ceiling on any creator markup, whatever the settings (shared by the editor and the server). */
export const MARKUP_CEILING = 10_000_000;

/** The creator's accounts, in the order the forms show them. */
export const CREATOR_SOCIALS = [["instagram", "Instagram"], ["tiktok", "TikTok"], ["facebook", "Facebook"], ["behance", "Behance"], ["website", "Website"]] as const;
export type CreatorSocial = (typeof CREATOR_SOCIALS)[number][0];

const PROFILE_URL: Record<Exclude<CreatorSocial, "website">, (h: string) => string> = {
  instagram: (h) => `https://www.instagram.com/${h}`,
  tiktok: (h) => `https://www.tiktok.com/@${h}`,
  facebook: (h) => `https://www.facebook.com/${h}`,
  behance: (h) => `https://www.behance.net/${h}`,
};

/**
 * What people actually type → a clean https link: "@name", "name", "instagram.com/name",
 * "http://…" or a full link. Returns "" for empty and null when it can't be a link.
 */
export function normalizeSocialLink(kind: CreatorSocial, raw: unknown): string | null {
  let v = String(raw ?? "").trim().replace(/\s+/g, "");
  if (!v) return "";
  if (kind !== "website") {
    const handle = /^@?([A-Za-z0-9._-]{1,60})$/.exec(v);
    if (handle && !handle[1]!.includes("..") && !/\.(com|net|org|io|me|iq)$/i.test(handle[1]!)) return PROFILE_URL[kind](handle[1]!);
  }
  if (/^http:\/\//i.test(v)) v = `https://${v.slice(7)}`;
  if (!/^https:\/\//i.test(v)) v = `https://${v}`;
  try {
    const u = new URL(v);
    if (u.protocol !== "https:" || !u.hostname.includes(".") || v.length > 300) return null;
    return u.toString().replace(/\/$/, "");
  } catch {
    return null;
  }
}
