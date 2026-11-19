"use client";
import { useRef } from "react";
import { clampRect, type Rect } from "@/lib/print-config";
import { cn } from "@/lib/format";

/** A mockup at its real proportions; children are positioned in fractions of it. */
export function MockupStage({ src, aspect, children, className, background = "#EFECE6" }: { src: string | null; aspect: number; children?: React.ReactNode; className?: string; background?: string }) {
  return (
    <div className={cn("relative w-full select-none overflow-hidden rounded-2xl", className)} style={{ aspectRatio: String(aspect), background }}>
      {src ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={src} alt="" draggable={false} className="pointer-events-none absolute inset-0 size-full object-fill" />
      ) : (
        <div className="absolute inset-0 grid place-items-center p-6 text-center text-sm text-mute">—</div>
      )}
      {children}
    </div>
  );
}

const pct = (n: number) => `${n * 100}%`;
export const rectStyle = (r: Rect): React.CSSProperties => ({ left: pct(r.x), top: pct(r.y), width: pct(r.width), height: pct(r.height) });

type Mode = { kind: "move" } | { kind: "resize"; corner: "nw" | "ne" | "sw" | "se" };

/**
 * A rectangle you can drag and resize with mouse or finger, in fractions of its parent.
 * `aspect` = height / width in parent fractions; when set, resizing keeps those proportions.
 * The rectangle can never leave its parent.
 */
export function DragRect({ rect, onChange, onCommit, onSelect, selected, aspect, label, tone = "area", children, minSize = 0.03, disabled }: {
  rect: Rect;
  onChange: (r: Rect) => void;
  onCommit?: (r: Rect) => void;
  onSelect?: () => void;
  selected?: boolean;
  aspect?: number | null;
  label?: string;
  tone?: "area" | "design" | "muted";
  children?: React.ReactNode;
  minSize?: number;
  disabled?: boolean;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const drag = useRef<{ mode: Mode; start: Rect; px: number; py: number; w: number; h: number; last: Rect } | null>(null);

  const begin = (e: React.PointerEvent, mode: Mode) => {
    if (disabled) return;
    e.preventDefault();
    e.stopPropagation();
    onSelect?.();
    const parent = ref.current?.parentElement?.getBoundingClientRect();
    if (!parent) return;
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    drag.current = { mode, start: rect, px: e.clientX, py: e.clientY, w: parent.width, h: parent.height, last: rect };
  };
  const move = (e: React.PointerEvent) => {
    const d = drag.current;
    if (!d) return;
    const dx = (e.clientX - d.px) / d.w;
    const dy = (e.clientY - d.py) / d.h;
    const s = d.start;
    let next: Rect;
    if (d.mode.kind === "move") {
      next = clampRect({ ...s, x: s.x + dx, y: s.y + dy }, minSize);
    } else {
      const c = d.mode.corner;
      // the opposite corner stays where it is
      const ax = c.includes("w") ? s.x + s.width : s.x;
      const ay = c.includes("n") ? s.y + s.height : s.y;
      let w = Math.max(minSize, c.includes("w") ? s.width - dx : s.width + dx);
      let h = Math.max(minSize, c.includes("n") ? s.height - dy : s.height + dy);
      if (aspect) h = w * aspect;
      // room available from the anchor towards the dragged corner
      const roomW = c.includes("w") ? ax : 1 - ax;
      const roomH = c.includes("n") ? ay : 1 - ay;
      if (w > roomW) { w = roomW; if (aspect) h = w * aspect; }
      if (h > roomH) { h = roomH; if (aspect) w = h / aspect; }
      next = clampRect({ width: w, height: h, x: c.includes("w") ? ax - w : ax, y: c.includes("n") ? ay - h : ay }, minSize / 2);
    }
    d.last = next;
    onChange(next);
  };
  const end = () => {
    if (drag.current) onCommit?.(drag.current.last);
    drag.current = null;
  };

  const colors = tone === "design" ? "border-amber" : tone === "muted" ? "border-ink/30" : selected ? "border-amber bg-amber/10" : "border-pine bg-pine/10";
  return (
    <div
      ref={ref}
      role="group"
      aria-label={label}
      onPointerDown={(e) => begin(e, { kind: "move" })}
      onPointerMove={move}
      onPointerUp={end}
      onPointerCancel={end}
      className={cn("absolute touch-none border-2 border-dashed", colors, !disabled && "cursor-move", selected && "z-10 border-solid")}
      style={rectStyle(rect)}
    >
      {children}
      {label && <span className={cn("pointer-events-none absolute -top-6 start-0 whitespace-nowrap rounded-md px-1.5 py-0.5 text-[11px] font-bold text-white", selected || tone === "design" ? "bg-amber" : "bg-pine")}>{label}</span>}
      {selected && !disabled && (["nw", "ne", "sw", "se"] as const).map((c) => (
        <span
          key={c}
          onPointerDown={(e) => begin(e, { kind: "resize", corner: c })}
          onPointerMove={move}
          onPointerUp={end}
          onPointerCancel={end}
          aria-hidden
          className={cn("absolute size-5 touch-none rounded-full border-2 border-white bg-amber shadow", c === "nw" && "-left-2.5 -top-2.5 cursor-nwse-resize", c === "ne" && "-right-2.5 -top-2.5 cursor-nesw-resize", c === "sw" && "-bottom-2.5 -left-2.5 cursor-nesw-resize", c === "se" && "-bottom-2.5 -right-2.5 cursor-nwse-resize")}
        />
      ))}
    </div>
  );
}
