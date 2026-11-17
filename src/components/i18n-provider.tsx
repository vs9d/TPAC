"use client";
import { createContext, useContext } from "react";
import type { Dict } from "@/lib/i18n/dictionaries/ar";
import type { Locale } from "@/lib/i18n/config";

const Ctx = createContext<{ locale: Locale; dict: Dict } | null>(null);

export function I18nProvider({ locale, dict, children }: { locale: Locale; dict: Dict; children: React.ReactNode }) {
  return <Ctx.Provider value={{ locale, dict }}>{children}</Ctx.Provider>;
}

export function useI18n() {
  const v = useContext(Ctx);
  if (!v) throw new Error("useI18n outside provider");
  return v;
}

export { fmt } from "@/lib/i18n/fmt";
