"use client";
import { useActionState, useEffect, useState } from "react";
import { saveAddress, deleteAddress } from "@/lib/actions/account";
import { useI18n } from "@/components/i18n-provider";
import { GOVERNORATES } from "@/lib/iraq";
import { formatIraqiPhone } from "@/lib/phone";
import type { Address } from "@/lib/types";

export function AddressForm({ address, onDone }: { address?: Address; onDone?: () => void }) {
  const { locale, dict } = useI18n();
  const [state, action, pending] = useActionState(saveAddress, null);
  useEffect(() => {
    if (state?.ok) onDone?.();
  }, [state, onDone]);
  const fe = (k: string) => (state && !state.ok && state.fields?.[k] ? <p className="mt-1 text-xs text-danger">{dict.validation[state.fields[k] as keyof typeof dict.validation] ?? dict.validation.required}</p> : null);
  return (
    <form action={action} className="grid gap-4 border border-line p-5 sm:grid-cols-2">
      {address && <input type="hidden" name="id" value={address.id} />}
      <div className="sm:col-span-2"><label className="label" htmlFor="label">{dict.account.label}</label><input id="label" name="label" defaultValue={address?.label ?? ""} className="field" maxLength={60} /></div>
      <div><label className="label" htmlFor="a-name">{dict.checkout.fullName}</label><input id="a-name" name="full_name" defaultValue={address?.full_name ?? ""} required className="field" />{fe("full_name")}</div>
      <div><label className="label" htmlFor="a-phone">{dict.checkout.phone}</label><input id="a-phone" name="phone" type="tel" dir="ltr" defaultValue={formatIraqiPhone(address?.phone)} required className="field" />{fe("phone")}</div>
      <div>
        <label className="label" htmlFor="a-gov">{dict.checkout.governorate}</label>
        <select id="a-gov" name="governorate" defaultValue={address?.governorate ?? ""} required className="field">
          <option value="">{dict.checkout.selectGovernorate}</option>
          {GOVERNORATES.map((g) => <option key={g.code} value={g.code}>{g[locale]}</option>)}
        </select>
        {fe("governorate")}
      </div>
      <div><label className="label" htmlFor="a-city">{dict.checkout.city}</label><input id="a-city" name="city" defaultValue={address?.city ?? ""} required className="field" />{fe("city")}</div>
      <div className="sm:col-span-2"><label className="label" htmlFor="a-line">{dict.checkout.address}</label><textarea id="a-line" name="address_line" rows={2} defaultValue={address?.address_line ?? ""} required className="field" placeholder={dict.checkout.addressHint} />{fe("address_line")}</div>
      <div className="sm:col-span-2"><label className="label" htmlFor="a-notes">{dict.checkout.instructions}</label><input id="a-notes" name="notes" defaultValue={address?.notes ?? ""} className="field" /></div>
      <label className="flex items-center gap-3 text-sm sm:col-span-2"><input type="checkbox" name="is_default" defaultChecked={address?.is_default} className="size-4 accent-ink" /> {dict.account.makeDefault}</label>
      <div className="flex gap-2 sm:col-span-2">
        <button disabled={pending} className="btn btn-primary">{dict.common.save}</button>
        {onDone && <button type="button" onClick={onDone} className="btn btn-ghost">{dict.common.cancel}</button>}
      </div>
    </form>
  );
}

export function AddressList({ addresses }: { addresses: Address[] }) {
  const { locale, dict } = useI18n();
  const [editing, setEditing] = useState<string | "new" | null>(addresses.length ? null : "new");
  return (
    <div className="space-y-4">
      {addresses.length === 0 && editing !== "new" && <p className="text-mute">{dict.account.noAddresses}</p>}
      <ul className="grid gap-4 md:grid-cols-2">
        {addresses.map((a) =>
          editing === a.id ? (
            <li key={a.id} className="md:col-span-2"><AddressForm address={a} onDone={() => setEditing(null)} /></li>
          ) : (
            <li key={a.id} className="border border-line p-5 text-sm">
              <div className="mb-2 flex items-center justify-between">
                <p className="font-semibold">{a.label || a.city}</p>
                {a.is_default && <span className="bg-ink px-2 py-0.5 text-[10px] font-bold text-paper">{dict.account.default}</span>}
              </div>
              <p>{a.full_name} · <span dir="ltr">{formatIraqiPhone(a.phone)}</span></p>
              <p className="text-mute">{GOVERNORATES.find((g) => g.code === a.governorate)?.[locale]} — {a.city}</p>
              <p className="text-mute">{a.address_line}</p>
              <div className="mt-4 flex gap-4 text-xs font-semibold">
                <button onClick={() => setEditing(a.id)} className="underline">{dict.common.edit}</button>
                <button onClick={() => deleteAddress(a.id)} className="text-danger underline">{dict.common.delete}</button>
              </div>
            </li>
          ),
        )}
      </ul>
      {editing === "new" ? <AddressForm onDone={addresses.length ? () => setEditing(null) : undefined} /> : <button onClick={() => setEditing("new")} className="btn btn-outline">{dict.account.addAddress}</button>}
    </div>
  );
}
