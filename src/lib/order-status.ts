/** Mirrors public.order_status / can_transition_order() in SQL. */
export const ORDER_STATUSES = [
  "received",
  "confirmed",
  "preparing",
  "printing",
  "quality_check",
  "ready_to_ship",
  "shipped",
  "delivered",
  "cancelled",
] as const;

export type OrderStatus = (typeof ORDER_STATUSES)[number];

/** Linear flow shown to customers (cancelled excluded). */
export const ORDER_FLOW: OrderStatus[] = ORDER_STATUSES.filter((s) => s !== "cancelled");

export function statusRank(s: OrderStatus): number {
  return s === "cancelled" ? 99 : ORDER_FLOW.indexOf(s) + 1;
}

export function canTransition(from: OrderStatus, to: OrderStatus): boolean {
  if (from === "delivered" || from === "cancelled") return false;
  if (to === "cancelled") return true;
  return statusRank(to) > statusRank(from);
}

export function nextStatuses(from: OrderStatus): OrderStatus[] {
  return ORDER_STATUSES.filter((s) => canTransition(from, s));
}

export function isOrderStatus(v: unknown): v is OrderStatus {
  return typeof v === "string" && (ORDER_STATUSES as readonly string[]).includes(v);
}
