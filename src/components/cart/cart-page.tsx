"use client";
import Link from "next/link";
import { ShoppingBag, Truck, ShieldCheck } from "lucide-react";
import { useI18n } from "@/components/i18n-provider";
import { useQuote } from "./use-quote";
import { lineKey } from "./store";
import { CartLineRow } from "./cart-line";
import { OrderSummary } from "./order-summary";
import { DiscountInput } from "./discount-input";

export function CartPageClient() {
  const { locale, dict } = useI18n();
  const { quote, loading, lines, hydrated } = useQuote();
  const qmap = new Map((quote?.lines ?? []).map((l) => [l.variant_id ?? `d:${l.custom_design_id}`, l]));
  const blocking = quote?.lines.some((l) => l.error);

  if (!hydrated) return <div className="container-x py-24"><div className="skeleton mx-auto h-8 w-48" /></div>;
  if (!lines.length)
    return (
      <div className="container-x flex flex-col items-center gap-4 py-28 text-center">
        <ShoppingBag className="size-12 text-mute" strokeWidth={1.2} />
        <h1 className="display text-4xl">{dict.cart.empty}</h1>
        <p className="text-mute">{dict.cart.emptyBody}</p>
        <Link href={`/${locale}/shop`} className="btn btn-primary mt-4">{dict.common.shopNow}</Link>
      </div>
    );

  return (
    <div className="container-x py-10 md:py-14">
      <h1 className="display mb-10 text-4xl md:text-6xl">{dict.cart.title}</h1>
      <div className="grid gap-12 lg:grid-cols-12">
        <div className="lg:col-span-8">
          {blocking && <p className="mb-4 bg-danger/10 p-3 text-sm font-semibold text-danger" role="alert">{dict.cart.issues}</p>}
          <div className="divide-y divide-line border-y border-line">
            {lines.map((l) => <CartLineRow key={lineKey(l)} line={l} quoted={qmap.get(lineKey(l))} />)}
          </div>
          <Link href={`/${locale}/shop`} className="mt-6 inline-block text-sm font-semibold underline">{dict.cart.continueShopping}</Link>
        </div>
        <aside className="lg:col-span-4">
          <div className="space-y-6 rounded-[1.75rem] bg-bone p-6 lg:sticky lg:top-28">
            <DiscountInput quote={quote} />
            <OrderSummary quote={quote} showDelivery={false} loading={loading} />
            <Link href={`/${locale}/checkout`} aria-disabled={blocking} className={`btn btn-primary w-full ${blocking ? "pointer-events-none opacity-40" : ""}`}>{dict.cart.checkout}</Link>
            <ul className="space-y-2 text-xs text-mute">
              <li className="flex items-center gap-2"><Truck className="size-4" /> {dict.footer.cod}</li>
              <li className="flex items-center gap-2"><ShieldCheck className="size-4" /> {dict.footer.returns}</li>
            </ul>
          </div>
        </aside>
      </div>
    </div>
  );
}
