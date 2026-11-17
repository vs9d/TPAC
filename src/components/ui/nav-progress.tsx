"use client";
import { useEffect, useRef, useState } from "react";
import { usePathname, useSearchParams } from "next/navigation";

/** Thin brand-coloured bar at the top: starts the instant an internal link is tapped, finishes when the new page arrives. */
export function NavProgress() {
  const pathname = usePathname();
  const search = useSearchParams();
  const [state, setState] = useState<"idle" | "loading" | "done">("idle");
  const [width, setWidth] = useState(0);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);
  const key = `${pathname}?${search.toString()}`;

  const stop = () => {
    if (timer.current) clearInterval(timer.current);
    timer.current = null;
  };

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      const a = (e.target as Element | null)?.closest<HTMLAnchorElement>("a[href]");
      if (!a || a.target === "_blank" || a.hasAttribute("download")) return;
      const url = new URL(a.href, location.href);
      if (url.origin !== location.origin) return;
      if (url.pathname === location.pathname && url.search === location.search) return;
      if (url.pathname === location.pathname && url.hash) return;
      stop();
      setState("loading");
      setWidth(12);
      // ease towards 90% while we wait
      timer.current = setInterval(() => setWidth((w) => (w < 90 ? w + (90 - w) * 0.12 : w)), 120);
    };
    document.addEventListener("click", onClick, true);
    return () => {
      document.removeEventListener("click", onClick, true);
      stop();
    };
  }, []);

  useEffect(() => {
    // the route changed => finish
    stop();
    setState((s) => {
      if (s === "loading") {
        setWidth(100);
        return "done";
      }
      return s;
    });
    const t = setTimeout(() => {
      setState("idle");
      setWidth(0);
    }, 350);
    return () => clearTimeout(t);
  }, [key]);

  return (
    <div aria-hidden className="pointer-events-none fixed inset-x-0 top-0 z-[130] h-[3px]">
      <div
        className="h-full bg-gradient-to-r from-amber via-pine to-amber shadow-[0_0_10px_rgba(227,150,60,0.7)]"
        style={{ width: `${width}%`, opacity: state === "idle" ? 0 : 1, transition: state === "done" ? "width .2s ease-out, opacity .3s .15s" : "width .25s ease-out", marginInlineEnd: "auto" }}
      />
    </div>
  );
}
