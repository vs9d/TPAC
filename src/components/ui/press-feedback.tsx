"use client";
import { useEffect } from "react";

const INTERACTIVE = 'a[href], button, summary, select, label, [role="button"], [role="tab"], [role="radio"], [role="link"]';

/**
 * Global tap feedback.
 *  1. Every tappable thing (links, plain-text links, cards, chips, buttons) gets an instant "pressed" look
 *     (.pressing) that stays visible for at least 200 ms, even for a very short tap.
 *  2. Buttons/chips also get a ripple from the exact touch point.
 *  3. A no-op touchstart listener switches on :active styles in iOS Safari (it ignores them otherwise).
 */
export function PressFeedback() {
  useEffect(() => {
    document.addEventListener("touchstart", () => {}, { passive: true });
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    const onDown = (e: PointerEvent) => {
      if (e.pointerType === "mouse" && e.button !== 0) return;
      const target = e.target as Element | null;
      const el = target?.closest<HTMLElement>(INTERACTIVE);
      if (!el || (el as HTMLButtonElement).disabled || el.getAttribute("aria-disabled") === "true") return;

      // 1) pressed look
      el.classList.add("pressing");
      const since = performance.now();
      const release = () => {
        const wait = Math.max(0, 200 - (performance.now() - since));
        setTimeout(() => el.classList.remove("pressing"), wait);
        window.removeEventListener("pointerup", release);
        window.removeEventListener("pointercancel", release);
      };
      window.addEventListener("pointerup", release);
      window.addEventListener("pointercancel", release);
      setTimeout(() => el.classList.remove("pressing"), 4000); // safety net

      // 2) ripple
      if (reduce) return;
      const host = target?.closest<HTMLElement>(".btn, .chip, [data-ripple]");
      if (!host) return;
      const r = host.getBoundingClientRect();
      const size = Math.max(r.width, r.height) * 2.2;
      const dot = document.createElement("span");
      dot.className = "ripple-dot";
      dot.style.cssText = `width:${size}px;height:${size}px;left:${e.clientX - r.left - size / 2}px;top:${e.clientY - r.top - size / 2}px`;
      host.appendChild(dot);
      dot.addEventListener("animationend", () => dot.remove(), { once: true });
      setTimeout(() => dot.remove(), 900);
    };
    document.addEventListener("pointerdown", onDown, { passive: true });
    return () => document.removeEventListener("pointerdown", onDown);
  }, []);
  return null;
}
