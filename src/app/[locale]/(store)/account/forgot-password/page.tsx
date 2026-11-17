import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { isLocale } from "@/lib/i18n/config";
import { getDictionary } from "@/lib/i18n";
import { getSession } from "@/lib/auth";
import { ForgotForm } from "@/components/account/auth-forms";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  if (!isLocale(locale)) return {};
  return { title: getDictionary(locale).auth.forgotTitle, robots: { index: false } };
}

export default async function Page({ params, searchParams }: { params: Promise<{ locale: string }>; searchParams: Promise<{ next?: string; error?: string }> }) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const dict = getDictionary(locale);
  const sp = await searchParams;
  const session = await getSession();
  if (session) redirect(`/${locale}/account`);
  return (
    <div className="container-x flex justify-center py-14 md:py-24">
      <div className="w-full max-w-md">
        <h1 className="display mb-3 text-4xl">{dict.auth.forgotTitle}</h1>
        <p className="mb-6 text-sm text-mute">{dict.auth.forgotBody}</p>
        {sp.error === "link" && <p className="mb-4 bg-danger/10 p-3 text-sm text-danger">{dict.common.somethingWrong}</p>}
        <div className="mt-6"><ForgotForm  /></div>
      </div>
    </div>
  );
}
