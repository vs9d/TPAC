"use client";
import Link from "next/link";
import Image from "next/image";
import { useState } from "react";
import { usePathname } from "next/navigation";
import { LayoutDashboard, ShoppingCart, Package, Boxes, Users, Building2, Tag, Megaphone, Home, Settings, Bell, History, MessageSquare, Star, Palette, Menu, X, Store, Layers, Shirt, Brush, Frame, Images, MessageCircle } from "lucide-react";
import { useI18n } from "@/components/i18n-provider";
import { adminT } from "@/lib/admin-i18n";
import { cn } from "@/lib/format";

export function AdminShell({ children, role, name, badges }: { children: React.ReactNode; role: string; name: string; badges: { notifications: number; bulk: number; orders: number } }) {
  const { locale } = useI18n();
  const t = adminT(locale);
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const base = `/${locale}/admin`;
  const groups: { label: string; items: { href: string; label: string; icon: typeof Home; badge?: number; adminOnly?: boolean }[] }[] = [
    { label: "", items: [{ href: base, label: t("نظرة عامة", "Overview"), icon: LayoutDashboard }] },
    {
      label: t("المبيعات", "Sales"),
      items: [
        { href: `${base}/orders`, label: t("الطلبات", "Orders"), icon: ShoppingCart, badge: badges.orders },
        { href: `${base}/bulk`, label: t("طلبات عروض الأسعار", "Quotation requests"), icon: Building2, badge: badges.bulk },
        { href: `${base}/customers`, label: t("العملاء", "Customers"), icon: Users },
      ],
    },
    {
      label: t("الكتالوج", "Catalog"),
      items: [
        { href: `${base}/products`, label: t("المنتجات", "Products"), icon: Package },
        { href: `${base}/product-types`, label: t("أنواع المنتجات والطباعة", "Product types & printing"), icon: Frame },
        { href: `${base}/inventory`, label: t("المخزون", "Inventory"), icon: Boxes },
        { href: `${base}/categories`, label: t("الفئات والمجموعات", "Categories & collections"), icon: Layers },
        { href: `${base}/attributes`, label: t("الألوان والمقاسات", "Colours & sizes"), icon: Palette },
        { href: `${base}/customizer`, label: t("أداة الطباعة", "Print designer"), icon: Shirt },
        { href: `${base}/designs`, label: t("تصاميم العملاء", "Customer designs"), icon: Brush },
        { href: `${base}/reviews`, label: t("التقييمات", "Reviews"), icon: Star },
      ],
    },
    {
      label: t("التسويق", "Marketing"),
      items: [
        { href: `${base}/discounts`, label: t("الكوبونات والخصومات", "Coupons & discounts"), icon: Tag },
        { href: `${base}/portfolio`, label: t("أعمالنا والعملاء السابقين", "Portfolio & clients"), icon: Images },
        { href: `${base}/marketing`, label: t("البانرات والحملات", "Banners & campaigns"), icon: Megaphone },
        { href: `${base}/homepage`, label: t("الصفحة الرئيسية", "Homepage"), icon: Home },
      ],
    },
    {
      label: t("النظام", "System"),
      items: [
        { href: `${base}/notifications`, label: t("الإشعارات", "Notifications"), icon: Bell, badge: badges.notifications },
        { href: `${base}/whatsapp`, label: t("إشعارات الواتساب", "WhatsApp notifications"), icon: MessageCircle, adminOnly: true },
        { href: `${base}/inquiries`, label: t("الاستفسارات", "Inquiries"), icon: MessageSquare },
        { href: `${base}/activity`, label: t("سجل النشاط", "Activity log"), icon: History },
        { href: `${base}/settings`, label: t("الإعدادات", "Settings"), icon: Settings, adminOnly: true },
      ],
    },
  ];
  const isActive = (href: string) => (href === base ? pathname === base : pathname.startsWith(href));
  const nav = (
    <nav className="space-y-6 px-3 py-5 text-sm">
      {groups.map((g) => (
        <div key={g.label}>
          {g.label && <p className="mb-2 px-3 text-[11px] font-semibold uppercase tracking-wider text-paper/40">{g.label}</p>}
          <ul className="space-y-0.5">
            {g.items.filter((i) => !i.adminOnly || role === "admin").map((i) => (
              <li key={i.href}>
                <Link href={i.href} onClick={() => setOpen(false)} className={cn("flex items-center gap-3 px-3 py-2 transition-colors", isActive(i.href) ? "bg-paper/10 text-paper" : "text-paper/65 hover:bg-paper/5 hover:text-paper")}>
                  <i.icon className="size-4 shrink-0" />
                  <span className="flex-1">{i.label}</span>
                  {!!i.badge && <span className="min-w-5 rounded-full bg-amber px-1.5 text-center text-[10px] font-bold leading-5 text-ink">{i.badge}</span>}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </nav>
  );
  return (
    <div data-theme="light" className="min-h-dvh bg-[#f6f6f4] text-ink print:block print:bg-paper lg:grid lg:grid-cols-[250px_1fr]">
      <aside className="no-print hidden bg-ink text-paper lg:sticky lg:top-0 lg:block lg:h-dvh lg:overflow-y-auto">
        <div className="flex h-16 items-center gap-3 border-b border-paper/10 px-6">
          <Image src="/brand/tpac-logo-orange.png" alt="TPAC" width={1512} height={806} className="h-7 w-auto" />
          <span className="text-xs font-semibold text-paper/50">ADMIN</span>
        </div>
        {nav}
      </aside>
      {open && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 bg-ink/50" onClick={() => setOpen(false)} />
          <aside className="absolute inset-y-0 start-0 w-72 overflow-y-auto bg-ink text-paper">
            <div className="flex h-14 items-center justify-between px-4">
              <Image src="/brand/tpac-logo-orange.png" alt="TPAC" width={1512} height={806} className="h-6 w-auto" />
              <button onClick={() => setOpen(false)} aria-label="close"><X className="size-5" /></button>
            </div>
            {nav}
          </aside>
        </div>
      )}
      <div className="min-w-0">
        <header className="no-print sticky top-0 z-40 flex h-14 items-center justify-between border-b border-line bg-paper px-4 md:px-8 lg:h-16">
          <button className="lg:hidden" onClick={() => setOpen(true)} aria-label="menu"><Menu className="size-5" /></button>
          <div className="flex-1" />
          <div className="flex items-center gap-4 text-sm">
            <Link href={`/${locale === "ar" ? "en" : "ar"}${pathname.slice(3)}`} className="font-semibold hover:text-amber-deep">{locale === "ar" ? "English" : "العربية"}</Link>
            <Link href={`/${locale}`} className="inline-flex items-center gap-1.5 text-mute hover:text-ink"><Store className="size-4" /> {t("المتجر", "Store")}</Link>
            <span className="hidden text-mute sm:inline">{name} · {role}</span>
          </div>
        </header>
        <main className="p-4 md:p-8 print:p-0">{children}</main>
      </div>
    </div>
  );
}
