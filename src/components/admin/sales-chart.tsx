"use client";
import { useI18n } from "@/components/i18n-provider";
import { formatIQD, formatDate } from "@/lib/format";

/** Single-series daily sales bars with hover tooltips and an accessible table fallback. */
export function SalesChart({ data }: { data: { day: string; total: number; orders: number }[] }) {
  const { locale } = useI18n();
  if (!data.length) return <p className="py-10 text-center text-sm text-mute">—</p>;
  const max = Math.max(...data.map((d) => d.total), 1);
  return (
    <div>
      <div className="flex h-48 items-end gap-[2px]" dir="ltr" aria-hidden>
        {data.map((d) => (
          <div key={d.day} className="group relative flex h-full flex-1 items-end">
            <div className="w-full rounded-t-[4px] bg-pine transition-colors group-hover:bg-ink" style={{ height: `${Math.max(2, (d.total / max) * 100)}%` }} />
            <div className="pointer-events-none absolute bottom-full left-1/2 z-10 mb-2 hidden -translate-x-1/2 whitespace-nowrap bg-ink px-2.5 py-1.5 text-xs text-paper shadow group-hover:block">
              <p className="font-semibold">{formatDate(d.day, locale)}</p>
              <p className="tabular-nums">{formatIQD(d.total, locale)} · {d.orders}</p>
            </div>
          </div>
        ))}
      </div>
      <div className="mt-2 flex justify-between text-[11px] text-mute" dir="ltr">
        <span>{formatDate(data[0]!.day, locale)}</span>
        <span>{formatDate(data[data.length - 1]!.day, locale)}</span>
      </div>
      <table className="sr-only">
        <tbody>{data.map((d) => <tr key={d.day}><td>{d.day}</td><td>{d.total}</td><td>{d.orders}</td></tr>)}</tbody>
      </table>
    </div>
  );
}
