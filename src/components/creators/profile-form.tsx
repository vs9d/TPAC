"use client";
import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ImagePlus, Loader2, Save, UserRound } from "lucide-react";
import { useI18n } from "@/components/i18n-provider";
import { toast } from "@/components/ui/toast";
import { updateCreatorProfile } from "@/lib/actions/creators";
import type { Creator } from "@/lib/creators";
import { creatorUpload } from "./upload";

const SOCIALS = [["instagram", "Instagram"], ["tiktok", "TikTok"], ["facebook", "Facebook"], ["behance", "Behance"], ["website", "Website"]] as const;

/** The creator edits their public page: photo, cover, name, bio, phone and links. */
export function CreatorProfileForm({ c }: { c: Creator }) {
  const { locale } = useI18n();
  const ar = locale === "ar";
  const router = useRouter();
  const [avatar, setAvatar] = useState(c.avatar_url);
  const [cover, setCover] = useState(c.cover_url);
  const [busy, setBusy] = useState<"avatar" | "cover" | null>(null);
  const [pending, start] = useTransition();
  const avatarRef = useRef<HTMLInputElement>(null);
  const coverRef = useRef<HTMLInputElement>(null);
  const upload = async (kind: "avatar" | "cover", f: File | undefined) => {
    if (!f) return;
    setBusy(kind);
    try {
      const r = await creatorUpload(f, kind, f.type);
      (kind === "avatar" ? setAvatar : setCover)(r.url);
    } catch {
      toast.error(ar ? "ما قدرنا نرفع الصورة — JPG أو PNG لغاية ١٢ ميغا" : "Upload failed — JPG or PNG up to 12 MB");
    } finally {
      setBusy(null);
    }
  };
  return (
    <form className="space-y-5" onSubmit={(e) => { e.preventDefault(); const fd = new FormData(e.currentTarget); start(async () => {
      const r = await updateCreatorProfile({
        display_name: fd.get("display_name"), bio: fd.get("bio") || undefined, phone: fd.get("phone"),
        socials: Object.fromEntries(SOCIALS.map(([k]) => [k, String(fd.get(k) ?? "").trim()])), avatar_url: avatar, cover_url: cover,
      });
      if (!r.ok) { toast.error(r.fields?.phone ? (ar ? "رقم الهاتف غير صحيح" : "Phone is not valid") : r.fields ? (ar ? "الروابط لازم تبدي بـ https://" : "Links must start with https://") : ar ? "ما انحفظ" : "Not saved"); return; }
      toast.success(ar ? "انحفظت صفحتك ✓" : "Saved ✓");
      router.refresh();
    }); }}>
      <div className="overflow-hidden rounded-[1.5rem] border border-line bg-paper">
        <button type="button" onClick={() => coverRef.current?.click()} className="relative block h-36 w-full bg-gradient-to-br from-pine to-ink text-start md:h-48" aria-label={ar ? "تغيير صورة الغلاف" : "Change cover"}>
          {cover && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={cover} alt="" className="absolute inset-0 size-full object-cover" />
          )}
          <span className="absolute end-3 top-3 inline-flex items-center gap-1.5 rounded-full bg-paper/90 px-3 py-1.5 text-xs font-bold">{busy === "cover" ? <Loader2 className="size-4 animate-spin" /> : <ImagePlus className="size-4" />} {ar ? "الغلاف" : "Cover"}</span>
        </button>
        <div className="-mt-12 px-5 pb-5">
          <button type="button" onClick={() => avatarRef.current?.click()} className="relative grid size-24 place-items-center overflow-hidden rounded-full border-4 border-paper bg-bone" aria-label={ar ? "تغيير الصورة الشخصية" : "Change photo"}>
            {avatar ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={avatar} alt="" className="size-full object-cover" />
            ) : <UserRound className="size-9 text-mute" />}
            {busy === "avatar" && <Loader2 className="absolute size-6 animate-spin" />}
          </button>
        </div>
      </div>
      <input ref={coverRef} type="file" accept="image/png,image/jpeg,image/webp" className="hidden" onChange={(e) => void upload("cover", e.target.files?.[0])} aria-label={ar ? "ملف الغلاف" : "Cover file"} />
      <input ref={avatarRef} type="file" accept="image/png,image/jpeg,image/webp" className="hidden" onChange={(e) => void upload("avatar", e.target.files?.[0])} aria-label={ar ? "ملف الصورة الشخصية" : "Photo file"} />
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block"><span className="mb-1.5 block text-sm font-semibold">{ar ? "الاسم" : "Name"}</span><input name="display_name" defaultValue={c.display_name} maxLength={60} className="field w-full" /></label>
        <label className="block"><span className="mb-1.5 block text-sm font-semibold">{ar ? "الهاتف (مخفي)" : "Phone (private)"}</span><input name="phone" defaultValue={c.phone ?? ""} dir="ltr" inputMode="tel" className="field w-full" /></label>
      </div>
      <label className="block"><span className="mb-1.5 block text-sm font-semibold">{ar ? "النبذة" : "Bio"}</span><textarea name="bio" defaultValue={c.bio ?? ""} rows={4} maxLength={600} className="field w-full" /></label>
      <fieldset>
        <legend className="mb-1.5 text-sm font-semibold">{ar ? "الروابط" : "Links"}</legend>
        <div className="grid gap-2 sm:grid-cols-2">{SOCIALS.map(([k, l]) => <input key={k} name={k} defaultValue={c.socials?.[k] ?? ""} dir="ltr" className="field w-full text-sm" placeholder={`${l} — https://…`} aria-label={l} />)}</div>
      </fieldset>
      <p className="text-xs text-mute" dir="ltr">thetpac.com/creator/{c.username}</p>
      <button type="submit" disabled={pending || !!busy} className="btn btn-brand h-12">{pending ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />} {ar ? "حفظ" : "Save"}</button>
    </form>
  );
}
