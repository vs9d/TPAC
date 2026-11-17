import "server-only";
import type { Locale } from "./config";
import ar from "./dictionaries/ar";
import en from "./dictionaries/en";

const dictionaries = { ar, en };
export type Dictionary = typeof ar;

export function getDictionary(locale: Locale): Dictionary {
  return dictionaries[locale] ?? ar;
}
