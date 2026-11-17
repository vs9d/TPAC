import type { Metadata, Viewport } from "next";
import { notFound } from "next/navigation";
import { Cairo, Readex_Pro } from "next/font/google";
import "../globals.css";
import { LOCALES, dir, isLocale, type Locale } from "@/lib/i18n/config";
import { getDictionary } from "@/lib/i18n";
import { I18nProvider } from "@/components/i18n-provider";
import { Suspense } from "react";
import { Toaster } from "@/components/ui/toast";
import { PressFeedback } from "@/components/ui/press-feedback";
import { NavProgress } from "@/components/ui/nav-progress";
import { publicEnv } from "@/lib/env";

const cairo = Cairo({ subsets: ["arabic", "latin"], variable: "--font-cairo", display: "swap" });
const readex = Readex_Pro({ subsets: ["arabic", "latin"], variable: "--font-readex", display: "swap" });

/** Runs before first paint: saved choice, else the device's colour scheme. Prevents a light→dark flash. */
const THEME_SCRIPT = `(function(){try{var t=localStorage.getItem("tpac-theme");if(t!=="light"&&t!=="dark"){t=window.matchMedia("(prefers-color-scheme: dark)").matches?"dark":"light"}document.documentElement.setAttribute("data-theme",t);var m=document.querySelector('meta[name="theme-color"]');if(m)m.setAttribute("content",t==="dark"?"#0f1513":"#fbfaf7")}catch(e){document.documentElement.setAttribute("data-theme","light")}})();`;

export function generateStaticParams() {
  return LOCALES.map((locale) => ({ locale }));
}

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const l: Locale = isLocale(locale) ? locale : "ar";
  const t = getDictionary(l);
  return {
    metadataBase: new URL(publicEnv.siteUrl),
    title: { default: `TPAC — ${t.meta.tagline}`, template: "%s | TPAC" },
    description: t.meta.description,
    applicationName: "TPAC",
    alternates: { canonical: `/${l}`, languages: { ar: "/ar", en: "/en", "x-default": "/ar" } },
    openGraph: {
      type: "website",
      siteName: "TPAC",
      locale: l === "ar" ? "ar_IQ" : "en_US",
      alternateLocale: l === "ar" ? ["en_US"] : ["ar_IQ"],
      images: [{ url: "/brand/og-default.jpg", width: 1200, height: 630, alt: "TPAC" }],
    },
    twitter: { card: "summary_large_image" },
    icons: { icon: "/favicon.png", apple: "/brand/apple-icon.png" },
    manifest: "/manifest.webmanifest",
  };
}

export const viewport: Viewport = {
  themeColor: [{ media: "(prefers-color-scheme: light)", color: "#fbfaf7" }, { media: "(prefers-color-scheme: dark)", color: "#0f1513" }],
  width: "device-width",
  initialScale: 1,
};

export default async function LocaleLayout({ children, params }: { children: React.ReactNode; params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const dict = getDictionary(locale);
  return (
    <html lang={locale} dir={dir(locale)} className={`${cairo.variable} ${readex.variable}`} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} />
      </head>
      <body className="min-h-dvh antialiased">
        <I18nProvider locale={locale} dict={dict}>
          {children}
          <Suspense fallback={null}><NavProgress /></Suspense>
          <PressFeedback />
          <Toaster />
        </I18nProvider>
      </body>
    </html>
  );
}
