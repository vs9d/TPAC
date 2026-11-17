"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { useI18n } from "@/components/i18n-provider";

export interface Announcement { id: string; text_ar: string; text_en: string; link: string | null }

export function AnnouncementBar({ items }: { items: Announcement[] }) {
  const { locale } = useI18n();
  const [i, setI] = useState(0);
  useEffect(() => {
    if (items.length < 2) return;
    const t = setInterval(() => setI((x) => (x + 1) % items.length), 4500);
    return () => clearInterval(t);
  }, [items.length]);
  if (!items.length) return null;
  const item = items[i]!;
  const text = locale === "ar" ? item.text_ar : item.text_en;
  const href = item.link ? (item.link.startsWith("/") ? `/${locale}${item.link}` : item.link) : null;
  return (
    <div className="bg-ink text-paper">
      <div className="container-x flex h-9 items-center justify-center overflow-hidden text-center text-[0.78rem] font-medium">
        <AnimatePresence mode="wait">
          <motion.div key={item.id} initial={{ y: 12, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: -12, opacity: 0 }} transition={{ duration: 0.35 }}>
            {href ? <Link href={href} className="hover:text-amber">{text}</Link> : text}
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}
