import { Star } from "lucide-react";
import { cn } from "@/lib/format";

export function Stars({ value, className = "size-4" }: { value: number; className?: string }) {
  return (
    <span className="inline-flex gap-0.5" aria-label={`${value}/5`} role="img">
      {[1, 2, 3, 4, 5].map((n) => (
        <Star key={n} className={cn(className, n <= Math.round(value) ? "fill-amber text-amber" : "fill-stone text-stone")} />
      ))}
    </span>
  );
}
