"use client";
import { useEffect, useState, useTransition } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { SlidersHorizontal, X, Check } from "lucide-react";
import { useI18n } from "@/components/i18n-provider";
import { cn } from "@/lib/format";

interface Opt { value: string; ar: string; en: string; hex?: string }

export function CatalogFilters({
  categories,
  collections,
  sizes,
  colors,
  hideCategory = false,
  hideCollection = false,
  total,
}: {
  categories: Opt[];
  collections: Opt[];
  sizes: string[];
  colors: Opt[];
  hideCategory?: boolean;
  hideCollection?: boolean;
  total: number;
}) {
  const { locale, dict } = useI18n();
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();
  const [min, setMin] = useState(params.get("min") ?? "");
  const [max, setMax] = useState(params.get("max") ?? "");
  useEffect(() => {
    setMin(params.get("min") ?? "");
    setMax(params.get("max") ?? "");
  }, [params]);

  const update = (mut: (p: URLSearchParams) => void) => {
    const p = new URLSearchParams(params.toString());
    mut(p);
    p.delete("page");
    start(() => router.push(`${pathname}?${p.toString()}`, { scroll: false }));
  };
  const toggleMulti = (key: string, value: string) =>
    update((p) => {
      const cur = p.getAll(key);
      p.delete(key);
      (cur.includes(value) ? cur.filter((v) => v !== value) : [...cur, value]).forEach((v) => p.append(key, v));
    });
  const setSingle = (key: string, value: string | null) => update((p) => (value ? p.set(key, value) : p.delete(key)));
  const toggleFlag = (key: string) => update((p) => (p.get(key) ? p.delete(key) : p.set(key, "1")));
  const label = (o: Opt) => (locale === "ar" ? o.ar : o.en);
  const activeCount = ["category", "collection", "size", "color", "min", "max", "stock", "new", "best"].reduce((n, k) => n + params.getAll(k).length, 0);

  const panel = (
    <div className={cn("space-y-8 transition-opacity", pending && "opacity-60")}>
      {!hideCategory && categories.length > 0 && (
        <fieldset>
          <legend className="eyebrow mb-3">{dict.shop.category}</legend>
          <ul className="space-y-1.5">
            {categories.map((c) => {
              const active = params.get("category") === c.value;
              return (
                <li key={c.value}>
                  <button onClick={() => setSingle("category", active ? null : c.value)} className={cn("flex w-full items-center justify-between py-1 text-start text-sm", active ? "font-semibold" : "text-mute hover:text-ink")} aria-pressed={active}>
                    {label(c)} {active && <Check className="size-4" />}
                  </button>
                </li>
              );
            })}
          </ul>
        </fieldset>
      )}
      {!hideCollection && collections.length > 0 && (
        <fieldset>
          <legend className="eyebrow mb-3">{dict.shop.collection}</legend>
          <ul className="space-y-1.5">
            {collections.map((c) => {
              const active = params.get("collection") === c.value;
              return (
                <li key={c.value}>
                  <button onClick={() => setSingle("collection", active ? null : c.value)} className={cn("flex w-full items-center justify-between py-1 text-start text-sm", active ? "font-semibold" : "text-mute hover:text-ink")} aria-pressed={active}>
                    {label(c)} {active && <Check className="size-4" />}
                  </button>
                </li>
              );
            })}
          </ul>
        </fieldset>
      )}
      <fieldset>
        <legend className="eyebrow mb-3">{dict.shop.size}</legend>
        <div className="flex flex-wrap gap-2">
          {sizes.map((s) => (
            <button key={s} className="chip" aria-pressed={params.getAll("size").includes(s)} onClick={() => toggleMulti("size", s)}>{s}</button>
          ))}
        </div>
      </fieldset>
      <fieldset>
        <legend className="eyebrow mb-3">{dict.shop.color}</legend>
        <div className="flex flex-wrap gap-2.5">
          {colors.map((c) => {
            const active = params.getAll("color").includes(c.value);
            return (
              <button key={c.value} onClick={() => toggleMulti("color", c.value)} aria-pressed={active} title={label(c)} aria-label={label(c)} className={cn("grid size-8 place-items-center rounded-full border transition", active ? "border-ink ring-2 ring-ink ring-offset-2" : "border-ink/25")} style={{ background: c.hex }} />
            );
          })}
        </div>
      </fieldset>
      <fieldset>
        <legend className="eyebrow mb-3">{dict.shop.price}</legend>
        <form
          className="flex items-center gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            update((p) => {
              min ? p.set("min", min) : p.delete("min");
              max ? p.set("max", max) : p.delete("max");
            });
          }}
        >
          <input className="field h-10 text-sm" inputMode="numeric" pattern="[0-9]*" placeholder={dict.shop.minPrice} value={min} onChange={(e) => setMin(e.target.value.replace(/\D/g, ""))} aria-label={dict.shop.minPrice} />
          <span className="text-mute">–</span>
          <input className="field h-10 text-sm" inputMode="numeric" pattern="[0-9]*" placeholder={dict.shop.maxPrice} value={max} onChange={(e) => setMax(e.target.value.replace(/\D/g, ""))} aria-label={dict.shop.maxPrice} />
          <button className="btn btn-primary btn-sm h-10">✓</button>
        </form>
      </fieldset>
      <fieldset className="space-y-2.5">
        <legend className="eyebrow mb-3">{dict.shop.availability}</legend>
        {[
          ["stock", dict.shop.inStockOnly],
          ["new", dict.shop.newOnly],
          ["best", dict.shop.bestSellersOnly],
        ].map(([k, l]) => (
          <label key={k} className="flex cursor-pointer items-center gap-3 text-sm">
            <input type="checkbox" className="size-4 accent-ink" checked={!!params.get(k!)} onChange={() => toggleFlag(k!)} /> {l}
          </label>
        ))}
      </fieldset>
      {activeCount > 0 && (
        <button onClick={() => start(() => router.push(pathname + (params.get("q") ? `?q=${encodeURIComponent(params.get("q")!)}` : "")))} className="text-sm font-semibold underline">
          {dict.shop.clearFilters}
        </button>
      )}
    </div>
  );

  return (
    <>
      <div className="hidden lg:block">{panel}</div>
      <button onClick={() => setOpen(true)} className="btn btn-outline btn-sm lg:hidden">
        <SlidersHorizontal className="size-4" /> {dict.shop.filters} {activeCount > 0 && `(${activeCount})`}
      </button>
      <AnimatePresence>
        {open && (
          <motion.div className="fixed inset-0 z-[80] lg:hidden" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <div className="absolute inset-0 bg-ink/40" onClick={() => setOpen(false)} />
            <motion.div initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }} transition={{ type: "tween", duration: 0.3 }} className="absolute inset-x-0 bottom-0 flex max-h-[88dvh] flex-col bg-paper" role="dialog" aria-modal="true" aria-label={dict.shop.filters}>
              <div className="flex h-14 items-center justify-between border-b border-line px-4">
                <p className="display text-lg">{dict.shop.filters}</p>
                <button onClick={() => setOpen(false)} className="grid size-10 place-items-center" aria-label={dict.common.close}><X className="size-5" /></button>
              </div>
              <div className="flex-1 overflow-y-auto p-4">{panel}</div>
              <div className="border-t border-line p-4">
                <button onClick={() => setOpen(false)} className="btn btn-primary w-full">{dict.shop.applyFilters} ({total})</button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}

export function SortSelect() {
  const { dict } = useI18n();
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const value = params.get("sort") ?? "newest";
  return (
    <label className="flex items-center gap-2 text-sm">
      <span className="hidden text-mute sm:inline">{dict.shop.sort}</span>
      <select
        value={value}
        onChange={(e) => {
          const p = new URLSearchParams(params.toString());
          p.set("sort", e.target.value);
          p.delete("page");
          router.push(`${pathname}?${p.toString()}`, { scroll: false });
        }}
        className="h-9 border border-line bg-paper px-2 text-sm font-medium outline-none focus:border-ink"
        aria-label={dict.shop.sort}
      >
        <option value="newest">{dict.shop.sortNewest}</option>
        <option value="popular">{dict.shop.sortPopular}</option>
        <option value="price_asc">{dict.shop.sortPriceAsc}</option>
        <option value="price_desc">{dict.shop.sortPriceDesc}</option>
      </select>
    </label>
  );
}
