"use client";
import { useEffect } from "react";

/**
 * Global tap feedback: a Material-style ripple from the exact touch point on buttons, chips and
 * anything marked data-ripple. Pure DOM + CSS (no per-component wiring); skipped for reduced motion.
 */
export function PressFeedback() {
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const onDown = (e: PointerEvent) => {
      if (e.button !== 0) return;
      const el = (e.target as Element | null)?.closest<HTMLElement>(".btn, .chip, [data-ripple]");
      if (!el || (el as HTMLButtonElement).disabled || el.getAttribute("aria-disabled") === "true") return;
      const r = el.getBoundingClientRect();
      const size = Math.max(r.width, r.height) * 2.2;
      const dot = document.createElement("span");
      dot.className = "ripple-dot";
      dot.style.cssText = `width:${size}px;height:${size}px;left:${e.clientX - r.left - size / 2}px;top:${e.clientY - r.top - size / 2}px`;
      el.appendChild(dot);
      dot.addEventListener("animationend", () => dot.remove(), { once: true });
      setTimeout(() => dot.remove(), 900);
    };
    document.addEventListener("pointerdown", onDown, { passive: true });
    return () => document.removeEventListener("pointerdown", onDown);
  }, []);
  return null;
}
