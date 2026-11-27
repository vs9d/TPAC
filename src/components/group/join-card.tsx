"use client";
import { Check, Minus, Plus, Users } from "lucide-react";
import { useI18n } from "@/components/i18n-provider";
import { PLACEMENT_LABEL, type GroupStudio } from "@/lib/group-template";
import { cn } from "@/lib/format";

export interface GroupJoinValue { name: string; size: string; qty: number; note: string }

/** Beside the studio in a group order: who you are, your size — the design is on the left. */
export function GroupJoinCard({ group, value, onChange, joined, onAgain }: { group: GroupStudio; value: GroupJoinValue; onChange: (v: GroupJoinValue) => void; joined: string | null; onAgain: () => void }) {
  const { locale } = useI18n();
  const ar = locale === "ar";
  const m = group.template.member;
  const where = PLACEMENT_LABEL[m.placement][ar ? 0 : 1];
  const set = (p: Partial<GroupJoinValue>) => onChange({ ...value, ...p });
  return (
    <section className="studio-card space-y-5 p-5 sm:p-7" aria-labelledby="group-join-title">
      <header>
        <p className="flex items-center gap-2 text-xs font-semibold text-pine"><Users className="size-4" aria-hidden="true" /> {ar ? `طلب جماعي · ينظمه ${group.organizer}` : `Group order · organised by ${group.organizer}`}</p>
        <h2 id="group-join-title" className="display mt-1 text-2xl">{group.title}</h2>
        <p className="mt-2 text-sm leading-relaxed text-mute">
          {m.kind === "name"
            ? ar ? `اسمك ينطبع على ${where}: اضغط على «اسمك» بالقطعة واكتب اسمك، وتكدر تحركه وتكبّره وتصغّره. تكدر هم تضيف كتابة أو صورة.` : `Your name goes on the ${where.toLowerCase()}: tap “YOUR NAME” on the piece and type yours; you can move and resize it, and add text or images too.`
            : m.kind === "design"
              ? ar ? `ضيف تصميمك على ${where} — ارفع صورة أو اكتب، وحرّكه وكبّره براحتك.` : `Add your design on the ${where.toLowerCase()} — upload an image or write, then move and resize it.`
              : ar ? "التصميم جاهز من المنظّم. تكدر تضيف كتابة أو صورة إذا تحب، واختار قياسك." : "The organiser's design is ready. Add text or an image if you like, then pick your size."}
        </p>
      </header>

      {joined ? (
        <div className="space-y-3 rounded-2xl bg-pine-soft p-4 text-center text-pine" role="status">
          <Check className="mx-auto size-8" aria-hidden="true" />
          <p className="font-bold">{ar ? `تم تسجيلك يا ${joined} 🎉` : `You're on the list, ${joined} 🎉`}</p>
          <p className="text-sm">{ar ? "المنظّم يشوف قطعتك ويكمل الطلب." : "The organiser sees your piece and completes the order."}</p>
          <button type="button" onClick={onAgain} className="btn btn-outline h-11">{ar ? "سجّل شخص ثاني" : "Add someone else"}</button>
        </div>
      ) : (
        <>
          <label className="block">
            <span className="mb-1.5 block text-sm font-semibold">{ar ? "اسمك" : "Your name"} <span className="text-danger">*</span></span>
            <input value={value.name} onChange={(e) => set({ name: e.target.value })} maxLength={80} className="field w-full" autoComplete="name" />
          </label>
          <fieldset>
            <legend className="mb-1.5 text-sm font-semibold">{ar ? "قياسك" : "Your size"} <span className="text-danger">*</span></legend>
            <div className="grid grid-cols-5 gap-2" role="radiogroup" aria-label={ar ? "قياسك" : "Your size"}>
              {group.sizes.map((s) => (
                <button key={s} type="button" role="radio" aria-checked={value.size === s} onClick={() => set({ size: s })} className={cn("h-11 rounded-xl border text-sm font-bold transition", value.size === s ? "border-ink bg-ink text-paper" : "border-line bg-paper hover:border-ink/40")}>{s}</button>
              ))}
            </div>
            <a href={`/${locale}/size-finder`} target="_blank" className="mt-2 inline-block text-xs font-semibold underline">{ar ? "ما تعرف قياسك؟" : "Not sure of your size?"}</a>
          </fieldset>
          <div className="flex flex-wrap items-end gap-4">
            <div>
              <span className="mb-1.5 block text-sm font-semibold">{ar ? "العدد" : "Pieces"}</span>
              <div className="flex items-center rounded-full border border-line">
                <button type="button" className="grid size-11 place-items-center" onClick={() => set({ qty: Math.max(1, value.qty - 1) })} aria-label="-"><Minus className="size-4" /></button>
                <span className="w-8 text-center font-bold tabular-nums">{value.qty}</span>
                <button type="button" className="grid size-11 place-items-center" onClick={() => set({ qty: Math.min(20, value.qty + 1) })} aria-label="+"><Plus className="size-4" /></button>
              </div>
            </div>
            <label className="block min-w-0 flex-1">
              <span className="mb-1.5 block text-sm font-semibold">{ar ? "ملاحظة (اختياري)" : "Note (optional)"}</span>
              <input value={value.note} onChange={(e) => set({ note: e.target.value })} maxLength={200} className="field w-full" />
            </label>
          </div>
        </>
      )}
    </section>
  );
}
