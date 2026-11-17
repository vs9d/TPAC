import Link from "next/link";
import { BadgeCheck } from "lucide-react";
import type { Locale } from "@/lib/i18n/config";
import type { Dict } from "@/lib/i18n/dictionaries/ar";
import type { PublicReview } from "@/lib/data/reviews";
import { formatDate, cn } from "@/lib/format";
import { InstagramIcon, WhatsAppIcon, TikTokIcon } from "@/components/ui/social-icons";
import { Stars } from "./stars";
import { ReviewPhotos } from "./review-photos";

export function ReviewCard({ review: r, locale, dict }: { review: PublicReview; locale: Locale; dict: Dict }) {
  const name = r.author_name?.trim() || (locale === "ar" ? "زبون TPAC" : "TPAC customer");
  const SourceIcon = r.source === "instagram" ? InstagramIcon : r.source === "whatsapp" ? WhatsAppIcon : r.source === "tiktok" ? TikTokIcon : null;
  return (
    <article className={cn("mb-4 break-inside-avoid border bg-paper", r.is_featured ? "border-ink" : "border-line")}>
      <ReviewPhotos photos={r.photos} alt={`${dict.reviews.title} — ${name}`} />
      <div className="p-5">
        <div className="flex items-center justify-between gap-3">
          <Stars value={r.rating} />
          {SourceIcon && <SourceIcon className="size-4 text-mute" />}
        </div>
        {r.body && <p className="mt-3 whitespace-pre-line text-[0.95rem] leading-relaxed">{r.body}</p>}
        {r.product && (
          <Link href={`/${locale}/product/${r.product.slug}`} className="mt-3 inline-block text-xs font-semibold text-pine underline-offset-4 hover:underline">
            {dict.reviews.productLink} {locale === "ar" ? r.product.name_ar : r.product.name_en}
          </Link>
        )}
        <div className="mt-4 flex items-center gap-3 border-t border-line pt-4">
          <span className="grid size-9 shrink-0 place-items-center rounded-full bg-pine font-[family-name:var(--font-display)] text-sm font-bold text-amber" aria-hidden>
            {name.charAt(0)}
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold">
              {name}
              {r.author_city && <span className="font-normal text-mute"> · {r.author_city}</span>}
            </p>
            <p className="flex items-center gap-2 text-xs text-mute">
              {r.is_verified && (
                <span className="inline-flex items-center gap-1 font-semibold text-pine">
                  <BadgeCheck className="size-3.5" /> {dict.reviews.verified}
                </span>
              )}
              <time dateTime={r.created_at}>{formatDate(r.created_at, locale)}</time>
            </p>
          </div>
        </div>
      </div>
    </article>
  );
}
