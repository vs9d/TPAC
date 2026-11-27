"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Bell, Brush, LayoutDashboard, ReceiptText, UserRound, Wallet } from "lucide-react";
import { useI18n } from "@/components/i18n-provider";
import { cn } from "@/lib/format";

export function CreatorStudioNav({ unread, username }: { unread: number; username: string }) {
  const { locale } = useI18n();
  const ar = locale === "ar";
  const path = usePathname();
  const base = `/${locale}/creator-studio`;
  const items = [
    [base, LayoutDashboard, ar ? "نظرة عامة" : "Overview"],
    [`${base}/designs`, Brush, ar ? "تصاميمي" : "My designs"],
    [`${base}/orders`, ReceiptText, ar ? "طلباتي" : "My orders"],
    [`${base}/wallet`, Wallet, ar ? "المحفظة والسحب" : "Wallet"],
    [`${base}/notifications`, Bell, ar ? "الإشعارات" : "Notifications"],
    [`${base}/profile`, UserRound, ar ? "صفحتي" : "My page"],
  ] as const;
  return (
    <nav className="-mx-4 flex gap-1 overflow-x-auto px-4 pb-1" aria-label={ar ? "لوحة المبدع" : "Creator dashboard"}>
      {items.map(([href, Icon, label]) => {
        const on = href === base ? path === base : path.startsWith(href);
        return (
          <Link key={href} href={href} aria-current={on ? "page" : undefined} className={cn("relative flex shrink-0 items-center gap-2 rounded-full px-4 py-2.5 text-sm font-semibold transition", on ? "bg-ink text-paper" : "bg-bone text-ink/80 hover:bg-line")}>
            <Icon className="size-4" aria-hidden="true" /> {label}
            {href.endsWith("/notifications") && unread > 0 && <span className="grid min-w-5 place-items-center rounded-full bg-amber px-1 text-[11px] font-black text-ink">{unread}</span>}
          </Link>
        );
      })}
      <Link href={`/${locale}/creator/${username}`} className="flex shrink-0 items-center rounded-full px-4 py-2.5 text-sm font-semibold text-pine underline-offset-4 hover:underline">{ar ? "عرض صفحتي ↗" : "View my page ↗"}</Link>
    </nav>
  );
}
