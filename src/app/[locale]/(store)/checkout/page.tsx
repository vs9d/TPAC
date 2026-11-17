export const dynamic = "force-dynamic";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { isLocale } from "@/lib/i18n/config";
import { getDictionary } from "@/lib/i18n";
import { getDeliveryZones } from "@/lib/data/content";
import { getSession } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { onlinePaymentAvailable } from "@/lib/payments";
import { CheckoutForm } from "@/components/cart/checkout-form";
import type { Address } from "@/lib/types";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  if (!isLocale(locale)) return {};
  return { title: getDictionary(locale).checkout.title, robots: { index: false } };
}

export default async function CheckoutPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const dict = getDictionary(locale);
  const [zones, session] = await Promise.all([getDeliveryZones(), getSession()]);
  let addresses: Address[] = [];
  if (session) {
    const supabase = await createClient();
    const { data } = await supabase.from("addresses").select("*").eq("user_id", session.userId).order("is_default", { ascending: false });
    addresses = (data as Address[]) ?? [];
  }
  return (
    <div className="container-x py-10 md:py-14">
      <h1 className="display mb-10 text-4xl md:text-6xl">{dict.checkout.title}</h1>
      <CheckoutForm
        zones={zones}
        addresses={addresses}
        signedIn={!!session}
        onlinePayment={onlinePaymentAvailable()}
        prefill={{ full_name: session?.profile?.full_name, phone: session?.profile?.phone, email: session?.email }}
      />
    </div>
  );
}
