import Link from "next/link";
import type { Locale } from "@/lib/i18n/config";
import type { Dict } from "@/lib/i18n/dictionaries/ar";
import type { Order } from "@/lib/types";
import { formatDate, formatIQD } from "@/lib/format";

export function StatusBadge({ status, dict }: { status: string; dict: Dict }) {
  const tone = status === "delivered" ? "bg-pine text-paper" : status === "cancelled" ? "bg-danger/10 text-danger" : status === "shipped" ? "bg-amber text-ink" : "bg-bone text-ink";
  return <span className={`inline-block whitespace-nowrap px-2 py-1 text-[11px] font-semibold ${tone}`}>{dict.status[status] ?? status}</span>;
}

export function OrderRow({ order, locale, dict }: { order: Pick<Order, "id" | "order_number" | "status" | "total" | "created_at">; locale: Locale; dict: Dict }) {
  return (
    <Link href={`/${locale}/account/orders/${order.id}`} className="flex flex-wrap items-center justify-between gap-3 border-b border-line py-4 hover:bg-bone/50">
      <div>
        <p className="font-semibold" dir="ltr">{order.order_number}</p>
        <p className="text-xs text-mute">{formatDate(order.created_at, locale)}</p>
      </div>
      <StatusBadge status={order.status} dict={dict} />
      <p className="text-sm font-semibold tabular-nums">{formatIQD(order.total, locale)}</p>
    </Link>
  );
}
