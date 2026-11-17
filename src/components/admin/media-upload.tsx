"use client";
import { useState } from "react";
import { Loader2, Upload } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { toast } from "@/components/ui/toast";

const IMAGES = ["image/jpeg", "image/png", "image/webp", "image/avif"];
const VIDEOS = ["video/mp4", "video/webm", "video/quicktime"];
const EXT: Record<string, string> = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp", "image/avif": "avif", "video/mp4": "mp4", "video/webm": "webm", "video/quicktime": "mov" };

/** Uploads an image (or, with kind="video", a short video) to the public site-media bucket and writes its URL into the field. */
export function MediaUrlInput({ name, label, defaultValue, kind = "image", hint }: { name: string; label: string; defaultValue?: string | null; kind?: "image" | "video"; hint?: string }) {
  const [value, setValue] = useState(defaultValue ?? "");
  const [busy, setBusy] = useState(false);
  const allowed = kind === "video" ? VIDEOS : IMAGES;
  const maxMb = kind === "video" ? 40 : 12;
  const upload = async (file: File | undefined) => {
    if (!file) return;
    if (!allowed.includes(file.type) || file.size > maxMb * 1024 * 1024) {
      toast.error(kind === "video" ? `MP4 / WEBM / MOV ≤ ${maxMb}MB` : `JPG/PNG/WEBP ≤ ${maxMb}MB`);
      return;
    }
    setBusy(true);
    const supabase = createClient();
    const path = `media/${new Date().toISOString().slice(0, 7)}/${crypto.randomUUID()}.${EXT[file.type]}`;
    const { error } = await supabase.storage.from("site-media").upload(path, file, { contentType: file.type, cacheControl: "31536000" });
    setBusy(false);
    if (error) return toast.error(error.message);
    setValue(supabase.storage.from("site-media").getPublicUrl(path).data.publicUrl);
    toast.success("✓");
  };
  return (
    <div>
      <label className="label" htmlFor={name}>{label}</label>
      <div className="flex gap-2">
        <input id={name} name={name} value={value} onChange={(e) => setValue(e.target.value)} className="field h-10 text-sm" dir="ltr" placeholder="https://..." />
        <label className="btn btn-outline btn-sm h-10 cursor-pointer" data-ripple>
          {busy ? <Loader2 className="size-4 animate-spin" /> : <Upload className="size-4" />}
          <input type="file" accept={allowed.join(",")} className="sr-only" disabled={busy} onChange={(e) => { void upload(e.target.files?.[0]); e.target.value = ""; }} />
        </label>
      </div>
      {kind === "video" && value && (
        // eslint-disable-next-line jsx-a11y/media-has-caption
        <video src={value} muted playsInline controls preload="metadata" className="mt-2 max-h-40 rounded-xl" />
      )}
      {hint && <p className="mt-1 text-xs text-mute">{hint}</p>}
    </div>
  );
}
