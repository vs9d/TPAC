"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, Loader2, Minus, Plus } from "lucide-react";
import { useI18n } from "@/components/i18n-provider";
import { toast } from "@/components/ui/toast";
import { joinGroupOrder } from "@/lib/actions/group";
import { cn } from "@/lib/format";

/** A member adds their name and size through the group link. */
export function GroupJoinForm({ code, sizes, allowNames }: { code: string; sizes: string[]; allowNames: boolean }) {
  const { locale, dict } = useI18n();
  const ar = locale === "ar";
  const router = useRouter();
  const [size, setSize] = useState<string>("");
  const [qty, setQty] = useState(1);
  const [done, setDone] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const submit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = e.currentTarget;
    const fd = new FormData(form);
    if (!size) {
      toast.error(ar ? "اختار قياسك" : "Pick your size");
      return;
    }
    start(async () => {
      const r = await joinGroupOrder(code, { name: fd.get("name"), size_code: size, quantity: qty, print_name: fd.get("print_name") || undefined, note: fd.get("note") || undefined });
      if (!r.ok) {
        toast.error(r.error === "closed" ? (ar ? "التسجيل انغلق" : "This list is closed") : r.error === "full" ? (ar ? "القائمة امتلت" : "The list is full") : r.error === "rate_limited" ? dict.checkout.errors.rate_limited! : r.fields?.name ? (ar ? "اكتب اسمك" : "Write your name") : dict.common.somethingWrong);
        return;
      }
      setDone(String(fd.get("name")));
      form.reset();
      setSize("");
      setQty(1);
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
      {allowNames && (
        <label className="block">
          <span className="mb-1.5 block text-sm font-semibold">{ar ? "الاسم اللي ينطبع على قطعتك (اختياري)" : "Name to print on your piece (optional)"}</span>
          <input name="print_name" maxLength={30} dir="auto" className="field w-full" placeholder={ar ? "مثلاً: Ali أو علي" : "e.g. Ali"} />
        </label>
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
      <button type="submit" disabled={pending} className="btn btn-brand h-12 w-full text-base">
        {pending ? <Loader2 className="size-5 animate-spin" /> : <Check className="size-5" />} {ar ? "سجّلني" : "Add me"}
      </button>
    </form>
  );
}
