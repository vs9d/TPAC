"use client";
import Image from "next/image";
import Link from "next/link";
import { Minus, Plus, X } from "lucide-react";
import { useI18n, fmt } from "@/components/i18n-provider";
import { formatIQD } from "@/lib/format";
import { toast } from "@/components/ui/toast";
import { useCart, lineKey, type CartLine as Line } from "./store";
import type { QuoteLine } from "@/lib/types";
import { LineOptions } from "@/components/product/line-options";

export function CartLineRow({ line, quoted, compact = false }: { line: Line; quoted?: QuoteLine; compact?: boolean }) {
  const { locale, dict } = useI18n();
  const setQuantity = useCart((s) => s.setQuantity);
  const remove = useCart((s) => s.remove);
  const key = lineKey(line);
  const snap = line.snapshot;
  const name = quoted ? (locale === "ar" ? quoted.name_ar : quoted.name_en) : snap ? (locale === "ar" ? snap.name_ar : snap.name_en) : "…";
  const image = quoted?.image_url ?? snap?.image ?? null;
  const colorName = quoted ? (locale === "ar" ? quoted.color_name_ar : quoted.color_name_en) : locale === "ar" ? snap?.color_name_ar : snap?.color_name_en;
  const lineOptions = quoted?.options ?? snap?.options;
  // a couple set lists "first hoodie size" with its options — no second size label
  const size = lineOptions?.some((o) => o.key === "size_1") ? undefined : quoted?.size_code ?? snap?.size;
  const unit = quoted?.unit_price ?? snap?.unit_price ?? 0;
  const href = quoted?.slug ?? snap?.slug ? `/${locale}/product/${quoted?.slug ?? snap?.slug}` : `/${locale}/design`;
  const errorText =
    quoted?.error === "unavailable"
      ? dict.cart.unavailable
      : quoted?.error === "insufficient_stock"
      ? fmt(dict.cart.insufficientStock, { n: quoted.available ?? 0 })
      : quoted?.error === "invalid_quantity"
      ? dict.cart.invalidQuantity
      : quoted?.error === "options_required"
      ? (locale === "ar" ? "ناقص قياس الهودي الثاني أو اسم/حرف/تاريخ — احذفه وأضفه من صفحة المنتج من جديد." : "The second size or a name / letter / date is missing — remove it and add it again from the product page.")
      : null;
  const locations = quoted?.print_locations ?? snap?.print_locations;

  return (
    <div className="flex gap-4 py-5">
      <Link href={href} className={`relative shrink-0 overflow-hidden bg-bone ${compact ? "h-28 w-22" : "h-36 w-28"}`}>
        {image && <Image src={image} alt={name} fill sizes="120px" className="object-cover" unoptimized={image.startsWith("data:") || image.includes("token=")} />}
      </Link>
      <div className="flex min-w-0 flex-1 flex-col">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <Link href={href} className="line-clamp-2 text-sm font-semibold leading-snug hover:underline">{name}</Link>
            <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-mute">
              {line.custom_design_id && <span className="bg-amber/20 px-1.5 py-0.5 font-semibold text-ink">{dict.cart.customDesign}</span>}
              {colorName && (
                <span className="inline-flex items-center gap-1.5">
                  <span className="size-3 rounded-full border border-line" style={{ background: quoted?.color_hex ?? snap?.color_hex }} />
                  {colorName}
                </span>
              )}
              {size && <span>{dict.common.size}: {size}</span>}
            </p>
            {locations && locations.length > 0 && (
              <p className="mt-1 text-xs text-mute">{dict.cart.printLocations}: {locations.map((l) => dict.designer.locations[l] ?? l).join("، ")}</p>
            )}
            {snap?.extras && <p className="mt-0.5 text-xs text-mute">{snap.extras}</p>}
            <LineOptions options={lineOptions} locale={locale} />
          </div>
          <button data-ripple onClick={() => { remove(key); toast.info(dict.common.itemRemoved); }} className="grid size-9 place-items-center rounded-full text-mute hover:bg-bone hover:text-ink" aria-label={dict.cart.remove}>
            <X className="size-4" />
          </button>
        </div>
        {errorText && <p className="mt-2 text-xs font-semibold text-danger">{errorText}</p>}
        <div className="mt-auto flex items-center justify-between pt-3">
          <div className="flex items-center border border-line" role="group" aria-label={dict.common.quantity}>
            <button className="grid size-8 place-items-center disabled:opacity-30" onClick={() => setQuantity(key, line.quantity - 1)} disabled={line.quantity <= 1} aria-label="-">
              <Minus className="size-3.5" />
            </button>
            <span className="w-8 text-center text-sm font-semibold tabular-nums">{line.quantity}</span>
            <button className="grid size-8 place-items-center disabled:opacity-30" onClick={() => setQuantity(key, line.quantity + 1)} disabled={line.quantity >= Math.min(99, quoted?.available ?? 99)} aria-label="+">
              <Plus className="size-3.5" />
            </button>
          </div>
          <p className="text-sm font-semibold tabular-nums">{formatIQD(quoted?.line_total ?? unit * line.quantity, locale)}</p>
        </div>
      </div>
    </div>
  );
}
