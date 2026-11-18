"use client";
import { useEffect } from "react";

type Snap = { el: HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement; value: string; checked: boolean }[];

/**
 * React 19 clears a <form action> after every submit — even when the server said "invalid", which would wipe
 * what the person typed. We snapshot the values on submit and put them back right after the automatic reset.
 * Forms that WANT to clear (data-reset="true") are left alone. File inputs can't be restored by browsers.
 */
export function FormKeeper() {
  useEffect(() => {
    const snaps = new WeakMap<HTMLFormElement, Snap>();
    const onSubmit = (e: Event) => {
      const form = e.target;
      if (!(form instanceof HTMLFormElement) || form.dataset.reset === "true") return;
      const snap: Snap = [];
      for (const el of Array.from(form.elements)) {
        if (!(el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement || el instanceof HTMLSelectElement)) continue;
        if (!el.name || (el instanceof HTMLInputElement && (el.type === "file" || el.type === "submit" || el.type === "button"))) continue;
        snap.push({ el, value: el.value, checked: el instanceof HTMLInputElement ? el.checked : false });
      }
      snaps.set(form, snap);
    };
    const onReset = (e: Event) => {
      const form = e.target;
      if (!(form instanceof HTMLFormElement) || form.dataset.reset === "true") return;
      const snap = snaps.get(form);
      if (!snap) return;
      setTimeout(() => {
        for (const { el, value, checked } of snap) {
          if (!el.isConnected) continue;
          if (el instanceof HTMLInputElement && (el.type === "checkbox" || el.type === "radio")) el.checked = checked;
          else el.value = value;
        }
      }, 0);
    };
    document.addEventListener("submit", onSubmit, true);
    document.addEventListener("reset", onReset, true);
    return () => {
      document.removeEventListener("submit", onSubmit, true);
      document.removeEventListener("reset", onReset, true);
    };
  }, []);
  return null;
}
