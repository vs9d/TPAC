"use client";
import Link from "next/link";
import { useActionState } from "react";
import { Loader2 } from "lucide-react";
import { signIn, signUp, requestPasswordReset, updatePassword, type AuthState } from "@/lib/actions/account";
import { useI18n } from "@/components/i18n-provider";

function useAuthErrors() {
  const { dict } = useI18n();
  return (state: AuthState) => {
    if (!state || state.ok) return null;
    const map: Record<string, string> = {
      invalid_credentials: dict.auth.invalidCredentials,
      email_taken: dict.auth.emailTaken,
      weak_password: dict.auth.weakPassword,
      rate_limited: dict.checkout.errors.rate_limited!,
      email_not_confirmed: dict.auth.checkEmail,
    };
    return map[state.error] ?? (state.error === "validation" ? null : dict.common.somethingWrong);
  };
}

function FieldError({ state, name }: { state: AuthState; name: string }) {
  const { dict } = useI18n();
  if (!state || state.ok || !state.fields?.[name]) return null;
  const key = state.fields[name]!;
  const text = key === "mismatch" ? dict.auth.passwordsMismatch : dict.validation[key as keyof typeof dict.validation] ?? dict.validation.required;
  return <p className="mt-1 text-xs text-danger">{text}</p>;
}

export function LoginForm({ next }: { next?: string }) {
  const { locale, dict } = useI18n();
  const [state, action, pending] = useActionState(signIn, null);
  const error = useAuthErrors()(state);
  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="locale" value={locale} />
      <input type="hidden" name="next" value={next ?? ""} />
      {error && <p className="bg-danger/10 p-3 text-sm text-danger" role="alert">{error}</p>}
      <div><label htmlFor="email" className="label">{dict.auth.email}</label><input id="email" name="email" type="email" required autoComplete="email" dir="ltr" className="field" /></div>
      <div>
        <div className="flex justify-between"><label htmlFor="password" className="label">{dict.auth.password}</label><Link href={`/${locale}/account/forgot-password`} className="text-xs underline">{dict.auth.forgot}</Link></div>
        <input id="password" name="password" type="password" required autoComplete="current-password" className="field" />
      </div>
      <button disabled={pending} className="btn btn-primary w-full">{pending ? <Loader2 className="size-4 animate-spin" /> : dict.auth.login}</button>
      <p className="text-center text-sm text-mute">{dict.auth.noAccount} <Link href={`/${locale}/account/register${next ? `?next=${encodeURIComponent(next)}` : ""}`} className="font-semibold text-ink underline">{dict.auth.registerTitle}</Link></p>
    </form>
  );
}

export function RegisterForm({ next }: { next?: string }) {
  const { locale, dict } = useI18n();
  const [state, action, pending] = useActionState(signUp, null);
  const error = useAuthErrors()(state);
  if (state?.ok) return <p className="bg-pine/10 p-4 text-sm font-medium text-pine">{dict.auth.checkEmail}</p>;
  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="locale" value={locale} />
      <input type="hidden" name="next" value={next ?? ""} />
      {error && <p className="bg-danger/10 p-3 text-sm text-danger" role="alert">{error}</p>}
      <div><label htmlFor="full_name" className="label">{dict.auth.fullName}</label><input id="full_name" name="full_name" required autoComplete="name" className="field" /><FieldError state={state} name="full_name" /></div>
      <div><label htmlFor="email" className="label">{dict.auth.email}</label><input id="email" name="email" type="email" required autoComplete="email" dir="ltr" className="field" /><FieldError state={state} name="email" /></div>
      <div><label htmlFor="phone" className="label">{dict.auth.phone}</label><input id="phone" name="phone" type="tel" inputMode="tel" required autoComplete="tel" dir="ltr" placeholder="07xx xxx xxxx" className="field" /><FieldError state={state} name="phone" /></div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div><label htmlFor="password" className="label">{dict.auth.password}</label><input id="password" name="password" type="password" required minLength={8} autoComplete="new-password" className="field" /><p className="mt-1 text-xs text-mute">{dict.auth.passwordHint}</p><FieldError state={state} name="password" /></div>
        <div><label htmlFor="confirm" className="label">{dict.auth.confirmPassword}</label><input id="confirm" name="confirm" type="password" required autoComplete="new-password" className="field" /><FieldError state={state} name="confirm" /></div>
      </div>
      <button disabled={pending} className="btn btn-primary w-full">{pending ? <Loader2 className="size-4 animate-spin" /> : dict.auth.register}</button>
      <p className="text-center text-sm text-mute">{dict.auth.haveAccount} <Link href={`/${locale}/account/login`} className="font-semibold text-ink underline">{dict.auth.loginTitle}</Link></p>
    </form>
  );
}

export function ForgotForm() {
  const { locale, dict } = useI18n();
  const [state, action, pending] = useActionState(requestPasswordReset, null);
  if (state?.ok) return <p className="bg-pine/10 p-4 text-sm font-medium text-pine">{dict.auth.linkSent}</p>;
  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="locale" value={locale} />
      {state?.ok === false && <p className="bg-danger/10 p-3 text-sm text-danger">{dict.checkout.errors.rate_limited}</p>}
      <div><label htmlFor="email" className="label">{dict.auth.email}</label><input id="email" name="email" type="email" required autoComplete="email" dir="ltr" className="field" /></div>
      <button disabled={pending} className="btn btn-primary w-full">{dict.auth.sendLink}</button>
    </form>
  );
}

export function NewPasswordForm() {
  const { locale, dict } = useI18n();
  const [state, action, pending] = useActionState(updatePassword, null);
  const error = useAuthErrors()(state);
  if (state?.ok) return <div className="space-y-4"><p className="bg-pine/10 p-4 text-sm font-medium text-pine">{dict.auth.resetDone}</p><Link href={`/${locale}/account`} className="btn btn-primary w-full">{dict.nav.account}</Link></div>;
  return (
    <form action={action} className="space-y-4">
      {error && <p className="bg-danger/10 p-3 text-sm text-danger" role="alert">{error}</p>}
      <div><label htmlFor="password" className="label">{dict.auth.password}</label><input id="password" name="password" type="password" required minLength={8} autoComplete="new-password" className="field" /><FieldError state={state} name="password" /></div>
      <div><label htmlFor="confirm" className="label">{dict.auth.confirmPassword}</label><input id="confirm" name="confirm" type="password" required autoComplete="new-password" className="field" /><FieldError state={state} name="confirm" /></div>
      <button disabled={pending} className="btn btn-primary w-full">{dict.common.save}</button>
    </form>
  );
}
