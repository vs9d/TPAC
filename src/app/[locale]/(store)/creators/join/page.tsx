import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { isLocale } from "@/lib/i18n/config";
import { getSession } from "@/lib/auth";
import { getMyCreator } from "@/lib/creators";
import { CreatorJoinForm } from "@/components/creators/join-form";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "TPAC Creators — انضم", robots: { index: false } };

export default async function CreatorJoinPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const ar = locale === "ar";
  const [session, me] = await Promise.all([getSession(), getMyCreator().catch(() => null)]);
  return (
    <div className="container-x max-w-2xl space-y-6 py-10 md:py-14">
      <header className="space-y-2">
        <p className="eyebrow text-pine">TPAC Creators</p>
        <h1 className="display text-3xl md:text-5xl">{ar ? "انضم كمبدع" : "Join as a creator"}</h1>
        <p className="text-mute">{ar ? "صمّم مرة، واربح كل ما تنباع قطعة. نراجع حسابك ونفعّله، وبعدها تفتح لوحتك وتبدي ترفع تصاميمك." : "Design once, earn every time a piece sells. We review and approve your account, then your dashboard opens."}</p>
        {!session && <p className="text-sm">{ar ? "عندك حساب TPAC؟" : "Have a TPAC account?"} <Link href={`/${locale}/account/login?next=/${locale}/creators/join`} className="font-semibold underline">{ar ? "سجّل دخول أولاً" : "Sign in first"}</Link></p>}
      </header>
      {me ? (
        <div className="rounded-[1.5rem] bg-bone p-6 text-center">
          <p className="font-bold">{me.status === "approved" ? (ar ? "حسابك مفعّل ✓" : "Your account is active ✓") : me.status === "pending" ? (ar ? "وصل طلبك 🎉 — قيد المراجعة، نفعّله بأقرب وقت ويوصلك إشعار" : "Application received 🎉 — under review, we'll notify you soon") : me.status === "suspended" ? (ar ? "حسابك موقوف — تواصل ويانا" : "Your account is suspended — contact us") : (ar ? "ما انقبل طلبك" : "Your application was not accepted")}</p>
          <Link href={`/${locale}/creator-studio`} className="btn btn-brand mt-4 h-12">{ar ? "لوحة المبدع" : "Creator dashboard"}</Link>
        </div>
      ) : (
        <CreatorJoinForm signedIn={!!session} defaults={{ name: session?.profile?.full_name ?? "", phone: session?.profile?.phone ?? "", email: session?.email ?? "" }} />
      )}
    </div>
  );
}
