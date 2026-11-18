import Image from "next/image";
import Link from "next/link";
import type { Locale } from "@/lib/i18n/config";
import type { Dict } from "@/lib/i18n/dictionaries/ar";
import type { ProductCard as Card } from "@/lib/types";
import { formatIQD } from "@/lib/format";

const badge = "rounded-full px-2.5 py-1 text-[11px] font-bold leading-none";

export function ProductCard({ product, locale, dict, priority = false, sizes = "(min-width:1024px) 25vw, 50vw" }: { product: Card; locale: Locale; dict: Dict; priority?: boolean; sizes?: string }) {
  const name = locale === "ar" ? product.name_ar : product.name_en;
  const [a, b] = product.images;
  const onSale = product.compare_at_price && product.compare_at_price > product.price;
  return (
    <Link
      href={`/${locale}/product/${product.slug}`}
      className="group block rounded-[1.6rem] border border-line bg-paper p-1.5 transition-all duration-300 hover:-translate-y-1 hover:border-pine/40 hover:shadow-[0_18px_40px_-24px_rgba(55,99,82,0.55)] sm:p-2"
    >
      <div className="relative aspect-[4/5] overflow-hidden rounded-[1.2rem] bg-[#ebe7de]">
        {a && (
          <Image src={a.url} alt={(locale === "ar" ? a.alt_ar : a.alt_en) ?? name} fill sizes={sizes} priority={priority} className={`object-cover transition-all duration-700 ease-out-expo group-hover:scale-[1.04] ${b ? "group-hover:opacity-0" : ""}`} />
        )}
        {b && <Image src={b.url} alt="" fill sizes={sizes} className="object-cover opacity-0 transition-opacity duration-700 group-hover:opacity-100" />}
        <div className="absolute start-2.5 top-2.5 flex flex-col items-start gap-1.5">
          {!product.in_stock && !product.is_customizable && <span className={`${badge} bg-night/85 text-snow backdrop-blur`}>{dict.shop.soldOut}</span>}
          {product.is_limited && <span className={`${badge} bg-amber text-[#1a1208]`}>{dict.shop.limited}</span>}
          {product.is_new_arrival && <span className={`${badge} bg-pine text-white`}>{dict.shop.new}</span>}
          {onSale && <span className={`${badge} bg-danger text-white`}>{dict.shop.sale}</span>}
        </div>
      </div>
      <div className="px-2 pb-2.5 pt-3 sm:px-2.5">
        <h3 className="line-clamp-2 min-h-[2.6em] text-[0.92rem] font-bold leading-snug sm:text-[0.98rem]">{name}</h3>
        <div className="mt-2 flex items-center justify-between gap-2">
          <p className="flex items-baseline gap-2 tabular-nums">
            <span className="font-[family-name:var(--font-display)] text-[1.02rem] font-extrabold text-pine">{formatIQD(product.price, locale)}</span>
            {onSale && <s className="text-xs text-mute">{formatIQD(product.compare_at_price!, locale)}</s>}
          </p>
          {product.colors.length > 1 && (
            <div className="flex -space-x-1.5 rtl:space-x-reverse" aria-hidden>
              {product.colors.slice(0, 4).map((c) => (
                <span key={c} className="size-4 rounded-full border-2 border-paper ring-1 ring-ink/20" style={{ background: c }} />
              ))}
            </div>
          )}
        </div>
      </div>
    </Link>
  );
}

export function ProductGridSkeleton({ count = 8 }: { count?: number }) {
  return (
    <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-4 md:gap-5">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i}>
          <div className="skeleton aspect-[4/5]" />
          <div className="skeleton mt-3 h-4 w-3/4" />
          <div className="skeleton mt-2 h-4 w-1/3" />
        </div>
      ))}
    </div>
  );
}
