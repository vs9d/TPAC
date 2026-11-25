"use client";
import { useMemo, useState } from "react";
import { ArrowDown, ArrowUp, Check, ChevronDown, Copy, Eye, EyeOff, HeartHandshake, Image as ImageIcon, Layers, Lightbulb, Loader2, Lock, LockOpen, Minus, Plus, Ruler, Shapes, Sparkles, Trash2, Type as TypeIcon, Upload } from "lucide-react";
import { useI18n } from "@/components/i18n-provider";
import { adminT } from "@/lib/admin-i18n";
import { GARMENTS, type GarmentType, type PrintLocation } from "@/lib/garments";
import { SHAPES, TEMPLATES, TEXT_PRESETS_UI, type DesignerFont } from "@/lib/design-assets";
import { nextTier, placementCharges } from "@/lib/design-pricing";
import { SizeGuideTable } from "@/components/product/size-guide";
import { formatIQD, cn } from "@/lib/format";
import type { Color, DesignerOptionRow, DesignerSettings, DesignerTierRow, GarmentTypeRow, PrintLocationRow } from "@/lib/types";
import type { Choice, DesignerApi, LayerInfo, TabId } from "./types";

/* ============================================================================ creative space */

const shapeGroups = { love: ["حب ومرتبطين", "Love"], cute: ["لطيفة", "Cute"], codes: ["باركود و QR", "Barcode & QR"], basic: ["أساسية", "Basic"], stars: ["نجوم", "Stars"], symbols: ["رموز", "Symbols"], lines: ["خطوط وإطارات", "Lines & frames"] } as const;

