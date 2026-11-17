import type { Metadata, Viewport } from "next";
import { notFound } from "next/navigation";
import { Alexandria, IBM_Plex_Sans_Arabic } from "next/font/google";
import "../globals.css";
import { LOCALES, dir, isLocale, type Locale } from "@/lib/i18n/config";
import { getDictionary } from "@/lib/i18n";
import { I18nProvider } from "@/components/i18n-provider";
import { Toaster } from "@/components/ui/toast";
import { publicEnv } from "@/lib/env";

const alexandria = Alexandria({ subsets: ["arabic", "latin"], weight: ["400", "500", "600", "700", "800", "900"], variable: "--font-alexandria", display: "swap" });
const plex = IBM_Plex_Sans_Arabic({ subsets: ["arabic", "latin"], weight: ["400", "500", "600", "700"], variable: "--font-plex-arabic", display: "swap" });

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
  themeColor: "#0a0a0a",
  width: "device-width",
  initialScale: 1,
};

export default async function LocaleLayout({ children, params }: { children: React.ReactNode; params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const dict = getDictionary(locale);
  return (
    <html lang={locale} dir={dir(locale)} className={`${alexandria.variable} ${plex.variable}`}>
      <body className="min-h-dvh antialiased">
        <I18nProvider locale={locale} dict={dict}>
          {children}
          <Toaster />
        </I18nProvider>
      </body>
    </html>
  );
}
