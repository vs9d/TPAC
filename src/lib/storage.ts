import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";

export const UPLOAD_LIMITS = {
  maxBytes: 15 * 1024 * 1024,
  artworkTypes: ["image/png", "image/jpeg", "image/webp", "image/svg+xml", "application/pdf"],
  productImageTypes: ["image/png", "image/jpeg", "image/webp", "image/avif"],
} as const;

/** Detects the real file type from magic bytes (never trust the browser's Content-Type). */
export function sniffMime(buf: Uint8Array): string | null {
  const b = buf;
  if (b.length >= 8 && b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47) return "image/png";
  if (b.length >= 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return "image/jpeg";
  if (b.length >= 12 && b[0] === 0x52 && b[1] === 0x49 && b[2] === 0x46 && b[3] === 0x46 && b[8] === 0x57 && b[9] === 0x45 && b[10] === 0x42 && b[11] === 0x50) return "image/webp";
  if (b.length >= 12 && b[4] === 0x66 && b[5] === 0x74 && b[6] === 0x79 && b[7] === 0x70 && b[8] === 0x61 && b[9] === 0x76 && b[10] === 0x69 && b[11] === 0x66) return "image/avif";
  if (b.length >= 5 && b[0] === 0x25 && b[1] === 0x50 && b[2] === 0x44 && b[3] === 0x46 && b[4] === 0x2d) return "application/pdf";
  const head = new TextDecoder().decode(b.slice(0, 1024)).trimStart().toLowerCase();
  if ((head.startsWith("<?xml") || head.startsWith("<svg")) && head.includes("<svg")) return "image/svg+xml";
  return null;
}

/** Rejects SVGs that could execute script when opened directly. */
export function isSafeSvg(text: string): boolean {
  const t = text.toLowerCase();
  return !/<script|javascript:|on[a-z]+\s*=|<foreignobject|<iframe|<embed|<object|xlink:href\s*=\s*["']?(?!#)|href\s*=\s*["']?(?!#|data:image)/.test(t);
}

export const EXT: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/webp": "webp",
  "image/svg+xml": "svg",
  "application/pdf": "pdf",
  "image/avif": "avif",
};

export async function signedUrl(path: string | null | undefined, bucket = "design-uploads", seconds = 3600): Promise<string | null> {
  if (!path) return null;
  const { data } = await createAdminClient().storage.from(bucket).createSignedUrl(path, seconds);
  return data?.signedUrl ?? null;
}

export async function signedUrls(paths: string[], bucket = "design-uploads", seconds = 3600): Promise<Record<string, string>> {
  const unique = [...new Set(paths.filter(Boolean))];
  if (!unique.length) return {};
  const { data } = await createAdminClient().storage.from(bucket).createSignedUrls(unique, seconds);
  const out: Record<string, string> = {};
  for (const row of data ?? []) if (row.path && row.signedUrl) out[row.path] = row.signedUrl;
  return out;
}
