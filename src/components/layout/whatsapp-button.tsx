"use client";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/format";

/** Floating "chat on WhatsApp" button on every store page, kept above the sticky buy / price bars. */
export function WhatsAppButton({ number, locale }: { number: string; locale: "ar" | "en" }) {
  const path = usePathname();
  const onDesign = /\/design(\/|$)/.test(path);
  const onProduct = /\/product\//.test(path);
  const text = locale === "ar" ? "مرحباً TPAC، عندي استفسار" : "Hi TPAC, I have a question";
  const label = locale === "ar" ? "راسلنا على واتساب" : "Chat with us on WhatsApp";
  return (
    <a
      href={`https://wa.me/${number}?text=${encodeURIComponent(text)}`}
      target="_blank"
      rel="noopener noreferrer"
      aria-label={label}
      title={label}
      data-ripple
      className={cn(
        "fixed left-4 z-30 grid size-14 place-items-center rounded-full bg-[#25D366] text-white shadow-[0_12px_28px_-8px_rgba(37,211,102,.7)] transition hover:scale-105 active:scale-95 sm:left-6",
        onDesign ? "bottom-28" : onProduct ? "bottom-24 md:bottom-6" : "bottom-5 sm:bottom-6",
      )}
    >
      <svg viewBox="0 0 32 32" className="size-7" aria-hidden fill="currentColor">
        <path d="M16.04 3C9.06 3 3.4 8.6 3.4 15.5c0 2.4.7 4.7 2 6.7L3.3 29l7-1.8c1.8 1 3.8 1.5 5.8 1.5 6.97 0 12.63-5.6 12.63-12.5S23 3 16.04 3zm0 22.9c-1.9 0-3.7-.5-5.3-1.5l-.4-.2-4.1 1.1 1.1-4-.3-.4a10.3 10.3 0 0 1-1.6-5.4c0-5.7 4.7-10.4 10.6-10.4 5.8 0 10.5 4.7 10.5 10.4S21.85 25.9 16.04 25.9zm5.8-7.8c-.3-.2-1.9-.9-2.2-1s-.5-.2-.7.2-.8 1-1 1.2-.4.2-.7 0a8.6 8.6 0 0 1-2.5-1.6 9.6 9.6 0 0 1-1.8-2.2c-.2-.3 0-.5.1-.7l.5-.6.3-.5c.1-.2 0-.4 0-.5l-1-2.4c-.3-.6-.5-.5-.7-.5h-.6c-.2 0-.5.1-.8.4s-1 1-1 2.5 1.1 2.9 1.2 3.1 2.1 3.2 5.1 4.5c.7.3 1.3.5 1.7.6.7.2 1.4.2 1.9.1.6-.1 1.9-.8 2.1-1.5s.3-1.3.2-1.5-.3-.2-.6-.4z" />
      </svg>
    </a>
  );
}
