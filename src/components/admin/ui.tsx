import Link from "next/link";
import { cn } from "@/lib/format";

export function PageHeader({ title, subtitle, actions }: { title: string; subtitle?: string; actions?: React.ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 className="font-[family-name:var(--font-display)] text-2xl font-bold md:text-3xl">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-mute">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  );
}

export function Card({ title, children, className, actions }: { title?: string; children: React.ReactNode; className?: string; actions?: React.ReactNode }) {
  return (
    <section className={cn("card-admin", className)}>
      {(title || actions) && (
        <div className="flex items-center justify-between border-b border-line px-5 py-3">
          {title && <h2 className="text-sm font-semibold">{title}</h2>}
          {actions}
        </div>
      )}
      <div className="p-5">{children}</div>
    </section>
  );
}

export function Stat({ label, value, hint, tone }: { label: string; value: React.ReactNode; hint?: string; tone?: "warn" | "good" }) {
  return (
    <div className="card-admin p-5">
      <p className="text-xs font-medium text-mute">{label}</p>
      <p className={cn("mt-2 font-[family-name:var(--font-display)] text-2xl font-bold tabular-nums", tone === "warn" && "text-amber-deep", tone === "good" && "text-pine")}>{value}</p>
      {hint && <p className="mt-1 text-xs text-mute">{hint}</p>}
    </div>
  );
}

export function Empty({ children }: { children: React.ReactNode }) {
  return <p className="py-10 text-center text-sm text-mute">{children}</p>;
}

export function Pill({ children, tone = "neutral" }: { children: React.ReactNode; tone?: "neutral" | "good" | "warn" | "bad" | "dark" }) {
  const map = { neutral: "bg-bone text-ink", good: "bg-pine/15 text-pine", warn: "bg-amber/25 text-amber-deep", bad: "bg-danger/10 text-danger", dark: "bg-ink text-paper" };
  return <span className={cn("inline-block whitespace-nowrap px-2 py-0.5 text-[11px] font-semibold", map[tone])}>{children}</span>;
}

export function Pagination({ page, pageSize, total, href }: { page: number; pageSize: number; total: number; href: (p: number) => string }) {
  const pages = Math.max(1, Math.ceil(total / pageSize));
  if (pages <= 1) return null;
  return (
    <div className="flex items-center justify-between border-t border-line px-4 py-3 text-sm">
      <span className="text-mute tabular-nums">{page} / {pages}</span>
      <div className="flex gap-2">
        {page > 1 && <Link href={href(page - 1)} className="btn btn-outline btn-sm">‹</Link>}
        {page < pages && <Link href={href(page + 1)} className="btn btn-outline btn-sm">›</Link>}
      </div>
    </div>
  );
}

export const STATUS_TONE: Record<string, "neutral" | "good" | "warn" | "bad" | "dark"> = {
  received: "warn",
  confirmed: "neutral",
  preparing: "neutral",
  printing: "neutral",
  quality_check: "neutral",
  ready_to_ship: "neutral",
  shipped: "dark",
  delivered: "good",
  cancelled: "bad",
};
