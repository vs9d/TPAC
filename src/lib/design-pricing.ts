/** Pure pricing helpers for made-to-order pieces. The server (saveDesign + quote_cart) is the authority; these mirror it for live display. */

export interface OptionLite { id: string; group_code: "method" | "finish" | "fabric" | "package" | "addon"; code: string; price: number; is_default: boolean }
export interface Tier { min_qty: number; discount_percent: number }
export interface OptionChoice { method?: string; finish?: string; fabric?: string; package?: string; addons?: string[] }

export const SINGLE_GROUPS = ["method", "finish", "fabric", "package"] as const;

/**
 * Printing on one placement is included in the garment price; every further placement adds its own price.
 * The included one is the most expensive of those used, so a single design never costs more than the
 * garment price, whichever side it is on. Returns the charge per used placement (0 for the included one).
 */
export function placementCharges(used: readonly string[], priceOf: (code: string) => number): Map<string, number> {
  const list = [...new Set(used)];
  const free = list.reduce<string | null>((best, l) => (best === null || priceOf(l) > priceOf(best) ? l : best), null);
  return new Map(list.map((l) => [l, l === free ? 0 : priceOf(l)]));
}
export function placementsPrice(used: readonly string[], priceOf: (code: string) => number): number {
  let n = 0;
  for (const v of placementCharges(used, priceOf).values()) n += v;
  return n;
}

/** Fills missing single-choice groups with their default, drops unknown codes. Returns the clean choice and its per-piece price. */
export function resolveOptions(options: OptionLite[], choice: OptionChoice): { choice: Required<Pick<OptionChoice, "addons">> & OptionChoice; price: number; picked: OptionLite[] } {
  const picked: OptionLite[] = [];
  const out: OptionChoice = { addons: [] };
  for (const g of SINGLE_GROUPS) {
    const inGroup = options.filter((o) => o.group_code === g);
    if (!inGroup.length) continue;
    const hit = inGroup.find((o) => o.code === choice[g]) ?? inGroup.find((o) => o.is_default) ?? inGroup[0]!;
    out[g] = hit.code;
    picked.push(hit);
  }
  const addons = new Set(choice.addons ?? []);
  for (const o of options) if (o.group_code === "addon" && addons.has(o.code)) {
    picked.push(o);
    out.addons!.push(o.code);
  }
  return { choice: out as Required<Pick<OptionChoice, "addons">> & OptionChoice, price: picked.reduce((n, o) => n + o.price, 0), picked };
}

/** Best discount for a total quantity of custom pieces. */
export function tierPercent(tiers: Tier[], qty: number): number {
  return tiers.reduce((best, t) => (qty >= t.min_qty && t.discount_percent > best ? t.discount_percent : best), 0);
}

/** Same rounding as quote_cart: discount rounded to the nearest 250 IQD. */
export function discountedUnit(unit: number, pct: number): number {
  return Math.max(unit - Math.round((unit * pct) / 100 / 250) * 250, 0);
}

/** Next tier the customer could reach, for the "add N more to save X%" hint. */
export function nextTier(tiers: Tier[], qty: number): Tier | null {
  return [...tiers].sort((a, b) => a.min_qty - b.min_qty).find((t) => t.min_qty > qty) ?? null;
}
