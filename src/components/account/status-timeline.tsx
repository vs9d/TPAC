"use client";
import { Check, X } from "lucide-react";
import { useI18n } from "@/components/i18n-provider";
import { ORDER_FLOW, statusRank, type OrderStatus } from "@/lib/order-status";
import { formatDate, cn } from "@/lib/format";

export function StatusTimeline({ status, history }: { status: OrderStatus; history: { status: string; at: string }[] }) {
  const { locale, dict } = useI18n();
  const at = new Map(history.map((h) => [h.status, h.at]));
  if (status === "cancelled") {
    return (
      <div className="flex items-center gap-3 border border-danger/30 bg-danger/5 p-4 text-danger">
        <X className="size-5" /> <span className="font-semibold">{dict.status.cancelled}</span>
        {at.get("cancelled") && <span className="text-xs">{formatDate(at.get("cancelled")!, locale, true)}</span>}
      </div>
    );
  }
  const current = statusRank(status);
  return (
    <ol className="relative space-y-0">
      {ORDER_FLOW.map((s, i) => {
        const done = statusRank(s) <= current;
        const isCurrent = s === status;
        return (
          <li key={s} className="relative flex gap-4 pb-6 last:pb-0">
            {i < ORDER_FLOW.length - 1 && <span className={cn("absolute start-[11px] top-6 h-full w-0.5", statusRank(ORDER_FLOW[i + 1]!) <= current ? "bg-ink" : "bg-line")} aria-hidden />}
            <span className={cn("relative z-10 grid size-6 shrink-0 place-items-center rounded-full border-2", done ? "border-ink bg-ink text-paper" : "border-line bg-paper", isCurrent && "ring-4 ring-amber/40")}>
              {done && <Check className="size-3.5" />}
            </span>
            <div className="-mt-0.5">
              <p className={cn("text-sm", done ? "font-semibold" : "text-mute")}>{dict.status[s]}</p>
              {at.get(s) && <p className="text-xs text-mute">{formatDate(at.get(s)!, locale, true)}</p>}
            </div>
          </li>
        );
      })}
    </ol>
  );
}
