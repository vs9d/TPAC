"use client";
import Image from "next/image";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { Search, X, Loader2 } from "lucide-react";
import { useI18n } from "@/components/i18n-provider";
import { formatIQD } from "@/lib/format";
import type { ProductCard } from "@/lib/types";

export function SearchOverlay({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { locale, dict } = useI18n();
  const router = useRouter();
  const [q, setQ] = useState("");
  const [items, setItems] = useState<ProductCard[]>([]);
  const [loading, setLoading] = useState(false);
  const input = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) setTimeout(() => input.current?.focus(), 50);
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  useEffect(() => {
    const term = q.trim();
    if (term.length < 2) {
      setItems([]);
      return;
    }
    const ctrl = new AbortController();
    setLoading(true);
    const t = setTimeout(async () => {
      try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(term)}`, { signal: ctrl.signal });
        if (res.ok) setItems((await res.json()).items ?? []);
      } catch {
        /* aborted */
      } finally {
        setLoading(false);
      }
    }, 220);
    return () => {
      clearTimeout(t);
      ctrl.abort();
    };
  }, [q]);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!q.trim()) return;
    onClose();
    router.push(`/${locale}/shop?q=${encodeURIComponent(q.trim())}`);
  };

  return (
    <AnimatePresence>
      {open && (
        <motion.div className="fixed inset-0 z-[70]" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
          <div className="absolute inset-0 bg-ink/40" onClick={onClose} />
          <motion.div
            initial={{ y: -24, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: -24, opacity: 0 }}
            transition={{ duration: 0.25 }}
            className="relative bg-paper"
            role="dialog"
            aria-modal="true"
            aria-label={dict.common.search}
          >
            <form onSubmit={submit} className="container-x flex h-20 items-center gap-3 border-b border-line">
              <Search className="size-5 shrink-0 text-mute" />
              <input
                ref={input}
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder={dict.nav.searchPlaceholder}
                className="h-full flex-1 bg-transparent text-lg outline-none md:text-2xl"
                aria-label={dict.common.search}
                enterKeyHint="search"
              />
              {loading && <Loader2 className="size-5 animate-spin text-mute" />}
              <button type="button" onClick={onClose} className="grid size-10 place-items-center" aria-label={dict.common.close}>
                <X className="size-5" />
              </button>
            </form>
            {items.length > 0 && (
              <div className="container-x py-6">
                <p className="eyebrow mb-4 text-mute">{dict.shop.suggestions}</p>
                <ul className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
                  {items.map((p) => (
                    <li key={p.id}>
                      <Link href={`/${locale}/product/${p.slug}`} onClick={onClose} className="group block">
                        <div className="relative aspect-[4/5] overflow-hidden bg-bone">
                          {p.images[0] && <Image src={p.images[0].url} alt="" fill sizes="200px" className="object-cover transition-transform duration-500 group-hover:scale-105" />}
                        </div>
                        <p className="mt-2 line-clamp-1 text-sm font-medium">{locale === "ar" ? p.name_ar : p.name_en}</p>
                        <p className="text-sm text-mute">{formatIQD(p.price, locale)}</p>
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
