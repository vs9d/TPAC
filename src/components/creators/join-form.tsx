"use client";
import { useRef, useState, useTransition } from "react";
import Link from "next/link";
import { Check, Loader2, Sparkles, UserRound } from "lucide-react";
import { useI18n } from "@/components/i18n-provider";
import { toast } from "@/components/ui/toast";
import { joinCreators, updateCreatorProfile } from "@/lib/actions/creators";
import { cn } from "@/lib/format";
import { CREATOR_SOCIALS as SOCIALS } from "@/lib/creator-labels";
import { creatorUpload } from "./upload";

/** Which field to fix, in words (the first wrong one). */
export function creatorFieldError(fields: Record<string, string> | undefined, ar: boolean): string | null {
  if (!fields) return null;
  const social = Object.keys(fields).find((k) => k.startsWith("socials."));
  if (social) {
    const label = SOCIALS.find(([k]) => `socials.${k}` === social)?.[1] ?? "";
    return ar ? `رابط ${label} مو صحيح — اكتب اسم حسابك مثل ‎@yourname أو انسخ الرابط كامل` : `${label} link isn't valid — type your handle like @yourname or paste the full link`;
  }
  const names: Record<string, [string, string]> = { display_name: ["الاسم (حرفين أو أكثر)", "Name (2+ characters)"], email: ["البريد الإلكتروني", "Email"], password: ["كلمة المرور (٨ أحرف أو أكثر)", "Password (8+ characters)"], bio: ["النبذة (لغاية ٦٠٠ حرف)", "Bio (up to 600 characters)"], phone: ["رقم الهاتف", "Phone"] };
  const k = Object.keys(fields).find((x) => names[x]);
  return k ? (ar ? `صحّح: ${names[k]![0]}` : `Please fix: ${names[k]![1]}`) : null;
}

