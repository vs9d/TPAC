"use client";
import { useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, ImagePlus, Loader2, Trash2, Users } from "lucide-react";
import { useI18n } from "@/components/i18n-provider";
import { toast } from "@/components/ui/toast";
import { createGroupOrder } from "@/lib/actions/group";
import { ACCEPT_DESIGN, uploadArtwork } from "@/lib/upload-client";
import { GROUP_PLACEMENTS, NAME_FONTS, PLACEMENT_LABEL, type GroupPlacement, type GroupTemplate, type NameFont, type PreviewKit } from "@/lib/group-template";
import { cn } from "@/lib/format";
import { GroupPieceView } from "./preview";

const GARMENT_LABEL: Record<string, [string, string]> = { hoodie: ["هودي", "Hoodie"], tshirt: ["تيشيرت", "T-shirt"], oversized: ["تيشيرت أوفرسايز", "Oversized tee"], sweatshirt: ["سويتشيرت", "Sweatshirt"] };
const NAME_COLORS = ["#FFFFFF", "#111111", "#E3963C", "#376352", "#C8102E"];

// outside the form component: a component defined inside it would remount (and empty the inputs) on every change
function Section({ n, title, children }: { n: number; title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-4 border-t border-line pt-6 first:border-0 first:pt-0">
      <h2 className="flex items-center gap-2 text-base font-bold"><span className="grid size-7 place-items-center rounded-full bg-ink text-xs text-paper">{n}</span> {title}</h2>
      {children}
    </section>
  );
}

