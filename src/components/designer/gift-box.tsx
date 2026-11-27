"use client";
import { useId, useState } from "react";
import { Check, Gift } from "lucide-react";
import { useI18n } from "@/components/i18n-provider";
import { adminT } from "@/lib/admin-i18n";
import { cn, formatIQD } from "@/lib/format";
import type { DesignerOptionRow } from "@/lib/types";

export const BOX_TEXT_MAX = 40;
const SAMPLE = "ليت العناق يُرسل";
const IDEAS = ["ليت العناق يُرسل", "إلى أجمل قلب", "كل عام وأنت بخير", "لك وحدك"];

export type BoxView = "angle" | "top" | "side";
const VIEWS: [BoxView, string, string][] = [["angle", "منظور", "Angle"], ["top", "من فوق", "Top"], ["side", "من الجنب", "Side"]];

/** The lid, in its own flat coordinates. */
const W = 380;
const H = 270;
const BOW = { x: 112, y: 212 }; // where the jute twine crosses and is tied

/** One word per line for short wishes (like the real box), otherwise up to three balanced lines. */
function lines(text: string): string[] {
  const words = text.trim().split(/\s+/).filter(Boolean);
  if (words.length <= 3) return words;
  const target = text.length / 3;
  const out: string[] = [];
  let cur = "";
  for (const w of words) {
    if (cur && (cur + " " + w).length > target * 1.15 && out.length < 2) { out.push(cur); cur = w; } else cur = cur ? `${cur} ${w}` : w;
  }
  out.push(cur);
  return out;
}

const KRAFT = { lid: ["#D6B98F", "#C7A577"], front: "#C09B6C", left: "#AE875A", rim: "#9F7B50" };
const TWINE = { dark: "#9C8056", light: "#D9C69C" };

function Twine({ d, w = 3 }: { d: string; w?: number }) {
  return (
    <>
      <path d={d} stroke={TWINE.dark} strokeWidth={w} fill="none" strokeLinecap="round" />
      <path d={d} stroke={TWINE.light} strokeWidth={w * 0.55} strokeDasharray="2.5 3" fill="none" strokeLinecap="round" />
    </>
  );
}

/** Jute bow with a sprig of dried flowers, centred on (x, y). */
function Bow({ x, y, s = 1 }: { x: number; y: number; s?: number }) {
  return (
    <g transform={`translate(${x} ${y}) scale(${s})`}>
      {/* dried sprig under the knot */}
      <g stroke="#7D7442" strokeWidth="1.6" fill="none" strokeLinecap="round">
        <path d="M2 -2 Q 30 -22 64 -50" />
        <path d="M22 -15 l 8 -16 M36 -25 l 14 -6 M44 -33 l 2 -16 M54 -41 l 12 -2 M14 -9 l 4 -14" />
      </g>
      <g fill="#B9A35E">
        {[[30, -31], [50, -31], [46, -49], [66, -43], [18, -23], [64, -52], [26, -24], [57, -45], [40, -27]].map(([cx, cy], i) => <circle key={i} cx={cx} cy={cy} r={i % 3 === 0 ? 2.6 : 1.9} />)}
      </g>
      <g fill="#8E8A4F" opacity=".8">
        {[[34, -34], [48, -46], [61, -40], [22, -18]].map(([cx, cy], i) => <circle key={i} cx={cx} cy={cy} r={1.5} />)}
      </g>
      {/* loops and tails */}
      <Twine d="M0 0 C -26 -34 -66 -24 -52 2 C -44 16 -18 10 0 0" w={2.8} />
      <Twine d="M0 0 C 16 26 4 46 -22 44 C -38 40 -26 18 0 0" w={2.8} />
      <Twine d="M0 0 Q -16 16 -58 22" w={2.6} />
      <Twine d="M0 0 Q 18 22 26 48" w={2.6} />
      <circle r="5" fill={TWINE.dark} />
      <circle r="2.6" fill={TWINE.light} />
    </g>
  );
}

