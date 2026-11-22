import { isLocale } from "@/lib/i18n/config";
import { getDictionary } from "@/lib/i18n";
import { notFound } from "next/navigation";
import { Header } from "@/components/layout/header";
import { Footer } from "@/components/layout/footer";
import { AnnouncementBar } from "@/components/layout/announcement-bar";
import { CartDrawer } from "@/components/cart/cart-drawer";
import { CartSync } from "@/components/cart/cart-sync";
import { WhatsAppButton } from "@/components/layout/whatsapp-button";
import { whatsappNumber } from "@/lib/whatsapp";
import { getCategories } from "@/lib/data/catalog";
import { getBanners, getSettings } from "@/lib/data/content";
import { getSession, isStaffRole } from "@/lib/auth";
import { isSupabaseConfigured } from "@/lib/env";

export default async function StoreLayout({ children, params }: { children: React.ReactNode; params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const dict = getDictionary(locale);
  const [categories, announcements, settings, session] = await Promise.all([getCategories(), getBanners("announcement"), getSettings(), getSession()]);
  const nav = categories.filter((c) => !c.parent_id).map((c) => ({ slug: c.slug, name_ar: c.name_ar, name_en: c.name_en }));
  return (
    <>
      <a href="#main" className="fixed start-2 top-2 z-[100] -translate-y-24 bg-paper p-3 text-sm font-semibold focus:translate-y-0">
        {locale === "ar" ? "انتقل إلى المحتوى" : "Skip to content"}
      </a>
      {!isSupabaseConfigured() && <div className="bg-amber px-4 py-2 text-center text-xs font-semibold text-ink">{dict.common.serviceUnavailable}</div>}
      <AnnouncementBar items={announcements.map((a) => ({ id: a.id, text_ar: a.title_ar ?? "", text_en: a.title_en ?? "", link: a.link }))} />
      <Header categories={nav} signedIn={!!session} isStaff={isStaffRole(session?.profile?.role)} />
      <main id="main">{children}</main>
      <Footer locale={locale} dict={dict} settings={settings} categories={nav} />
      <CartDrawer />
      <CartSync userId={session?.userId ?? null} />
      <WhatsAppButton number={whatsappNumber(settings.contact.whatsapp)} locale={locale} />
    </>
  );
}
