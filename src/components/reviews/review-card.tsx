import Link from "next/link";
import { BadgeCheck, UserRound } from "lucide-react";
import type { Locale } from "@/lib/i18n/config";
import type { Dict } from "@/lib/i18n/dictionaries/ar";
import type { PublicReview } from "@/lib/data/reviews";
import { cn } from "@/lib/format";
import { Stars } from "./stars";

export function QuoteMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 48 36" className={cn("rotate-180", className)} aria-hidden fill="currentColor">
      <path d="M0 36V22C0 9.6 6.4 2.3 19.2 0l2 5.2C14.4 7.2 11 11 10.6 16.6H20V36H0zm27.6 0V22C27.6 9.6 34 2.3 46.8 0l2 5.2C42 7.2 38.6 11 38.2 16.6h9.4V36h-20z" />
    </svg>
  );
}

export function ReviewCard({ review: r, locale, dict }: { review: PublicReview; locale: Locale; dict: Dict }) {
  const name = r.author_name?.trim() || (locale === "ar" ? "زبون TPAC" : "TPAC customer");
  const category = r.label || (r.product?.category ? (locale === "ar" ? r.product.category.name_ar : r.product.category.name_en) : null);
  return (
    <article className={cn("rounded-3xl border bg-paper p-4 transition-shadow duration-300 hover:shadow-[0_12px_30px_-12px_rgba(55,99,82,0.35)] sm:p-6", r.is_featured ? "border-pine/50" : "border-line")}>
      <header className="flex items-center gap-3">
        {r.avatar_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={r.avatar_url} alt="" loading="lazy" className="size-11 shrink-0 rounded-full object-cover sm:size-14" />
        ) : (
          <span className="grid size-11 shrink-0 place-items-end justify-center overflow-hidden rounded-full bg-stone sm:size-14" aria-hidden>
            <UserRound className="size-9 translate-y-1 fill-paper text-paper sm:size-11" strokeWidth={1} />
          </span>
        )}
        <div className="min-w-0">
          <p className="truncate font-[family-name:var(--font-display)] text-[0.95rem] font-bold sm:text-base">{name}</p>
          <Stars value={r.rating} className="size-3.5 sm:size-4" tone="pine" />
          {(category || r.author_city) && (
            <p className="truncate text-xs text-mute">
              {[category, r.author_city].filter(Boolean).join(" · ")}
            </p>
          )}
        </div>
      </header>
      <div className="relative mt-4">
        <QuoteMark className="pointer-events-none absolute -top-1 end-0 h-7 w-9 text-pine/15 sm:h-9 sm:w-12" />
        {r.body && <p className="relative whitespace-pre-line text-[0.95rem] leading-relaxed sm:text-lg">{r.body}</p>}
      </div>
      {(r.is_verified || r.product) && (
        <footer className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
          {r.is_verified && <span className="inline-flex items-center gap-1 font-semibold text-pine"><BadgeCheck className="size-3.5" /> {dict.reviews.verified}</span>}
          {r.product && <Link href={`/${locale}/product/${r.product.slug}`} className="text-mute underline-offset-4 hover:underline">{locale === "ar" ? r.product.name_ar : r.product.name_en}</Link>}
        </footer>
      )}
    </article>
  );
}
