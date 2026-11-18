"use client";
import { motion, useReducedMotion } from "framer-motion";

/** Soft fade-in for every navigation (used from template.tsx, which remounts per route). Opacity only, so fixed bars never jump. */
export function PageFade({ children }: { children: React.ReactNode }) {
  const reduce = useReducedMotion();
  return (
    <motion.div initial={reduce ? false : { opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.38, ease: [0.16, 1, 0.3, 1] }}>
      {children}
    </motion.div>
  );
}
