import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Link2, Send, Users } from "lucide-react";
import { isLocale } from "@/lib/i18n/config";
import { getProductBySlug } from "@/lib/data/catalog";
import { GroupCreateForm } from "@/components/group/create-form";

const TYPE_BY_CATEGORY: Record<string, string> = { hoodies: "hoodie", "t-shirts": "tshirt", "oversized-t-shirts": "oversized", sweatshirts: "sweatshirt" };

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const ar = locale === "ar";
  return {
    title: ar ? "طلب جماعي برابط" : "Group order by link",
    description: ar ? "سوّي رابط، دزه بالكروب، وكل واحد يسجل اسمه وقياسه — وأنت ترسل القائمة لـ TPAC." : "Make a link, send it to the group, everyone adds their name and size — you send the list to TPAC.",
    alternates: { canonical: `/${locale}/group` },
  };
}

export default async function GroupPage({ params, searchParams }: { params: Promise<{ locale: string }>; searchParams: Promise<{ product?: string }> }) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const ar = locale === "ar";
  const { product: slug } = await searchParams;
  const p = slug && /^[a-z0-9-]{1,160}$/.test(slug) ? await getProductBySlug(slug).catch(() => null) : null;
  const product = p ? { slug: p.slug, name: ar ? p.name_ar : p.name_en, type: TYPE_BY_CATEGORY[p.category?.slug ?? ""] ?? (p.tags.some((t) => /hoodie|هودي/i.test(t)) ? "hoodie" : "tshirt") } : null;
  const steps = ar
    ? [["سوّي الرابط", "اسم المجموعة والقطعة والفكرة."], ["دزه بالكروب", "كل واحد يسجل اسمه وقياسه والاسم اللي ينطبع."], ["أرسل القائمة", "تشوف المجموع وترسله لنا، ونرجع لك بالسعر."]]
    : [["Make the link", "Group name, garment and idea."], ["Share it", "Everyone adds their name, size and name to print."], ["Send the list", "See the totals and send it; we come back with the price."]];
  const icons = [Link2, Users, Send];
  return (
    <div>
      <section className="bg-ink text-paper">
        <div className="container-x py-14 md:py-20">
          <p className="eyebrow mb-4 text-amber">{ar ? "طلب جماعي" : "Group order"}</p>
          <h1 className="display max-w-3xl text-4xl md:text-6xl">{ar ? "رابط واحد، والكل يسجل قياسه" : "One link, everyone adds their size"}</h1>
          <p className="mt-4 max-w-xl text-lg text-paper/70">{ar ? "للدفعات والفرق والشركات والمناسبات: بدل ما تجمع الأسماء والقياسات بالواتساب، دز الرابط وكل واحد يسجل بنفسه." : "For classes, teams, companies and events: instead of collecting names and sizes in chats, everyone adds their own."}</p>
          <ol className="mt-10 grid gap-6 md:grid-cols-3">
            {steps.map(([h, b], i) => {
              const Icon = icons[i]!;
              return (
                <li key={h} className="border-t border-paper/20 pt-5">
                  <Icon className="size-7 text-amber" aria-hidden="true" />
                  <p className="mt-3 font-bold">{h}</p>
                  <p className="mt-1 text-sm text-paper/70">{b}</p>
                </li>
              );
            })}
          </ol>
        </div>
      </section>
      <div className="container-x max-w-2xl py-12 md:py-16">
        <GroupCreateForm product={product} />
      </div>
    </div>
  );
}
