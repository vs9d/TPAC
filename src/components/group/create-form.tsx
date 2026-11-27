"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Users } from "lucide-react";
import { useI18n } from "@/components/i18n-provider";
import { toast } from "@/components/ui/toast";
import { createGroupOrder } from "@/lib/actions/group";
import { QUOTE_PRODUCT_TYPES } from "@/lib/validation";
import { cn } from "@/lib/format";

/** An organiser opens a group order and gets the link for the group chat. */
export function GroupCreateForm({ product }: { product: { slug: string; name: string; type: string } | null }) {
  const { locale, dict } = useI18n();
  const ar = locale === "ar";
  const router = useRouter();
  const [pending, start] = useTransition();
  const [errors, setErrors] = useState<Record<string, string>>({});

  const submit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    start(async () => {
      const r = await createGroupOrder({
        title: fd.get("title"),
        organizer_name: fd.get("organizer_name"),
        organizer_phone: fd.get("organizer_phone"),
        product_slug: product?.slug,
        product_type: product?.type ?? fd.get("product_type"),
        idea: fd.get("idea") || undefined,
        allow_names: fd.get("allow_names") === "on",
        deadline: fd.get("deadline") || undefined,
      });
      if (!r.ok) {
        setErrors(r.fields ?? {});
        toast.error(r.error === "rate_limited" ? dict.checkout.errors.rate_limited! : r.fields?.organizer_phone ? (ar ? "رقم الهاتف غير صحيح" : "Phone number is not valid") : r.fields?.deadline ? (ar ? "اختار تاريخ بالمستقبل" : "Pick a future date") : dict.common.somethingWrong);
        return;
      }
      router.push(`/${locale}/group/manage/${r.token}?new=1`);
    });
  };

  const err = (k: string) => (errors[k] ? "border-danger" : "");
  return (
    <form onSubmit={submit} className="space-y-5 rounded-[1.5rem] border border-line bg-paper p-5 sm:p-7" noValidate>
      {product && (
        <p className="rounded-2xl bg-pine-soft px-4 py-3 text-sm font-semibold text-pine">{ar ? "المنتج:" : "Product:"} {product.name}</p>
      )}
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
      {!product && (
        <fieldset>
          <legend className="mb-1.5 text-sm font-semibold">{ar ? "نوع القطعة" : "Garment"}</legend>
          <div className="grid grid-cols-3 gap-2">
            {QUOTE_PRODUCT_TYPES.map((t, i) => (
              <label key={t} className="cursor-pointer">
                <input type="radio" name="product_type" value={t} defaultChecked={i === 0} className="peer sr-only" />
                <span className="flex h-12 items-center justify-center rounded-2xl border border-line text-sm font-bold transition peer-checked:border-ink peer-checked:bg-ink peer-checked:text-paper peer-focus-visible:ring-2 peer-focus-visible:ring-pine">{dict.bulk.productTypes[t]}</span>
              </label>
            ))}
          </div>
        </fieldset>
      )}
      <label className="block">
        <span className="mb-1.5 block text-sm font-semibold">{ar ? "الفكرة أو التصميم (اختياري)" : "Idea or design (optional)"}</span>
        <textarea name="idea" rows={3} maxLength={1000} className="field w-full" placeholder={ar ? "مثلاً: شعار الكلية على الصدر وأسماء على الظهر، لون أسود" : "e.g. College logo on the chest, names on the back, black"} />
      </label>
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block">
          <span className="mb-1.5 block text-sm font-semibold">{ar ? "آخر موعد للتسجيل (اختياري)" : "Last day to join (optional)"}</span>
          <input type="date" name="deadline" className={cn("field w-full", err("deadline"))} />
        </label>
        <label className="flex items-center gap-3 self-end rounded-2xl border border-line px-4 py-3 text-sm font-semibold">
          <input type="checkbox" name="allow_names" defaultChecked className="size-5 accent-[var(--color-pine,#376352)]" />
          {ar ? "كل واحد يكتب الاسم اللي ينطبع على قطعته" : "Each person writes the name to print on their piece"}
        </label>
      </div>
      <button type="submit" disabled={pending} className="btn btn-brand h-12 w-full text-base">
        {pending ? <Loader2 className="size-5 animate-spin" /> : <Users className="size-5" />} {ar ? "سوّي الرابط" : "Create the link"}
      </button>
      <p className="text-xs text-mute">{ar ? "بعدها تاخذ رابط تدزه بالكروب، وكل واحد يسجل اسمه وقياسه. أنت تشوف القائمة وترسلها لنا بضغطة." : "You'll get a link for the group chat; everyone adds their name and size. You see the list and send it to us in one tap."}</p>
    </form>
  );
}
