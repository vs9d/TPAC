"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useI18n } from "@/components/i18n-provider";
import { cn } from "@/lib/format";

export function AccountNav() {
  const { locale, dict } = useI18n();
  const pathname = usePathname();
  const base = `/${locale}/account`;
  const items = [
    [base, dict.account.overview],
    [`${base}/orders`, dict.account.orders],
    [`${base}/addresses`, dict.account.addresses],
    [`${base}/favorites`, dict.account.favorites],
    [`${base}/profile`, dict.account.profile],
  ] as const;
  return (
    <nav className="-mx-4 flex gap-1 overflow-x-auto px-4 lg:mx-0 lg:flex-col lg:px-0 [&::-webkit-scrollbar]:hidden" aria-label={dict.account.title}>
      {items.map(([href, label]) => {
        const active = href === base ? pathname === base : pathname.startsWith(href);
        return (
          <Link key={href} href={href} aria-current={active ? "page" : undefined} className={cn("shrink-0 whitespace-nowrap border-b-2 px-3 py-2.5 text-sm font-semibold lg:border-b-0 lg:border-s-2", active ? "border-ink" : "border-transparent text-mute hover:text-ink")}>
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
