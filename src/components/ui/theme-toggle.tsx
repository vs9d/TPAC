"use client";
import { useEffect, useState } from "react";
import { Moon, Sun } from "lucide-react";
import { useI18n } from "@/components/i18n-provider";

export function ThemeToggle({ className = "" }: { className?: string }) {
  const { locale } = useI18n();
  const [theme, setTheme] = useState<"light" | "dark" | null>(null);
  useEffect(() => {
    setTheme((document.documentElement.getAttribute("data-theme") as "light" | "dark") ?? "light");
  }, []);
  const toggle = () => {
    const next = theme === "dark" ? "light" : "dark";
    document.documentElement.setAttribute("data-theme", next);
    document.querySelector('meta[name="theme-color"]')?.setAttribute("content", next === "dark" ? "#0f1513" : "#fbfaf7");
    try {
      localStorage.setItem("tpac-theme", next);
    } catch {
      /* storage blocked: the choice just won't persist */
    }
    setTheme(next);
  };
  const label = theme === "dark" ? (locale === "ar" ? "الوضع الفاتح" : "Light mode") : locale === "ar" ? "الوضع الداكن" : "Dark mode";
  return (
    <button onClick={toggle} aria-label={label} title={label} className={`grid size-11 place-items-center rounded-full border border-line text-ink transition-colors hover:bg-bone ${className}`}>
      {theme === "dark" ? <Sun className="size-[1.15rem]" /> : <Moon className="size-[1.15rem]" />}
    </button>
  );
}
