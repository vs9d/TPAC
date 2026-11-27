"use client";
import { useState } from "react";
import { Check, Gift } from "lucide-react";
import { useI18n } from "@/components/i18n-provider";
import { adminT } from "@/lib/admin-i18n";
import { cn, formatIQD } from "@/lib/format";
import type { DesignerOptionRow } from "@/lib/types";

export const BOX_TEXT_MAX = 40;
const SAMPLE = "ليت العناق يُرسل";
const IDEAS = ["ليت العناق يُرسل", "إلى أجمل قلب", "كل عام وأنت بخير", "لك وحدك"];

export type BoxView = "angle" | "front" | "side";
const VIEWS: [BoxView, string, string][] = [["angle", "منظور", "Angle"], ["front", "من الأمام", "Front"], ["side", "من الجنب", "Side"]];

/**
 * Real photos of the TPAC kraft box (twine, bow and dried flowers) with the printed words removed.
 * For each one: the photo size, the centre of the printable area on the lid, its size, and the
 * linear part of the transform that lays flat text onto the lid at that camera angle.
 */
const PHOTOS: Record<BoxView, { src: string; w: number; h: number; cx: number; cy: number; bw: number; bh: number; m: [number, number, number, number] }> = {
  angle: { src: "/gift-box/box-angle.webp", w: 1254, h: 787, cx: 870, cy: 205, bw: 390, bh: 235, m: [1, -0.055, 0.16, 0.95] },
  front: { src: "/gift-box/box-front.webp", w: 634, h: 459, cx: 455, cy: 166, bw: 220, bh: 135, m: [1, 0, 0, 1] },
  side: { src: "/gift-box/box-side.webp", w: 611, h: 459, cx: 400, cy: 93, bw: 172, bh: 96, m: [0.98, -0.2, 0.42, 0.8] },
};

/** Like the real box: the opening words on one line, the last word large underneath. */
export function boxLines(text: string): string[] {
  const words = text.trim().split(/\s+/).filter(Boolean);
  if (words.length <= 1) return words;
  if (words.length === 2) return text.trim().length <= 12 ? [words.join(" ")] : words;
  if (words.length === 3) return [words.slice(0, 2).join(" "), words[2]!];
  const half = Math.ceil(words.length / 2);
  return [words.slice(0, half).join(" "), words.slice(half).join(" ")];
}

/** The gift box photo from one side, with the customer's words printed on the lid. */
export function GiftBoxArt({ text, font, view = "angle", className, decorative = false }: { text: string; font?: string; view?: BoxView; className?: string; decorative?: boolean }) {
  const p = PHOTOS[view];
  const shown = text.trim() || SAMPLE;
  const faded = !text.trim();
  const ls = boxLines(shown);
  const big = ls.length > 1 ? 1.18 : 1; // the last line is set larger, as on the box
  const longest = Math.max(1, ...ls.map((l, i) => l.length * (i === ls.length - 1 ? big : 1)));
  // marks such as ضمة sit very high in this calligraphic face: a line carrying them needs more room above
  const marks = (l: string) => /[\u064B-\u0652]/.test(l);
  const gap = (i: number) => (marks(ls[i]!) ? 1.85 : 1.4);
  const units = ls.reduce((n, _, i) => n + (i === 0 ? 1 : gap(i)) * (i === ls.length - 1 ? big : 1), 0);
  // Arabic letters run about half an em wide
  const size = Math.min(p.bh / (units * 1.05), p.bw / (longest * 0.5));
  const ys: number[] = [];
  ls.forEach((_, i) => ys.push(i === 0 ? 0 : ys[i - 1]! + size * gap(i) * (i === ls.length - 1 ? big : 1)));
  const mid = (ys[ys.length - 1] ?? 0) / 2;
  const a11y = decorative ? { "aria-hidden": true as const } : { role: "img", "aria-label": `علبة هدية TPAC مكتوب عليها: ${shown}` };
  return (
    <div className={cn("relative overflow-hidden rounded-xl", className)} {...a11y}>
      {/* eslint-disable-next-line @next/next/no-img-element -- fixed local photo, the words are drawn over it */}
      <img src={p.src} width={p.w} height={p.h} alt="" className="block h-auto w-full" loading="lazy" decoding="async" />
      <svg viewBox={`0 0 ${p.w} ${p.h}`} className="absolute inset-0 size-full" aria-hidden="true">
        <g
          transform={`translate(${p.cx} ${p.cy}) matrix(${p.m.join(" ")} 0 0)`}
          fill="#211B15" fillOpacity={faded ? 0.32 : 0.9} fontFamily={font ?? "serif"} fontWeight={700}
          textAnchor="middle" direction="rtl" style={{ mixBlendMode: "multiply" }}
        >
          {ls.map((l, i) => {
            const fs = i === ls.length - 1 ? size * big : size;
            return <text key={i} x={0} y={ys[i]! - mid + fs * 0.35} fontSize={fs}>{l}</text>;
          })}
        </g>
      </svg>
    </div>
  );
}

