import type { Locale } from "@/lib/i18n/config";

/** Formats integer IQD. Arabic uses Arabic-Indic digits and "د.ع". */
export function formatIQD(amount: number, locale: Locale): string {
  const n = new Intl.NumberFormat(locale === "ar" ? "ar-IQ" : "en-US", { maximumFractionDigits: 0 }).format(amount);
  return locale === "ar" ? `${n} د.ع` : `${n} IQD`;
}

export function formatNumber(n: number, locale: Locale): string {
  return new Intl.NumberFormat(locale === "ar" ? "ar-IQ" : "en-US").format(n);
}

export function formatDate(d: string | Date, locale: Locale, withTime = false): string {
  const date = typeof d === "string" ? new Date(d) : d;
  return new Intl.DateTimeFormat(locale === "ar" ? "ar-IQ" : "en-GB", {
    year: "numeric",
    month: "short",
    day: "numeric",
    ...(withTime ? { hour: "2-digit", minute: "2-digit" } : {}),
    timeZone: "Asia/Baghdad",
  }).format(date);
}

export function cn(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(" ");
}

/** ISO timestamp -> "YYYY-MM-DDTHH:mm" in Baghdad time, for datetime-local inputs. */
export function toBaghdadInput(iso: string | null | undefined): string {
  if (!iso) return "";
  return new Date(new Date(iso).getTime() + 3 * 3600000).toISOString().slice(0, 16);
}

/** Is a scheduled feature window currently active? */
export function inWindow(from: string | null | undefined, until: string | null | undefined, now = Date.now()): boolean {
  return (!from || new Date(from).getTime() <= now) && (!until || new Date(until).getTime() >= now);
}
