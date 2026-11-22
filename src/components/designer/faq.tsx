import { Plus } from "lucide-react";
import type { FaqItem } from "@/lib/design-faq";

/** "Questions people ask" accordion under the studio (native <details>: works without JavaScript). */
export function DesignFaq({ items, locale }: { items: FaqItem[]; locale: "ar" | "en" }) {
  if (!items.length) return null;
  const q = (i: FaqItem) => (locale === "ar" ? i.q_ar : i.q_en || i.q_ar);
  const a = (i: FaqItem) => (locale === "ar" ? i.a_ar : i.a_en || i.a_ar);
  return (
    <section className="mx-auto -mt-16 mb-28 max-w-3xl" aria-labelledby="design-faq">
      <p className="mb-3 text-xs font-semibold uppercase tracking-[0.32em] text-mute" dir="ltr">Good to know</p>
      <h2 id="design-faq" className="display text-3xl sm:text-4xl">{locale === "ar" ? "أسئلة تتكرر." : "Questions people ask."}</h2>
      <div className="mt-8 space-y-3">
        {items.map((i, n) => (
          <details key={n} className="studio-card group px-5 sm:px-6">
            <summary className="flex cursor-pointer list-none items-center justify-between gap-4 py-5 text-base font-bold [&::-webkit-details-marker]:hidden">
              {q(i)}
              <Plus className="size-5 shrink-0 text-pine transition-transform duration-300 group-open:rotate-45" aria-hidden />
            </summary>
            <p className="pb-5 text-sm leading-relaxed text-mute">{a(i)}</p>
          </details>
        ))}
      </div>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify({ "@context": "https://schema.org", "@type": "FAQPage", mainEntity: items.map((i) => ({ "@type": "Question", name: q(i), acceptedAnswer: { "@type": "Answer", text: a(i) } })) }).replace(/</g, "\\u003c") }}
      />
    </section>
  );
}
