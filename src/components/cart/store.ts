"use client";
import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import { valuesKey, type OptionValues, type ResolvedOption } from "@/lib/couple-options";

export interface CartSnapshot {
  name_ar: string;
  name_en: string;
  image?: string | null;
  size?: string;
  color_hex?: string;
  color_name_ar?: string;
  color_name_en?: string;
  unit_price?: number;
  slug?: string;
  print_locations?: string[];
  /** printing options chosen in the designer (method · finish · fabric · add-ons) */
  extras?: string;
  /** couple sets: the answers with their labels, shown until the server quote arrives */
  options?: ResolvedOption[];
}

export interface CartLine {
  variant_id?: string;
  custom_design_id?: string;
  quantity: number;
  /** couple sets: the customer's answers (second size, names, letters…) — a different answer is a different line */
  options?: OptionValues;
  snapshot?: CartSnapshot;
}

// cart lines carry the answers in `options`; quote lines echo them in `option_values` (their `options` is the labelled list)
type Keyed = { variant_id?: string; custom_design_id?: string; options?: OptionValues | ResolvedOption[] | null; option_values?: OptionValues | null };
export const lineKey = (l: Keyed) => {
  if (!l.variant_id) return `d:${l.custom_design_id}`;
  const o = valuesKey(l.option_values ?? (Array.isArray(l.options) ? null : l.options));
  return o ? `${l.variant_id}|${o}` : l.variant_id;
};

/** What the server is sent for a cart line. */
export const lineItem = (l: CartLine) =>
  l.variant_id
    ? { variant_id: l.variant_id, quantity: l.quantity, ...(valuesKey(l.options) ? { options: l.options } : {}) }
    : { custom_design_id: l.custom_design_id!, quantity: l.quantity };

interface CartState {
  lines: CartLine[];
  discountCode: string;
  drawerOpen: boolean;
  hydrated: boolean;
  /** bumps on every local change so the server copy can be synced */
  version: number;
  add: (line: CartLine) => void;
  setQuantity: (key: string, quantity: number) => void;
  remove: (key: string) => void;
  clear: () => void;
  replace: (lines: CartLine[]) => void;
  setDiscountCode: (code: string) => void;
  openDrawer: (open: boolean) => void;
  setHydrated: () => void;
}

export const useCart = create<CartState>()(
  persist(
    (set) => ({
      lines: [],
      discountCode: "",
      drawerOpen: false,
      hydrated: false,
      version: 0,
      add: (line) =>
        set((s) => {
          const key = lineKey(line);
          const existing = s.lines.find((l) => lineKey(l) === key);
          const lines = existing
            ? s.lines.map((l) => (lineKey(l) === key ? { ...l, quantity: Math.min(99, l.quantity + line.quantity), snapshot: line.snapshot ?? l.snapshot } : l))
            : [...s.lines, { ...line, quantity: Math.min(99, line.quantity) }];
          return { lines: lines.slice(0, 50), version: s.version + 1 };
        }),
      setQuantity: (key, quantity) =>
        set((s) => ({
          lines: s.lines.map((l) => (lineKey(l) === key ? { ...l, quantity: Math.max(1, Math.min(99, quantity)) } : l)),
          version: s.version + 1,
        })),
      remove: (key) => set((s) => ({ lines: s.lines.filter((l) => lineKey(l) !== key), version: s.version + 1 })),
      clear: () => set((s) => ({ lines: [], discountCode: "", version: s.version + 1 })),
      replace: (lines) => set({ lines }),
      setDiscountCode: (discountCode) => set({ discountCode }),
      openDrawer: (drawerOpen) => set({ drawerOpen }),
      setHydrated: () => set({ hydrated: true }),
    }),
    {
      name: "tpac-cart",
      version: 1,
      storage: createJSONStorage(() => localStorage),
      partialize: (s) => ({ lines: s.lines, discountCode: s.discountCode }),
      // NB: rehydration can run synchronously while `useCart` is still being created,
      // so use the state passed to the callback rather than the store binding.
      onRehydrateStorage: () => (state) => state?.setHydrated(),
    },
  ),
);

export const cartCount = (lines: CartLine[]) => lines.reduce((n, l) => n + l.quantity, 0);

// Safety net: if storage is unavailable (private mode, blocked) or hydration
// errored, still mark the store hydrated so the cart UI never hangs.
if (typeof window !== "undefined") {
  if (useCart.persist.hasHydrated()) useCart.setState({ hydrated: true });
  useCart.persist.onFinishHydration(() => useCart.setState({ hydrated: true }));
}
