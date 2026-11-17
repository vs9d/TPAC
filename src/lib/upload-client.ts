"use client";
import { createClient } from "@/lib/supabase/client";

export const ACCEPT_DESIGN = "image/png,image/jpeg,image/webp,image/svg+xml";
export const ACCEPT_BULK = "image/png,image/jpeg,image/webp,image/svg+xml,application/pdf";
export const ACCEPT_REVIEW = "image/png,image/jpeg,image/webp";
export const MAX_UPLOAD_BYTES = 15 * 1024 * 1024;

/** Signed direct upload to the private bucket + server-side verification. Returns the artwork id. */
export async function uploadArtwork(file: File, purpose: "design" | "bulk" | "review"): Promise<{ id: string; width: number | null; height: number | null }> {
  const allowed = (purpose === "design" ? ACCEPT_DESIGN : purpose === "review" ? ACCEPT_REVIEW : ACCEPT_BULK).split(",");
  if (!allowed.includes(file.type)) throw new Error("fileType");
  if (file.size > MAX_UPLOAD_BYTES) throw new Error("fileSize");
  const sign = await fetch("/api/uploads/sign", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ purpose, type: file.type, size: file.size }) });
  if (!sign.ok) throw new Error((await sign.json().catch(() => ({}))).error ?? "upload_failed");
  const { path, token } = await sign.json();
  const { error } = await createClient().storage.from("design-uploads").uploadToSignedUrl(path, token, file, { contentType: file.type });
  if (error) throw new Error("upload_failed");
  const done = await fetch("/api/uploads/complete", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ path, original_name: file.name }) });
  if (!done.ok) throw new Error((await done.json().catch(() => ({}))).error ?? "upload_failed");
  return done.json();
}
