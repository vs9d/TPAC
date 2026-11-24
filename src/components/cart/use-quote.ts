"use client";
import { useEffect, useRef, useState } from "react";
import { quoteCart } from "@/lib/actions/cart";
import { useCart, lineItem, lineKey } from "./store";
import type { CartQuote } from "@/lib/types";

/** Server-calculated quote for the current cart (prices are never trusted from the browser). */
export function useQuote(opts: { governorate?: string; delivery_method?: string; phone?: string; enabled?: boolean } = {}) {
  const lines = useCart((s) => s.lines);
  const hydrated = useCart((s) => s.hydrated);
  const discountCode = useCart((s) => s.discountCode);
  const [quote, setQuote] = useState<CartQuote | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const seq = useRef(0);
  const enabled = opts.enabled ?? true;
  const key = JSON.stringify([lines.map((l) => [lineKey(l), l.quantity]), discountCode, opts.governorate, opts.delivery_method]);

  useEffect(() => {
    if (!hydrated || !enabled) return;
    if (!lines.length) {
      setQuote(null);
      return;
    }
    const id = ++seq.current;
    setLoading(true);
    const t = setTimeout(async () => {
      const res = await quoteCart({
        items: lines.map(lineItem),
        discount_code: discountCode || undefined,
        governorate: opts.governorate || undefined,
        delivery_method: (opts.delivery_method as "standard") || undefined,
        phone: opts.phone || undefined,
      });
      if (id !== seq.current) return;
      setLoading(false);
      if (res.ok) {
        setQuote(res.data);
        setError(null);
      } else setError(res.error);
    }, 150);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, hydrated, enabled]);

  return { quote, loading, error, lines, hydrated };
}
