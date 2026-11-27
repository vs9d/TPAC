"use client";
import { createClient } from "@/lib/supabase/client";
import { signCreatorUpload } from "@/lib/actions/creators";

/** Uploads a creator's file through a one-time signed URL (only into their own folders). */
export async function creatorUpload(file: Blob, kind: "avatar" | "cover" | "art" | "gen", type: string, path?: string): Promise<{ url: string; path: string }> {
  const t = type === "image/jpg" ? "image/jpeg" : type;
  const r = await signCreatorUpload({ kind, path, type: t, size: file.size });
  if (!r.ok) throw new Error(r.error);
  const { error } = await createClient().storage.from("product-images").uploadToSignedUrl(r.path, r.token, file, { contentType: t, cacheControl: "31536000" });
  if (error) throw new Error("upload_failed");
  return { url: r.url, path: r.path };
}

/** For the product studio: it names the file (products/<id>/art|gen/…); the server checks the listing is the creator's. */
export const studioUploader = (file: Blob, path: string, contentType: string) =>
  creatorUpload(file, path.includes("/gen/") ? "gen" : "art", contentType, path);
