"use client";
import { create } from "zustand";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { Check, AlertCircle, X, Info } from "lucide-react";

type Kind = "success" | "error" | "info";
interface Toast { id: number; kind: Kind; text: string; ms: number }
interface ToastState { toasts: Toast[]; push: (kind: Kind, text: string, ms?: number) => void; dismiss: (id: number) => void }

let seq = 0;
export const useToast = create<ToastState>((set) => ({
  toasts: [],
  push: (kind, text, ms = kind === "error" ? 5000 : 3200) => {
    const id = ++seq;
    // keep at most 3 on screen; replace identical consecutive text instead of stacking
    set((s) => ({ toasts: [...s.toasts.filter((t) => t.text !== text), { id, kind, text, ms }].slice(-3) }));
    if (typeof navigator !== "undefined" && "vibrate" in navigator) navigator.vibrate?.(kind === "error" ? [18, 40, 18] : 10);
    setTimeout(() => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })), ms);
  },
  dismiss: (id) => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),
}));

export const toast = {
  success: (t: string) => useToast.getState().push("success", t),
  error: (t: string) => useToast.getState().push("error", t),
  info: (t: string) => useToast.getState().push("info", t),
};

const STYLE: Record<Kind, { ring: string; icon: React.ReactNode; bar: string }> = {
  success: { ring: "bg-pine text-white dark:text-night", icon: <Check className="size-4" strokeWidth={3} />, bar: "bg-pine" },
  error: { ring: "bg-danger text-white", icon: <AlertCircle className="size-4" />, bar: "bg-danger" },
  info: { ring: "bg-amber text-[#1a1208]", icon: <Info className="size-4" />, bar: "bg-amber" },
};

/** Top-of-screen toasts: they never sit behind the mobile sticky bars, slide in with a spring, pop their icon, and show a countdown. */
export function Toaster() {
  const { toasts, dismiss } = useToast();
  const reduce = useReducedMotion();
  return (
    <div className="pointer-events-none fixed inset-x-0 top-[max(0.75rem,env(safe-area-inset-top))] z-[120] flex flex-col items-center gap-2 px-4" role="status" aria-live="polite">
      <AnimatePresence initial={false}>
        {toasts.map((t) => {
          const st = STYLE[t.kind];
          return (
            <motion.div
              key={t.id}
              layout={!reduce}
              initial={reduce ? { opacity: 0 } : { opacity: 0, y: -28, scale: 0.92 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={reduce ? { opacity: 0 } : { opacity: 0, y: -16, scale: 0.95, transition: { duration: 0.18 } }}
              transition={{ type: "spring", stiffness: 520, damping: 32 }}
              drag={reduce ? false : "y"}
              dragConstraints={{ top: 0, bottom: 0 }}
              dragElastic={{ top: 0.6, bottom: 0 }}
              onDragEnd={(_, info) => info.offset.y < -24 && dismiss(t.id)}
              className="pointer-events-auto relative w-full max-w-md overflow-hidden rounded-2xl border border-line bg-paper text-sm text-ink shadow-[0_18px_40px_-12px_rgba(0,0,0,0.45)]"
            >
              <div className="flex items-center gap-3 px-3 py-3">
                <motion.span initial={reduce ? false : { scale: 0, rotate: -40 }} animate={{ scale: 1, rotate: 0 }} transition={{ type: "spring", stiffness: 600, damping: 14, delay: 0.08 }} className={`grid size-8 shrink-0 place-items-center rounded-full ${st.ring}`}>
                  {st.icon}
                </motion.span>
                <span className="flex-1 font-semibold leading-snug">{t.text}</span>
                <button onClick={() => dismiss(t.id)} aria-label="close" className="grid size-8 place-items-center rounded-full text-mute hover:bg-bone">
                  <X className="size-4" />
                </button>
              </div>
              {!reduce && <motion.div className={`h-[3px] origin-[0_50%] ${st.bar}`} initial={{ scaleX: 1 }} animate={{ scaleX: 0 }} transition={{ duration: t.ms / 1000, ease: "linear" }} />}
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>
  );
}
