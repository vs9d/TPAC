import { whatsappNumber } from "@/lib/whatsapp";
import Link from "next/link";
import Image from "next/image";
import type { Locale } from "@/lib/i18n/config";
import type { Dict } from "@/lib/i18n/dictionaries/ar";
import type { SiteSettings } from "@/lib/types";
import type { NavCategory } from "./header";
import { InstagramIcon, TikTokIcon, FacebookIcon, WhatsAppIcon } from "@/components/ui/social-icons";
import { NewsletterForm } from "@/components/home/newsletter-form";

export function Footer({ locale, dict, settings, categories }: { locale: Locale; dict: Dict; settings: SiteSettings; categories: NavCategory[] }) {
  const L = (p: string) => `/${locale}${p}`;
  const s = settings.social;
  const wa = whatsappNumber(settings.contact.whatsapp);
  return (
    <footer className="mt-20 rounded-t-[2.5rem] bg-night text-snow md:mt-28 md:rounded-t-[3.5rem]">
      <div className="container-x grid grid-cols-1 gap-12 py-16 md:grid-cols-12">
        <div className="md:col-span-4">
          <Image src="/brand/tpac-logo-white.png" alt="TPAC" width={1512} height={806} className="h-12 w-auto" />
          <p className="mt-5 max-w-xs text-sm leading-relaxed text-snow/60">{locale === "ar" ? settings.brand.tagline_ar : settings.brand.tagline_en}</p>
          <div className="mt-8 max-w-sm">
            <p className="eyebrow mb-3 text-amber">{dict.home.newsletterTitle}</p>
            <NewsletterForm dark />
          </div>
        </div>
        <nav className="md:col-span-2" aria-label={dict.footer.shop}>
          <p className="eyebrow mb-4 text-snow/50">{dict.footer.shop}</p>
          <ul className="space-y-2.5 text-sm">
            {categories.slice(0, 7).map((c) => (
              <li key={c.slug}><Link href={L(`/shop?category=${c.slug}`)} className="text-snow/80 hover:text-amber">{locale === "ar" ? c.name_ar : c.name_en}</Link></li>
            ))}
          </ul>
        </nav>
        <nav className="md:col-span-2" aria-label={dict.footer.help}>
          <p className="eyebrow mb-4 text-snow/50">{dict.footer.help}</p>
          <ul className="space-y-2.5 text-sm text-snow/80">
            <li><Link href={L("/track")} className="hover:text-amber">{dict.nav.track}</Link></li>
            <li><Link href={L("/pages/shipping")} className="hover:text-amber">{dict.footer.shipping}</Link></li>
            <li><Link href={L("/pages/returns")} className="hover:text-amber">{dict.footer.returns}</Link></li>
            <li><Link href={L("/size-finder")} className="hover:text-amber">{locale === "ar" ? "اعرف قياسك" : "Find your size"}</Link></li>
            <li><Link href={L("/pages/size-guide")} className="hover:text-amber">{dict.footer.sizeGuide}</Link></li>
            <li><Link href={L("/pages/faq")} className="hover:text-amber">{dict.footer.faq}</Link></li>
            <li><Link href={L("/contact")} className="hover:text-amber">{dict.nav.contact}</Link></li>
          </ul>
        </nav>
        <nav className="md:col-span-2" aria-label={dict.footer.company}>
          <p className="eyebrow mb-4 text-snow/50">{dict.footer.company}</p>
          <ul className="space-y-2.5 text-sm text-snow/80">
            <li><Link href={L("/pages/about")} className="hover:text-amber">{dict.nav.about}</Link></li>
            <li><Link href={L("/reviews")} className="hover:text-amber">{dict.reviews.navLabel}</Link></li>
            <li><Link href={L("/design")} className="hover:text-amber">{dict.nav.customDesign}</Link></li>
            <li><Link href={L("/bulk")} className="hover:text-amber">{dict.nav.bulk}</Link></li>
            <li><Link href={L("/couples")} className="hover:text-amber">{locale === "ar" ? "للمرتبطين" : "For couples"}</Link></li>
            <li><Link href={L("/group")} className="hover:text-amber">{locale === "ar" ? "طلب جماعي برابط" : "Group order by link"}</Link></li>
            <li><Link href={L("/community")} className="hover:text-amber">{locale === "ar" ? "تصاميم الزبائن" : "Customer designs"}</Link></li>
            <li><Link href={L("/creators")} className="hover:text-amber">TPAC Creators</Link></li>
            <li><Link href={L("/portfolio")} className="hover:text-amber">{locale === "ar" ? "أعمالنا" : "Our work"}</Link></li>
            <li><Link href={L("/pages/privacy")} className="hover:text-amber">{dict.footer.privacy}</Link></li>
            <li><Link href={L("/pages/terms")} className="hover:text-amber">{dict.footer.terms}</Link></li>
          </ul>
        </nav>
        <div className="md:col-span-2">
          <p className="eyebrow mb-4 text-snow/50">{dict.nav.contact}</p>
          <ul className="space-y-2.5 text-sm text-snow/80">
            {settings.contact.phone && <li dir="ltr" className="text-start">+{settings.contact.phone}</li>}
            {settings.contact.email && <li><a href={`mailto:${settings.contact.email}`} className="hover:text-amber">{settings.contact.email}</a></li>}
            <li>{locale === "ar" ? settings.contact.address_ar : settings.contact.address_en}</li>
          </ul>
          <div className="mt-5 flex gap-3">
            {s.instagram && <a href={s.instagram} target="_blank" rel="noopener noreferrer" aria-label="Instagram" className="grid size-11 place-items-center rounded-full border border-snow/20 hover:border-amber hover:text-amber"><InstagramIcon /></a>}
            {s.tiktok && <a href={s.tiktok} target="_blank" rel="noopener noreferrer" aria-label="TikTok" className="grid size-11 place-items-center rounded-full border border-snow/20 hover:border-amber hover:text-amber"><TikTokIcon /></a>}
            {s.facebook && <a href={s.facebook} target="_blank" rel="noopener noreferrer" aria-label="Facebook" className="grid size-11 place-items-center rounded-full border border-snow/20 hover:border-amber hover:text-amber"><FacebookIcon /></a>}
            {wa && <a href={`https://wa.me/${wa}`} target="_blank" rel="noopener noreferrer" aria-label="WhatsApp" className="grid size-11 place-items-center rounded-full border border-snow/20 hover:border-amber hover:text-amber"><WhatsAppIcon /></a>}
          </div>
        </div>
      </div>
      <div className="border-t border-snow/10">
        <div className="container-x flex flex-col items-center justify-between gap-3 py-6 text-xs text-snow/50 md:flex-row">
          <p>© {new Date().getFullYear()} TPAC — {dict.footer.rights}</p>
          <p className="flex items-center gap-4"><span>{dict.footer.cod}</span><span className="text-amber">{dict.footer.madeIn}</span></p>
        </div>
      </div>
    </footer>
  );
}
