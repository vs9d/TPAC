"use client";
import { createClient } from "@/lib/supabase/client";

export const MOCKUP_TYPES = ["image/jpeg", "image/png", "image/webp", "image/avif"];
export const MAX_MOCKUP_BYTES = 8 * 1024 * 1024;

/** Staff-only upload to the public product-images bucket (RLS enforces staff). Returns the public URL. */
export async function uploadProductImage(file: Blob, path: string, contentType: string): Promise<{ url: string; path: string }> {
  const supabase = createClient();
  const { error } = await supabase.storage.from("product-images").upload(path, file, { contentType, cacheControl: "31536000", upsert: false });
  if (error) throw new Error(error.message);
  return { url: supabase.storage.from("product-images").getPublicUrl(path).data.publicUrl, path };
}

/** Natural pixel size of an image file or URL. */
export async function imageSize(src: Blob | string): Promise<{ width: number; height: number }> {
  const url = typeof src === "string" ? src : URL.createObjectURL(src);
  try {
    const img = new Image();
    img.decoding = "async";
    img.src = url;
    await img.decode();
    return { width: img.naturalWidth, height: img.naturalHeight };
  } finally {
    if (typeof src !== "string") URL.revokeObjectURL(url);
  }
}

export function checkImageFile(file: File): string | null {
  if (!MOCKUP_TYPES.includes(file.type)) return "type";
  if (file.size > MAX_MOCKUP_BYTES) return "size";
  return null;
}

export const extOf = (type: string) => type.split("/")[1]!.replace("jpeg", "jpg");
