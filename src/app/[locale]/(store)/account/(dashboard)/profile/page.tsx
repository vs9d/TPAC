import { notFound } from "next/navigation";
import { isLocale } from "@/lib/i18n/config";
import { getDictionary } from "@/lib/i18n";
import { requireUser } from "@/lib/auth";
import { ProfileForm } from "@/components/account/profile-form";
import { NewPasswordForm } from "@/components/account/auth-forms";

export const metadata = { robots: { index: false } };

export default async function ProfilePage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const dict = getDictionary(locale);
  const session = await requireUser(locale);
  if (!session.profile) notFound();
  return (
    <div className="space-y-14">
      <section>
        <h2 className="display mb-6 text-2xl">{dict.account.profile}</h2>
        <ProfileForm profile={session.profile} email={session.email} />
      </section>
      <section className="max-w-xl">
        <h2 className="display mb-6 text-2xl">{dict.account.changePassword}</h2>
        <NewPasswordForm />
      </section>
    </div>
  );
}
