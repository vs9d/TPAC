"use client";
import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";

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
}

export interface CartLine {
  variant_id?: string;
  custom_design_id?: string;
  quantity: number;
  snapshot?: CartSnapshot;
}

export const lineKey = (l: { variant_id?: string; custom_design_id?: string }) => l.variant_id ?? `d:${l.custom_design_id}`;

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
