"use client";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { useI18n } from "@/components/i18n-provider";

export function LocaleSwitch({ className = "" }: { className?: string }) {
  const { locale, dict } = useI18n();
  const pathname = usePathname();
  const search = useSearchParams();
  const other = locale === "ar" ? "en" : "ar";
  const rest = pathname.split("/").slice(2).join("/");
  const qs = search.toString();
  return (
    <Link href={`/${other}${rest ? `/${rest}` : ""}${qs ? `?${qs}` : ""}`} hrefLang={other} className={className} lang={other}>
      {dict.common.language}
    </Link>
  );
}
