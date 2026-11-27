import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { CheckCircle2 } from "lucide-react";
import { isLocale } from "@/lib/i18n/config";
import { getDictionary } from "@/lib/i18n";
import { getSession } from "@/lib/auth";
import { PushToggle } from "@/components/pwa/push-toggle";

export const metadata: Metadata = { robots: { index: false } };

export default async function SuccessPage({ params, searchParams }: { params: Promise<{ locale: string }>; searchParams: Promise<{ order?: string }> }) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const dict = getDictionary(locale);
  const { order } = await searchParams;
  const orderNumber = order && /^TP\d{4,10}$/.test(order) ? order : null;
  const session = await getSession();
  return (
    <div className="container-x flex flex-col items-center py-24 text-center">
      <CheckCircle2 className="size-14 text-pine" strokeWidth={1.4} />
      <h1 className="display mt-6 text-4xl md:text-5xl">{dict.checkout.successTitle}</h1>
      <p className="mt-4 max-w-md text-mute">{dict.checkout.successBody}</p>
      {orderNumber && (
        <div className="mt-8 border border-ink px-8 py-5">
          <p className="eyebrow text-mute">{dict.checkout.orderNumber}</p>
          <p className="display mt-1 text-3xl" dir="ltr">{orderNumber}</p>
        </div>
      )}
      {/* signed in: offer order updates on the phone right when they matter */}
      {session && <PushToggle className="mt-8 w-full max-w-md text-start" />}
      <div className="mt-10 flex flex-wrap justify-center gap-3">
        <Link href={`/${locale}/track${orderNumber ? `?order=${orderNumber}` : ""}`} className="btn btn-primary">{dict.checkout.trackOrder}</Link>
        <Link href={`/${locale}/shop`} className="btn btn-outline">{dict.cart.continueShopping}</Link>
      </div>
    </div>
  );
}
