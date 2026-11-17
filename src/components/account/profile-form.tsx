"use client";
import { useActionState } from "react";
import { updateProfile } from "@/lib/actions/account";
import { useI18n } from "@/components/i18n-provider";
import { formatIraqiPhone } from "@/lib/phone";
import type { Profile } from "@/lib/types";

export function ProfileForm({ profile, email }: { profile: Profile; email: string | null }) {
  const { dict } = useI18n();
  const [state, action, pending] = useActionState(updateProfile, null);
  const fe = (k: string) => (state && !state.ok && state.fields?.[k] ? <p className="mt-1 text-xs text-danger">{dict.validation[state.fields[k] as keyof typeof dict.validation] ?? dict.validation.required}</p> : null);
  return (
    <form action={action} className="grid max-w-xl gap-4">
      <div><label className="label" htmlFor="p-email">{dict.auth.email}</label><input id="p-email" value={email ?? ""} disabled dir="ltr" className="field bg-bone" /></div>
      <div><label className="label" htmlFor="p-name">{dict.auth.fullName}</label><input id="p-name" name="full_name" defaultValue={profile.full_name ?? ""} required className="field" />{fe("full_name")}</div>
      <div><label className="label" htmlFor="p-phone">{dict.auth.phone}</label><input id="p-phone" name="phone" type="tel" dir="ltr" defaultValue={formatIraqiPhone(profile.phone)} required className="field" />{fe("phone")}</div>
      <div>
        <label className="label" htmlFor="p-locale">{dict.common.language === "English" ? "اللغة" : "Language"}</label>
        <select id="p-locale" name="preferred_locale" defaultValue={profile.preferred_locale} className="field">
          <option value="ar">العربية</option>
          <option value="en">English</option>
        </select>
      </div>
      <label className="flex items-center gap-3 text-sm"><input type="checkbox" name="marketing_opt_in" defaultChecked={profile.marketing_opt_in} className="size-4 accent-ink" /> {dict.account.marketing}</label>
      {state?.ok && <p className="text-sm font-medium text-pine">{dict.common.saved}</p>}
      <button disabled={pending} className="btn btn-primary w-fit">{dict.common.save}</button>
    </form>
  );
}
