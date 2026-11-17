import Image from "next/image";
import Link from "next/link";
import type { Locale } from "@/lib/i18n/config";
import type { Dict } from "@/lib/i18n/dictionaries/ar";
import type { ProductCard as Card } from "@/lib/types";
import { formatIQD } from "@/lib/format";

export function ProductCard({ product, locale, dict, priority = false, sizes = "(min-width:1024px) 25vw, 50vw" }: { product: Card; locale: Locale; dict: Dict; priority?: boolean; sizes?: string }) {
  const name = locale === "ar" ? product.name_ar : product.name_en;
  const [a, b] = product.images;
  const onSale = product.compare_at_price && product.compare_at_price > product.price;
  return (
    <Link href={`/${locale}/product/${product.slug}`} className="group block" prefetch={false}>
      <div className="relative aspect-[4/5] overflow-hidden bg-bone">
        {a && (
          <Image src={a.url} alt={(locale === "ar" ? a.alt_ar : a.alt_en) ?? name} fill sizes={sizes} priority={priority} className={`object-cover transition-all duration-700 ease-out-expo group-hover:scale-[1.03] ${b ? "group-hover:opacity-0" : ""}`} />
        )}
        {b && <Image src={b.url} alt="" fill sizes={sizes} className="object-cover opacity-0 transition-opacity duration-700 group-hover:opacity-100" />}
        <div className="absolute start-2 top-2 flex flex-col items-start gap-1">
          {!product.in_stock && !product.is_customizable && <span className="bg-paper px-2 py-1 text-[10px] font-bold uppercase">{dict.shop.soldOut}</span>}
          {product.is_limited && <span className="bg-amber px-2 py-1 text-[10px] font-bold uppercase text-ink">{dict.shop.limited}</span>}
          {product.is_new_arrival && <span className="bg-ink px-2 py-1 text-[10px] font-bold uppercase text-paper">{dict.shop.new}</span>}
          {onSale && <span className="bg-pine px-2 py-1 text-[10px] font-bold uppercase text-paper">{dict.shop.sale}</span>}
        </div>
      </div>
      <div className="mt-3 space-y-1">
        <h3 className="line-clamp-1 text-sm font-semibold">{name}</h3>
        <p className="flex items-baseline gap-2 text-sm tabular-nums">
          <span className={onSale ? "font-semibold text-pine" : ""}>{formatIQD(product.price, locale)}</span>
          {onSale && <s className="text-xs text-mute">{formatIQD(product.compare_at_price!, locale)}</s>}
        </p>
        {product.colors.length > 1 && (
          <div className="flex gap-1.5 pt-1" aria-hidden>
            {product.colors.slice(0, 5).map((c) => (
              <span key={c} className="size-3 rounded-full border border-black/15" style={{ background: c }} />
            ))}
          </div>
        )}
      </div>
    </Link>
  );
}

export function ProductGridSkeleton({ count = 8 }: { count?: number }) {
  return (
    <div className="grid grid-cols-2 gap-x-3 gap-y-8 md:grid-cols-3 lg:grid-cols-4 md:gap-x-5">
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