/** Becoming a TPAC creator: account (if needed), public name and @username, phone, bio, photo, social links. */
export function CreatorJoinForm({ signedIn, defaults }: { signedIn: boolean; defaults: { name: string; phone: string; email: string } }) {
  const { locale } = useI18n();
  const ar = locale === "ar";
  const [pending, start] = useTransition();
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [done, setDone] = useState<{ needsEmail: boolean } | null>(null);
  const [avatar, setAvatar] = useState<File | null>(null);
  const [user, setUser] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  const submit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const socials = Object.fromEntries(SOCIALS.map(([k]) => [k, String(fd.get(k) ?? "").trim()]).filter(([, v]) => v));
    start(async () => {
      const r = await joinCreators({
        username: user, display_name: fd.get("display_name"), phone: fd.get("phone"), bio: fd.get("bio") || undefined, socials, email: fd.get("email"),
        ...(signedIn ? {} : { password: fd.get("password") }),
      });
      if (!r.ok) {
        setErrors(r.fields ?? {});
        toast.error(
          r.fields?.username ? (r.fields.username === "taken" ? (ar ? "اسم المستخدم محجوز — جرّب غيره" : "That username is taken") : (ar ? "اسم المستخدم: حروف إنكليزية صغيرة وأرقام و _ . (٣ حروف أو أكثر)" : "Username: lowercase letters, digits, _ and . (3+)"))
            : r.error === "email_taken" ? (ar ? "هذا الإيميل عنده حساب — سجّل دخول أولاً" : "That email has an account — sign in first")
              : r.error === "weak_password" ? (ar ? "الرمز ضعيف — ٨ أحرف أو أكثر" : "Password too weak — 8+ characters")
                : r.error === "already" ? (ar ? "عندك طلب انضمام من قبل" : "You've already applied")
                  : r.fields?.email ? (ar ? "اكتب إيميل صحيح — عليه توصلك إشعارات المبيعات والأرباح" : "Enter a valid email — sales and earnings notifications go there")
                  : r.fields?.phone ? (ar ? "رقم الهاتف غير صحيح" : "Phone number is not valid")
                    : r.error === "rate_limited" ? (ar ? "محاولات كثيرة — حاول بعد شوي" : "Too many tries — try again shortly")
                      : r.error === "signup_busy" ? (ar ? "التسجيلات كثيرة هسه — جرّب بعد ساعة، أو سجّل دخول إذا عندك حساب" : "Too many sign-ups right now — try again in an hour, or sign in if you have an account")
                      : creatorFieldError(r.fields, ar) ?? (r.error === "generic" ? (ar ? "صار خلل بسيط — جرّب مرة ثانية" : "Something went wrong — try again") : ar ? "تأكد من الخانات" : "Check the fields"),
        );
        return;
      }
      if (avatar && !r.needsEmail) {
        try {
          const up = await creatorUpload(avatar, "avatar", avatar.type);
          await updateCreatorProfile({ display_name: String(fd.get("display_name")), phone: String(fd.get("phone")), email: String(fd.get("email") ?? ""), bio: String(fd.get("bio") ?? ""), socials, avatar_url: up.url });
        } catch { /* the photo can be added later from the profile */ }
      }
      // keep the thank-you on screen (a refresh would swap the form for the status box)
      setDone({ needsEmail: !!r.needsEmail });
    });
  };

  if (done) {
    return (
      <div className="space-y-4 rounded-[1.5rem] border border-pine bg-pine-soft/40 p-6 text-center" role="status">
        <Check className="mx-auto size-10 text-pine" aria-hidden="true" />
        <p className="display text-2xl">{ar ? "وصل طلبك 🎉" : "Application received 🎉"}</p>
        <p className="text-sm leading-relaxed text-mute">{done.needsEmail ? (ar ? "أكّد إيميلك من الرسالة اللي وصلتك، وبعد ما نراجع حسابك ونفعّله تفتح لوحة المبدع." : "Confirm your email from the message we sent; once we review and approve your account, your creator dashboard opens.") : (ar ? "نراجع حسابك ونفعّله بأقرب وقت، ويوصلك إشعار. خلال هالفترة تكدر تجهّز ملفات تصاميمك (PNG بخلفية شفافة)." : "We'll review and approve your account soon. Meanwhile, get your designs ready (transparent PNG).")}</p>
        {!done.needsEmail && <Link href={`/${locale}/creator-studio`} className="btn btn-brand h-12">{ar ? "لوحة المبدع" : "Creator dashboard"}</Link>}
      </div>
    );
  }

  const err = (k: string) => (errors[k] ? "border-danger" : "");
  return (
    <form onSubmit={submit} className="space-y-5 rounded-[1.5rem] border border-line bg-paper p-5 sm:p-7" noValidate>
      <div className="flex items-center gap-4">
        <button type="button" onClick={() => fileRef.current?.click()} className="relative grid size-20 shrink-0 place-items-center overflow-hidden rounded-full border-2 border-dashed border-line bg-bone" aria-label={ar ? "صورتك الشخصية" : "Profile photo"}>
          {avatar ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={URL.createObjectURL(avatar)} alt="" className="size-full object-cover" />
          ) : <UserRound className="size-8 text-mute" />}
        </button>
        <input ref={fileRef} type="file" accept="image/png,image/jpeg,image/webp" className="hidden" onChange={(e) => setAvatar(e.target.files?.[0] ?? null)} aria-label={ar ? "ملف الصورة الشخصية" : "Profile photo file"} />
        <p className="text-sm text-mute">{ar ? "صورتك الشخصية (اختياري) — تطلع بصفحتك." : "Your profile photo (optional) — shown on your page."}</p>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block">
          <span className="mb-1.5 block text-sm font-semibold">{ar ? "الاسم الكامل / اسم العرض" : "Full / display name"} <span className="text-danger">*</span></span>
          <input name="display_name" required maxLength={60} defaultValue={defaults.name} className={cn("field w-full", err("display_name"))} autoComplete="name" />
        </label>
        <label className="block">
          <span className="mb-1.5 block text-sm font-semibold">{ar ? "اسم المستخدم" : "Username"} <span className="text-danger">*</span></span>
          <div className={cn("field flex w-full items-center gap-1", err("username"))} dir="ltr">
            <span className="text-mute">thetpac.com/creator/</span>
            <input value={user} onChange={(e) => setUser(e.target.value.toLowerCase().replace(/[^a-z0-9_.]/g, "").slice(0, 30))} required className="min-w-0 flex-1 bg-transparent outline-none" aria-label={ar ? "اسم المستخدم" : "Username"} placeholder="yourname" />
          </div>
        </label>
        <label className="block">
          <span className="mb-1.5 block text-sm font-semibold">{ar ? "رقم الهاتف" : "Phone"} <span className="text-danger">*</span></span>
          <input name="phone" required inputMode="tel" dir="ltr" defaultValue={defaults.phone} className={cn("field w-full", err("phone"))} placeholder="07XX XXX XXXX" autoComplete="tel" />
        </label>
        <label className="block">
          <span className="mb-1.5 block text-sm font-semibold">{ar ? "البريد الإلكتروني" : "Email"} <span className="text-danger">*</span></span>
          <input name="email" type="email" required dir="ltr" defaultValue={defaults.email} className={cn("field w-full", err("email"))} autoComplete="email" aria-describedby="creator-email-help" />
          <span id="creator-email-help" className="mt-1 block text-xs text-mute">{ar ? "عليه توصلك إشعارات المبيعات والأرباح والسحب." : "Sales, earnings and payout notifications are sent here."}</span>
        </label>
        {!signedIn && (
          <>
            <label className="block sm:col-span-2">
              <span className="mb-1.5 block text-sm font-semibold">{ar ? "كلمة المرور (٨ أحرف أو أكثر)" : "Password (8+ characters)"} <span className="text-danger">*</span></span>
              <input name="password" type="password" required minLength={8} className={cn("field w-full", err("password"))} autoComplete="new-password" />
            </label>
          </>
        )}
      </div>
      <label className="block">
        <span className="mb-1.5 block text-sm font-semibold">{ar ? "نبذة عنك" : "About you"}</span>
        <textarea name="bio" rows={3} maxLength={600} className="field w-full" placeholder={ar ? "شنو تصمم؟ شنو أسلوبك؟ من وين تستلهم؟" : "What do you design? Your style? Your inspiration?"} />
      </label>
      <fieldset>
        <legend className="mb-1.5 text-sm font-semibold">{ar ? "حساباتك (اختياري)" : "Your accounts (optional)"}</legend>
        <div className="grid gap-2 sm:grid-cols-2">
          {SOCIALS.map(([k, label]) => <input key={k} name={k} type="text" inputMode="url" autoCapitalize="off" autoCorrect="off" spellCheck={false} dir="ltr" className={cn("field w-full text-sm", err(`socials.${k}`))} placeholder={k === "website" ? "Website — yoursite.com" : `${label} — @yourname`} aria-label={label} aria-invalid={!!errors[`socials.${k}`]} />)}
        </div>
      </fieldset>
      <button type="submit" disabled={pending || user.length < 3} className="btn btn-brand h-12 w-full text-base">
        {pending ? <Loader2 className="size-5 animate-spin" /> : <Sparkles className="size-5" />} {ar ? "قدّم طلب الانضمام" : "Apply to join"}
      </button>
      <p className="text-xs text-mute">{ar ? "بالتقديم توافق إن التصاميم لازم تكون من شغلك أنت — بدون شعارات ماركات أو صور أشخاص بدون إذنهم. حسابك يتفعل بعد مراجعة الإدارة." : "By applying you agree your designs are your own work — no brand logos or people's photos without consent. Your account opens after review."}</p>
    </form>
  );
}
