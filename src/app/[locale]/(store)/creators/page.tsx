import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Brush, Coins, Rocket, Sparkles, Truck, Trophy } from "lucide-react";
import { isLocale } from "@/lib/i18n/config";
import { topCreators } from "@/lib/data/creators";
import { getMyCreator, getCreatorSettings } from "@/lib/creators";
import { CreatorCardView } from "@/components/creators/creator-card";
import { formatIQD } from "@/lib/format";

export const revalidate = 300;

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const ar = locale === "ar";
  return {
    title: "TPAC Creators",
    description: ar ? "افتح متجرك الخاص داخل TPAC: ارفع تصاميمك على الهوديات والتيشيرتات، حدّد سعرك، واربح من كل قطعة — وإحنا نطبع ونوصّل." : "Open your own store inside TPAC: put your designs on hoodies and tees, set your price, earn from every piece — we print and deliver.",
    alternates: { canonical: `/${locale}/creators`, languages: { ar: "/ar/creators", en: "/en/creators" } },
  };
}

export default async function CreatorsPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const ar = locale === "ar";
  const [top, me, s] = await Promise.all([topCreators("all", 8), getMyCreator().catch(() => null), getCreatorSettings()]);
  const steps = ar
    ? [[Brush, "ارفع تصميمك", "PNG بخلفية شفافة، على الهودي أو التيشيرت أو السويتشيرت."], [Coins, "حدّد سعرك", "سعر القطعة من TPAC + اللي تضيفه أنت. تشوف ربحك قبل النشر."], [Truck, "إحنا نكمّل", "نطبع ونجهّز ونوصّل ونخدم الزبون."], [Rocket, "اربح", "ربحك من كل قطعة تكتمل، وتسحبه لزين كاش أو حساب بنكي."]]
    : [[Brush, "Upload your design", "Transparent PNG, on hoodies, tees or sweatshirts."], [Coins, "Set your price", "TPAC's garment price + your markup. See your earning before you publish."], [Truck, "We do the rest", "Printing, packing, delivery and customer care."], [Rocket, "Earn", "From every completed piece — withdraw to ZainCash or a bank account."]];
  return (
    <div>
      <section className="bg-ink text-paper">
        <div className="container-x py-16 md:py-24">
          <p className="eyebrow mb-4 text-amber">TPAC Creators</p>
          <h1 className="display max-w-4xl text-5xl md:text-7xl">{ar ? "متجرك الخاص، داخل TPAC." : "Your own store, inside TPAC."}</h1>
          <p className="mt-5 max-w-2xl text-lg text-paper/70">{ar ? "إذا تصمّم، مكانك هنا. ارفع تصاميمك، خلّي الناس تلبسها بكل العراق، واربح من كل قطعة — بدون مخزون، بدون طباعة، بدون توصيل. إنت أبدع، وإحنا نتكفل بالباقي." : "If you design, this is your place. Publish your work, let people across Iraq wear it, and earn from every piece — no stock, no printing, no delivery. You create; we handle the rest."}</p>
          <div className="mt-8 flex flex-wrap gap-3">
            {me ? (
              <Link href={`/${locale}/creator-studio`} className="btn btn-accent h-12"><Sparkles className="size-5" /> {ar ? "لوحة المبدع" : "Creator dashboard"}</Link>
            ) : (
              <Link href={`/${locale}/creators/join`} className="btn btn-accent h-12"><Sparkles className="size-5" /> {ar ? "انضم كمبدع" : "Join as a creator"}</Link>
            )}
            <Link href={`/${locale}/creators/top`} className="btn btn-outline h-12 border-paper/40 text-paper hover:bg-paper hover:text-ink"><Trophy className="size-5" /> {ar ? "أفضل المبدعين" : "Top creators"}</Link>
          </div>
          <ol className="mt-14 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {steps.map(([Icon, h, b], i) => {
              const I = Icon as typeof Brush;
              return (
                <li key={String(h)} className="border-t border-paper/20 pt-5">
                  <I className="size-7 text-amber" aria-hidden="true" />
                  <p className="mt-3 font-bold">0{i + 1} — {String(h)}</p>
                  <p className="mt-1 text-sm text-paper/70">{String(b)}</p>
                </li>
              );
            })}
          </ol>
          <p className="mt-10 text-sm text-paper/60">{ar ? `مثال: سعر الهودي من TPAC ${formatIQD(25000, locale)} وأنت تضيف ${formatIQD(5000, locale)} ← الزبون يدفع ${formatIQD(30000, locale)}، وربحك ${s.commission_mode === "percent" ? `${s.commission_value}% من الإضافة (${formatIQD(Math.round(5000 * s.commission_value / 100), locale)})` : `${formatIQD(s.commission_value, locale)} لكل قطعة`}.` : `Example: TPAC's hoodie ${formatIQD(25000, locale)} + your ${formatIQD(5000, locale)} → the customer pays ${formatIQD(30000, locale)}; you earn ${s.commission_mode === "percent" ? `${s.commission_value}% of your markup (${formatIQD(Math.round(5000 * s.commission_value / 100), locale)})` : `${formatIQD(s.commission_value, locale)} per piece`}.`}</p>
        </div>
      </section>
      <section className="container-x py-14 md:py-20">
        <div className="mb-6 flex items-end justify-between gap-4">
          <div>
            <h2 className="display text-3xl md:text-4xl">{ar ? "مبدعين TPAC" : "TPAC creators"}</h2>
            <p className="mt-1 text-mute">{ar ? "كل قطعة تشتريها منهم تدعم مبدع عراقي يكمل ويصمّم أكثر 💚" : "Every piece you buy from them backs a local creator 💚"}</p>
          </div>
          <Link href={`/${locale}/creators/top`} className="text-sm font-semibold underline">{ar ? "الكل" : "All"}</Link>
        </div>
        {top.length === 0 ? (
          <p className="rounded-[1.5rem] bg-bone p-8 text-center text-mute">{ar ? "أول المبدعين بالطريق — كون منهم." : "The first creators are on their way — be one of them."}</p>
        ) : (
          <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
            {top.map((c) => <CreatorCardView key={c.user_id} c={c} locale={locale} stat={ar ? `${c.designs} تصميم` : `${c.designs} designs`} />)}
          </div>
        )}
      </section>
    </div>
  );
}
