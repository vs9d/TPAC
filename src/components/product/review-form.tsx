"use client";
import Link from "next/link";
import { useActionState, useState } from "react";
import { Star } from "lucide-react";
import { submitReview } from "@/lib/actions/forms";
import { useI18n } from "@/components/i18n-provider";
import { cn } from "@/lib/format";

export function ReviewForm({ productId, signedIn, slug }: { productId: string; signedIn: boolean; slug: string }) {
  const { locale, dict } = useI18n();
  const [state, action, pending] = useActionState(submitReview, null);
  const [rating, setRating] = useState(5);
  if (!signedIn) return <Link href={`/${locale}/account/login?next=/${locale}/product/${slug}`} className="btn btn-outline btn-sm">{dict.product.writeReview}</Link>;
  if (state?.ok) return <p className="text-sm font-medium text-success">{dict.product.reviewSubmitted}</p>;
  return (
    <form action={action} className="max-w-lg space-y-3">
      <input type="hidden" name="product_id" value={productId} />
      <input type="hidden" name="rating" value={rating} />
      <div className="flex gap-1" role="radiogroup" aria-label={dict.product.rating}>
        {[1, 2, 3, 4, 5].map((n) => (
          <button type="button" key={n} role="radio" aria-checked={rating === n} aria-label={String(n)} onClick={() => setRating(n)}>
            <Star className={cn("size-6", n <= rating ? "fill-amber text-amber" : "text-line")} />
          </button>
        ))}
      </div>
      <textarea name="body" className="field" maxLength={2000} rows={3} aria-label={dict.product.writeReview} />
      {state?.ok === false && <p className="text-sm text-danger">{dict.common.somethingWrong}</p>}
      <button disabled={pending} className="btn btn-primary btn-sm">{dict.product.writeReview}</button>
    </form>
  );
}
