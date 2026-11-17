import type { Locale } from "@/lib/i18n/config";

/** Inline bilingual strings for the admin dashboard: t("عربي", "English"). */
export const adminT = (locale: Locale) => (ar: string, en: string) => (locale === "ar" ? ar : en);