export function CreativeSpace({ tab, setTab, api, ready, uploading, openUpload, fonts, location, locationLabel, layers, selectedId, garmentLocations, textRef, onClear }: {
  tab: TabId; setTab: (t: TabId) => void; api: DesignerApi; ready: boolean; uploading: boolean; openUpload: () => void;
  fonts: DesignerFont[]; location: PrintLocation; locationLabel: string; layers: LayerInfo[]; selectedId?: string;
  garmentLocations: string[]; textRef: React.RefObject<HTMLInputElement | null>; onClear: () => void;
}) {
  const { locale } = useI18n();
  const t = adminT(locale);
  const [word, setWord] = useState("");
  const [group, setGroup] = useState<keyof typeof shapeGroups>("love");
  const [code, setCode] = useState("");
  const [making, setMaking] = useState(false);
  const makeCode = async (kind: "barcode" | "qr") => {
    setMaking(true);
    try { await api.addCode(kind, code); } finally { setMaking(false); }
  };
  const [layersOpen, setLayersOpen] = useState(false);
  const here = layers.filter((l) => l.location === location);
  const tabs: [TabId, string, React.ReactNode][] = [
    ["image", t("صورة", "Image"), <ImageIcon key="i" className="size-6" />],
    ["text", t("نصوص", "Text"), <TypeIcon key="t" className="size-6" />],
    ["shapes", t("أشكال", "Shapes"), <Shapes key="s" className="size-6" />],
    ["ideas", t("إلهام", "Ideas"), <Lightbulb key="l" className="size-6" />],
  ];
  const presets = TEXT_PRESETS_UI.filter((p) => (locale === "ar" ? true : !["kufi", "ruqaa", "lalezar"].includes(p.id)));
  const fontOf = (name: string) => fonts.find((f) => f.label === name)?.family;
  const add = () => {
    api.addText(undefined, word || undefined);
    setWord("");
  };

  return (
    <section className="studio-card" aria-labelledby="creative-title">
      <header className="flex items-center justify-between px-5 pt-5 sm:px-7">
        <h2 id="creative-title" className="display text-xl sm:text-2xl">{t("مساحة الإبداع", "Creative space")}</h2>
        <Sparkles className="size-6 text-mute" aria-hidden />
      </header>
      <div className="mx-5 mt-4 grid grid-cols-4 border-y border-line sm:mx-7" role="tablist" aria-label={t("أدوات التصميم", "Design tools")}>
        {tabs.map(([id, label, icon]) => (
          <button key={id} role="tab" aria-selected={tab === id} onClick={() => setTab(id)} className={cn("relative flex flex-col items-center gap-1.5 py-4 text-sm font-semibold transition-colors", tab === id ? "text-pine" : "text-ink/70 hover:text-ink")}>
            {icon}
            {label}
            <span className={cn("absolute inset-x-3 -bottom-px h-[3px] rounded-full bg-pine transition-transform duration-300", tab === id ? "scale-x-100" : "scale-x-0")} aria-hidden />
          </button>
        ))}
      </div>

      <div className="px-5 py-6 sm:px-7" role="tabpanel">
        {tab === "image" && (
          <div className="space-y-5">
            <div>
              <h3 className="text-lg font-bold">{t("ابدأ بصورتك", "Start with your image")}</h3>
              <p className="mt-1 text-sm text-mute">{t("شعار، رسمة، أو صورة تحبها. ارفعها وحرّكها على القطعة مثل ما تريد.", "A logo, a drawing or a photo you love. Upload it and place it however you like.")}</p>
            </div>
            <div className={cn("grid place-items-center gap-2 rounded-[1.25rem] border-2 border-dashed border-line bg-bone/50 px-6 py-8 text-center", (!ready || uploading) && "opacity-60")}>
              {uploading ? <Loader2 className="size-9 animate-spin text-pine" /> : <Upload className="size-9 text-ink/70" strokeWidth={1.6} />}
              <p className="text-base font-bold">{uploading ? t("جاري الرفع…", "Uploading…") : t("ارفع تصميمك", "Upload your design")}</p>
              <p className="text-xs text-mute" dir="ltr">PNG, JPG, WEBP, SVG · 15 MB</p>
              <button type="button" onClick={openUpload} disabled={!ready || uploading} className="mt-1 rounded-xl border border-line bg-paper px-6 py-2.5 text-sm font-semibold shadow-sm transition hover:border-pine">
                {t("اختيار صورة", "Choose image")} +
              </button>
            </div>
            <p className="rounded-[1rem] bg-bone px-5 py-4 text-sm leading-relaxed text-mute">
              {t("حتى تطلع الطباعة واضحة، استخدم صورة بدقة عالية، والأفضل PNG بخلفية شفافة. بعد الرفع تگدر تحوّلها أبيض وأسود أو تعكس ألوانها.", "For a crisp print use a high-resolution image — ideally a transparent PNG. After uploading you can make it black & white or invert it.")}
            </p>
          </div>
        )}

        {tab === "text" && (
          <div className="space-y-5">
            <div>
              <h3 className="text-lg font-bold">{t("اكتب كلمتك", "Write your words")}</h3>
              <p className="mt-1 text-sm text-mute">{t("اسم، عبارة، تاريخ أو رقم — بالعربي أو الإنجليزي.", "A name, a phrase, a date or a number — Arabic or English.")}</p>
            </div>
            <form className="flex gap-2" onSubmit={(e) => { e.preventDefault(); add(); }}>
              <input ref={textRef} className="field h-12 flex-1" dir="auto" maxLength={200} value={word} onChange={(e) => setWord(e.target.value)} placeholder={t("مثال: بغداد ٢٠٢٦", "e.g. BAGHDAD 2026")} aria-label={t("النص", "Text")} />
              <button type="submit" disabled={!ready} className="btn btn-brand h-12 px-5"><Plus className="size-4" /> {t("أضف", "Add")}</button>
            </form>
            <div>
              <p className="mb-2 text-xs font-semibold text-mute">{t("اختر شكل الخط", "Pick a look")}</p>
              <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
                {presets.map((p) => (
                  <button key={p.id} type="button" disabled={!ready} onClick={() => { api.addText(p.id, word || undefined); setWord(""); }} className="group grid h-20 place-items-center rounded-2xl border border-line bg-paper px-2 transition hover:border-pine hover:bg-pine-soft">
                    <span className="truncate text-xl leading-none" style={{ fontFamily: fontOf(p.font), fontWeight: p.weight, letterSpacing: p.charSpacing ? `${p.charSpacing / 1000}em` : undefined, WebkitTextStroke: p.fill === null ? "1px currentColor" : undefined, color: p.fill === null ? "transparent" : undefined }}>
                      {p.upper || locale === "en" ? "Aa" : "أبج"}
                    </span>
                    <span className="text-[11px] font-semibold text-mute">{locale === "ar" ? p.ar : p.en}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {tab === "shapes" && (
          <div className="space-y-4">
            <div>
              <h3 className="text-lg font-bold">{t("أشكال ورموز", "Shapes & symbols")}</h3>
              <p className="mt-1 text-sm text-mute">{t("اضغط على أي شكل وغيّر لونه وحجمه بعدها.", "Tap a shape, then change its colour and size.")}</p>
            </div>
            <div className="flex gap-1.5 overflow-x-auto pb-1">
              {(Object.keys(shapeGroups) as (keyof typeof shapeGroups)[]).map((g) => (
                <button key={g} aria-pressed={group === g} onClick={() => setGroup(g)} className="chip h-9 shrink-0 px-4 text-xs">{shapeGroups[g][locale === "ar" ? 0 : 1]}</button>
              ))}
            </div>
            {group === "codes" ? (
              <div className="space-y-3 rounded-2xl border border-line p-4">
                <p className="text-sm text-mute">{t("اكتب تاريخ، اسم، رقم، أو رابط (مثلاً حساب إنستغرام أو أغنيتكم) ونحوّله لباركود أو QR ينطبع.", "Type a date, a name, a number or a link (an Instagram account, your song…) and we turn it into a printable barcode or QR code.")}</p>
                <input value={code} onChange={(e) => setCode(e.target.value)} maxLength={300} dir="auto" placeholder={t("مثلاً: 20.09.2020 أو instagram.com/…", "e.g. 20.09.2020 or instagram.com/…")} aria-label={t("نص الباركود", "Barcode text")} className="field h-12" />
                <div className="grid grid-cols-2 gap-2">
                  <button type="button" disabled={!ready || !code.trim() || making || uploading} onClick={() => makeCode("barcode")} className="btn btn-outline h-12">{making ? <Loader2 className="size-4 animate-spin" /> : <span className="font-mono text-base leading-none tracking-[-.18em]" aria-hidden>║▌║█║</span>} {t("باركود", "Barcode")}</button>
                  <button type="button" disabled={!ready || !code.trim() || making || uploading} onClick={() => makeCode("qr")} className="btn btn-outline h-12">{making ? <Loader2 className="size-4 animate-spin" /> : <span className="font-mono text-base leading-none" aria-hidden>▣</span>} {t("رمز QR", "QR code")}</button>
                </div>
                <p className="text-[11px] text-mute">{t("الباركود يقبل الأحرف الإنجليزية والأرقام. الـ QR يقبل أي نص أو رابط، والكاميرا تقراه.", "Barcodes take English letters and digits. QR codes take any text or link and phones can scan them.")}</p>
              </div>
            ) : (
            <div className="grid grid-cols-4 gap-2 sm:grid-cols-6">
              {SHAPES.filter((s) => s.group === group).map((s) => (
                <button key={s.id} disabled={!ready} onClick={() => api.addShape(s.id)} title={locale === "ar" ? s.ar : s.en} aria-label={locale === "ar" ? s.ar : s.en} className="grid aspect-square place-items-center rounded-2xl border border-line bg-paper p-3.5 transition hover:border-pine hover:bg-pine-soft">
                  <svg viewBox="0 0 100 100" className="size-full text-ink" aria-hidden><path d={s.path} fill="currentColor" fillRule={s.evenodd ? "evenodd" : "nonzero"} /></svg>
                </button>
              ))}
            </div>
            )}
          </div>
        )}

        {tab === "ideas" && (
          <div className="space-y-4">
            <div>
              <h3 className="text-lg font-bold">{t("أفكار جاهزة", "Ready ideas")}</h3>
              <p className="mt-1 text-sm text-mute">{t("اختر فكرة وبعدها عدّل الكلام مثل ما تحب.", "Pick an idea, then change the words to your own.")}</p>
            </div>
            {([
              ["couple", t("للمرتبطين 💞 — قطعتين سوة", "For couples 💞 — two pieces at once")],
              ["gift", t("هدايا وكلمات وتواريخ", "Gifts, words & dates")],
              ["", t("أفكار عامة", "General ideas")],
            ] as const).map(([g, title]) => {
              const list = TEMPLATES.filter((tp) => (tp.group ?? "") === g && [...tp.items, ...(tp.pair ?? [])].some((i) => garmentLocations.includes(i.location)));
              if (!list.length) return null;
              return (
                <div key={g || "general"} className="space-y-2">
                  <p className="text-sm font-bold">{title}</p>
                  <div className="grid gap-2 sm:grid-cols-2">
                    {list.map((tp) => (
                      <button key={tp.id} disabled={!ready} onClick={() => api.applyTemplate(tp.id)} className="flex items-center gap-3 rounded-2xl border border-line bg-paper p-4 text-start transition hover:border-pine hover:bg-pine-soft">
                        <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-pine-soft text-pine">{tp.pair ? <HeartHandshake className="size-5" /> : <Sparkles className="size-5" />}</span>
                        <span><span className="block text-sm font-bold">{locale === "ar" ? tp.ar : tp.en}</span><span className="block text-xs text-mute" dir="auto">{locale === "ar" ? tp.hint_ar : tp.hint_en}</span></span>
                      </button>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* elements on the current placement */}
      <div className="border-t border-line px-5 sm:px-7">
        <button type="button" onClick={() => setLayersOpen((o) => !o)} aria-expanded={layersOpen} className="flex w-full items-center justify-between py-4 text-sm text-mute">
          <span className="flex items-center gap-2.5"><Layers className="size-5" /> {t("عناصر", "Elements on")} {locationLabel} · {here.length}</span>
          {layers.length > 0 && <ChevronDown className={cn("size-4 transition-transform", layersOpen && "rotate-180")} />}
        </button>
        {layersOpen && layers.length > 0 && (
          <div className="space-y-1.5 pb-4">
            {[...layers].reverse().map((l, i, list) => (
              <div key={l.id} className={cn("flex items-center gap-1 rounded-2xl border px-2 py-1.5", selectedId === l.id ? "border-pine bg-pine-soft" : "border-line", l.hidden && "opacity-55")}>
                <button onClick={() => api.selectLayer(l.id)} className="flex min-w-0 flex-1 items-center gap-2 px-1 py-1 text-start">
                  <span className="grid size-7 shrink-0 place-items-center rounded-lg bg-bone text-mute">{l.kind === "text" ? <TypeIcon className="size-3.5" /> : l.kind === "shape" ? <Shapes className="size-3.5" /> : <ImageIcon className="size-3.5" />}</span>
                  <span className="min-w-0"><span className="block truncate text-sm font-semibold" dir="auto">{l.label}</span></span>
                </button>
                <Mini label={t("للأمام", "Forward")} disabled={i === 0} onClick={() => api.layerAction(l.id, "up")}><ArrowUp className="size-3.5" /></Mini>
                <Mini label={t("للخلف", "Back")} disabled={i === list.length - 1} onClick={() => api.layerAction(l.id, "down")}><ArrowDown className="size-3.5" /></Mini>
                <Mini label={l.hidden ? t("إظهار", "Show") : t("إخفاء", "Hide")} onClick={() => api.layerAction(l.id, "hide")}>{l.hidden ? <EyeOff className="size-3.5" /> : <Eye className="size-3.5" />}</Mini>
                <Mini label={l.locked ? t("فك القفل", "Unlock") : t("قفل", "Lock")} onClick={() => api.layerAction(l.id, "lock")}>{l.locked ? <Lock className="size-3.5" /> : <LockOpen className="size-3.5" />}</Mini>
                <Mini label={t("نسخ", "Duplicate")} onClick={() => api.layerAction(l.id, "duplicate")}><Copy className="size-3.5" /></Mini>
                <Mini label={t("حذف", "Delete")} onClick={() => api.layerAction(l.id, "delete")} danger><Trash2 className="size-3.5" /></Mini>
              </div>
            ))}
            <button type="button" onClick={onClear} className="pt-1 text-xs font-semibold text-danger underline">{t("مسح كل التصميم", "Clear the whole design")}</button>
          </div>
        )}
      </div>
    </section>
  );
}

function Mini({ children, label, onClick, disabled, danger }: { children: React.ReactNode; label: string; onClick: () => void; disabled?: boolean; danger?: boolean }) {
  return <button type="button" title={label} aria-label={label} disabled={disabled} onClick={onClick} className={cn("grid size-8 shrink-0 place-items-center rounded-full text-mute transition hover:bg-paper hover:text-ink disabled:opacity-30", danger && "hover:text-danger")}>{children}</button>;
}

/* ============================================================================ the piece */

const FIT: Record<string, string> = { tshirt: "REGULAR FIT", oversized: "OVERSIZED FIT", hoodie: "HEAVY FLEECE", sweatshirt: "CREWNECK", longsleeve: "LONG SLEEVE" };
/** rough height / weight fit per size, for the hint under the size grid */
const FITS_LIKE: Record<string, [string, string]> = { XS: ["155-162", "45-55"], S: ["160-168", "55-65"], M: ["165-173", "62-72"], L: ["170-178", "70-80"], XL: ["175-183", "78-90"], XXL: ["180-188", "88-100"], "3XL": ["185-193", "98-112"] };
const groupTitle: Record<string, [string, string]> = { method: ["طريقة الطباعة", "Print method"], finish: ["اللمسة النهائية", "Finish"], fabric: ["الخامة", "Fabric"], package: ["التغليف", "Packaging"], addon: ["إضافات", "Extras"] };

export function PieceCard({ garments, garmentCode, setGarmentCode, colors, colorId, setColorId, sizes, setSizes, locations, used, options, choice, setChoice, tiers, totalQty, pct, unit, unitAfter, settings, rush, notes, setNotes, designName, setDesignName, sectionRef }: {
  garments: GarmentTypeRow[]; garmentCode: string; setGarmentCode: (c: GarmentTypeRow["code"]) => void;
  colors: Color[]; colorId: string; setColorId: (id: string) => void;
  sizes: Record<string, number>; setSizes: (s: Record<string, number>) => void;
  locations: PrintLocationRow[]; used: PrintLocation[];
  options: DesignerOptionRow[]; choice: Choice; setChoice: (c: Choice) => void;
  tiers: DesignerTierRow[]; totalQty: number; pct: number; unit: number; unitAfter: number; settings: DesignerSettings; rush: boolean;
  notes: string; setNotes: (s: string) => void; designName: string; setDesignName: (s: string) => void;
  sectionRef: React.RefObject<HTMLElement | null>;
}) {
  const { locale, dict } = useI18n();
  const t = adminT(locale);
  const garment = garments.find((g) => g.code === garmentCode)!;
  const [multi, setMulti] = useState(Object.keys(sizes).length > 1);
  const [guide, setGuide] = useState(false);
  const picked = Object.entries(sizes).filter(([, q]) => q > 0);
  const single = picked[0]?.[0] ?? "";
  const singleQty = picked[0]?.[1] ?? 1;
  const nt = nextTier(tiers, totalQty);
  const groups = useMemo(() => (["method", "finish", "fabric", "package", "addon"] as const).filter((g) => options.some((o) => o.group_code === g)), [options]);
  const extraPicked = options.filter((o) => o.price > 0 && (o.group_code === "addon" ? choice.addons.includes(o.code) : choice[o.group_code as "method"] === o.code));
  const name = (o: DesignerOptionRow) => (locale === "ar" ? o.name_ar : o.name_en);
  const fits = FITS_LIKE[single];
  const locPrice = (code: string) => locations.find((l) => l.code === code)?.price ?? 0;
  const charges = placementCharges(used, locPrice);

  return (
    <section ref={sectionRef} className="studio-card scroll-mt-24" aria-labelledby="piece-title">
      <header className="flex items-center justify-between px-5 pt-5 sm:px-7">
        <h2 id="piece-title" className="display text-xl sm:text-2xl">{t("قطعتك، بطريقتك", "Your piece, your way")}</h2>
        <svg viewBox="0 0 600 700" className="size-7 text-ink" aria-hidden><path d={GARMENTS.tshirt.body.front} fill="none" stroke="currentColor" strokeWidth="34" strokeLinejoin="round" /></svg>
      </header>
      <div className="mx-5 mt-4 border-t border-line sm:mx-7" />

      <div className="space-y-8 px-5 py-6 sm:px-7">
        {/* 01 — garment */}
        <div>
          <p className="step-label">01 / {t("نوع القطعة", "Garment")}</p>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {garments.map((g) => {
              const on = g.code === garmentCode;
              return (
                <button key={g.code} aria-pressed={on} onClick={() => setGarmentCode(g.code)} className={cn("relative flex flex-col items-center gap-2 rounded-[1.25rem] border px-3 pb-4 pt-5 transition", on ? "border-pine bg-pine-soft/60 text-pine" : "border-line bg-paper hover:border-ink/30")}>
                  {on && <Check className="absolute start-3 top-3 size-4" />}
                  <svg viewBox="0 0 600 700" className="h-12 w-auto" aria-hidden><path d={GARMENTS[g.code as GarmentType].body.front} fill="none" stroke="currentColor" strokeWidth="30" strokeLinejoin="round" /></svg>
                  <span className="text-base font-bold">{locale === "ar" ? g.name_ar : g.name_en}</span>
                  <span className="text-[10px] font-semibold tracking-[0.18em] text-mute" dir="ltr">{FIT[g.code] ?? ""}</span>
                  <span className="text-xs text-mute">{formatIQD(g.base_price, locale)}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* 02 — colour */}
        <div>
          <p className="step-label">02 / {t("اللون", "Colour")}</p>
          <div className="flex flex-wrap gap-2.5" role="radiogroup" aria-label={t("اللون", "Colour")}>
            {colors.map((c) => {
              const on = c.id === colorId;
              const dark = parseInt(c.hex.slice(1, 3), 16) < 140;
              return (
                <button key={c.id} role="radio" aria-checked={on} onClick={() => setColorId(c.id)} className={cn("flex items-center gap-2.5 rounded-full border py-1.5 pe-5 ps-1.5 text-base font-semibold transition", on ? "border-pine bg-pine-soft/60 text-pine" : "border-line bg-paper")}>
                  <span className="grid size-9 place-items-center rounded-full border border-ink/15" style={{ background: c.hex }}>{on && <Check className="size-4" style={{ color: dark ? "#fff" : "#111" }} />}</span>
                  {locale === "ar" ? c.name_ar : c.name_en}
                </button>
              );
            })}
          </div>
        </div>

        {/* 03 — size */}
        <div>
          <div className="flex items-center justify-between">
            <p className="step-label !mb-0">03 / {t("القياس", "Size")}</p>
            <button type="button" onClick={() => setGuide((g) => !g)} className="flex items-center gap-1.5 text-sm font-semibold text-pine underline underline-offset-4"><Ruler className="size-4" /> {t("دليل القياسات", "Size guide")}</button>
          </div>
          {guide && <div className="mt-3 rounded-2xl border border-line p-4"><SizeGuideTable garment={garmentCode} /></div>}
          {!multi ? (
            <>
              <div className="mt-3 grid grid-cols-5 gap-2">
                {garment.sizes.map((s) => (
                  <button key={s} aria-pressed={single === s} onClick={() => setSizes({ [s]: singleQty })} className={cn("h-12 rounded-xl border text-base font-medium transition", single === s ? "border-pine bg-pine-soft/60 text-pine" : "border-line bg-paper hover:border-ink/30")}>{s}</button>
                ))}
              </div>
              {fits && <p className="mt-3 text-sm text-mute">{t(`قياس ${single} يناسب تقريباً طول ${fits[0]} سم ووزن ${fits[1]} كغ.`, `Size ${single} fits roughly ${fits[0]} cm tall and ${fits[1]} kg.`)}</p>}
              <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <span className="text-sm font-semibold">{t("الكمية", "Quantity")}</span>
                  <Qty value={singleQty} onChange={(q) => setSizes({ [single]: q })} label={single} />
                </div>
                <button type="button" onClick={() => setMulti(true)} className="text-sm font-semibold text-pine underline underline-offset-4">{t("تحتاج أكثر من قياس؟", "Need several sizes?")}</button>
              </div>
            </>
          ) : (
            <>
              <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3">
                {garment.sizes.map((s) => (
                  <div key={s} className={cn("flex items-center justify-between rounded-xl border px-3 py-1.5", (sizes[s] ?? 0) > 0 ? "border-pine bg-pine-soft/60" : "border-line")}>
                    <span className="text-base font-bold">{s}</span>
                    <Qty value={sizes[s] ?? 0} min={0} onChange={(q) => setSizes({ ...sizes, [s]: q })} label={s} small />
                  </div>
                ))}
              </div>
              <button type="button" onClick={() => { setMulti(false); setSizes({ [single || garment.sizes[0]!]: Math.max(1, singleQty) }); }} className="mt-3 text-sm font-semibold text-pine underline underline-offset-4">{t("قياس واحد فقط", "Just one size")}</button>
            </>
          )}
        </div>

        {/* placements */}
        <div className="border-t border-line pt-6">
          <p className="step-label">{t("أماكن الطباعة", "Print placements")}</p>
          {used.length === 0 ? (
            <p className="text-sm text-mute">{t("بعد ما تضيف تصميم. ارفع صورة أو اكتب كلمة حتى تبدأ.", "Once you add a design. Upload an image or write a word to start.")}</p>
          ) : (
            <ul className="space-y-2">
              {used.map((l) => <li key={l} className="flex justify-between text-sm"><span className="flex items-center gap-2"><Check className="size-4 text-pine" /> {dict.designer.locations[l]}</span>{charges.get(l) === 0 ? <span className="text-xs font-bold text-pine">{t("مشمول بالسعر", "Included")}</span> : <span className="tabular-nums text-mute">+{formatIQD(charges.get(l) ?? 0, locale)}</span>}</li>)}
            </ul>
          )}
          <p className="mt-4 rounded-[1rem] bg-bone px-5 py-3.5 text-sm text-mute">
            {t("مكان طباعة واحد مشمول بسعر القطعة. كل مكان إضافي:", "One print placement is included in the price. Each extra placement:")} {locations.filter((l) => garment.print_locations.includes(l.code)).map((l) => `${dict.designer.locations[l.code]} +${formatIQD(l.price, locale)}`).join(" · ")}
          </p>
        </div>

        {/* options (collapsed: defaults are fine for most people) */}
        {groups.length > 0 && (
          <details className="group border-t border-line pt-6">
            <summary className="flex cursor-pointer list-none items-center justify-between [&::-webkit-details-marker]:hidden">
              <span><span className="step-label !mb-0 block">{t("خيارات الطباعة", "Printing options")}</span><span className="mt-1 block text-xs text-mute">{extraPicked.length ? extraPicked.map(name).join(" · ") : t("الافتراضي: طباعة DTF مطفية على قطن قياسي", "Default: matte DTF on standard cotton")}</span></span>
              <ChevronDown className="size-5 text-mute transition-transform group-open:rotate-180" />
            </summary>
            <div className="mt-5 space-y-5">
              {groups.map((g) => (
                <div key={g}>
                  <p className="mb-2 text-xs font-semibold text-mute">{groupTitle[g]![locale === "ar" ? 0 : 1]}</p>
                  <div className="flex flex-wrap gap-2">
                    {options.filter((o) => o.group_code === g).map((o) => {
                      const on = g === "addon" ? choice.addons.includes(o.code) : choice[g] === o.code;
                      return (
                        <button
                          key={o.id}
                          role={g === "addon" ? "checkbox" : "radio"}
                          aria-checked={on}
                          title={(locale === "ar" ? o.description_ar : o.description_en) ?? undefined}
                          onClick={() => setChoice(g === "addon" ? { ...choice, addons: on ? choice.addons.filter((c) => c !== o.code) : [...choice.addons, o.code] } : { ...choice, [g]: o.code })}
                          className={cn("rounded-full border px-4 py-2 text-sm font-semibold transition", on ? "border-pine bg-pine-soft/60 text-pine" : "border-line bg-paper hover:border-ink/30")}
                        >
                          {on && <Check className="me-1 inline size-3.5" />}{name(o)}{o.price > 0 && <span className="ms-1.5 text-xs font-normal text-mute">+{formatIQD(o.price, locale)}</span>}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
              <div className="grid gap-3 sm:grid-cols-2">
                <input className="field" maxLength={80} value={designName} onChange={(e) => setDesignName(e.target.value)} placeholder={t("اسم التصميم (اختياري)", "Design name (optional)")} aria-label={t("اسم التصميم", "Design name")} />
                <input className="field" maxLength={1000} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder={t("ملاحظة للمطبعة (اختياري)", "Note for the print shop (optional)")} aria-label={dict.designer.notes} />
              </div>
            </div>
          </details>
        )}

        {/* price */}
        <div className="border-t border-line pt-6">
          <div className="flex items-end justify-between gap-3">
            <p className="text-lg font-bold">{t("السعر مع الطباعة", "Price with printing")}</p>
            <div className="text-end">
              {pct > 0 && <p className="text-xs text-mute line-through tabular-nums">{formatIQD(unit * totalQty, locale)}</p>}
              <p className="display text-2xl tabular-nums">{formatIQD(unitAfter * totalQty, locale)}</p>
            </div>
          </div>
          <p className="mt-1 text-sm text-mute">{totalQty > 1 ? `${totalQty} × ${formatIQD(unitAfter, locale)} · ` : ""}{t("التوصيل يُحسب حسب المحافظة عند الطلب.", "Delivery is calculated per governorate at checkout.")}</p>
          {tiers.length > 0 && (
            <p className={cn("mt-3 rounded-[1rem] px-4 py-3 text-sm", pct > 0 ? "bg-pine-soft text-pine" : "bg-bone text-mute")}>
              {pct > 0 ? t(`خصم ${pct}% على كل قطعة. `, `${pct}% off every piece. `) : ""}
              {nt ? t(`اطلب ${nt.min_qty} قطع أو أكثر ووفّر ${nt.discount_percent}%.`, `Order ${nt.min_qty}+ pieces and save ${nt.discount_percent}%.`) : ""}
            </p>
          )}
          <p className="mt-3 text-xs text-mute">{t("التجهيز", "Ready in")} {rush ? `${settings.rush_days} ${t("أيام", "days")}` : `${settings.lead_days_min}–${settings.lead_days_max} ${t("أيام عمل", "working days")}`} {t("ثم الشحن.", "then dispatch.")}</p>
        </div>
      </div>
    </section>
  );
}

function Qty({ value, onChange, min = 1, label, small }: { value: number; onChange: (v: number) => void; min?: number; label: string; small?: boolean }) {
  return (
    <div className={cn("flex items-center rounded-full border border-line bg-paper", small && "border-0 bg-transparent")}>
      <button type="button" className={cn("grid place-items-center rounded-full hover:bg-bone", small ? "size-8" : "size-10")} onClick={() => onChange(Math.max(min, value - 1))} aria-label={`- ${label}`}><Minus className="size-3.5" /></button>
      <span className="w-7 text-center text-sm font-bold tabular-nums">{value}</span>
      <button type="button" className={cn("grid place-items-center rounded-full hover:bg-bone", small ? "size-8" : "size-10")} onClick={() => onChange(Math.min(99, value + 1))} aria-label={`+ ${label}`}><Plus className="size-3.5" /></button>
    </div>
  );
}