/** An organiser opens a group order: the piece (garment, colour, their design), what each member adds and where. */
export function GroupCreateForm({ product, kits }: { product: { slug: string; name: string; type: string } | null; kits: PreviewKit[] }) {
  const { locale, dict } = useI18n();
  const ar = locale === "ar";
  const L = (x: [string, string]) => (ar ? x[0] : x[1]);
  const router = useRouter();
  const [pending, start] = useTransition();
  const [errors, setErrors] = useState<Record<string, string>>({});

  const [garment, setGarment] = useState(kits.find((k) => k.garment === "hoodie")?.garment ?? kits[0]?.garment ?? "hoodie");
  const kit = kits.find((k) => k.garment === garment) ?? null;
  const [colorId, setColorId] = useState<string | null>(kit?.colors[0]?.id ?? null);
  const color = kit?.colors.find((c) => c.id === colorId) ?? kit?.colors[0] ?? null;
  // the organiser's fixed design per placement: uploaded artwork id + a local preview
  const [fixed, setFixed] = useState<Partial<Record<GroupPlacement, { id: string; url: string }>>>({});
  const [uploading, setUploading] = useState<GroupPlacement | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const target = useRef<GroupPlacement>("front");
  const [member, setMember] = useState<GroupTemplate["member"]>({ kind: "name", placement: "back", font: "block", color: "#FFFFFF" });
  const [sample, setSample] = useState(ar ? "علي" : "ALI");

  const freePlacements = GROUP_PLACEMENTS.filter((p) => !fixed[p]);
  const template: GroupTemplate = useMemo(() => ({
    fixed: Object.fromEntries(Object.entries(fixed).map(([k, v]) => [k, v!.id])),
    member,
  }), [fixed, member]);
  const fixedUrls = Object.fromEntries(Object.entries(fixed).map(([k, v]) => [k, v!.url])) as Partial<Record<GroupPlacement, string>>;

  const pickColor = (g: string) => {
    setGarment(g);
    const k = kits.find((x) => x.garment === g);
    if (k && !k.colors.some((c) => c.id === colorId)) setColorId(k.colors[0]?.id ?? null);
  };
  const askUpload = (p: GroupPlacement) => {
    target.current = p;
    fileRef.current?.click();
  };
  const onFile = async (f: File | undefined) => {
    if (!f) return;
    const p = target.current;
    setUploading(p);
    try {
      const { id } = await uploadArtwork(f, "design");
      setFixed((x) => ({ ...x, [p]: { id, url: URL.createObjectURL(f) } }));
      // a placement with the organiser's design can't also take the members' name / design
      if (member.placement === p) {
        const other = GROUP_PLACEMENTS.find((q) => q !== p && !fixed[q]);
        if (other) setMember((m) => ({ ...m, placement: other }));
      }
    } catch (e) {
      const k = e instanceof Error ? e.message : "";
      toast.error(k === "fileType" ? dict.validation.fileType : k === "fileSize" ? dict.validation.fileSize : k === "uploads_disabled" ? (ar ? "رفع الصور متوقف حالياً" : "Uploads are paused") : dict.common.somethingWrong);
    } finally {
      setUploading(null);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const submit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    start(async () => {
      const r = await createGroupOrder({
        title: fd.get("title"),
        organizer_name: fd.get("organizer_name"),
        organizer_phone: fd.get("organizer_phone"),
        product_slug: product?.slug,
        product_type: product?.type ?? garment,
        idea: fd.get("idea") || undefined,
        allow_names: member.kind === "name",
        deadline: fd.get("deadline") || undefined,
        ...(product ? { template: { fixed: {}, member } } : { garment, color_id: color?.id, template }),
      });
      if (!r.ok) {
        setErrors(r.fields ?? {});
        toast.error(r.error === "rate_limited" ? dict.checkout.errors.rate_limited! : r.error === "artwork" ? (ar ? "ارفع صورة التصميم مرة ثانية" : "Upload the design again") : r.fields?.organizer_phone ? (ar ? "رقم الهاتف غير صحيح" : "Phone number is not valid") : r.fields?.deadline ? (ar ? "اختار تاريخ بالمستقبل" : "Pick a future date") : dict.common.somethingWrong);
        return;
      }
      router.push(`/${locale}/group/manage/${r.token}?new=1`);
    });
  };

  const err = (k: string) => (errors[k] ? "border-danger" : "");
  return (
    <form onSubmit={submit} className="space-y-6 rounded-[1.5rem] border border-line bg-paper p-5 sm:p-7" noValidate>
      <Section n={1} title={ar ? "المجموعة" : "The group"}>
        {product && <p className="rounded-2xl bg-pine-soft px-4 py-3 text-sm font-semibold text-pine">{ar ? "المنتج:" : "Product:"} {product.name}</p>}
        <label className="block">
          <span className="mb-1.5 block text-sm font-semibold">{ar ? "اسم المجموعة" : "Group name"} <span className="text-danger">*</span></span>
          <input name="title" required maxLength={120} className={cn("field w-full", err("title"))} placeholder={ar ? "مثلاً: دفعة هندسة مدني ٢٠٢٦" : "e.g. Civil Engineering class of 2026"} />
        </label>
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block">
            <span className="mb-1.5 block text-sm font-semibold">{ar ? "اسمك" : "Your name"} <span className="text-danger">*</span></span>
            <input name="organizer_name" required maxLength={80} className={cn("field w-full", err("organizer_name"))} autoComplete="name" />
          </label>
          <label className="block">
            <span className="mb-1.5 block text-sm font-semibold">{ar ? "رقم هاتفك" : "Your phone"} <span className="text-danger">*</span></span>
            <input name="organizer_phone" required inputMode="tel" dir="ltr" className={cn("field w-full", err("organizer_phone"))} placeholder="07XX XXX XXXX" autoComplete="tel" />
          </label>
        </div>
      </Section>

      {!product && kit && (
        <Section n={2} title={ar ? "شكل القطعة" : "The piece"}>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4" role="radiogroup" aria-label={ar ? "نوع القطعة" : "Garment"}>
            {kits.map((k) => (
              <button key={k.garment} type="button" role="radio" aria-checked={garment === k.garment} onClick={() => pickColor(k.garment)} className={cn("h-12 rounded-2xl border text-sm font-bold transition", garment === k.garment ? "border-ink bg-ink text-paper" : "border-line")}>{L(GARMENT_LABEL[k.garment] ?? [k.garment, k.garment])}</button>
            ))}
          </div>
          <div className="flex flex-wrap gap-2" role="radiogroup" aria-label={ar ? "اللون" : "Colour"}>
            {kit.colors.map((c) => (
              <button key={c.id} type="button" role="radio" aria-checked={color?.id === c.id} onClick={() => setColorId(c.id)} className={cn("flex min-h-11 items-center gap-2 rounded-full border px-3 text-sm font-semibold", color?.id === c.id ? "border-pine bg-pine-soft text-pine" : "border-line")}>
                <span className="size-5 rounded-full border border-ink/20" style={{ background: c.hex }} aria-hidden="true" /> {ar ? c.name_ar : c.name_en}
              </button>
            ))}
          </div>
          <div>
            <p className="mb-2 text-sm font-semibold">{ar ? "تصميمك الثابت للكل (اختياري)" : "Your design for everyone (optional)"}</p>
            <div className="grid gap-2 sm:grid-cols-3">
              {GROUP_PLACEMENTS.map((p) => (
                <div key={p} className={cn("flex items-center gap-2 rounded-2xl border p-2", fixed[p] ? "border-pine bg-pine-soft/40" : "border-dashed border-line")}>
                  {fixed[p] ? (
                    <>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={fixed[p]!.url} alt="" className="size-11 rounded-lg bg-bone object-contain" />
                      <span className="flex-1 text-sm font-semibold">{L(PLACEMENT_LABEL[p])} <Check className="inline size-4 text-pine" /></span>
                      <button type="button" onClick={() => setFixed((x) => { const n = { ...x }; delete n[p]; return n; })} className="grid size-10 place-items-center rounded-full hover:bg-bone" aria-label={ar ? `حذف تصميم ${PLACEMENT_LABEL[p][0]}` : `Remove ${PLACEMENT_LABEL[p][1]} design`}><Trash2 className="size-4" /></button>
                    </>
                  ) : (
                    <button type="button" onClick={() => askUpload(p)} disabled={!!uploading} className="flex min-h-11 flex-1 items-center justify-center gap-2 text-sm font-semibold text-mute">
                      {uploading === p ? <Loader2 className="size-4 animate-spin" /> : <ImagePlus className="size-4" />} {ar ? `ارفع تصميم ${PLACEMENT_LABEL[p][0]}` : `Upload ${PLACEMENT_LABEL[p][1].toLowerCase()} design`}
                    </button>
                  )}
                </div>
              ))}
            </div>
            <input ref={fileRef} type="file" accept={ACCEPT_DESIGN} className="hidden" onChange={(e) => void onFile(e.target.files?.[0])} aria-label={ar ? "ملف التصميم" : "Design file"} />
          </div>
        </Section>
      )}

      <Section n={product ? 2 : 3} title={ar ? "شنو يضيف كل واحد؟" : "What does each person add?"}>
        <div className="grid gap-2 sm:grid-cols-3" role="radiogroup" aria-label={ar ? "شنو يضيف كل واحد" : "What each person adds"}>
          {([["name", ar ? "اسمه" : "Their name"], ...(product ? [] : [["design", ar ? "تصميمه الخاص" : "Their own design"]]), ["none", ar ? "بس القياس" : "Only their size"]] as [GroupTemplate["member"]["kind"], string][]).map(([k, label]) => (
            <button key={k} type="button" role="radio" aria-checked={member.kind === k} onClick={() => setMember((m) => ({ ...m, kind: k }))} className={cn("h-12 rounded-2xl border text-sm font-bold transition", member.kind === k ? "border-ink bg-ink text-paper" : "border-line")}>{label}</button>
          ))}
        </div>
        {member.kind !== "none" && (
          <>
            <div>
              <p className="mb-2 text-sm font-semibold">{ar ? "وين ينطبع؟ (الكل نفس المكان)" : "Where is it printed? (same for everyone)"}</p>
              <div className="flex flex-wrap gap-2" role="radiogroup" aria-label={ar ? "مكان الطباعة" : "Placement"}>
                {(product ? GROUP_PLACEMENTS : freePlacements).map((p) => (
                  <button key={p} type="button" role="radio" aria-checked={member.placement === p} onClick={() => setMember((m) => ({ ...m, placement: p }))} className={cn("min-h-11 rounded-full border px-4 text-sm font-semibold", member.placement === p ? "border-pine bg-pine-soft text-pine" : "border-line")}>{L(PLACEMENT_LABEL[p])}</button>
                ))}
              </div>
            </div>
            {member.kind === "name" && (
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <p className="mb-2 text-sm font-semibold">{ar ? "الخط" : "Font"}</p>
                  <div className="flex flex-wrap gap-2" role="radiogroup" aria-label={ar ? "الخط" : "Font"}>
                    {NAME_FONTS.map((f) => (
                      <button key={f.id} type="button" role="radio" aria-checked={member.font === f.id} onClick={() => setMember((m) => ({ ...m, font: f.id as NameFont }))} className={cn("min-h-11 rounded-full border px-4 text-base", member.font === f.id ? "border-pine bg-pine-soft text-pine" : "border-line")} style={{ fontFamily: f.family }}>{L(f.label as unknown as [string, string])}</button>
                    ))}
                  </div>
                </div>
                <div>
                  <p className="mb-2 text-sm font-semibold">{ar ? "لون الاسم" : "Name colour"}</p>
                  <div className="flex flex-wrap gap-2" role="radiogroup" aria-label={ar ? "لون الاسم" : "Name colour"}>
                    {NAME_COLORS.map((c) => (
                      <button key={c} type="button" role="radio" aria-checked={member.color === c} aria-label={c} onClick={() => setMember((m) => ({ ...m, color: c }))} className={cn("size-11 rounded-full border-2", member.color === c ? "border-pine ring-2 ring-pine/30" : "border-line")} style={{ background: c }} />
                    ))}
                  </div>
                </div>
              </div>
            )}
          </>
        )}
        {!product && kit && (
          <div className="space-y-2">
            <div className="flex items-center justify-between gap-3">
              <p className="text-sm font-semibold">{ar ? "هيچ يشوفها كل واحد" : "How everyone will see it"}</p>
              {member.kind === "name" && <input value={sample} onChange={(e) => setSample(e.target.value.slice(0, 30))} className="field h-10 w-36 text-sm" aria-label={ar ? "اسم للتجربة" : "Sample name"} dir="auto" />}
            </div>
            <div className="grid grid-cols-2 gap-3">
              <GroupPieceView kit={kit} colorId={color?.id ?? null} view="front" fixed={fixedUrls} template={template} member={{ name: sample }} label={ar ? "الأمام" : "Front"} emptyHint={member.kind === "design" ? (ar ? "تصميمه" : "their design") : undefined} />
              <GroupPieceView kit={kit} colorId={color?.id ?? null} view="back" fixed={fixedUrls} template={template} member={{ name: sample }} label={ar ? "الخلف" : "Back"} emptyHint={member.kind === "design" ? (ar ? "تصميمه" : "their design") : undefined} />
            </div>
          </div>
        )}
      </Section>

      <Section n={product ? 3 : 4} title={ar ? "تفاصيل أخيرة" : "Last details"}>
        <label className="block">
          <span className="mb-1.5 block text-sm font-semibold">{ar ? "ملاحظات أو فكرة (اختياري)" : "Notes or idea (optional)"}</span>
          <textarea name="idea" rows={3} maxLength={1000} className="field w-full" placeholder={ar ? "مثلاً: الشعار أبيض، والأسماء بالإنكليزي" : "e.g. White logo, names in English"} />
        </label>
        <label className="block">
          <span className="mb-1.5 block text-sm font-semibold">{ar ? "آخر موعد للتسجيل (اختياري)" : "Last day to join (optional)"}</span>
          <input type="date" name="deadline" className={cn("field w-full", err("deadline"))} />
        </label>
      </Section>

      <button type="submit" disabled={pending || !!uploading} className="btn btn-brand h-12 w-full text-base">
        {pending ? <Loader2 className="size-5 animate-spin" /> : <Users className="size-5" />} {ar ? "سوّي الرابط" : "Create the link"}
      </button>
      <p className="text-xs text-mute">{ar ? "بعدها تاخذ رابط تدزه بالكروب. كل واحد يشوف القطعة بتصميمك ويكتب اسمه أو يرفع تصميمه بالمكان اللي حددته، ويختار قياسه." : "You'll get a link for the group chat. Everyone sees the piece with your design, adds their name or design where you chose, and picks their size."}</p>
    </form>
  );
}
