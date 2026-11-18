"use client";
import type { IText as FabricIText } from "fabric";
import { AlignCenterHorizontal, AlignCenterVertical, AlertTriangle, ArrowDown, ArrowUp, Bold, CheckCircle2, ChevronDown, Copy, FlipHorizontal2, FlipVertical2, Italic, Lock, LockOpen, Minus, Plus, RotateCw, Trash2, Underline, X, AlignLeft, AlignCenter, AlignRight } from "lucide-react";
import { useI18n } from "@/components/i18n-provider";
import { adminT } from "@/lib/admin-i18n";
import { PRINT_COLORS, TEXT_PRESETS_UI, type DesignerFont } from "@/lib/design-assets";
import { cn } from "@/lib/format";
import type { Tagged } from "./types";

type Act = "up" | "down" | "hide" | "lock" | "delete" | "duplicate";

/** Editor for the selected element, shown right under the preview: the essentials first, the rest folded away. */
export function Inspector({ o, fonts, quality, minDpi, sizeCm, setProps, applyFilters, alignTo, setWidthCm, onClose, onAction, onFont, onPreset }: {
  o: Tagged;
  tick: number;
  fonts: DesignerFont[];
  quality: number | null;
  minDpi: number;
  sizeCm: { w: number; h: number };
  setProps: (p: Record<string, unknown>) => void;
  applyFilters: (k: "grayscale" | "invert", on: boolean) => void;
  alignTo: (h: "left" | "centerX" | "right" | "top" | "centerY" | "bottom") => void;
  setWidthCm: (cm: number) => void;
  onClose: () => void;
  onAction: (a: Act) => void;
  onFont: (f: DesignerFont) => void;
  onPreset: (id: string) => void;
}) {
  const { locale } = useI18n();
  const t = adminT(locale);
  const txt = o.tpacKind === "text" ? (o as unknown as FabricIText) : null;
  const fillable = o.tpacKind === "text" || o.tpacKind === "shape";
  const fill = typeof o.fill === "string" ? o.fill : "#111111";
  const stroke = typeof o.stroke === "string" ? o.stroke : "#111111";
  const curFont = txt ? fonts.find((f) => String(txt.fontFamily) === f.family) : undefined;
  const kindLabel = o.tpacKind === "text" ? t("تعديل النص", "Edit text") : o.tpacKind === "shape" ? t("تعديل الشكل", "Edit shape") : t("تعديل الصورة", "Edit image");

  return (
    <section className="space-y-5 bg-bone/50 px-5 py-5 sm:px-7" aria-label={kindLabel}>
      <header className="flex items-center justify-between gap-2">
        <p className="text-base font-bold">{kindLabel}</p>
        <div className="flex items-center gap-0.5">
          <Act label={t("تكرار", "Duplicate")} onClick={() => onAction("duplicate")}><Copy className="size-[18px]" /></Act>
          <Act label={t("للأمام", "Bring forward")} onClick={() => onAction("up")}><ArrowUp className="size-[18px]" /></Act>
          <Act label={t("للخلف", "Send backward")} onClick={() => onAction("down")}><ArrowDown className="size-[18px]" /></Act>
          <Act label={o.tpacLocked ? t("فك القفل", "Unlock") : t("قفل", "Lock")} on={!!o.tpacLocked} onClick={() => onAction("lock")}>{o.tpacLocked ? <Lock className="size-[18px]" /> : <LockOpen className="size-[18px]" />}</Act>
          <Act label={t("حذف", "Delete")} danger onClick={() => onAction("delete")}><Trash2 className="size-[18px]" /></Act>
          <Act label={t("تم", "Done")} onClick={onClose}><X className="size-[18px]" /></Act>
        </div>
      </header>

      {txt && (
        <>
          <textarea className="field min-h-[3.25rem] text-base" rows={2} maxLength={200} value={txt.text ?? ""} dir="auto" aria-label={t("النص", "Text")} onChange={(e) => setProps({ text: e.target.value })} />
          <div>
            <p className="mb-2 text-xs font-semibold text-mute">{t("الخط", "Font")}</p>
            <div className="-mx-5 flex gap-2 overflow-x-auto px-5 pb-1 sm:-mx-7 sm:px-7">
              {fonts.map((f) => (
                <button key={f.label} onClick={() => onFont(f)} aria-pressed={curFont?.label === f.label} className={cn("shrink-0 rounded-xl border px-3.5 py-2 text-base leading-tight transition", curFont?.label === f.label ? "border-pine bg-pine-soft text-pine" : "border-line bg-paper")} style={{ fontFamily: f.family }}>
                  {f.group === "arabic" ? (f.labelAr ?? f.label) : f.label}
                </button>
              ))}
            </div>
          </div>
        </>
      )}

      {fillable && (
        <div>
          <p className="mb-2 text-xs font-semibold text-mute">{t("اللون", "Colour")}</p>
          <Palette value={fill} onChange={(v) => setProps({ fill: v })} />
        </div>
      )}

      {o.tpacKind === "image" && (
        <div className="space-y-3">
          {o.tpacVector ? (
            <p className="flex items-center gap-2 text-sm font-semibold text-pine"><CheckCircle2 className="size-4" /> {t("ملف متجهي (SVG) — دقة ممتازة بأي حجم", "Vector (SVG) — sharp at any size")}</p>
          ) : quality !== null && (
            <p className={cn("flex items-center gap-2 text-sm font-semibold", quality >= minDpi ? "text-pine" : "text-amber-deep")}>
              {quality >= minDpi ? <CheckCircle2 className="size-4" /> : <AlertTriangle className="size-4" />}
              {quality} DPI — {quality >= minDpi ? t("دقة ممتازة للطباعة", "great for print") : t(`منخفضة (المطلوب ${minDpi}+) — صغّر الصورة أو ارفع ملفاً أكبر`, `low (${minDpi}+ needed) — make it smaller or upload a bigger file`)}
            </p>
          )}
          <div className="flex flex-wrap gap-2">
            <button className="chip h-10 text-sm" aria-pressed={!!o.tpacFilters?.grayscale} onClick={() => applyFilters("grayscale", !o.tpacFilters?.grayscale)}>{t("أبيض وأسود", "Black & white")}</button>
            <button className="chip h-10 text-sm" aria-pressed={!!o.tpacFilters?.invert} onClick={() => applyFilters("invert", !o.tpacFilters?.invert)}>{t("عكس الألوان", "Invert")}</button>
          </div>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-3">
        <span className="text-xs font-semibold text-mute">{t("العرض", "Width")}</span>
        <Stepper value={Number(sizeCm.w.toFixed(1))} onChange={setWidthCm} step={1} suffix={t("سم", "cm")} />
        <span className="text-xs text-mute tabular-nums" dir="ltr">{sizeCm.w.toFixed(1)} × {sizeCm.h.toFixed(1)} cm</span>
        <span className="ms-auto flex gap-1">
          <Tog on={false} onClick={() => alignTo("centerX")} label={t("توسيط أفقي", "Centre horizontally")}><AlignCenterVertical className="size-4" /></Tog>
          <Tog on={false} onClick={() => alignTo("centerY")} label={t("توسيط عمودي", "Centre vertically")}><AlignCenterHorizontal className="size-4" /></Tog>
        </span>
      </div>

      <details className="group rounded-2xl border border-line bg-paper">
        <summary className="flex cursor-pointer list-none items-center justify-between px-4 py-3 text-sm font-semibold [&::-webkit-details-marker]:hidden">
          {t("تعديلات متقدمة", "More adjustments")}
          <ChevronDown className="size-4 transition-transform group-open:rotate-180" />
        </summary>
        <div className="space-y-4 border-t border-line p-4">
          {txt && (
            <>
              <Field label={t("نمط جاهز", "Quick style")}>
                <div className="flex gap-1.5 overflow-x-auto pb-1">
                  {TEXT_PRESETS_UI.map((p) => <button key={p.id} onClick={() => onPreset(p.id)} className="chip h-8 shrink-0 px-3 text-xs">{locale === "ar" ? p.ar : p.en}</button>)}
                </div>
              </Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label={t("حجم الخط", "Font size")}>
                  <Stepper value={Math.round(txt.fontSize ?? 40)} onChange={(v) => setProps({ fontSize: Math.min(400, Math.max(6, v)) })} step={4} />
                </Field>
                <Field label={t("التنسيق", "Style")}>
                  <div className="flex gap-1">
                    <Tog on={Number(txt.fontWeight) >= 600} disabled={curFont?.weights === 1} onClick={() => setProps({ fontWeight: Number(txt.fontWeight) >= 600 ? 400 : 700 })} label={t("عريض", "Bold")}><Bold className="size-4" /></Tog>
                    <Tog on={txt.fontStyle === "italic"} onClick={() => setProps({ fontStyle: txt.fontStyle === "italic" ? "normal" : "italic" })} label={t("مائل", "Italic")}><Italic className="size-4" /></Tog>
                    <Tog on={!!txt.underline} onClick={() => setProps({ underline: !txt.underline })} label={t("تسطير", "Underline")}><Underline className="size-4" /></Tog>
                  </div>
                </Field>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <Field label={t("المحاذاة", "Align")}>
                  <div className="flex gap-1">
                    {(["left", "center", "right"] as const).map((a) => (
                      <Tog key={a} on={txt.textAlign === a} onClick={() => setProps({ textAlign: a })} label={a}>{a === "left" ? <AlignLeft className="size-4" /> : a === "center" ? <AlignCenter className="size-4" /> : <AlignRight className="size-4" />}</Tog>
                    ))}
                  </div>
                </Field>
                <Field label={t("تباعد الحروف", "Letter spacing")}>
                  <Range min={-50} max={800} step={10} value={txt.charSpacing ?? 0} onChange={(v) => setProps({ charSpacing: v })} />
                </Field>
              </div>
              <Field label={t("تباعد الأسطر", "Line height")}>
                <Range min={0.8} max={2.2} step={0.05} value={txt.lineHeight ?? 1.16} onChange={(v) => setProps({ lineHeight: v })} format={(v) => v.toFixed(2)} />
              </Field>
            </>
          )}
          {fillable && (
            <Field label={t("الحد الخارجي", "Outline")}>
              <div className="space-y-2">
                <Range min={0} max={14} step={0.5} value={Number(o.strokeWidth ?? 0)} onChange={(v) => setProps({ strokeWidth: v, stroke: v > 0 ? stroke : undefined, paintFirst: "stroke" })} format={(v) => (v === 0 ? t("بدون", "None") : `${v}`)} />
                {Number(o.strokeWidth ?? 0) > 0 && <Palette value={stroke} onChange={(v) => setProps({ stroke: v })} compact />}
                {txt && <button className="text-xs font-semibold underline" onClick={() => setProps({ fill: "rgba(0,0,0,0)", stroke: typeof o.stroke === "string" && o.stroke ? stroke : fill, strokeWidth: Math.max(2, Number(o.strokeWidth ?? 0)), paintFirst: "stroke" })}>{t("تفريغ النص (خطوط فقط)", "Hollow out (outline only)")}</button>}
              </div>
            </Field>
          )}
          <Field label={t("الشفافية", "Opacity")}>
            <Range min={0.1} max={1} step={0.05} value={o.opacity ?? 1} onChange={(v) => setProps({ opacity: v })} format={(v) => `${Math.round(v * 100)}%`} />
          </Field>
          <Field label={`${t("التدوير", "Rotate")} — ${Math.round(o.angle ?? 0)}°`}>
            <div className="flex items-center gap-2">
              <Range min={-180} max={180} step={1} value={Math.max(-180, Math.min(180, Math.round((((o.angle ?? 0) + 180) % 360) - 180 || 0)))} onChange={(v) => setProps({ angle: v })} format={() => ""} />
              <Tog on={false} onClick={() => setProps({ angle: Math.round(((o.angle ?? 0) + 90) / 90) * 90 })} label={t("تدوير ٩٠°", "Rotate 90°")}><RotateCw className="size-4" /></Tog>
              <button className="chip h-9 text-xs" onClick={() => setProps({ angle: 0 })}>0°</button>
            </div>
          </Field>
          <Field label={t("قلب", "Flip")}>
            <div className="flex gap-1">
              <Tog on={!!o.flipX} onClick={() => setProps({ flipX: !o.flipX })} label={t("قلب أفقي", "Flip horizontally")}><FlipHorizontal2 className="size-4" /></Tog>
              <Tog on={!!o.flipY} onClick={() => setProps({ flipY: !o.flipY })} label={t("قلب عمودي", "Flip vertically")}><FlipVertical2 className="size-4" /></Tog>
              <button className="chip h-9 text-xs" onClick={() => onAction("hide")}>{t("إخفاء العنصر", "Hide element")}</button>
            </div>
          </Field>
        </div>
      </details>
    </section>
  );
}

function Act({ children, label, onClick, danger, on }: { children: React.ReactNode; label: string; onClick: () => void; danger?: boolean; on?: boolean }) {
  return <button type="button" title={label} aria-label={label} aria-pressed={on} onClick={onClick} className={cn("grid size-9 place-items-center rounded-full transition hover:bg-paper", danger ? "text-danger" : "text-ink/75", on && "bg-paper text-pine")}>{children}</button>;
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <div><p className="mb-1.5 text-xs font-semibold text-mute">{label}</p>{children}</div>;
}

function Tog({ children, on, onClick, label, disabled }: { children: React.ReactNode; on: boolean; onClick: () => void; label: string; disabled?: boolean }) {
  return (
    <button type="button" title={label} aria-label={label} aria-pressed={on} disabled={disabled} onClick={onClick} className={cn("grid size-9 place-items-center rounded-full border transition disabled:opacity-35", on ? "border-pine bg-pine-soft text-pine" : "border-line bg-paper hover:bg-bone")}>
      {children}
    </button>
  );
}

function Stepper({ value, onChange, step, suffix }: { value: number; onChange: (v: number) => void; step: number; suffix?: string }) {
  return (
    <div className="flex h-10 items-center rounded-full border border-line bg-paper">
      <button type="button" className="grid h-full w-10 place-items-center" onClick={() => onChange(value - step)} aria-label="-"><Minus className="size-4" /></button>
      <span className="min-w-14 flex-1 text-center text-sm tabular-nums">{value}{suffix ? ` ${suffix}` : ""}</span>
      <button type="button" className="grid h-full w-10 place-items-center" onClick={() => onChange(value + step)} aria-label="+"><Plus className="size-4" /></button>
    </div>
  );
}

function Range({ value, min, max, step, onChange, format }: { value: number; min: number; max: number; step: number; onChange: (v: number) => void; format?: (v: number) => string }) {
  const label = (format ?? ((v) => String(v)))(value);
  return (
    <div className="flex flex-1 items-center gap-2">
      <input type="range" min={min} max={max} step={step} value={value} onChange={(e) => onChange(Number(e.target.value))} className="h-2 flex-1 cursor-pointer accent-[var(--color-pine)]" />
      {label !== "" && <span className="w-12 text-end text-xs tabular-nums text-mute">{label}</span>}
    </div>
  );
}

function Palette({ value, onChange, compact }: { value: string; onChange: (v: string) => void; compact?: boolean }) {
  const cur = value.toUpperCase();
  return (
    <div className="flex flex-wrap items-center gap-2">
      {PRINT_COLORS.slice(0, compact ? 8 : PRINT_COLORS.length).map((hex) => (
        <button key={hex} aria-label={hex} aria-pressed={cur === hex} onClick={() => onChange(hex)} className={cn("size-8 rounded-full border", cur === hex ? "ring-2 ring-pine ring-offset-2 ring-offset-bone" : "border-ink/20")} style={{ background: hex }} />
      ))}
      <input type="color" aria-label={`custom colour`} value={/^#[0-9a-f]{6}$/i.test(value) ? value : "#111111"} onChange={(e) => onChange(e.target.value.toUpperCase())} className="size-8 cursor-pointer rounded-full border border-line bg-transparent p-0" />
    </div>
  );
}