/** Gift box with the customer's own words — optional, chosen by the customer, priced by the admin. */
export function GiftBoxPicker({ option, on, onToggle, text, setText, font }: {
  option: DesignerOptionRow;
  on: boolean;
  onToggle: () => void;
  text: string;
  setText: (v: string) => void;
  font?: string;
}) {
  const { locale } = useI18n();
  const t = adminT(locale);
  const [view, setView] = useState<BoxView>("angle");
  const words = on ? text : "";
  return (
    <div className="border-t border-line pt-6">
      <p className="step-label">{t("علبة هدية", "Gift box")} <span className="font-normal normal-case tracking-normal text-mute">({t("اختياري", "optional")})</span></p>
      <div className={cn("overflow-hidden rounded-[1.25rem] border transition", on ? "border-pine bg-pine-soft/40" : "border-line bg-paper")}>
        <button type="button" role="switch" aria-checked={on} onClick={onToggle} className="flex w-full items-center gap-3 p-4 text-start">
          <span className={cn("grid size-11 shrink-0 place-items-center rounded-xl", on ? "bg-pine text-white dark:text-night" : "bg-amber/15 text-amber-deep")}><Gift className="size-5" aria-hidden="true" /></span>
          <span className="min-w-0 flex-1">
            <span className="block text-[15px] font-bold">{locale === "ar" ? option.name_ar : option.name_en}<span className="ms-2 text-sm font-semibold text-mute">+{formatIQD(option.price, locale)}</span></span>
            <span className="block text-sm leading-snug text-mute">{t("علبة كرافت مربوطة بخيط جوت وورد مجفف، ونكتب على غطائها الكلام اللي تختاره.", "A kraft box tied with jute twine and dried flowers, with your own words on the lid.")}</span>
          </span>
          <span className={cn("grid size-7 shrink-0 place-items-center rounded-full border-2", on ? "border-pine bg-pine text-white dark:text-night" : "border-line")} aria-hidden="true">{on && <Check className="size-4" />}</span>
        </button>
        <div className="px-4 pb-4">
          <GiftBoxArt text={words} font={font} view={view} className="mx-auto w-full max-w-md rounded-2xl" />
          <div className="mt-2 grid grid-cols-3 gap-2" role="tablist" aria-label={t("زوايا العلبة", "Box views")}>
            {VIEWS.map(([v, ar, en]) => (
              <button
                key={v}
                type="button"
                role="tab"
                aria-selected={view === v}
                onClick={() => setView(v)}
                className={cn("flex flex-col items-center gap-1 rounded-xl border-2 p-1 text-xs font-semibold transition", view === v ? "border-pine text-pine" : "border-transparent text-mute hover:border-line")}
              >
                <GiftBoxArt text={words} font={font} view={v} decorative className="w-full rounded-lg" />
                {locale === "ar" ? ar : en}
              </button>
            ))}
          </div>
          {on && (
            <div className="mt-4 space-y-2">
              <label htmlFor="box-text" className="text-sm font-bold">{t("شنو نكتب على العلبة؟", "What should we write on the box?")}</label>
              <input
                id="box-text"
                className="field"
                dir="auto"
                maxLength={BOX_TEXT_MAX}
                value={text}
                onChange={(e) => setText(e.target.value)}
                placeholder={t(`مثلاً: ${SAMPLE}`, `e.g. ${SAMPLE}`)}
              />
              <div className="flex flex-wrap gap-2">
                {IDEAS.map((idea) => (
                  <button key={idea} type="button" onClick={() => setText(idea)} className={cn("min-h-10 rounded-full border px-3.5 text-sm transition", text === idea ? "border-pine bg-pine-soft text-pine" : "border-line bg-paper text-ink/80 hover:border-ink/30")}>{idea}</button>
                ))}
              </div>
              <p className="text-xs text-mute">{t(`لغاية ${BOX_TEXT_MAX} حرف، تنطبع بالأسود على غطاء العلبة. إذا تركتها فارغة نرسل العلبة بدون كتابة.`, `Up to ${BOX_TEXT_MAX} characters, printed in black on the lid. Leave it empty for a plain box.`)}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
