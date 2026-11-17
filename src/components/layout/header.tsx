"use client";
import Link from "next/link";
import { Suspense, useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowLeft, ArrowRight, Menu, Search, ShoppingBag, User, X, Heart, Paintbrush, Building2, Star, PackageSearch, LayoutDashboard } from "lucide-react";
import { useI18n } from "@/components/i18n-provider";
import { useCart, cartCount } from "@/components/cart/store";
import { Logo } from "@/components/ui/logo";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import { LocaleSwitch } from "./locale-switch";
import { SearchOverlay } from "./search-overlay";
import { cn } from "@/lib/format";

export interface NavCategory { slug: string; name_ar: string; name_en: string }

export function Header({ categories, signedIn, isStaff }: { categories: NavCategory[]; signedIn: boolean; isStaff: boolean }) {
  const { locale, dict } = useI18n();
  const pathname = usePathname();
  const lines = useCart((s) => s.lines);
  const hydrated = useCart((s) => s.hydrated);
  const openDrawer = useCart((s) => s.openDrawer);
  const [menu, setMenu] = useState(false);
  const [search, setSearch] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const count = hydrated ? cartCount(lines) : 0;
  // wiggle the cart whenever something is added
  const [bump, setBump] = useState(false);
  const prevCount = useRef(count);
  useEffect(() => {
    if (count > prevCount.current) {
      setBump(true);
      const t = setTimeout(() => setBump(false), 600);
      prevCount.current = count;
      return () => clearTimeout(t);
    }
    prevCount.current = count;
  }, [count]);
  const L = (p: string) => `/${locale}${p}`;
  const Arrow = locale === "ar" ? ArrowLeft : ArrowRight;

  useEffect(() => setMenu(false), [pathname]);
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);
  useEffect(() => {
    document.body.style.overflow = menu ? "hidden" : "";
  }, [menu]);

  const primary = [
    { href: L("/shop?new=1"), label: dict.nav.newArrivals, match: "new=1" },
    { href: L("/shop"), label: dict.nav.shop, match: "/shop" },
    { href: L("/collections"), label: dict.nav.collections, match: "/collections" },
    { href: L("/design"), label: dict.nav.customDesign, match: "/design", brand: true },
    { href: L("/bulk"), label: dict.nav.bulk, match: "/bulk" },
    { href: L("/reviews"), label: dict.reviews.navLabel, match: "/reviews" },
  ];
  const active = (m: string) => (m === "new=1" ? false : pathname.includes(m));

  const iconBtn = "grid size-11 place-items-center rounded-full border border-line text-ink transition-colors hover:bg-bone active:bg-stone";

  return (
    <>
      <header className={cn("sticky top-0 z-50 bg-paper/85 backdrop-blur-xl transition-[border-color,box-shadow]", scrolled ? "border-b border-line shadow-[0_8px_24px_-18px_rgba(0,0,0,.35)]" : "border-b border-transparent")}>
        <div className="container-x flex h-[68px] items-center gap-3 md:h-[76px]">
          <button data-ripple className={cn(iconBtn, "lg:hidden")} onClick={() => setMenu(true)} aria-label={dict.common.menu} aria-expanded={menu}>
            <Menu className="size-5" />
          </button>
          <Logo href={L("")} priority className="h-8 w-auto md:h-9" />

          <nav className="ms-6 hidden items-center gap-1 lg:flex" aria-label="primary">
            {primary.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                aria-current={active(item.match) ? "page" : undefined}
                className={cn(
                  "rounded-full px-3.5 py-2 text-[0.85rem] font-semibold transition-colors",
                  item.brand ? "bg-pine-soft text-pine hover:bg-pine hover:text-white dark:hover:text-night" : "hover:bg-bone",
                  active(item.match) && !item.brand && "bg-bone",
                )}
              >
                {item.label}
              </Link>
            ))}
          </nav>

          <div className="ms-auto flex items-center gap-2">
            <Suspense fallback={null}>
              <LocaleSwitch className="hidden h-11 items-center rounded-full border border-line px-4 text-[0.82rem] font-bold transition-colors hover:bg-bone sm:inline-flex" />
            </Suspense>
            <ThemeToggle className="hidden sm:grid" />
            <button data-ripple onClick={() => setSearch(true)} className={iconBtn} aria-label={dict.common.search}>
              <Search className="size-5" />
            </button>
            {signedIn && (
              <Link data-ripple href={L("/account/favorites")} className={cn(iconBtn, "hidden md:grid")} aria-label={dict.nav.favorites}>
                <Heart className="size-5" />
              </Link>
            )}
            <Link data-ripple href={L(signedIn ? "/account" : "/account/login")} className={cn(iconBtn, "hidden md:grid")} aria-label={dict.nav.account}>
              <User className="size-5" />
            </Link>
            <button data-ripple onClick={() => openDrawer(true)} className={cn("relative inline-flex h-11 min-w-11 items-center justify-center gap-2 rounded-full bg-pine px-3.5 text-white transition-transform hover:scale-105 active:scale-95 dark:text-night", bump && "animate-[bump_.55s_ease-out]")} aria-label={`${dict.nav.cart} (${count})`}>
              <ShoppingBag className="size-5" />
              <AnimatePresence initial={false}>
                {count > 0 && (
                  <motion.span key={count} initial={{ scale: 0.4, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="text-sm font-extrabold tabular-nums">
                    {count}
                  </motion.span>
                )}
              </AnimatePresence>
            </button>
          </div>
        </div>
      </header>

      <AnimatePresence>
        {menu && (
          <motion.div className="fixed inset-0 z-[60] lg:hidden" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <div className="absolute inset-0 bg-night/60 backdrop-blur-sm" onClick={() => setMenu(false)} />
            <motion.nav
              initial={{ x: locale === "ar" ? "100%" : "-100%" }}
              animate={{ x: 0 }}
              exit={{ x: locale === "ar" ? "100%" : "-100%" }}
              transition={{ type: "tween", duration: 0.32, ease: [0.16, 1, 0.3, 1] }}
              className="absolute inset-y-0 start-0 flex w-[88%] max-w-sm flex-col rounded-e-[2rem] bg-paper"
              aria-label={dict.common.menu}
            >
              <div className="flex h-[68px] items-center justify-between px-4">
                <Logo className="h-8 w-auto" />
                <button onClick={() => setMenu(false)} className={iconBtn} aria-label={dict.common.close}>
                  <X className="size-5" />
                </button>
              </div>
              <div className="flex-1 space-y-6 overflow-y-auto px-4 pb-6 pt-2">
                <ul className="space-y-2">
                  {[
                    { href: L("/shop"), label: dict.nav.shop, icon: ShoppingBag },
                    { href: L("/design"), label: dict.nav.customDesign, icon: Paintbrush, brand: true },
                    { href: L("/bulk"), label: dict.nav.bulk, icon: Building2 },
                    { href: L("/reviews"), label: dict.reviews.navLabel, icon: Star },
                    { href: L("/track"), label: dict.nav.track, icon: PackageSearch },
                  ].map((item) => (
                    <li key={item.href}>
                      <Link href={item.href} className={cn("flex items-center gap-3 rounded-2xl px-4 py-3.5 font-[family-name:var(--font-display)] text-lg font-bold", item.brand ? "bg-pine text-white dark:text-night" : "bg-bone")}>
                        <item.icon className="size-5" /> <span className="flex-1">{item.label}</span> <Arrow className="size-4 opacity-60" />
                      </Link>
                    </li>
                  ))}
                </ul>
                <div>
                  <p className="eyebrow mb-3 text-mute">{dict.shop.category}</p>
                  <ul className="flex flex-wrap gap-2">
                    {categories.map((c) => (
                      <li key={c.slug}>
                        <Link href={L(`/shop?category=${c.slug}`)} className="inline-flex h-10 items-center rounded-full border border-line px-4 text-sm font-semibold hover:border-ink">
                          {locale === "ar" ? c.name_ar : c.name_en}
                        </Link>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
              <div className="space-y-2 border-t border-line p-4">
                <div className="flex items-center gap-2">
                  <ThemeToggle />
                  <Suspense fallback={null}>
                    <LocaleSwitch className="inline-flex h-11 flex-1 items-center justify-center rounded-full border border-line text-sm font-bold hover:bg-bone" />
                  </Suspense>
                  <Link href={L(signedIn ? "/account" : "/account/login")} className="inline-flex h-11 flex-[1.4] items-center justify-center gap-2 rounded-full bg-ink text-sm font-bold text-paper">
                    <User className="size-4" /> {signedIn ? dict.nav.account : dict.nav.login}
                  </Link>
                </div>
                {isStaff && (
                  <Link href={L("/admin")} className="flex h-11 items-center justify-center gap-2 rounded-full bg-amber text-sm font-bold text-[#1a1208]">
                    <LayoutDashboard className="size-4" /> {dict.nav.admin}
                  </Link>
                )}
              </div>
            </motion.nav>
          </motion.div>
        )}
      </AnimatePresence>

      <SearchOverlay open={search} onClose={() => setSearch(false)} />
    </>
  );
}
