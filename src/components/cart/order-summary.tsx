"use client";
import { useI18n, fmt } from "@/components/i18n-provider";
import { formatIQD } from "@/lib/format";
import type { CartQuote } from "@/lib/types";

export function OrderSummary({ quote, showDelivery, loading }: { quote: CartQuote | null; showDelivery: boolean; loading?: boolean }) {
  const { locale, dict } = useI18n();
  const row = (label: string, value: React.ReactNode, strong = false) => (
    <div className={`flex justify-between ${strong ? "text-base font-semibold" : "text-sm"}`}>
      <span>{label}</span>
      <span className="tabular-nums">{value}</span>
    </div>
  );
  return (
    <div className={`space-y-3 transition-opacity ${loading ? "opacity-60" : ""}`}>
      {row(dict.cart.subtotal, quote ? formatIQD(quote.subtotal, locale) : "—")}
      {quote && quote.discount_total > 0 && row(`${dict.cart.discount}${quote.discount?.code ? ` (${quote.discount.code})` : ""}`, <span className="text-pine">− {formatIQD(quote.discount_total, locale)}</span>)}
      {row(dict.cart.delivery, showDelivery && quote?.delivery?.available ? (quote.delivery_fee === 0 ? dict.common.free : formatIQD(quote.delivery_fee, locale)) : <span className="text-mute">{dict.cart.deliveryCalculated}</span>)}
      <div className="border-t border-line pt-3">{row(dict.cart.total, quote ? formatIQD(showDelivery ? quote.total : quote.subtotal - quote.discount_total, locale) : "—", true)}</div>
      {quote?.errors.some((e) => e.code === "min_order_total") && (
        <p className="text-xs font-semibold text-danger">{fmt(dict.cart.minOrder, { n: formatIQD(quote.min_order_total, locale) })}</p>
      )}
    </div>
  );
}
