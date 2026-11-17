"use client";
import { create } from "zustand";
import { AnimatePresence, motion } from "framer-motion";
import { Check, AlertCircle, X } from "lucide-react";

interface Toast { id: number; kind: "success" | "error"; text: string }
interface ToastState { toasts: Toast[]; push: (kind: Toast["kind"], text: string) => void; dismiss: (id: number) => void }

let seq = 0;
export const useToast = create<ToastState>((set) => ({
  toasts: [],
  push: (kind, text) => {
    const id = ++seq;
    set((s) => ({ toasts: [...s.toasts, { id, kind, text }] }));
    setTimeout(() => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })), 4000);
  },
  dismiss: (id) => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),
}));

export const toast = {
  success: (t: string) => useToast.getState().push("success", t),
  error: (t: string) => useToast.getState().push("error", t),
};

export function Toaster() {
  const { toasts, dismiss } = useToast();
  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-4 z-[100] flex flex-col items-center gap-2 px-4" role="status" aria-live="polite">
      <AnimatePresence>
        {toasts.map((t) => (
          <motion.div
            key={t.id}
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 8 }}
            className="pointer-events-auto flex min-w-[260px] max-w-md items-center gap-3 bg-ink px-4 py-3 text-sm text-paper shadow-xl"
          >
            {t.kind === "success" ? <Check className="size-4 text-amber" /> : <AlertCircle className="size-4 text-red-400" />}
            <span className="flex-1">{t.text}</span>
            <button onClick={() => dismiss(t.id)} aria-label="close" className="opacity-60 hover:opacity-100">
              <X className="size-4" />
            </button>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}
