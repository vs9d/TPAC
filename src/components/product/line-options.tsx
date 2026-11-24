import type { ResolvedOption } from "@/lib/couple-options";

/** A couple set's answers (sizes of both hoodies, names, letters, dates) under the line's name. */
export function LineOptions({ options, locale, className = "" }: { options?: ResolvedOption[] | null; locale: "ar" | "en"; className?: string }) {
  if (!options?.length) return null;
  return (
    <ul className={`mt-1 space-y-0.5 text-xs text-mute ${className}`}>
      {options.map((o) => (
        <li key={o.key}>
          {locale === "ar" ? o.label_ar : o.label_en}: <span className="font-semibold text-ink" dir="auto">{o.value}</span>
        </li>
      ))}
    </ul>
  );
}

/** One line of text for places without markup (invoice cells, messages). */
export const optionsText = (options: ResolvedOption[] | null | undefined, locale: "ar" | "en") =>
  (options ?? []).map((o) => `${locale === "ar" ? o.label_ar : o.label_en}: ${o.value}`).join(" · ");
