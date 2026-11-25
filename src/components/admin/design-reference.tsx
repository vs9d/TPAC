import Image from "next/image";
import { ImagePlus } from "lucide-react";
import type { DesignReferenceCfg } from "@/lib/design-admin";

/**
 * Shown wherever staff look at a saved design: the customer had no design file, uploaded
 * photos of a piece they liked and asked for the same — the team recreates it.
 */
export function DesignReferenceBlock({ reference, paths, urls, locationName, locale, compact = false }: {
  reference: DesignReferenceCfg | undefined;
  /** artwork id → storage path */
  paths: Map<string, string> | Record<string, string>;
  /** storage path → signed url */
  urls: Record<string, string>;
  locationName: (code: string) => string;
  locale: "ar" | "en";
  compact?: boolean;
}) {
  if (!reference?.artwork_ids?.length) return null;
  const ar = locale === "ar";
  const pathOf = (id: string) => (paths instanceof Map ? paths.get(id) : paths[id]);
  const shots = reference.artwork_ids.map((id) => pathOf(id)).filter((p): p is string => !!p && !!urls[p]);
  return (
    <div className="mt-4 rounded-2xl border-2 border-amber/70 bg-amber/10 p-4">
      <p className="flex items-center gap-2 text-sm font-bold">
        <ImagePlus className="size-4 shrink-0" aria-hidden="true" />
        {ar ? "الزبون ما عنده تصميم — يريد مثل هذه الصور" : "No design file — the customer wants it like these photos"}
      </p>
      <p className="mt-1 text-xs text-mute">
        {ar ? "صمّموا القطعة حسب الصور، وأرسلوا للزبون صورة للموافقة قبل الطباعة." : "Recreate the design from the photos and send the customer a proof before printing."}
      </p>
      {shots.length > 0 && (
        <div className={compact ? "mt-3 flex flex-wrap gap-2" : "mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4"}>
          {shots.map((p) => (
            <a key={p} href={urls[p]} target="_blank" rel="noopener noreferrer" className={compact ? "relative block size-24 overflow-hidden rounded-lg bg-bone" : "relative block aspect-square overflow-hidden rounded-xl bg-bone"}>
              <Image src={urls[p]!} alt={ar ? "صورة مرجعية من الزبون" : "Customer reference photo"} fill sizes="240px" className="object-cover" unoptimized />
            </a>
          ))}
        </div>
      )}
      <dl className="mt-3 space-y-1 text-sm">
        <div><dt className="inline font-semibold">{ar ? "مكان الطباعة: " : "Print on: "}</dt><dd className="inline">{reference.locations.map(locationName).join("، ")}</dd></div>
        {reference.note && <div><dt className="inline font-semibold">{ar ? "طلب الزبون: " : "Customer's request: "}</dt><dd className="inline whitespace-pre-line">{reference.note}</dd></div>}
      </dl>
    </div>
  );
}
