import Link from "next/link";
import { cn } from "@/lib/format";

export function CreatorsTabs({ locale, active, counts }: { locale: string; active: "list" | "designs" | "withdrawals" | "settings"; counts?: { designs?: number; withdrawals?: number; pending?: number } }) {
  const ar = locale === "ar";
  const base = `/${locale}/admin/creators`;
  const tabs = [["list", base, ar ? "المبدعين" : "Creators", counts?.pending], ["designs", `${base}/designs`, ar ? "مراجعة التصاميم" : "Design review", counts?.designs], ["withdrawals", `${base}/withdrawals`, ar ? "طلبات السحب" : "Withdrawals", counts?.withdrawals], ["settings", `${base}/settings`, ar ? "الإعدادات والتقارير" : "Settings & reports", undefined]] as const;
  return (
    <nav className="flex flex-wrap gap-1 rounded-full border border-line bg-bone p-1 text-sm font-bold sm:w-fit">
      {tabs.map(([k, href, label, n]) => (
        <Link key={k} href={href} className={cn("flex items-center gap-1.5 rounded-full px-4 py-2 transition", active === k ? "bg-ink text-paper" : "text-mute hover:text-ink")}>
          {label}{n ? <span className="grid min-w-5 place-items-center rounded-full bg-amber px-1 text-[11px] text-ink">{n}</span> : null}
        </Link>
      ))}
    </nav>
  );
}
