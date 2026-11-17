"use client";
import { useActionState } from "react";
import { subscribeNewsletter } from "@/lib/actions/forms";
import { useI18n } from "@/components/i18n-provider";
import { cn } from "@/lib/format";

/** `tone`: "dark" for the footer, "light" on the amber card (always dark text), default on page surfaces. */
export function NewsletterForm({ dark = false, onAccent = false }: { dark?: boolean; onAccent?: boolean }) {
  const { locale, dict } = useI18n();
  const [state, action, pending] = useActionState(subscribeNewsletter, null);
  if (state?.ok) return <p className={cn("text-sm font-semibold", dark ? "text-amber" : onAccent ? "text-[#1a1208]" : "text-pine")}>{state.exists ? dict.home.newsletterExists : dict.home.newsletterSuccess}</p>;
  return (
    <form action={action} className={cn("flex items-center gap-1.5 rounded-full border p-1.5", dark ? "border-snow/25" : onAccent ? "border-[#1a1208]/25 bg-white/40" : "border-line bg-paper")}>
      <input type="hidden" name="locale" value={locale} />
      <label htmlFor={`nl-${dark}-${onAccent}`} className="sr-only">{dict.home.newsletterPlaceholder}</label>
      <input
        id={`nl-${dark}-${onAccent}`}
        name="email"
        type="email"
        size={1}
        required
        autoComplete="email"
        placeholder={dict.home.newsletterPlaceholder}
        aria-invalid={state?.ok === false}
        className={cn("h-11 min-w-0 flex-1 bg-transparent px-4 text-sm outline-none", dark ? "text-snow placeholder:text-snow/40" : onAccent ? "text-[#1a1208] placeholder:text-[#1a1208]/55" : "placeholder:text-mute")}
      />
      <button disabled={pending} className={cn("btn btn-sm h-11 shrink-0", dark ? "btn-accent" : onAccent ? "bg-[#1a1208] text-white hover:bg-black" : "btn-brand")}>{dict.home.newsletterCta}</button>
      {state?.ok === false && <span className="sr-only" role="alert">{dict.validation.email}</span>}
    </form>
  );
}