/** Everything printed or tied on the lid, drawn flat (0..W × 0..H). */
function Lid({ ids, text, faded, font }: { ids: { kraft: string; fibre: string }; text: string; faded: boolean; font?: string }) {
  const ls = lines(text);
  const longest = Math.max(1, ...ls.map((l) => l.length));
  // room for the marks above the letters (ضمة، شدة…) between the lines
  const size = Math.max(18, Math.min(44, Math.round(270 / longest), Math.round(172 / (ls.length * 1.42))));
  const lead = size * 1.42;
  return (
    <g>
      <rect width={W} height={H} rx="6" fill={`url(#${ids.kraft})`} />
      <rect width={W} height={H} rx="6" fill={`url(#${ids.fibre})`} />
      {/* the customer's words, top corner like the real box */}
      <g fill="#1B1712" opacity={faded ? 0.3 : 1} fontFamily={font ?? "serif"} fontWeight={700} fontSize={size} textAnchor="middle" direction="rtl">
        {ls.map((l, i) => <text key={i} x={272} y={24 + size * 1.05 + i * lead}>{l}</text>)}
      </g>
      {/* jute twine around the box, tied in a bow */}
      <Twine d={`M${BOW.x} 0 V ${H}`} />
      <Twine d={`M0 ${BOW.y} H ${W}`} />
      <Bow x={BOW.x} y={BOW.y} s={1.1} />
    </g>
  );
}

function Defs({ ids }: { ids: { kraft: string; fibre: string } }) {
  return (
    <defs>
      <linearGradient id={ids.kraft} x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stopColor={KRAFT.lid[0]} />
        <stop offset="1" stopColor={KRAFT.lid[1]} />
      </linearGradient>
      {/* irregular kraft fibres */}
      <pattern id={ids.fibre} width="23" height="19" patternUnits="userSpaceOnUse">
        <circle cx="2" cy="3" r=".6" fill="#8F6E45" opacity=".22" />
        <circle cx="13" cy="8" r=".5" fill="#8F6E45" opacity=".18" />
        <circle cx="19" cy="15" r=".7" fill="#8F6E45" opacity=".15" />
        <circle cx="7" cy="14" r=".5" fill="#F3E6CF" opacity=".35" />
        <circle cx="17" cy="2.5" r=".45" fill="#F3E6CF" opacity=".3" />
        <path d="M4 9 l3 1" stroke="#8F6E45" strokeOpacity=".14" strokeWidth=".5" />
        <path d="M14 13 l2.5 -1.5" stroke="#F3E6CF" strokeOpacity=".3" strokeWidth=".5" />
      </pattern>
    </defs>
  );
}

/**
 * The TPAC kraft gift box, drawn from three sides, with the customer's words on the lid.
 * Angle = a 3/4 view showing the lid, the front and one side.
 */
