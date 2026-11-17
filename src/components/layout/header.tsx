"use client";
import Link from "next/link";
import Image from "next/image";
import { Suspense, useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { Menu, Search, ShoppingBag, User, X, Heart } from "lucide-react";
import { useI18n } from "@/components/i18n-provider";
import { useCart, cartCount } from "@/components/cart/store";
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
  const L = (p: string) => `/${locale}${p}`;

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
    { href: L("/shop?new=1"), label: dict.nav.newArrivals },
    { href: L("/shop"), label: dict.nav.shop },
    { href: L("/collections"), label: dict.nav.collections },
    { href: L("/design"), label: dict.nav.customDesign, accent: true },
    { href: L("/bulk"), label: dict.nav.bulk },
  ];

  return (
    <>
      <header className={cn("sticky top-0 z-50 border-b bg-paper/95 backdrop-blur transition-colors", scrolled ? "border-line" : "border-transparent")}>
        <div className="container-x grid h-16 grid-cols-[1fr_auto_1fr] items-center md:h-[72px]">
          <div className="flex items-center gap-1">
            <button className="btn-ghost -ms-2 grid size-10 place-items-center lg:hidden" onClick={() => setMenu(true)} aria-label={dict.common.menu} aria-expanded={menu}>
              <Menu className="size-5" />
            </button>
            <nav className="hidden items-center gap-6 lg:flex" aria-label="primary">
              {primary.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn("relative py-2 text-[0.85rem] font-semibold transition-colors hover:text-amber-deep", item.accent && "text-pine")}
                >
                  {item.label}
                </Link>
              ))}
            </nav>
          </div>

          <Link href={L("")} aria-label="TPAC" className="justify-self-center">
            <Image src="/brand/tpac-logo-black.png" alt="TPAC" width={1512} height={806} priority className="h-8 w-auto md:h-9" />
          </Link>

          <div className="flex items-center justify-end gap-0.5">
            <Suspense fallback={null}>
              <LocaleSwitch className="hidden px-2 text-[0.8rem] font-semibold hover:text-amber-deep sm:inline" />
            </Suspense>
            <button onClick={() => setSearch(true)} className="grid size-10 place-items-center hover:text-amber-deep" aria-label={dict.common.search}>
              <Search className="size-5" />
            </button>
            {signedIn && (
              <Link href={L("/account/favorites")} className="hidden size-10 place-items-center hover:text-amber-deep sm:grid" aria-label={dict.nav.favorites}>
                <Heart className="size-5" />
              </Link>
            )}
            <Link href={L(signedIn ? "/account" : "/account/login")} className="hidden size-10 place-items-center hover:text-amber-deep sm:grid" aria-label={dict.nav.account}>
              <User className="size-5" />
            </Link>
            <button onClick={() => openDrawer(true)} className="relative grid size-10 place-items-center hover:text-amber-deep" aria-label={`${dict.nav.cart} (${count})`}>
              <ShoppingBag className="size-5" />
              {count > 0 && (
                <span className="absolute end-0.5 top-0.5 grid min-w-[18px] place-items-center rounded-full bg-amber px-1 text-[10px] font-bold leading-[18px] text-ink">
                  {count}
                </span>
              )}
            </button>
          </div>
        </div>
      </header>

      <AnimatePresence>
        {menu && (
          <motion.div className="fixed inset-0 z-[60] lg:hidden" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <div className="absolute inset-0 bg-ink/40" onClick={() => setMenu(false)} />
            <motion.nav
              initial={{ x: locale === "ar" ? "100%" : "-100%" }}
              animate={{ x: 0 }}
              exit={{ x: locale === "ar" ? "100%" : "-100%" }}
              transition={{ type: "tween", duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
              className="absolute inset-y-0 start-0 flex w-[86%] max-w-sm flex-col bg-paper"
              aria-label={dict.common.menu}
            >
              <div className="flex h-16 items-center justify-between border-b border-line px-4">
                <Image src="/brand/tpac-logo-black.png" alt="TPAC" width={1512} height={806} className="h-7 w-auto" />
                <button onClick={() => setMenu(false)} className="grid size-10 place-items-center" aria-label={dict.common.close}>
                  <X className="size-5" />
                </button>
              </div>
              <div className="flex-1 overflow-y-auto px-4 py-6">
                <ul className="space-y-1">
                  {primary.map((item) => (
                    <li key={item.href}>
                      <Link href={item.href} className={cn("display block py-2 text-2xl", item.accent && "text-pine")}>
                        {item.label}
                      </Link>
                    </li>
                  ))}
                </ul>
                <p className="eyebrow mt-8 mb-3 text-mute">{dict.shop.category}</p>
                <ul className="grid grid-cols-2 gap-2">
                  {categories.map((c) => (
                    <li key={c.slug}>
                      <Link href={L(`/shop?category=${c.slug}`)} className="block border border-line px-3 py-3 text-sm font-medium hover:border-ink">
                        {locale === "ar" ? c.name_ar : c.name_en}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
              <div className="space-y-1 border-t border-line px-4 py-4 text-sm font-medium">
                <Link href={L(signedIn ? "/account" : "/account/login")} className="flex items-center gap-3 py-2">
                  <User className="size-4" /> {signedIn ? dict.nav.account : dict.nav.login}
                </Link>
                <Link href={L("/track")} className="block py-2">{dict.nav.track}</Link>
                {isStaff && <Link href={L("/admin")} className="block py-2 text-pine">{dict.nav.admin}</Link>}
                <Suspense fallback={null}>
                  <LocaleSwitch className="block py-2 font-semibold" />
                </Suspense>
              </div>
            </motion.nav>
          </motion.div>
        )}
      </AnimatePresence>

      <SearchOverlay open={search} onClose={() => setSearch(false)} />
    </>
  );
}
