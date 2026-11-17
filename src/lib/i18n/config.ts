export const LOCALES = ["ar", "en"] as const;
export type Locale = (typeof LOCALES)[number];
export const DEFAULT_LOCALE: Locale = "ar";

export function isLocale(v: unknown): v is Locale {
  return typeof v === "string" && (LOCALES as readonly string[]).includes(v);
}

export function dir(locale: Locale): "rtl" | "ltr" {
  return locale === "ar" ? "rtl" : "ltr";
}

/** Pick the localized column of a bilingual record: t(row, "name", "ar") -> row.name_ar */
export function loc<T extends Record<string, unknown>>(row: T | null | undefined, field: string, locale: Locale): string {
  if (!row) return "";
  const v = row[`${field}_${locale}`] ?? row[`${field}_${locale === "ar" ? "en" : "ar"}`];
  return typeof v === "string" ? v : "";
}
