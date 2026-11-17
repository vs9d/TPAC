import Link from "next/link";
import { ArrowLeft, ArrowRight } from "lucide-react";

export function SectionHeading({ title, eyebrow, href, cta, locale }: { title: string; eyebrow?: string; href?: string; cta?: string; locale: "ar" | "en" }) {
  const Arrow = locale === "ar" ? ArrowLeft : ArrowRight;
  return (
    <div className="mb-8 flex items-end justify-between gap-6 md:mb-10">
      <div>
        {eyebrow && <p className="eyebrow mb-2 text-amber-deep">{eyebrow}</p>}
        <h2 className="display text-3xl md:text-5xl">{title}</h2>
      </div>
      {href && cta && (
        <Link href={href} className="group inline-flex shrink-0 items-center gap-2 text-sm font-semibold">
          <span className="border-b border-ink pb-0.5">{cta}</span>
          <Arrow className="size-4 transition-transform group-hover:translate-x-1 rtl:group-hover:-translate-x-1" />
        </Link>
      )}
    </div>
  );
}
