import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { isLocale } from "@/lib/i18n/config";
import { getDictionary } from "@/lib/i18n";
import { getSettings } from "@/lib/data/content";
import { ContactForm } from "@/components/home/contact-form";
import { WhatsAppIcon, InstagramIcon } from "@/components/ui/social-icons";
import { formatIraqiPhone } from "@/lib/phone";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  if (!isLocale(locale)) return {};
  const t = getDictionary(locale);
  return { title: t.contact.title, description: t.contact.body, alternates: { canonical: `/${locale}/contact` } };
}

export default async function ContactPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const dict = getDictionary(locale);
  const s = await getSettings();
  return (
    <div className="container-x grid gap-14 py-14 md:py-20 lg:grid-cols-2">
      <div>
        <h1 className="display text-5xl md:text-7xl">{dict.contact.title}</h1>
        <p className="mt-5 max-w-md text-lg text-mute">{dict.contact.body}</p>
        <dl className="mt-10 space-y-6 text-sm">
          {s.contact.whatsapp && (
            <div><dt className="eyebrow text-mute">{dict.contact.whatsapp}</dt><dd className="mt-1"><a href={`https://wa.me/${s.contact.whatsapp}`} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 text-lg font-semibold hover:text-pine" dir="ltr"><WhatsAppIcon /> {formatIraqiPhone(s.contact.whatsapp)}</a></dd></div>
          )}
          {s.contact.email && <div><dt className="eyebrow text-mute">Email</dt><dd className="mt-1 text-lg font-semibold"><a href={`mailto:${s.contact.email}`}>{s.contact.email}</a></dd></div>}
          {s.social.instagram && <div><dt className="eyebrow text-mute">Instagram</dt><dd className="mt-1"><a href={s.social.instagram} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 text-lg font-semibold"><InstagramIcon /> @thetpac</a></dd></div>}
          <div><dt className="eyebrow text-mute">{dict.contact.address}</dt><dd className="mt-1 text-lg">{locale === "ar" ? s.contact.address_ar : s.contact.address_en}</dd></div>
          <div><dt className="eyebrow text-mute">{dict.contact.hours}</dt><dd className="mt-1 text-lg">{(locale === "ar" ? s.contact.hours_ar : s.contact.hours_en) || dict.contact.hoursValue}</dd></div>
        </dl>
      </div>
      <div className="bg-bone p-6 md:p-10"><ContactForm /></div>
    </div>
  );
}
