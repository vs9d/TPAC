"use client";
import { Check, Gift } from "lucide-react";
import { useI18n } from "@/components/i18n-provider";
import { adminT } from "@/lib/admin-i18n";
import { cn, formatIQD } from "@/lib/format";
import type { DesignerOptionRow } from "@/lib/types";

export const BOX_TEXT_MAX = 40;
const SAMPLE = "ليت العتاب يُرسل";
const IDEAS = ["ليت العتاب يُرسل", "إلى أجمل قلب", "كل عام وأنت بخير", "لك وحدك"];

/** Splits the customer's words into at most two balanced lines for the lid. */
function lines(text: string): string[] {
  const words = text.trim().split(/\s+/).filter(Boolean);
  if (words.length < 2 || text.length <= 9) return [text.trim()];
  let best = 1;
  let gap = Infinity;
  for (let i = 1; i < words.length; i++) {
    const d = Math.abs(words.slice(0, i).join(" ").length - words.slice(i).join(" ").length);
    if (d < gap) { gap = d; best = i; }
  }
  return [words.slice(0, best).join(" "), words.slice(best).join(" ")];
}

/** A kraft gift box seen from above: TPAC band on one side, the customer's words on the lid. */
export function GiftBoxArt({ text, font, className }: { text: string; font?: string; className?: string }) {
  const shown = text.trim() || SAMPLE;
  const ls = lines(shown);
  const longest = Math.max(...ls.map((l) => l.length));
  // as large as the lid allows (about 190 px of room beside the band)
  const size = Math.max(20, Math.min(54, Math.round(340 / Math.max(5, longest))));
  const lineH = size * 1.25;
  const y0 = 150 - ((ls.length - 1) * lineH) / 2;
  return (
    <svg viewBox="0 0 420 300" className={className} role="img" aria-label={`علبة هدية TPAC مكتوب عليها: ${shown}`}>
      <defs>
        <linearGradient id="kraft" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#D2B288" />
          <stop offset="1" stopColor="#BE9A6B" />
        </linearGradient>
        <pattern id="fibre" width="7" height="7" patternUnits="userSpaceOnUse">
          <circle cx="1.5" cy="2" r=".55" fill="#9C7B4F" opacity=".35" />
          <circle cx="5" cy="5.5" r=".45" fill="#F1E3CC" opacity=".5" />
        </pattern>
        <pattern id="tri" width="12" height="10" patternUnits="userSpaceOnUse">
          <path d="M0 10 L6 0 L12 10 Z" fill="#1C1C1C" />
        </pattern>
        <clipPath id="lid"><rect x="20" y="24" width="380" height="246" rx="10" /></clipPath>
      </defs>
      <ellipse cx="210" cy="282" rx="190" ry="10" fill="#000" opacity=".12" />
      <rect x="20" y="24" width="380" height="246" rx="10" fill="url(#kraft)" />
      <g clipPath="url(#lid)">
        <rect x="20" y="24" width="380" height="246" fill="url(#fibre)" />
        {/* lid edge */}
        <rect x="20" y="254" width="380" height="16" fill="#A9855A" opacity=".55" />
        {/* paper band with the TPAC mark */}
        <rect x="44" y="24" width="112" height="246" fill="#F7F5F0" />
        <rect x="44" y="214" width="112" height="56" fill="url(#tri)" opacity=".85" />
        <rect x="44" y="200" width="112" height="14" fill="url(#tri)" opacity=".35" />
        <image href="/brand/tpac-logo-black.png" x="58" y="62" width="84" height="54" preserveAspectRatio="xMidYMid meet" />
        <text x="100" y="134" textAnchor="middle" fontSize="7.2" fill="#2A2A2A" fontFamily="system-ui, sans-serif" letterSpacing=".6" direction="ltr">WHAT MAKES YOU DIFFERENT,</text>
        <text x="100" y="144" textAnchor="middle" fontSize="7.2" fill="#2A2A2A" fontFamily="system-ui, sans-serif" letterSpacing=".6" direction="ltr">MAKES YOU BEAUTIFUL</text>
        <text x="100" y="164" textAnchor="middle" fontSize="9.5" fill="#2A2A2A" direction="rtl" fontFamily={font ?? "serif"}>ما يجعلك مختلفاً، يجعلك جميلاً</text>
        {/* jute twine */}
        <line x1="178" y1="24" x2="178" y2="270" stroke="#7E6A45" strokeWidth="3.2" />
        <line x1="178" y1="24" x2="178" y2="270" stroke="#C9B58A" strokeWidth="3.2" strokeDasharray="3 4" />
        <path d="M178 250 q-14 6 -10 18 M178 250 q12 8 6 20" stroke="#7E6A45" strokeWidth="2.4" fill="none" strokeLinecap="round" />
      </g>
      {/* the customer's words */}
      <g fill="#141414" opacity={text.trim() ? 1 : 0.28} fontFamily={font ?? "serif"} fontWeight={700} fontSize={size} textAnchor="middle" direction="rtl">
        {ls.map((l, i) => <text key={i} x="292" y={y0 + i * lineH + size * 0.35}>{l}</text>)}
      </g>
      <rect x="20" y="24" width="380" height="246" rx="10" fill="none" stroke="#000" strokeOpacity=".08" />
    </svg>
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
  return (
    <div className="border-t border-line pt-6">
      <p className="step-label">{t("علبة هدية", "Gift box")} <span className="font-normal normal-case tracking-normal text-mute">({t("اختياري", "optional")})</span></p>
      <div className={cn("overflow-hidden rounded-[1.25rem] border transition", on ? "border-pine bg-pine-soft/40" : "border-line bg-paper")}>
        <button type="button" role="switch" aria-checked={on} onClick={onToggle} className="flex w-full items-center gap-3 p-4 text-start">
          <span className={cn("grid size-11 shrink-0 place-items-center rounded-xl", on ? "bg-pine text-white dark:text-night" : "bg-amber/15 text-amber-deep")}><Gift className="size-5" aria-hidden="true" /></span>
          <span className="min-w-0 flex-1">
            <span className="block text-[15px] font-bold">{locale === "ar" ? option.name_ar : option.name_en}<span className="ms-2 text-sm font-semibold text-mute">+{formatIQD(option.price, locale)}</span></span>
            <span className="block text-sm leading-snug text-mute">{t("علبة كرافت بشريط TPAC، ونكتب عليها الكلام اللي تختاره.", "A kraft box with the TPAC band, with your own words on the lid.")}</span>
          </span>
          <span className={cn("grid size-7 shrink-0 place-items-center rounded-full border-2", on ? "border-pine bg-pine text-white dark:text-night" : "border-line")} aria-hidden="true">{on && <Check className="size-4" />}</span>
        </button>
        <div className="px-4 pb-4">
          <GiftBoxArt text={on ? text : ""} font={font} className="mx-auto w-full max-w-sm drop-shadow-sm" />
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
              <p className="text-xs text-mute">{t(`لغاية ${BOX_TEXT_MAX} حرف. تنطبع بخط عربي أسود على غطاء العلبة. إذا تركتها فارغة نرسل العلبة بدون كتابة.`, `Up to ${BOX_TEXT_MAX} characters, printed in black Arabic calligraphy on the lid. Leave it empty for a plain box.`)}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
