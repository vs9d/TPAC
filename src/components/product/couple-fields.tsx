"use client";
import { optionInputs, PIECES, TYPE_LABELS, type CoupleOptions, type OptionValues } from "@/lib/couple-options";
import { cn } from "@/lib/format";

/**
 * The extra boxes on a couple set's page: the second hoodie's size and the names / letters / dates the admin asked for.
 * (The size picked in the usual size row is the first hoodie's.)
 */
export function CoupleFields({ cfg, sizes, values, onChange, locale, showErrors }: {
  cfg: CoupleOptions;
  sizes: string[];
  values: OptionValues;
  onChange: (v: OptionValues) => void;
  locale: "ar" | "en";
  showErrors: boolean;
}) {
  const ar = locale === "ar";
  const set = (k: string, v: string) => onChange({ ...values, [k]: v });
  const inputs = optionInputs(cfg);
  const placeholder = (type: keyof typeof TYPE_LABELS) =>
    type === "letter" ? (ar ? "مثلاً: M" : "e.g. M") : type === "date" ? (ar ? "مثلاً: 14/2/2025" : "e.g. 14/2/2025") : ar ? "مثلاً: Mona" : "e.g. Mona";

  return (
    <div className="mt-5 space-y-4 rounded-[1.25rem] border border-line p-4">
      {cfg.second_size && (
        <div>
          <p className="mb-2 text-sm font-semibold">{ar ? `قياس ${PIECES[1][0]}` : `${PIECES[1][1]} size`} <span className="text-danger">*</span></p>
          <div className="grid grid-cols-5 gap-2" role="radiogroup" aria-label={ar ? `قياس ${PIECES[1][0]}` : `${PIECES[1][1]} size`}>
            {sizes.map((s) => (
              <button key={s} type="button" role="radio" aria-checked={values.size_2 === s} onClick={() => set("size_2", s)} className="chip w-full">{s}</button>
            ))}
          </div>
          {showErrors && !values.size_2 && <p className="mt-1.5 text-xs font-semibold text-danger">{ar ? "اختار قياس الهودي الثاني" : "Choose the second hoodie's size"}</p>}
        </div>
      )}
      {inputs.length > 0 && (
        <div className="grid gap-3 sm:grid-cols-2">
          {inputs.map((i) => {
            const empty = !(values[i.name] ?? "").trim();
            return (
              <label key={i.name} className={cn("block text-sm", !i.piece && "sm:col-span-2")}>
                <span className="mb-1.5 block font-semibold">
                  {ar ? i.label_ar : i.label_en} {i.field.required ? <span className="text-danger">*</span> : <span className="text-xs font-normal text-mute">{ar ? "(اختياري)" : "(optional)"}</span>}
                </span>
                <input
                  value={values[i.name] ?? ""}
                  onChange={(e) => set(i.name, e.target.value)}
                  maxLength={i.max}
                  dir="auto"
                  placeholder={placeholder(i.field.type)}
                  className={cn("field h-11 w-full", showErrors && i.field.required && empty && "border-danger")}
                />
              </label>
            );
          })}
        </div>
      )}
      <p className="text-xs text-mute">{ar ? "القياس اللي فوق للهودي الأول. نطبع اللي تكتبه بالضبط — تأكد من الإملاء." : "The size above is the first hoodie's. We print exactly what you type — check the spelling."}</p>
    </div>
  );
}