export function GiftBoxArt({ text, font, view = "angle", className, decorative = false }: { text: string; font?: string; view?: BoxView; className?: string; decorative?: boolean }) {
  const uid = useId().replace(/[^a-zA-Z0-9]/g, "");
  const ids = { kraft: `k${uid}`, fibre: `f${uid}` };
  const shown = text.trim() || SAMPLE;
  const faded = !text.trim();
  const a11y = decorative ? { "aria-hidden": true as const } : { role: "img", "aria-label": `علبة هدية TPAC مكتوب عليها: ${shown}` };

  if (view === "top") {
    return (
      <svg viewBox="0 0 420 320" className={className} {...a11y}>
        <Defs ids={ids} />
        <ellipse cx="210" cy="300" rx="185" ry="9" fill="#000" opacity=".1" />
        <g transform="translate(20 20)"><Lid ids={ids} text={shown} faded={faded} font={font} /></g>
        <rect x="20" y="20" width={W} height={H} rx="6" fill="none" stroke="#000" strokeOpacity=".1" />
      </svg>
    );
  }

  if (view === "side") {
    const top = 120;
    const h = 120;
    const tx = 20 + BOW.x;
    return (
      <svg viewBox="0 0 420 320" className={className} {...a11y}>
        <Defs ids={ids} />
        <ellipse cx="210" cy={top + h + 16} rx="190" ry="9" fill="#000" opacity=".12" />
        <rect x="20" y={top} width={W} height={h} fill={KRAFT.front} />
        <rect x="20" y={top} width={W} height={h} fill={`url(#${ids.fibre})`} />
        <rect x="20" y={top} width={W} height="20" fill={KRAFT.rim} opacity=".45" />
        <line x1="20" x2={20 + W} y1={top + 20} y2={top + 20} stroke="#000" strokeOpacity=".15" />
        <image href="/brand/tpac-logo-black.png" x="300" y={top + 48} width="80" height="40" preserveAspectRatio="xMidYMid meet" opacity=".85" />
        <Twine d={`M${tx} ${top} V ${top + h}`} />
        {/* the bow and its sprig rise above the lid edge */}
        <Bow x={tx} y={top - 4} s={0.8} />
        <rect x="20" y={top} width={W} height={h} fill="none" stroke="#000" strokeOpacity=".12" />
      </svg>
    );
  }

  // 3/4 view: the flat lid is mapped onto the top face, then the front and left faces drop below it
  const A = { x: 18, y: 112 }; // lid corner (0, 0)
  const u = { x: 250 / W, y: -84 / W }; // along the lid's width
  const v = { x: 132 / H, y: 102 / H }; // along the lid's depth
  const at = (x: number, y: number) => ({ x: A.x + x * u.x + y * v.x, y: A.y + x * u.y + y * v.y });
  const depth = 74;
  const D = at(0, H);
  const B = at(W, 0);
  const C = at(W, H);
  const down = (p: { x: number; y: number }, d = depth) => `${p.x} ${p.y + d}`;
  const tw1 = at(BOW.x, H); // twine running down the front
  const tw2 = at(0, BOW.y); // twine running down the left side
  void B;
  return (
    <svg viewBox="0 0 420 320" className={className} {...a11y}>
      <Defs ids={ids} />
      <ellipse cx="225" cy="296" rx="175" ry="12" fill="#000" opacity=".12" />
      {/* left side */}
      <path d={`M${A.x} ${A.y} L${D.x} ${D.y} L${down(D)} L${down(A)} Z`} fill={KRAFT.left} />
      {/* front */}
      <path d={`M${D.x} ${D.y} L${C.x} ${C.y} L${down(C)} L${down(D)} Z`} fill={KRAFT.front} />
      <path d={`M${D.x} ${D.y} L${C.x} ${C.y} L${down(C)} L${down(D)} Z`} fill={`url(#${ids.fibre})`} />
      {/* lid rim */}
      <path d={`M${A.x} ${A.y} L${D.x} ${D.y} L${C.x} ${C.y} L${C.x} ${C.y + 16} L${D.x} ${D.y + 16} L${A.x} ${A.y + 16} Z`} fill={KRAFT.rim} opacity=".4" />
      <path d={`M${A.x} ${A.y + 16} L${D.x} ${D.y + 16} L${C.x} ${C.y + 16}`} stroke="#000" strokeOpacity=".14" fill="none" />
      <path d={`M${D.x} ${D.y} L${down(D)}`} stroke="#000" strokeOpacity=".12" />
      <Twine d={`M${tw1.x} ${tw1.y} L${down(tw1)}`} />
      <Twine d={`M${tw2.x} ${tw2.y} L${down(tw2)}`} />
      {/* lid */}
      <g transform={`matrix(${u.x} ${u.y} ${v.x} ${v.y} ${A.x} ${A.y})`}>
        <Lid ids={ids} text={shown} faded={faded} font={font} />
      </g>
    </svg>
  );
}

/** Gift box with the customer's own words — optional, chosen by the customer, priced by the admin. */
export type GiftOption = Pick<DesignerOptionRow, "name_ar" | "name_en" | "price">;

export function GiftBoxPicker({ option, on, onToggle, text, setText, font }: {
  option: GiftOption;
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
          <div className="rounded-2xl bg-[#EFEAE1] p-3 dark:bg-white/5">
            <GiftBoxArt text={words} font={font} view={view} className="mx-auto w-full max-w-md" />
          </div>
          <div className="mt-2 grid grid-cols-3 gap-2" role="tablist" aria-label={t("زوايا العلبة", "Box views")}>
            {VIEWS.map(([v, ar, en]) => (
              <button
                key={v}
                type="button"
                role="tab"
                aria-selected={view === v}
                onClick={() => setView(v)}
                className={cn("flex flex-col items-center gap-1 rounded-xl border bg-[#EFEAE1] p-1.5 text-xs font-semibold transition dark:bg-white/5", view === v ? "border-pine text-pine" : "border-transparent text-mute hover:border-line")}
              >
                <GiftBoxArt text={words} font={font} view={v} decorative className="w-full" />
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
