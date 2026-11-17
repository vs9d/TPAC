"use client";
import { useActionState } from "react";
import { submitContact } from "@/lib/actions/forms";
import { useI18n } from "@/components/i18n-provider";

export function ContactForm() {
  const { dict } = useI18n();
  const [state, action, pending] = useActionState(submitContact, null);
  if (state?.ok) return <p className="text-lg font-semibold text-pine">{dict.contact.success}</p>;
  const fe = (k: string) => state && !state.ok && state.fields?.[k] ? <p className="mt-1 text-xs text-danger">{dict.validation[state.fields[k] as keyof typeof dict.validation] ?? dict.validation.required}</p> : null;
  return (
    <form action={action} className="space-y-4">
      {state?.ok === false && state.error !== "validation" && <p className="text-sm text-danger" role="alert">{state.error === "rate_limited" ? dict.checkout.errors.rate_limited : dict.common.somethingWrong}</p>}
      <div><label htmlFor="c-name" className="label">{dict.contact.name}</label><input id="c-name" name="name" required className="field" autoComplete="name" />{fe("name")}</div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div><label htmlFor="c-phone" className="label">{dict.checkout.phone}</label><input id="c-phone" name="phone" type="tel" dir="ltr" className="field" autoComplete="tel" /></div>
        <div><label htmlFor="c-email" className="label">{dict.checkout.email}</label><input id="c-email" name="email" type="email" dir="ltr" className="field" autoComplete="email" />{fe("email")}</div>
      </div>
      <div><label htmlFor="c-msg" className="label">{dict.contact.message}</label><textarea id="c-msg" name="message" rows={5} required maxLength={4000} className="field" />{fe("message")}</div>
      <button disabled={pending} className="btn btn-primary w-full">{dict.contact.send}</button>
    </form>
  );
}
