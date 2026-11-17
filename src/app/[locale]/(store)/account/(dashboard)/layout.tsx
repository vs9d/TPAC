export const dynamic = "force-dynamic";
import Link from "next/link";
import { notFound } from "next/navigation";
import { isLocale } from "@/lib/i18n/config";
import { getDictionary } from "@/lib/i18n";
import { requireUser, isStaffRole } from "@/lib/auth";
import { signOut } from "@/lib/actions/account";
import { AccountNav } from "@/components/account/account-nav";

export default async function AccountLayout({ children, params }: { children: React.ReactNode; params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const dict = getDictionary(locale);
  const session = await requireUser(locale, `/${locale}/account`);
  return (
    <div className="container-x py-10 md:py-14">
      <div className="mb-10 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="eyebrow text-mute">{dict.account.title}</p>
          <h1 className="display mt-2 text-4xl md:text-5xl">{dict.account.welcome.replace("{name}", session.profile?.full_name?.split(" ")[0] ?? "")}</h1>
        </div>
        <div className="flex gap-2">
          {isStaffRole(session.profile?.role) && <Link href={`/${locale}/admin`} className="btn btn-accent btn-sm">{dict.nav.admin}</Link>}
          <form action={signOut}><input type="hidden" name="locale" value={locale} /><button className="btn btn-outline btn-sm">{dict.nav.logout}</button></form>
        </div>
      </div>
      <div className="grid gap-10 lg:grid-cols-[220px_1fr]">
        <AccountNav />
        <div className="min-w-0">{children}</div>
      </div>
    </div>
  );
}
