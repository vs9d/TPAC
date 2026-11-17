import { notFound } from "next/navigation";
import { isLocale } from "@/lib/i18n/config";
import { getDictionary } from "@/lib/i18n";
import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { AddressList } from "@/components/account/address-form";
import type { Address } from "@/lib/types";

export const metadata = { robots: { index: false } };

export default async function AddressesPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const dict = getDictionary(locale);
  const session = await requireUser(locale);
  const supabase = await createClient();
  const { data } = await supabase.from("addresses").select("*").eq("user_id", session.userId).order("created_at");
  return (
    <section>
      <h2 className="display mb-6 text-2xl">{dict.account.addresses}</h2>
      <AddressList addresses={(data as Address[]) ?? []} />
    </section>
  );
}
