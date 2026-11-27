"use client";
import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, ImagePlus, Loader2, Minus, Plus } from "lucide-react";
import { useI18n } from "@/components/i18n-provider";
import { toast } from "@/components/ui/toast";
import { joinGroupOrder } from "@/lib/actions/group";
import { cn } from "@/lib/format";
import { ACCEPT_DESIGN, uploadArtwork } from "@/lib/upload-client";
import { PLACEMENT_LABEL, type GroupPlacement, type GroupTemplate, type PreviewKit } from "@/lib/group-template";
import { GroupPieceView } from "./preview";

/** A member adds their name and size through the group link. */
export function GroupJoinForm({ code, sizes, template, kit, colorId, fixed }: {
  code: string; sizes: string[]; template: GroupTemplate;
  /** the garment to preview (own-design groups); null for a store product */
  kit: PreviewKit | null; colorId: string | null; fixed: Partial<Record<GroupPlacement, string>>;
}) {
  const { locale, dict } = useI18n();
  const ar = locale === "ar";
  const router = useRouter();
  const [size, setSize] = useState<string>("");
  const [qty, setQty] = useState(1);
  const [done, setDone] = useState<string | null>(null);
  const kind = template.member.kind;
  const where = PLACEMENT_LABEL[template.member.placement][ar ? 0 : 1];
  const [printName, setPrintName] = useState("");
  const [art, setArt] = useState<{ id: string; url: string } | null>(null);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const onFile = async (f: File | undefined) => {
    if (!f) return;
    setUploading(true);
    try {
      const { id } = await uploadArtwork(f, "design");
      setArt({ id, url: URL.createObjectURL(f) });
    } catch (e) {
      const k = e instanceof Error ? e.message : "";
      toast.error(k === "fileType" ? dict.validation.fileType : k === "fileSize" ? dict.validation.fileSize : dict.common.somethingWrong);
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };
  const [pending, start] = useTransition();

  const submit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = e.currentTarget;
    const fd = new FormData(form);
    if (!size) {
      toast.error(ar ? "اختار قياسك" : "Pick your size");
      return;
    }
    if (kind === "name" && !printName.trim()) {
      toast.error(ar ? `اكتب الاسم اللي ينطبع على ${where}` : `Write the name to print on the ${where.toLowerCase()}`);
      return;
    }
    if (kind === "design" && !art) {
      toast.error(ar ? `ارفع تصميمك لـ${where}` : `Upload your design for the ${where.toLowerCase()}`);
      return;
    }
    start(async () => {
      const r = await joinGroupOrder(code, { name: fd.get("name"), size_code: size, quantity: qty, print_name: kind === "name" ? printName : undefined, artwork_id: kind === "design" ? art?.id : undefined, note: fd.get("note") || undefined });
      if (!r.ok) {
        toast.error(r.error === "closed" ? (ar ? "التسجيل انغلق" : "This list is closed") : r.error === "full" ? (ar ? "القائمة امتلت" : "The list is full") : r.error === "rate_limited" ? dict.checkout.errors.rate_limited! : r.fields?.name ? (ar ? "اكتب اسمك" : "Write your name") : dict.common.somethingWrong);
        return;
      }
      setDone(String(fd.get("name")));
      form.reset();
      setSize("");
      setQty(1);
      setPrintName("");
      setArt(null);
      router.refresh();
    });
  };

  if (done) {
    return (
      <div className="space-y-4 rounded-[1.5rem] border border-pine bg-pine-soft/50 p-6 text-center" role="status">
        <Check className="mx-auto size-10 text-pine" aria-hidden="true" />
        <p className="display text-2xl">{ar ? `تم تسجيلك يا ${done} 🎉` : `You're on the list, ${done} 🎉`}</p>
        <p className="text-sm text-mute">{ar ? "المنظّم يشوف اسمك وقياسك ويكمل الطلب." : "The organiser sees your name and size and completes the order."}</p>
        <button type="button" onClick={() => setDone(null)} className="btn btn-outline h-11">{ar ? "سجّل شخص ثاني" : "Add someone else"}</button>
      </div>
    );
  }
  return (
    <form onSubmit={submit} className="space-y-5 rounded-[1.5rem] border border-line bg-paper p-5 sm:p-7" noValidate>
      <label className="block">
        <span className="mb-1.5 block text-sm font-semibold">{ar ? "اسمك" : "Your name"} <span className="text-danger">*</span></span>
        <input name="name" required minLength={2} maxLength={80} className="field w-full" autoComplete="name" />
      </label>
      <fieldset>
        <legend className="mb-1.5 text-sm font-semibold">{ar ? "قياسك" : "Your size"} <span className="text-danger">*</span></legend>
        <div className="grid grid-cols-5 gap-2" role="radiogroup" aria-label={ar ? "قياسك" : "Your size"}>
          {sizes.map((s) => (
            <button key={s} type="button" role="radio" aria-checked={size === s} onClick={() => setSize(s)} className={cn("h-11 rounded-xl border text-sm font-bold transition", size === s ? "border-ink bg-ink text-paper" : "border-line bg-paper hover:border-ink/40")}>{s}</button>
          ))}
        </div>
        <a href={`/${locale}/size-finder`} target="_blank" className="mt-2 inline-block text-xs font-semibold underline">{ar ? "ما تعرف قياسك؟" : "Not sure of your size?"}</a>
      </fieldset>
      {kind === "name" && (
        <label className="block">
          <span className="mb-1.5 block text-sm font-semibold">{ar ? `الاسم اللي ينطبع على ${where}` : `Name to print on the ${where.toLowerCase()}`} <span className="text-danger">*</span></span>
          <input name="print_name" value={printName} onChange={(e) => setPrintName(e.target.value)} maxLength={30} dir="auto" className="field w-full" placeholder={ar ? "مثلاً: Ali أو علي" : "e.g. Ali"} />
        </label>
      )}
      {kind === "design" && (
        <div>
          <p className="mb-1.5 text-sm font-semibold">{ar ? `تصميمك لـ${where}` : `Your design for the ${where.toLowerCase()}`} <span className="text-danger">*</span></p>
          <button type="button" onClick={() => fileRef.current?.click()} disabled={uploading} className={cn("flex min-h-12 w-full items-center justify-center gap-2 rounded-2xl border-2 border-dashed text-sm font-semibold", art ? "border-pine text-pine" : "border-line text-mute")}>
            {uploading ? <Loader2 className="size-5 animate-spin" /> : art ? <Check className="size-5" /> : <ImagePlus className="size-5" />} {art ? (ar ? "تم — غيّر الصورة" : "Done — change image") : (ar ? "ارفع صورتك" : "Upload your image")}
          </button>
          <input ref={fileRef} type="file" accept={ACCEPT_DESIGN} className="hidden" onChange={(e) => void onFile(e.target.files?.[0])} aria-label={ar ? "ملف تصميمك" : "Your design file"} />
        </div>
      )}
      {kit && (
        <div className="grid grid-cols-2 gap-3" aria-live="polite">
          <GroupPieceView kit={kit} colorId={colorId} view="front" fixed={fixed} template={template} member={{ name: printName, image: art?.url }} label={ar ? "الأمام" : "Front"} emptyHint={kind === "name" ? (ar ? "اسمك هنا" : "your name") : kind === "design" ? (ar ? "تصميمك" : "your design") : undefined} />
          <GroupPieceView kit={kit} colorId={colorId} view="back" fixed={fixed} template={template} member={{ name: printName, image: art?.url }} label={ar ? "الخلف" : "Back"} emptyHint={kind === "name" ? (ar ? "اسمك هنا" : "your name") : kind === "design" ? (ar ? "تصميمك" : "your design") : undefined} />
        </div>
      )}
      <div className="flex flex-wrap items-end gap-4">
        <div>
          <span className="mb-1.5 block text-sm font-semibold">{ar ? "العدد" : "Pieces"}</span>
          <div className="flex items-center rounded-full border border-line">
            <button type="button" className="grid size-11 place-items-center" onClick={() => setQty((q) => Math.max(1, q - 1))} aria-label="-"><Minus className="size-4" /></button>
            <span className="w-8 text-center font-bold tabular-nums">{qty}</span>
            <button type="button" className="grid size-11 place-items-center" onClick={() => setQty((q) => Math.min(20, q + 1))} aria-label="+"><Plus className="size-4" /></button>
          </div>
        </div>
        <label className="block min-w-0 flex-1">
          <span className="mb-1.5 block text-sm font-semibold">{ar ? "ملاحظة (اختياري)" : "Note (optional)"}</span>
          <input name="note" maxLength={200} className="field w-full" />
        </label>
      </div>
      <button type="submit" disabled={pending || uploading} className="btn btn-brand h-12 w-full text-base">
        {pending ? <Loader2 className="size-5 animate-spin" /> : <Check className="size-5" />} {ar ? "سجّلني" : "Add me"}
      </button>
    </form>
  );
}
