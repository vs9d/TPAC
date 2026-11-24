"use client";
import { useEffect, useRef } from "react";
import { syncCart, saveCart } from "@/lib/actions/cart";
import { useCart, lineItem, lineKey } from "./store";

const toServer = (lines: ReturnType<typeof useCart.getState>["lines"]) => lines.map(lineItem);

/** Keeps a signed-in customer's cart saved to their account (cross-device persistence). */
export function CartSync({ userId }: { userId: string | null }) {
  const hydrated = useCart((s) => s.hydrated);
  const version = useCart((s) => s.version);
  const synced = useRef<string | null>(null);

  useEffect(() => {
    if (!hydrated || !userId || synced.current === userId) return;
    synced.current = userId;
    const local = useCart.getState().lines;
    syncCart(toServer(local)).then((res) => {
      if (!res.ok) return;
      const bySnapshot = new Map(local.map((l) => [lineKey(l), l.snapshot]));
      useCart.getState().replace(res.data.map((l) => ({ ...l, snapshot: bySnapshot.get(lineKey(l)) })));
    });
  }, [hydrated, userId]);

  useEffect(() => {
    if (!hydrated || !userId || synced.current !== userId || version === 0) return;
    const t = setTimeout(() => saveCart(toServer(useCart.getState().lines)), 800);
    return () => clearTimeout(t);
  }, [version, hydrated, userId]);

  return null;
}
