"use client";
import { useEffect, useRef, useState } from "react";
import { motion, useInView, useReducedMotion, animate } from "framer-motion";

/** Card entrance: fades/slides in when scrolled into view, staggered within each row; lifts on hover. */
export function RevealCard({ index, children }: { index: number; children: React.ReactNode }) {
  const reduce = useReducedMotion();
  return (
    <motion.div
      className="mb-3 break-inside-avoid sm:mb-4"
      initial={reduce ? false : { opacity: 0, y: 28, scale: 0.97 }}
      whileInView={{ opacity: 1, y: 0, scale: 1 }}
      viewport={{ once: true, margin: "-40px" }}
      transition={{ duration: 0.55, delay: (index % 6) * 0.07, ease: [0.16, 1, 0.3, 1] }}
      whileHover={reduce ? undefined : { y: -4 }}
    >
      {children}
    </motion.div>
  );
}

/** Number that counts up from 0 the first time it becomes visible. */
export function CountUp({ value, decimals = 0, duration = 1.4 }: { value: number; decimals?: number; duration?: number }) {
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true });
  const reduce = useReducedMotion();
  const [shown, setShown] = useState(reduce ? value : 0);
  useEffect(() => {
    if (!inView || reduce) return setShown(value);
    const controls = animate(0, value, { duration, ease: [0.16, 1, 0.3, 1], onUpdate: setShown });
    return () => controls.stop();
  }, [inView, value, duration, reduce]);
  return <span ref={ref}>{shown.toFixed(decimals)}</span>;
}

/** Fade-up block (hero pieces, highlighted quote). */
export function FadeUp({ children, delay = 0, className }: { children: React.ReactNode; delay?: number; className?: string }) {
  const reduce = useReducedMotion();
  return (
    <motion.div
      className={className}
      initial={reduce ? false : { opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ duration: 0.7, delay, ease: [0.16, 1, 0.3, 1] }}
    >
      {children}
    </motion.div>
  );
}
