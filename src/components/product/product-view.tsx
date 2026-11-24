"use client";
import Image from "next/image";
import Link from "next/link";
import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { Heart, Minus, Plus, Ruler, X, ZoomIn, Paintbrush, ScanLine } from "lucide-react";
import { useI18n, fmt } from "@/components/i18n-provider";
import { useCart } from "@/components/cart/store";
import { toast } from "@/components/ui/toast";
import { toggleFavorite } from "@/lib/actions/forms";
import { formatIQD, cn } from "@/lib/format";
import type { ProductDetail, Color } from "@/lib/types";
import { SizeGuideTable } from "./size-guide";
import { MockupPreview } from "./mockup-preview";
import { designCm } from "@/lib/print-config";
import { CoupleFields } from "./couple-fields";
import { cleanValues, missingInputs, parseCoupleOptions, resolveLocally, type OptionValues } from "@/lib/couple-options";

export function ProductView({ product, sizeOrder, garment, initialFavorite, signedIn, customStudio = true }: { product: ProductDetail; sizeOrder: string[]; garment: string; initialFavorite: boolean; signedIn: boolean; customStudio?: boolean }) {
  const { locale, dict } = useI18n();
  const router = useRouter();
  const add = useCart((s) => s.add);
  const openDrawer = useCart((s) => s.openDrawer);
  const name = locale === "ar" ? product.name_ar : product.name_en;

  const colors = useMemo(() => {
    const m = new Map<string, Color>();
    for (const v of product.product_variants) if (v.color) m.set(v.color.id, v.color);
    return [...m.values()].sort((a, b) => a.sort_order - b.sort_order);
  }, [product]);
  // the page opens on the product's cover colour (the colour of its first photo, chosen by the admin)
  const [colorId, setColorId] = useState<string | null>(() => {
    const cover = product.product_images.find((im) => im.color_id && colors.some((c) => c.id === im.color_id))?.color_id;
    return cover ?? colors[0]?.id ?? null;
  });
  const [size, setSize] = useState<string | null>(null);
  const [qty, setQty] = useState(1);
  const [guide, setGuide] = useState(false);
  const [zoom, setZoom] = useState<number | null>(null);
  const [fav, setFav] = useState(initialFavorite);
  const [favPending, startFav] = useTransition();
  const [active, setActive] = useState(0);
  // couple sets: second size + names / letters / dates set by the admin
  const couple = useMemo(() => parseCoupleOptions(product.couple_options), [product.couple_options]);
  const [answers, setAnswers] = useState<OptionValues>({});
  const [showErrors, setShowErrors] = useState(false);

  const variantsForColor = product.product_variants.filter((v) => v.color_id === colorId);
  const sizes = sizeOrder.filter((s) => product.product_variants.some((v) => v.size_code === s));
  const variant = variantsForColor.find((v) => v.size_code === size) ?? null;
  const stock = variant?.inventory?.quantity ?? 0;
  const threshold = variant?.inventory?.low_stock_threshold ?? 3;
  const price = variant?.price_override ?? product.base_price;
  // Printing template configured by the admin: views of the product with the official artwork on them.
  const print = useMemo(() => {
    const type = product.product_type;
    if (!type || product.print_enabled === false) return null;
    const off = new Set(product.disabled_print_area_ids ?? []);
    const designs = (product.product_designs ?? []);
    const views = (type.product_type_views ?? []).filter((v) => v.is_active).map((v) => {
      const areas = (v.product_print_areas ?? []).filter((a) => a.is_active && !off.has(a.id));
      return { view: v, areas, designs: designs.filter((d) => areas.some((a) => a.id === d.area_id)) };
    }).filter((x) => x.designs.length);
    if (!views.length) return null;
    const details = views.flatMap((x) => x.designs.map((d) => {
      const a = x.areas.find((y) => y.id === d.area_id)!;
      return { id: d.id, view: x.view, area: a, cm: designCm(a, d) };
    }));
    return { shape: type.garment_shape, views, details };
  }, [product]);
  const [showAreas, setShowAreas] = useState(false);
  const images = useMemo(() => {
    // the generated photos are what the live mockups show: keep them for cards / sharing, not twice in the gallery
    const pool = print ? product.product_images.filter((i) => !i.is_generated) : product.product_images;
    const forColor = pool.filter((i) => i.color_id === colorId);
    const generic = pool.filter((i) => !i.color_id);
    const list = [...forColor, ...generic];
    return list.length || print ? list : product.product_images;
  }, [product, colorId, print]);
  const color = colors.find((c) => c.id === colorId);
  // Print-on-demand items carry no ready stock: the only way to buy them is through the designer.
  const designOnly = product.is_customizable && product.product_variants.every((v) => (v.inventory?.quantity ?? 0) <= 0);

  const addToCart = (buyNow: boolean) => {
    if (!variant) {
      toast.error(dict.product.chooseOptions);
      return;
    }
    const options = couple ? cleanValues(answers) : undefined;
    if (couple && missingInputs(couple, answers).length) {
      setShowErrors(true);
      toast.error(locale === "ar" ? "كمّل قياس الهودي الثاني والخانات المطلوبة" : "Fill in the second size and the required boxes");
      return;
    }
    add({
      variant_id: variant.id,
      quantity: qty,
      ...(options && Object.keys(options).length ? { options } : {}),
      snapshot: {
        name_ar: product.name_ar,
        name_en: product.name_en,
        image: images[0]?.url ?? null,
        size: variant.size_code,
        color_hex: color?.hex,
        color_name_ar: color?.name_ar,
        color_name_en: color?.name_en,
        unit_price: price,
        slug: product.slug,
        ...(couple ? { options: resolveLocally(couple, variant.size_code, answers) } : {}),
      },
    });
    if (buyNow) router.push(`/${locale}/checkout`);
    else {
      toast.success(dict.product.added);
      openDrawer(true);
    }
  };

  const onFav = () => {
    if (!signedIn) {
      router.push(`/${locale}/account/login?next=/${locale}/product/${product.slug}`);
      return;
    }
    startFav(async () => {
      const r = await toggleFavorite(product.id);
      if (r.ok) {
        setFav(!!r.favorite);
        toast.success(r.favorite ? dict.common.favAdded : dict.common.favRemoved);
      } else toast.error(dict.common.somethingWrong);
    });
  };

  return (
    <div className="grid gap-8 pb-24 md:pb-0 lg:grid-cols-12 lg:gap-14">
      {/* Gallery */}
      <div className="lg:col-span-7">
        <div className="-mx-4 flex snap-x snap-mandatory overflow-x-auto md:mx-0 md:grid md:grid-cols-2 md:gap-2 md:overflow-visible [&::-webkit-scrollbar]:hidden" onScroll={(e) => {
          const el = e.currentTarget;
          setActive(Math.round(Math.abs(el.scrollLeft) / el.clientWidth));
        }}>
          {print?.views.map(({ view, areas, designs }) => (
            <div key={view.id} className={cn("relative aspect-[4/5] w-full shrink-0 snap-center overflow-hidden md:rounded-[1.75rem]", (print.views.length + images.length) % 2 === 1 && view.id === print.views[0]!.view.id && "md:col-span-2")}>
              <MockupPreview view={view} shape={print.shape} color={color ? { id: color.id, hex: color.hex } : null} areas={areas} designs={designs} showAreas={showAreas} label={`${name} — ${locale === "ar" ? view.name_ar : view.name_en}`} />
              <span className="absolute start-3 top-3 rounded-full bg-paper/85 px-3 py-1 text-xs font-bold backdrop-blur">{locale === "ar" ? view.name_ar : view.name_en}</span>
              {areas.some((a) => a.code !== "free") && (
                <button type="button" onClick={() => setShowAreas((v) => !v)} aria-pressed={showAreas} className="absolute bottom-3 end-3 flex items-center gap-1.5 rounded-full bg-paper/85 px-3 py-1.5 text-xs font-semibold backdrop-blur">
                  <ScanLine className="size-4" /> {showAreas ? (locale === "ar" ? "إخفاء منطقة الطباعة" : "Hide print area") : (locale === "ar" ? "منطقة الطباعة" : "Print area")}
                </button>
              )}
            </div>
          ))}
          {images.map((img, i) => (
            <button
              key={img.id}
              onClick={() => setZoom(i)}
              className={cn("group relative aspect-[4/5] w-full shrink-0 snap-center cursor-zoom-in overflow-hidden bg-[#ebe7de] md:rounded-[1.75rem]", !print && i === 0 && images.length % 2 === 1 && "md:col-span-2")}
              aria-label={`${dict.product.zoom} ${i + 1}`}
            >
              <Image src={img.url} alt={(locale === "ar" ? img.alt_ar : img.alt_en) ?? name} fill priority={i === 0} sizes="(min-width:1024px) 30vw, 100vw" className="object-cover transition-transform duration-700 group-hover:scale-[1.04]" />
              <ZoomIn className="absolute bottom-3 end-3 size-5 opacity-0 transition group-hover:opacity-70" />
            </button>
          ))}
        </div>
        {images.length + (print?.views.length ?? 0) > 1 && (
          <div className="mt-3 flex justify-center gap-1.5 md:hidden" aria-hidden>
            {Array.from({ length: images.length + (print?.views.length ?? 0) }, (_, i) => <span key={i} className={cn("h-1 rounded-full transition-all", i === active ? "w-6 bg-ink" : "w-1.5 bg-line")} />)}
          </div>
        )}
      </div>

      {/* Purchase panel */}
      <div className="lg:col-span-5">
        <div className="lg:sticky lg:top-28">
          <div className="flex items-start justify-between gap-4">
            <div>
              {(product.is_limited || product.is_new_arrival) && (
                <p className="eyebrow mb-2 text-amber-deep">{product.is_limited ? dict.shop.limited : dict.shop.new}</p>
              )}
              <h1 className="display text-3xl md:text-4xl">{name}</h1>
            </div>
            <button onClick={onFav} disabled={favPending} className={cn("grid size-11 shrink-0 place-items-center rounded-full border border-line transition-colors hover:border-ink", fav && "border-danger/40 bg-danger/10", favPending && "animate-[bump_.5s_ease-out]")} aria-pressed={fav} aria-label={fav ? dict.product.unfavorite : signedIn ? dict.product.favorite : dict.product.loginToFavorite}>
              <Heart className={cn("size-5 transition-transform", fav && "scale-110 fill-danger text-danger")} />
            </button>
          </div>
          <p className="mt-4 flex items-baseline gap-3 text-xl tabular-nums">
            <span className="font-semibold">{formatIQD(price, locale)}</span>
            {product.compare_at_price && product.compare_at_price > price && <s className="text-base text-mute">{formatIQD(product.compare_at_price, locale)}</s>}
          </p>

          {!!product.garment_options?.length && product.product_type && (
            <div className="mt-6">
              <p className="mb-3 text-sm font-semibold">{locale === "ar" ? "نفس التصميم على:" : "Same design on:"}</p>
              <div className="flex flex-wrap gap-2" role="list" aria-label={locale === "ar" ? "نوع القطعة" : "Garment"}>
                <span role="listitem" aria-current="true" className="flex items-center gap-2 rounded-full border-2 border-ink bg-ink px-4 py-2 text-sm font-bold text-paper">
                  {locale === "ar" ? product.product_type.name_ar : product.product_type.name_en} <span className="font-normal tabular-nums opacity-80">{formatIQD(price, locale)}</span>
                </span>
                {product.garment_options.map((g) => (
                  <Link key={g.slug} role="listitem" href={`/${locale}/product/${g.slug}`} className="flex items-center gap-2 rounded-full border border-line px-4 py-2 text-sm font-semibold transition hover:border-ink">
                    {locale === "ar" ? g.type.name_ar : g.type.name_en} <span className="font-normal tabular-nums text-mute">{formatIQD(g.price, locale)}</span>
                  </Link>
                ))}
              </div>
            </div>
          )}

          <div className="mt-8" id="options">
            <p className="mb-3 text-sm font-semibold">
              {dict.common.color}: <span className="font-normal text-mute">{color ? (locale === "ar" ? color.name_ar : color.name_en) : ""}</span>
            </p>
            <div className="flex flex-wrap gap-3" role="radiogroup" aria-label={dict.product.selectColor}>
              {colors.map((c) => (
                <button
                  key={c.id}
                  role="radio"
                  aria-checked={c.id === colorId}
                  aria-label={locale === "ar" ? c.name_ar : c.name_en}
                  onClick={() => {
                    setColorId(c.id);
                    setActive(0);
                  }}
                  className={cn("size-10 rounded-full border transition", c.id === colorId ? "border-ink ring-2 ring-ink ring-offset-2" : "border-ink/25 hover:border-ink")}
                  style={{ background: c.hex }}
                />
              ))}
            </div>
          </div>

          {designOnly ? (
            <div className="mt-8 space-y-3">
              <p className="text-sm leading-relaxed text-mute">{dict.product.designOnlyNote}</p>
              <Link href={`/${locale}/design?garment=${garment}${color ? `&color=${color.code}` : ""}`} className="btn btn-primary h-14 w-full text-base">
                <Paintbrush className="size-5" /> {dict.product.customizeThis}
              </Link>
            </div>
          ) : (
            <>
          <div className="mt-8">
            <div className="mb-3 flex items-center justify-between">
              <p className="text-sm font-semibold">{couple?.second_size ? (locale === "ar" ? "قياس الهودي الأول" : "First hoodie size") : dict.product.selectSize}</p>
              <button onClick={() => setGuide(true)} className="inline-flex items-center gap-1.5 text-sm underline">
                <Ruler className="size-4" /> {dict.product.sizeGuide}
              </button>
            </div>
            <div className="grid grid-cols-5 gap-2" role="radiogroup" aria-label={dict.product.selectSize}>
              {sizes.map((s) => {
                const v = variantsForColor.find((x) => x.size_code === s);
                const out = !v || (v.inventory?.quantity ?? 0) <= 0;
                return (
                  <button
                    key={s}
                    role="radio"
                    aria-checked={size === s}
                    data-disabled={out}
                    disabled={!v}
                    onClick={() => {
                      setSize(s);
                      setQty(1);
                    }}
                    className="chip w-full"
                  >
                    {s}
                  </button>
                );
              })}
            </div>
            <Link href={`/${locale}/size-finder?product=${garment === "hoodie" || garment === "sweatshirt" ? garment : "tshirt"}`} className="mt-3 inline-flex items-center gap-1.5 text-sm font-semibold text-pine hover:underline">
              <Ruler className="size-4" /> {locale === "ar" ? "ما تعرف قياسك؟ اعرفه بثواني من طولك ووزنك" : "Not sure? Find your size from your height and weight"}
            </Link>
            <p className="mt-3 h-5 text-sm" aria-live="polite">
              {variant &&
                (stock <= 0 ? (
                  <span className="text-danger">{dict.product.outOfStock}</span>
                ) : stock <= threshold ? (
                  <span className="font-semibold text-amber-deep">{fmt(dict.product.lowStock, { n: stock })}</span>
                ) : (
                  <span className="text-success">{dict.product.inStock}</span>
                ))}
            </p>
          </div>

          {couple && <CoupleFields cfg={couple} sizes={sizes} values={answers} onChange={setAnswers} locale={locale} showErrors={showErrors} />}

          <div className="mt-4 flex gap-3">
            <div className="flex items-center border border-line" role="group" aria-label={dict.common.quantity}>
              <button className="grid size-12 place-items-center disabled:opacity-30" onClick={() => setQty((q) => Math.max(1, q - 1))} disabled={qty <= 1} aria-label="-">
                <Minus className="size-4" />
              </button>
              <span className="w-8 text-center font-semibold tabular-nums">{qty}</span>
              <button className="grid size-12 place-items-center disabled:opacity-30" onClick={() => setQty((q) => Math.min(q + 1, Math.max(1, Math.min(stock, 99))))} disabled={!!variant && qty >= stock} aria-label="+">
                <Plus className="size-4" />
              </button>
            </div>
            <button onClick={() => addToCart(false)} disabled={!!variant && stock <= 0} className="btn btn-primary h-12 flex-1">
              {dict.product.addToCart}
            </button>
          </div>
          <button onClick={() => addToCart(true)} disabled={!!variant && stock <= 0} className="btn btn-outline mt-3 h-12 w-full">
            {dict.product.buyNow}
          </button>
          {product.is_customizable && customStudio && (
            <Link href={`/${locale}/design?garment=${garment}${color ? `&color=${color.code}` : ""}`} className="btn btn-accent mt-3 h-12 w-full">
              <Paintbrush className="size-4" /> {dict.product.customizeThis}
            </Link>
          )}
            </>
          )}
          {variant && <p className="mt-4 text-xs text-mute">{dict.product.sku}: <span dir="ltr">{variant.sku}</span></p>}

          {print && (
            <div className="mt-8 rounded-[1.5rem] border border-line p-5">
              <p className="flex items-center gap-2 text-sm font-bold"><ScanLine className="size-4 text-pine" /> {locale === "ar" ? "تفاصيل الطباعة" : "Print details"}</p>
              <ul className="mt-3 space-y-2 text-sm">
                {print.details.map((d) => (
                  <li key={d.id} className="flex flex-wrap items-baseline justify-between gap-x-3">
                    <span>{d.area.code === "free" ? (locale === "ar" ? "تصميم" : "Design") : locale === "ar" ? d.area.name_ar : d.area.name_en} <span className="text-xs text-mute">· {locale === "ar" ? d.view.name_ar : d.view.name_en}</span></span>
                    <span className="tabular-nums" dir="ltr"><b>{d.area.code === "free" ? "≈ " : ""}{d.cm.w} × {d.cm.h} cm</b>{d.area.code !== "free" && <span className="text-xs text-mute"> / max {d.area.max_width_cm} × {d.area.max_height_cm}</span>}</span>
                  </li>
                ))}
              </ul>
              <p className="mt-3 text-xs text-mute">{locale === "ar" ? "المقاس الأول هو حجم الطباعة الفعلي، والثاني أكبر حجم يُطبع بهذا المكان." : "The first size is the actual print, the second the largest this spot can print."}</p>
            </div>
          )}

          <div className="mt-8 divide-y divide-line border-y border-line">
            {[
              [dict.product.description, locale === "ar" ? product.description_ar : product.description_en],
              [dict.product.material, locale === "ar" ? product.material_ar : product.material_en],
              [dict.product.printing, locale === "ar" ? product.printing_ar : product.printing_en],
              [dict.product.delivery, dict.product.deliveryBody],
            ]
              .filter(([, body]) => body)
              .map(([title, body], i) => (
                <details key={title} open={i === 0} className="group py-4">
                  <summary className="flex cursor-pointer list-none items-center justify-between text-sm font-semibold">
                    {title}
                    <Plus className="size-4 transition-transform group-open:rotate-45" />
                  </summary>
                  <p className="mt-3 whitespace-pre-line text-sm leading-relaxed text-mute">{body}</p>
                </details>
              ))}
          </div>
        </div>
      </div>

      {/* Size guide */}
      <AnimatePresence>
        {guide && (
          <motion.div className="fixed inset-0 z-[90] grid place-items-center p-4" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <div className="absolute inset-0 bg-ink/50" onClick={() => setGuide(false)} />
            <motion.div initial={{ scale: 0.96 }} animate={{ scale: 1 }} className="relative w-full max-w-lg bg-paper p-6" role="dialog" aria-modal="true" aria-label={dict.product.sizeGuide}>
              <div className="mb-4 flex items-center justify-between">
                <h2 className="display text-2xl">{dict.product.sizeGuide}</h2>
                <button onClick={() => setGuide(false)} className="grid size-10 place-items-center" aria-label={dict.common.close}><X className="size-5" /></button>
              </div>
              <SizeGuideTable garment={garment} />
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Mobile purchase bar */}
      {!designOnly && (
        <div className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-paper/90 px-4 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-3 backdrop-blur-xl md:hidden">
          <div className="mx-auto flex max-w-md items-center gap-3">
            <div className="shrink-0">
              <p className="max-w-[9rem] truncate text-[11px] text-mute">{name}</p>
              <p className="font-[family-name:var(--font-display)] text-xl font-extrabold tabular-nums text-pine">{formatIQD(price, locale)}</p>
            </div>
            <button
              onClick={() => {
                if (!variant) document.getElementById("options")?.scrollIntoView({ behavior: "smooth", block: "center" });
                addToCart(false);
              }}
              disabled={!!variant && stock <= 0}
              className="btn btn-brand h-12 flex-1"
            >
              {dict.product.addToCart}
            </button>
          </div>
        </div>
      )}

      {/* Zoom lightbox */}
      <AnimatePresence>
        {zoom !== null && images[zoom] && (
          <ZoomLightbox src={images[zoom].url} alt={name} onClose={() => setZoom(null)} onNav={(d) => setZoom((z) => ((z ?? 0) + d + images.length) % images.length)} count={images.length} closeLabel={dict.common.close} />
        )}
      </AnimatePresence>
    </div>
  );
}

function ZoomLightbox({ src, alt, onClose, onNav, count, closeLabel }: { src: string; alt: string; onClose: () => void; onNav: (d: number) => void; count: number; closeLabel: string }) {
  const [origin, setOrigin] = useState("50% 50%");
  const [zoomed, setZoomed] = useState(false);
  return (
    <motion.div className="fixed inset-0 z-[95] bg-paper" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} role="dialog" aria-modal="true" aria-label={alt}>
      <button onClick={onClose} className="absolute end-4 top-4 z-10 grid size-11 place-items-center bg-paper" aria-label={closeLabel}><X className="size-6" /></button>
      <div
        className={cn("relative h-full w-full overflow-hidden", zoomed ? "cursor-zoom-out" : "cursor-zoom-in")}
        onClick={() => setZoomed((z) => !z)}
        onMouseMove={(e) => {
          const r = e.currentTarget.getBoundingClientRect();
          setOrigin(`${((e.clientX - r.left) / r.width) * 100}% ${((e.clientY - r.top) / r.height) * 100}%`);
        }}
        onTouchMove={(e) => {
          const t = e.touches[0]!;
          const r = e.currentTarget.getBoundingClientRect();
          setOrigin(`${((t.clientX - r.left) / r.width) * 100}% ${((t.clientY - r.top) / r.height) * 100}%`);
        }}
      >
        <Image src={src} alt={alt} fill sizes="100vw" quality={90} className="object-contain transition-transform duration-300" style={{ transform: zoomed ? "scale(2.4)" : "scale(1)", transformOrigin: origin }} />
      </div>
      {count > 1 && (
        <div className="absolute inset-x-0 bottom-6 flex justify-center gap-3">
          <button onClick={() => onNav(-1)} className="btn btn-outline btn-sm bg-paper">‹</button>
          <button onClick={() => onNav(1)} className="btn btn-outline btn-sm bg-paper">›</button>
        </div>
      )}
    </motion.div>
  );
}
