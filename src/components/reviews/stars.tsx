import { Star } from "lucide-react";
import { cn } from "@/lib/format";

export function Stars({ value, className = "size-4", tone = "amber" }: { value: number; className?: string; tone?: "amber" | "pine" }) {
  const on = tone === "pine" ? "fill-pine text-pine" : "fill-amber text-amber";
  return (
    <span className="inline-flex gap-0.5" aria-label={`${value}/5`} role="img">
      {[1, 2, 3, 4, 5].map((n) => (
        <Star key={n} className={cn(className, n <= Math.round(value) ? on : "fill-stone text-stone")} />
      ))}
    </span>
  );
}
