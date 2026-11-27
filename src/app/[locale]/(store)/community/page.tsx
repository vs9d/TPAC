import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Sparkles } from "lucide-react";
import { isLocale } from "@/lib/i18n/config";
import { listCommunityDesigns } from "@/lib/data/community";

export const revalidate = 300;

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const ar = locale === "ar";
  return {
    title: ar ? "تصاميم الزبائن" : "Customer designs",
    description: ar ? "تصاميم صمّمها زبائن TPAC بالاستوديو — اطلبها كما هي أو عدّل عليها." : "Designs made by TPAC customers in the studio — order one as it is or change it.",
    alternates: { canonical: `/${locale}/community`, languages: { ar: "/ar/community", en: "/en/community" } },
  };
}

export default async function CommunityPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const ar = locale === "ar";
  const designs = await listCommunityDesigns();
  return (
    <div>
      <section className="bg-ink text-paper">
        <div className="container-x py-14 md:py-20">
          <p className="eyebrow mb-4 text-amber">{ar ? "من صنع زبائننا" : "Made by our customers"}</p>
          <h1 className="display max-w-3xl text-4xl md:text-6xl">{ar ? "تصاميم الزبائن" : "Customer designs"}</h1>
          <p className="mt-4 max-w-xl text-lg text-paper/70">{ar ? "تصاميم صمّمها ناس مثلك بالاستوديو ونشروها. كل قطعة تطلبها توصلك مثل ما صمّمها صاحبها بالضبط — وهو ياخذ مكافأة على كل بيعة." : "Made in our studio by people like you. Every piece arrives exactly as its designer made it — and they get a reward for every sale."}</p>
          <div className="mt-8 grid gap-4 md:grid-cols-2">
            <div className="rounded-[1.5rem] border border-paper/15 bg-paper/5 p-5">
              <p className="text-sm font-bold text-amber">{ar ? "إذا تصمّم 🎨" : "If you design 🎨"}</p>
              <p className="mt-2 text-sm leading-relaxed text-paper/80">{ar ? "فكرتك تستاهل تنلبس. ارفع تصميمك، وخلّي الناس تلبسه بكل العراق، واكسب مكافأة على كل قطعة تنباع منه — بدون ما تطبع أو توصّل شي، إحنا نتكفل بكلشي." : "Your idea deserves to be worn. Publish it, let people across Iraq wear it, and earn a reward for every piece sold — we print and deliver, you just create."}</p>
              <Link href={`/${locale}/community/new`} className="btn btn-accent mt-4 h-12"><Sparkles className="size-5" /> {ar ? "صمّم مالتك وانشره" : "Design yours and share it"}</Link>
            </div>
            <div className="rounded-[1.5rem] border border-paper/15 bg-paper/5 p-5">
              <p className="text-sm font-bold text-amber">{ar ? "إذا تشتري 💚" : "If you shop 💚"}</p>
              <p className="mt-2 text-sm leading-relaxed text-paper/80">{ar ? "لما تطلب من هنا، أنت مو بس تاخذ قطعة مميزة ما موجودة بمكان ثاني — أنت تدعم مبدع عراقي يكمل ويصمّم أكثر. كل طلب يفرق وياه." : "Ordering here gets you a one-of-a-kind piece — and backs a local creator so they keep designing. Every order makes a difference."}</p>
            </div>
          </div>
        </div>
      </section>
      <div className="container-x py-12 md:py-16">
        {designs.length === 0 ? (
          <p className="rounded-[1.5rem] bg-bone p-8 text-center text-mute">{ar ? "قريباً — أول التصاميم بالطريق. كون أول واحد: صمّم مالتك وانشره." : "Coming soon — be the first: design yours and publish it."}</p>
        ) : (
          <ul className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4">
            {designs.map((d) => (
              <li key={d.id} className="group overflow-hidden rounded-[1.25rem] border border-line bg-paper">
                <Link href={`/${locale}/design?community=${d.id}&garment=${d.garment_type}`} className="block">
                  <div className="relative aspect-[6/7] bg-bone">
                    {d.image_front && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={d.image_front} alt={d.title} className="absolute inset-0 size-full object-contain transition group-hover:opacity-0" loading="lazy" />
                    )}
                    {d.image_back && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={d.image_back} alt="" className="absolute inset-0 size-full object-contain opacity-0 transition group-hover:opacity-100" loading="lazy" />
                    )}
                  </div>
                  <div className="space-y-1 p-3">
                    <p className="truncate font-bold">{d.title}</p>
                    <p className="truncate text-xs text-mute">{ar ? `تصميم ${d.designer_name}` : `by ${d.designer_name}`}</p>
                    <span className="mt-2 inline-flex h-10 w-full items-center justify-center rounded-xl bg-pine text-sm font-bold text-white dark:text-night">{ar ? "اطلبه وادعم المصمم" : "Order it & support the designer"}</span>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
