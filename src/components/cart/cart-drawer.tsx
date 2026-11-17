"use client";
import Link from "next/link";
import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { ShoppingBag, X } from "lucide-react";
import { useI18n } from "@/components/i18n-provider";
import { formatIQD } from "@/lib/format";
import { useCart, lineKey, cartCount } from "./store";
import { useQuote } from "./use-quote";
import { CartLineRow } from "./cart-line";

export function CartDrawer() {
  const { locale, dict } = useI18n();
  const open = useCart((s) => s.drawerOpen);
  const setOpen = useCart((s) => s.openDrawer);
  const pathname = usePathname();
  const { quote, lines } = useQuote({ enabled: open });

  useEffect(() => setOpen(false), [pathname, setOpen]);
  useEffect(() => {
    document.body.style.overflow = open ? "hidden" : "";
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, setOpen]);

  const qmap = new Map((quote?.lines ?? []).map((l) => [l.variant_id ?? `d:${l.custom_design_id}`, l]));

  return (
    <AnimatePresence>
      {open && (
        <motion.div className="fixed inset-0 z-[80]" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
          <div className="absolute inset-0 bg-ink/40" onClick={() => setOpen(false)} />
          <motion.aside
            role="dialog"
            aria-modal="true"
            aria-label={dict.cart.title}
            initial={{ x: locale === "ar" ? "-100%" : "100%" }}
            animate={{ x: 0 }}
            exit={{ x: locale === "ar" ? "-100%" : "100%" }}
            transition={{ type: "tween", duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
            className="absolute inset-y-0 end-0 flex w-full max-w-md flex-col bg-paper"
          >
            <div className="flex h-16 items-center justify-between border-b border-line px-5">
              <h2 className="display text-xl">
                {dict.cart.title} <span className="text-mute">({cartCount(lines)})</span>
              </h2>
              <button onClick={() => setOpen(false)} className="grid size-10 place-items-center" aria-label={dict.common.close}>
                <X className="size-5" />
              </button>
            </div>
            {lines.length === 0 ? (
              <div className="flex flex-1 flex-col items-center justify-center gap-4 px-6 text-center">
                <ShoppingBag className="size-10 text-mute" strokeWidth={1.2} />
                <p className="display text-2xl">{dict.cart.empty}</p>
                <p className="text-sm text-mute">{dict.cart.emptyBody}</p>
                <Link href={`/${locale}/shop`} className="btn btn-primary mt-2">{dict.common.shopNow}</Link>
              </div>
            ) : (
              <>
                <div className="flex-1 divide-y divide-line overflow-y-auto px-5">
                  {lines.map((l) => (
                    <CartLineRow key={lineKey(l)} line={l} quoted={qmap.get(lineKey(l))} compact />
                  ))}
                </div>
                <div className="space-y-3 border-t border-line p-5">
                  <div className="flex justify-between text-sm">
                    <span>{dict.cart.subtotal}</span>
                    <span className="font-semibold tabular-nums">{quote ? formatIQD(quote.subtotal, locale) : "—"}</span>
                  </div>
                  <p className="text-xs text-mute">{dict.cart.deliveryCalculated}</p>
                  <div className="grid grid-cols-2 gap-2">
                    <Link href={`/${locale}/cart`} className="btn btn-outline">{dict.cart.title}</Link>
                    <Link href={`/${locale}/checkout`} className="btn btn-primary">{dict.cart.checkout}</Link>
                  </div>
                </div>
              </>
            )}
          </motion.aside>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
