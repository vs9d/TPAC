"use client";
import { useMemo, useState } from "react";
import Link from "next/link";
import { ArrowLeft, ArrowRight, Baby, Minus, Plus, Ruler, Shirt, Sparkles } from "lucide-react";
import { useI18n } from "@/components/i18n-provider";
import { findSize, LIMITS, SIZE_CHARTS, type Fit, type FinderProduct } from "@/lib/size-chart";
import { cn } from "@/lib/format";

const PRODUCTS: { key: FinderProduct; ar: string; en: string; shop: string }[] = [
  { key: "hoodie", ar: "هودي", en: "Hoodie", shop: "hoodies" },
  { key: "sweatshirt", ar: "سويتر", en: "Sweatshirt", shop: "hoodies" },
  { key: "tshirt", ar: "تيشيرت", en: "T-shirt", shop: "t-shirts" },
  { key: "kids", ar: "أطفال", en: "Kids", shop: "" },
];
const FITS: { key: Fit; ar: string; en: string; hint_ar: string; hint_en: string }[] = [
  { key: "slim", ar: "ضيق", en: "Slim", hint_ar: "لابس على الجسم", hint_en: "Close to the body" },
  { key: "regular", ar: "طبيعي", en: "Regular", hint_ar: "مريح ومظبوط", hint_en: "Comfortable, true to size" },
  { key: "wide", ar: "واسع", en: "Loose", hint_ar: "أوفرسايز ومرتاح", hint_en: "Oversized and relaxed" },
];

