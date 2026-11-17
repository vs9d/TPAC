import Link from "next/link";
import { ArrowLeft, ArrowRight } from "lucide-react";

export function SectionHeading({ title, eyebrow, href, cta, locale }: { title: string; eyebrow?: string; href?: string; cta?: string; locale: "ar" | "en" }) {
  const Arrow = locale === "ar" ? ArrowLeft : ArrowRight;
  return (
    <div className="mb-6 flex items-end justify-between gap-4 md:mb-10">
      <div>
        {eyebrow && <p className="eyebrow mb-2 text-pine">{eyebrow}</p>}
        <h2 className="display text-[1.75rem] md:text-5xl">{title}</h2>
      </div>
      {href && cta && (
        <Link href={href} className="btn btn-outline btn-sm group shrink-0">
          {cta}
          <Arrow className="size-4 transition-transform group-hover:-translate-x-0.5 ltr:group-hover:translate-x-0.5" />
        </Link>
      )}
    </div>
  );
}
