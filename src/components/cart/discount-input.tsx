"use client";
import { useState } from "react";
import { useI18n, fmt } from "@/components/i18n-provider";
import { useCart } from "./store";
import { formatIQD } from "@/lib/format";
import type { CartQuote } from "@/lib/types";

export function DiscountInput({ quote }: { quote: CartQuote | null }) {
  const { locale, dict } = useI18n();
  const code = useCart((s) => s.discountCode);
  const setCode = useCart((s) => s.setDiscountCode);
  const [value, setValue] = useState(code);
  const d = quote?.discount;
  const err = d && !d.valid ? fmt(dict.cart.discountErrors[d.error ?? "invalid_code"] ?? dict.cart.discountErrors.invalid_code!, { n: d.min_order_total ? formatIQD(d.min_order_total, locale) : "" }) : null;
  return (
    <div>
      <form
        className="flex"
        onSubmit={(e) => {
          e.preventDefault();
          setCode(value.trim().toUpperCase());
        }}
      >
        <label htmlFor="discount" className="sr-only">{dict.cart.discountCode}</label>
        <input id="discount" value={value} onChange={(e) => setValue(e.target.value)} placeholder={dict.cart.discountCode} className="field h-11 uppercase" maxLength={32} autoComplete="off" />
        <button className="btn btn-outline h-11 shrink-0">{dict.cart.apply}</button>
      </form>
      {code && d?.valid && (
        <p className="mt-2 flex items-center justify-between text-xs font-semibold text-pine">
          {dict.cart.discountApplied}: {d.code}
          <button type="button" onClick={() => { setCode(""); setValue(""); }} className="text-mute underline">{dict.cart.remove}</button>
        </p>
      )}
      {code && err && <p className="mt-2 text-xs font-semibold text-danger" role="alert">{err}</p>}
    </div>
  );
}