/** Customer size finder: height + weight + product + fit → the TPAC size, from TPAC's own size charts. */
export function SizeFinder({ initialProduct }: { initialProduct?: FinderProduct }) {
  const { locale } = useI18n();
  const ar = locale === "ar";
  const L = (a: string, e: string) => (ar ? a : e);
  const [product, setProduct] = useState<FinderProduct>(initialProduct ?? "hoodie");
  const kids = product === "kids";
  const [height, setHeight] = useState("");
  const [weight, setWeight] = useState("");
  const [fit, setFit] = useState<Fit>("regular");
  const [shown, setShown] = useState(false);
  const lim = kids ? LIMITS.kids : LIMITS.adult;
  const h = Number(height), w = Number(weight);
  const valid = height !== "" && weight !== "" && h >= lim.h[0] && h <= lim.h[1] && w >= lim.w[0] && w <= lim.w[1];
  const advice = useMemo(() => (valid ? findSize(product, h, w, fit) : null), [valid, product, h, w, fit]);
  const chart = SIZE_CHARTS[product];
  const label = (s: string) => (kids ? L(`${s} سنوات`, `${s} yrs`) : s);
  const Arrow = ar ? ArrowLeft : ArrowRight;
  const shop = PRODUCTS.find((p) => p.key === product)!.shop;

  const step = (set: (v: string) => void, v: string, d: number, min: number, max: number, start: number) => {
    const n = v === "" ? start : Number(v) + d;
    set(String(Math.min(max, Math.max(min, n))));
  };

  return (
    <div className="mt-10 grid gap-8 lg:grid-cols-[1.1fr_1fr]">
      <form className="space-y-7" onSubmit={(e) => { e.preventDefault(); setShown(true); }}>
        <fieldset>
          <legend className="label">{L("شنو تريد تلبس؟", "What are you sizing?")}</legend>
          <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-4" role="radiogroup">
            {PRODUCTS.map((p) => (
              <button key={p.key} type="button" role="radio" aria-checked={product === p.key} onClick={() => { setProduct(p.key); setShown(false); }}
                className={cn("flex h-14 items-center justify-center gap-2 rounded-2xl border text-sm font-bold transition", product === p.key ? "border-ink bg-ink text-paper" : "border-line hover:border-ink")}>
                {p.key === "kids" ? <Baby className="size-4" /> : <Shirt className="size-4" />} {ar ? p.ar : p.en}
              </button>
            ))}
          </div>
        </fieldset>

        <div className="grid gap-4 sm:grid-cols-2">
          {([
            ["height", L("الطول (سم)", "Height (cm)"), height, setHeight, lim.h, kids ? 120 : 170],
            ["weight", L("الوزن (كغ)", "Weight (kg)"), weight, setWeight, lim.w, kids ? 25 : 70],
          ] as const).map(([id, lbl, v, set, [min, max], start]) => (
            <div key={id}>
              <label htmlFor={`sf-${id}`} className="label">{lbl}</label>
              <div className="mt-1 flex items-center gap-2">
                <button type="button" onClick={() => step(set, v, -1, min, max, start)} className="grid size-12 shrink-0 place-items-center rounded-full border border-line hover:border-ink" aria-label={L("أقل", "Less")}><Minus className="size-4" /></button>
                <input id={`sf-${id}`} type="number" inputMode="numeric" min={min} max={max} value={v} placeholder={String(start)} onChange={(e) => { set(e.target.value); setShown(false); }} className="field h-12 text-center text-lg font-bold tabular-nums" dir="ltr" />
                <button type="button" onClick={() => step(set, v, 1, min, max, start)} className="grid size-12 shrink-0 place-items-center rounded-full border border-line hover:border-ink" aria-label={L("أكثر", "More")}><Plus className="size-4" /></button>
              </div>
              {v !== "" && (Number(v) < min || Number(v) > max) && <p className="mt-1 text-xs text-danger">{L(`بين ${min} و ${max}`, `Between ${min} and ${max}`)}</p>}
            </div>
          ))}
        </div>

        <fieldset>
          <legend className="label">{L("شلون تحبه يكون؟", "How do you like it to fit?")}</legend>
          <div className="mt-2 grid grid-cols-3 gap-2" role="radiogroup">
            {FITS.map((f) => (
              <button key={f.key} type="button" role="radio" aria-checked={fit === f.key} onClick={() => setFit(f.key)}
                className={cn("rounded-2xl border px-3 py-3 text-center transition", fit === f.key ? "border-pine bg-pine text-white dark:text-night" : "border-line hover:border-ink")}>
                <span className="block text-sm font-bold">{ar ? f.ar : f.en}</span>
                <span className={cn("mt-0.5 block text-[11px]", fit === f.key ? "opacity-85" : "text-mute")}>{ar ? f.hint_ar : f.hint_en}</span>
              </button>
            ))}
          </div>
        </fieldset>

        <button disabled={!valid} className="btn btn-primary h-14 w-full text-base"><Ruler className="size-5" /> {L("اعرف قياسي", "Find my size")}</button>
      </form>

      <div aria-live="polite">
        {shown && advice ? (
          <div className="rounded-[1.75rem] border border-line bg-bone p-6 md:p-8">
            <p className="flex items-center gap-2 text-sm font-semibold text-pine"><Sparkles className="size-4" /> {L("قياسك المقترح من TPAC", "Your TPAC size")}</p>
            <p className="display mt-2 text-7xl tabular-nums" data-testid="size-result">{label(advice.size)}</p>
            <p className="mt-2 text-sm text-mute">
              {ar ? `${PRODUCTS.find((p) => p.key === product)!.ar} · ${FITS.find((f) => f.key === fit)!.ar}` : `${PRODUCTS.find((p) => p.key === product)!.en} · ${FITS.find((f) => f.key === fit)!.en}`}
            </p>
            <dl className="mt-6 grid grid-cols-3 gap-2 text-center">
              {[[L("الطول", "Length"), advice.row.length], [L("العرض", "Width"), advice.row.width], [L("الردن", "Sleeve"), kids && advice.row.sleeveLong ? `${advice.row.sleeve} / ${advice.row.sleeveLong}` : advice.row.sleeve]].map(([k, v]) => (
                <div key={String(k)} className="rounded-2xl bg-paper p-3"><dt className="text-xs text-mute">{k}</dt><dd className="mt-1 text-lg font-bold tabular-nums" dir="ltr">{v} <span className="text-xs font-normal">cm</span></dd></div>
              ))}
            </dl>
            <ul className="mt-5 space-y-1.5 text-sm text-mute">
              {advice.tooBig && <li className="font-semibold text-danger">{L("حسب جدولنا هذا أكبر قياس عدنا — راسلنا بالواتساب حتى نتأكد وياك.", "This is our largest size — message us on WhatsApp so we can check together.")}</li>}
              {advice.forLength && <li>{L("اخترنالك قياس أكبر بواحد حتى يجيك الطول مضبوط.", "We went one size up so the length suits your height.")}</li>}
              {advice.bigger && fit !== "wide" && <li>{L(`تحبه أوسع؟ خذ ${label(advice.bigger)}.`, `Want it looser? Take ${label(advice.bigger)}.`)}</li>}
              {advice.smaller && fit !== "slim" && <li>{L(`تحبه أضيق؟ خذ ${label(advice.smaller)}.`, `Want it closer? Take ${label(advice.smaller)}.`)}</li>}
              {kids && <li>{L("الردن: قصير للتيشيرت / طويل للهودي.", "Sleeve: short for the t-shirt / long for the hoodie.")}</li>}
            </ul>
            {shop && (
              <Link href={`/${locale}/shop?category=${shop}`} className="btn btn-outline mt-6 w-full">{L("تسوّق بهذا القياس", "Shop in this size")} <Arrow className="size-4" /></Link>
            )}
          </div>
        ) : (
          <div className="grid h-full min-h-60 place-items-center rounded-[1.75rem] border border-dashed border-line p-8 text-center text-sm text-mute">
            <div><Ruler className="mx-auto mb-3 size-8 text-pine" />{L("اكتب طولك ووزنك واختار شلون تحبه، ونگلك قياسك.", "Enter your height and weight, pick your fit, and we'll tell you your size.")}</div>
          </div>
        )}
      </div>

      <div className="lg:col-span-2">
        <h2 className="text-lg font-bold">{L("جدول القياسات", "Size chart")} — {ar ? PRODUCTS.find((p) => p.key === product)!.ar : PRODUCTS.find((p) => p.key === product)!.en}</h2>
        <div className="mt-3 overflow-x-auto rounded-2xl border border-line">
          <table className="w-full text-sm">
            <thead><tr className="bg-bone text-start">
              <th className="p-2.5 text-start font-semibold sm:p-3">{kids ? L("العمر", "Age") : L("القياس", "Size")}</th>
              <th className="p-2.5 text-start font-semibold sm:p-3">{L("الطول", "Length")}</th>
              <th className="p-2.5 text-start font-semibold sm:p-3">{L("العرض", "Width")}</th>
              <th className="p-2.5 text-start font-semibold sm:p-3">{L("الردن", "Sleeve")}{kids ? L(" (قصير/طويل)", " (short/long)") : ""}</th>
            </tr></thead>
            <tbody>
              {chart.map((r) => (
                <tr key={r.size} className={cn("border-t border-line", shown && advice?.size === r.size && "bg-amber/15 font-bold")}>
                  <td className="p-2.5 sm:p-3 font-semibold">{label(r.size)}</td>
                  <td className="p-2.5 sm:p-3 tabular-nums">{r.length}</td>
                  <td className="p-2.5 sm:p-3 tabular-nums">{r.width}</td>
                  <td className="p-2.5 sm:p-3 tabular-nums" dir="ltr">{r.sleeveLong ? `${r.sleeve} / ${r.sleeveLong}` : r.sleeve}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="mt-2 text-xs text-mute">{L("القياسات بالسنتيمتر وبشكل مسطّح (العرض = من إبط لإبط). الاقتراح تقريبي حسب جسم الإنسان المتوسط.", "Measurements in cm, laid flat (width = armpit to armpit). The suggestion is an estimate for an average build.")}</p>
      </div>
    </div>
  );
}
