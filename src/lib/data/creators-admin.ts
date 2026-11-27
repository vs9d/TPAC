import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";

/** Queue sizes for the admin tabs. */
export async function creatorQueueCounts() {
  const db = createAdminClient();
  const [a, b, c] = await Promise.all([
    db.from("creators").select("user_id", { count: "exact", head: true }).eq("status", "pending"),
    db.from("creator_products").select("id", { count: "exact", head: true }).eq("status", "pending"),
    db.from("creator_withdrawals").select("id", { count: "exact", head: true }).eq("status", "requested"),
  ]);
  return { pending: a.count ?? 0, designs: b.count ?? 0, withdrawals: c.count ?? 0 };
}

/** Per creator: pieces, orders, earned (not void), paid out, listings. */
export async function creatorTotals(ids: string[]) {
  const db = createAdminClient();
  if (!ids.length) return new Map<string, { pieces: number; orders: number; earned: number; paid: number; listings: number; published: number }>();
  const [{ data: earn }, { data: wd }, { data: cps }] = await Promise.all([
    db.from("creator_earnings").select("creator_id, quantity, order_id, amount").in("creator_id", ids).neq("status", "void"),
    db.from("creator_withdrawals").select("creator_id, amount").in("creator_id", ids).eq("status", "paid"),
    db.from("creator_products").select("creator_id, status").in("creator_id", ids),
  ]);
  const m = new Map<string, { pieces: number; orders: Set<string>; earned: number; paid: number; listings: number; published: number }>();
  const g = (id: string) => m.get(id) ?? (m.set(id, { pieces: 0, orders: new Set(), earned: 0, paid: 0, listings: 0, published: 0 }), m.get(id)!);
  for (const e of (earn ?? []) as { creator_id: string; quantity: number; order_id: string; amount: number }[]) { const x = g(e.creator_id); x.pieces += e.quantity; x.orders.add(e.order_id); x.earned += e.amount; }
  for (const w of (wd ?? []) as { creator_id: string; amount: number }[]) g(w.creator_id).paid += w.amount;
  for (const p of (cps ?? []) as { creator_id: string; status: string }[]) { const x = g(p.creator_id); x.listings += 1; if (p.status === "approved") x.published += 1; }
  return new Map([...m.entries()].map(([k, v]) => [k, { ...v, orders: v.orders.size }]));
}
