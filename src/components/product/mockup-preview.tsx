import { absolute, mockupFor, viewAspect, type PrintAreaRow, type ProductDesignRow, type TypeViewRow } from "@/lib/print-config";
import type { GarmentType } from "@/lib/garments";
import { cn } from "@/lib/format";

const pct = (n: number) => `${n * 100}%`;

/** The product as the admin configured it: the blank mockup for the colour + the official artwork, optionally with the print areas outlined. */
export function MockupPreview({ view, shape, color, areas, designs, showAreas, label, className }: {
  view: TypeViewRow; shape: GarmentType | null; color: { id: string; hex: string } | null;
  areas: PrintAreaRow[]; designs: ProductDesignRow[]; showAreas?: boolean; label?: string; className?: string;
}) {
  const src = mockupFor(view, shape, color);
  return (
    <div className={cn("relative grid size-full place-items-center bg-[#ebe7de]", className)}>
      <div className="relative w-[90%]" style={{ aspectRatio: String(viewAspect(view)) }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        {src && <img src={src} alt={label ?? ""} draggable={false} className="absolute inset-0 size-full object-fill" />}
        {designs.map((d) => {
          const a = areas.find((x) => x.id === d.area_id);
          if (!a) return null;
          const r = absolute(a, d);
          // eslint-disable-next-line @next/next/no-img-element
          return <img key={d.id} src={d.artwork_url} alt="" draggable={false} className="absolute object-contain" style={{ left: pct(r.x), top: pct(r.y), width: pct(r.width), height: pct(r.height) }} />;
        })}
        {showAreas && areas.map((a) => (
          <span key={a.id} className="absolute rounded-sm border-2 border-dashed border-amber" style={{ left: pct(a.x), top: pct(a.y), width: pct(a.width), height: pct(a.height) }}>
            <span className="absolute -top-5 start-0 whitespace-nowrap rounded bg-amber px-1 text-[10px] font-bold text-white">{a.max_width_cm}×{a.max_height_cm} cm</span>
          </span>
        ))}
      </div>
    </div>
  );
}
