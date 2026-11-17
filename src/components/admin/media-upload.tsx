"use client";
import { useState } from "react";
import { Loader2, Upload } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { toast } from "@/components/ui/toast";

/** Uploads an image to the public site-media bucket and writes its URL into a sibling input. */
export function MediaUrlInput({ name, label, defaultValue }: { name: string; label: string; defaultValue?: string | null }) {
  const [value, setValue] = useState(defaultValue ?? "");
  const [busy, setBusy] = useState(false);
  const upload = async (file: File | undefined) => {
    if (!file) return;
    if (!["image/jpeg", "image/png", "image/webp", "image/avif"].includes(file.type) || file.size > 12 * 1024 * 1024) {
      toast.error("JPG/PNG/WEBP ≤ 12MB");
      return;
    }
    setBusy(true);
    const supabase = createClient();
    const path = `media/${new Date().toISOString().slice(0, 7)}/${crypto.randomUUID()}.${file.type.split("/")[1]!.replace("jpeg", "jpg")}`;
    const { error } = await supabase.storage.from("site-media").upload(path, file, { contentType: file.type, cacheControl: "31536000" });
    setBusy(false);
    if (error) return toast.error(error.message);
    setValue(supabase.storage.from("site-media").getPublicUrl(path).data.publicUrl);
  };
  return (
    <div>
      <label className="label" htmlFor={name}>{label}</label>
      <div className="flex gap-2">
        <input id={name} name={name} value={value} onChange={(e) => setValue(e.target.value)} className="field h-10 text-sm" dir="ltr" placeholder="/products/... or https://..." />
        <label className="btn btn-outline btn-sm h-10 cursor-pointer">{busy ? <Loader2 className="size-4 animate-spin" /> : <Upload className="size-4" />}<input type="file" accept="image/*" className="sr-only" onChange={(e) => void upload(e.target.files?.[0])} /></label>
      </div>
    </div>
  );
}
