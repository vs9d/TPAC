"use client";
import { useActionState } from "react";
import { subscribeNewsletter } from "@/lib/actions/forms";
import { useI18n } from "@/components/i18n-provider";
import { cn } from "@/lib/format";

export function NewsletterForm({ dark = false }: { dark?: boolean }) {
  const { locale, dict } = useI18n();
  const [state, action, pending] = useActionState(subscribeNewsletter, null);
  if (state?.ok) return <p className={cn("text-sm font-medium", dark ? "text-amber" : "text-pine")}>{state.exists ? dict.home.newsletterExists : dict.home.newsletterSuccess}</p>;
  return (
    <form action={action} className="flex">
      <input type="hidden" name="locale" value={locale} />
      <label htmlFor={`nl-${dark}`} className="sr-only">{dict.home.newsletterPlaceholder}</label>
      <input
        id={`nl-${dark}`}
        name="email"
        type="email"
        required
        autoComplete="email"
        placeholder={dict.home.newsletterPlaceholder}
        aria-invalid={state?.ok === false}
        className={cn("h-12 min-w-0 flex-1 border px-4 text-sm outline-none", dark ? "border-paper/25 bg-transparent text-paper placeholder:text-paper/40 focus:border-amber" : "border-line bg-paper focus:border-ink")}
      />
      <button disabled={pending} className={cn("btn h-12 shrink-0", dark ? "btn-accent" : "btn-primary")}>{dict.home.newsletterCta}</button>
      {state?.ok === false && <span className="sr-only" role="alert">{dict.validation.email}</span>}
    </form>
  );
}
