import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { isLocale } from "@/lib/i18n/config";
import { requireUser } from "@/lib/auth";
import { getMyCreator } from "@/lib/creators";
import { createAdminClient } from "@/lib/supabase/admin";
import { CreatorStudioNav } from "@/components/creators/studio-nav";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "TPAC Creators — لوحة المبدع", robots: { index: false } };

/** The creator dashboard: signed-in creators only; it opens once staff approve the account. */
export default async function CreatorStudioLayout({ children, params }: { children: React.ReactNode; params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const ar = locale === "ar";
  await requireUser(locale, `/${locale}/creator-studio`);
  const me = await getMyCreator();
  if (!me) redirect(`/${locale}/creators/join`);
  if (me.status !== "approved") {
    const msg = me.status === "pending"
      ? [ar ? "طلبك قيد المراجعة ⏳" : "Under review ⏳", ar ? "نراجع حسابك ونفعّله بأقرب وقت، ويوصلك إشعار. جهّز تصاميمك (PNG بخلفية شفافة) حتى تبدي أول ما ينفتح." : "We'll approve your account soon. Get your designs ready (transparent PNG)."]
      : me.status === "suspended"
        ? [ar ? "حسابك موقوف" : "Account suspended", me.review_note ?? (ar ? "تواصل ويا الإدارة." : "Please contact us.")]
        : [ar ? "ما انقبل طلبك" : "Application not accepted", me.review_note ?? (ar ? "تكدر تتواصل ويانا للتفاصيل." : "Contact us for details.")];
    return (
      <div className="container-x max-w-xl py-16 text-center">
        <p className="eyebrow text-pine">TPAC Creators</p>
        <h1 className="display mt-2 text-3xl">{msg[0]}</h1>
        <p className="mt-3 text-mute">{msg[1]}</p>
        <Link href={`/${locale}/creators`} className="btn btn-outline mt-6 h-12">{ar ? "رجوع" : "Back"}</Link>
      </div>
    );
  }
  const { count } = await createAdminClient().from("creator_notifications").select("id", { count: "exact", head: true }).eq("creator_id", me.user_id).is("read_at", null);
  return (
    <div className="container-x space-y-6 py-8 md:py-10">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="eyebrow text-pine">TPAC Creators</p>
          <h1 className="display text-2xl md:text-3xl">{ar ? `أهلاً ${me.display_name} 👋` : `Hi ${me.display_name} 👋`}</h1>
        </div>
      </header>
      <CreatorStudioNav unread={count ?? 0} username={me.username} />
      {children}
    </div>
  );
}
