"use client";
import { useMemo, useState } from "react";
import { ArrowDown, ArrowUp, ArrowRight, Check, Copy, Eye, EyeOff, ImagePlus, Layers, Loader2, Lock, LockOpen, Minus, Plus, Shapes, Trash2, Type as TypeIcon, Image as ImageIcon, LayoutTemplate } from "lucide-react";
import { useI18n } from "@/components/i18n-provider";
import { adminT } from "@/lib/admin-i18n";
import { ACCEPT_DESIGN } from "@/lib/upload-client";
import { GARMENTS, garmentDataUrl, type GarmentType, type PrintArea, type PrintLocation } from "@/lib/garments";
import { SHAPES, TEMPLATES, TEXT_PRESETS_UI, type DesignerFont } from "@/lib/design-assets";
import { nextTier } from "@/lib/design-pricing";
import { formatIQD, cn } from "@/lib/format";
import type { Color, DesignerOptionRow, DesignerSettings, DesignerTierRow, GarmentTypeRow, PrintLocationRow } from "@/lib/types";
import type { Choice, DesignerApi, LayerInfo } from "./types";

const Next = ({ onClick, children }: { onClick: () => void; children: React.ReactNode }) => (
  <button onClick={onClick} className="btn btn-outline w-full">{children} <ArrowRight className="size-4 rtl:rotate-180" /></button>
);

/* ----------------------------------------------------------------------------------------- PRODUCT */

export function ProductTab({ garments, garmentCode, setGarmentCode, colors, colorId, setColorId, locations, location, setLocation, used, garmentMeta, next }: {
  garments: GarmentTypeRow[]; garmentCode: string; setGarmentCode: (c: GarmentTypeRow["code"]) => void;
  colors: Color[]; colorId: string; setColorId: (id: string) => void;
  locations: PrintLocationRow[]; location: PrintLocation; setLocation: (l: PrintLocation) => void; used: PrintLocation[];
  garmentMeta: Record<PrintLocation, PrintArea>; next: () => void;
}) {
  const { locale, dict } = useI18n();
  const t = adminT(locale);
  const cur = colors.find((c) => c.id === colorId);
  return (
    <div className="space-y-6">
      <section>
        <h2 className="label">{dict.designer.garment}</h2>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {garments.map((g) => (
            <button key={g.code} aria-pressed={g.code === garmentCode} onClick={() => setGarmentCode(g.code)} className={cn("group overflow-hidden rounded-2xl border p-2 text-start transition", g.code === garmentCode ? "border-pine bg-pine-soft ring-1 ring-pine" : "border-line hover:bg-bone")}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={garmentDataUrl(g.code as GarmentType, "front", cur?.hex ?? "#111111")} alt="" className="mx-auto h-24 w-auto object-contain" loading="lazy" />
              <span className="mt-1 block text-sm font-bold">{locale === "ar" ? g.name_ar : g.name_en}</span>
              <span className="block text-xs text-mute">{t("من", "from")} {formatIQD(g.base_price, locale)}</span>
            </button>
          ))}
        </div>
      </section>

      <section>
        <h2 className="label">{dict.designer.color}: <span className="font-normal text-mute">{cur ? (locale === "ar" ? cur.name_ar : cur.name_en) : ""}</span></h2>
        <div className="flex flex-wrap gap-3" role="radiogroup" aria-label={dict.designer.color}>
          {colors.map((c) => (
            <button key={c.id} role="radio" aria-checked={c.id === colorId} aria-label={locale === "ar" ? c.name_ar : c.name_en} title={locale === "ar" ? c.name_ar : c.name_en} onClick={() => setColorId(c.id)} className={cn("grid size-11 place-items-center rounded-full border transition", c.id === colorId ? "border-ink ring-2 ring-ink ring-offset-2" : "border-ink/25")} style={{ background: c.hex }}>
              {c.id === colorId && <Check className="size-4" style={{ color: parseInt(c.hex.slice(1, 3), 16) < 140 ? "#fff" : "#111" }} />}
            </button>
          ))}
        </div>
      </section>

      <section>
        <h2 className="label">{dict.designer.location}</h2>
        <p className="mb-2 text-xs text-mute">{t("اختر المكان ثم أضف التصميم داخله. كل مكان له سعر طباعة مستقل.", "Pick a placement, then add your design inside it. Each placement is priced separately.")}</p>
        <div className="grid grid-cols-2 gap-2">
          {locations.map((l) => (
            <button key={l.code} aria-pressed={location === l.code} onClick={() => setLocation(l.code)} className={cn("rounded-2xl border px-3 py-2.5 text-start transition", location === l.code ? "border-pine bg-pine-soft ring-1 ring-pine" : "border-line hover:bg-bone")}>
              <span className="flex items-center gap-2 text-sm font-bold">{used.includes(l.code) && <span className="size-2 rounded-full bg-amber" aria-hidden />}{dict.designer.locations[l.code]}</span>
              <span className="block text-xs text-mute">+{formatIQD(l.price, locale)} · {garmentMeta[l.code].cm.width}×{garmentMeta[l.code].cm.height} cm</span>
            </button>
          ))}
        </div>
      </section>
      <Next onClick={next}>{t("التالي: أضف تصميمك", "Next: add your design")}</Next>
    </div>
  );
}

/* ----------------------------------------------------------------------------------------- ADD */

const groupLabels = { basic: ["أساسية", "Basic"], stars: ["نجوم", "Stars"], symbols: ["رموز", "Symbols"], lines: ["خطوط وإطارات", "Lines & frames"] } as const;

export function AddTab({ api, ready, uploading, locationLabel, next, garmentLocations, fonts }: { api: DesignerApi; ready: boolean; uploading: boolean; fonts: DesignerFont[]; locationLabel?: string; garmentLocations: string[]; next: () => void }) {
  const { locale, dict } = useI18n();
  const t = adminT(locale);
  const [group, setGroup] = useState<keyof typeof groupLabels>("basic");
  const shapes = useMemo(() => SHAPES.filter((s) => s.group === group), [group]);
  const templates = TEMPLATES.filter((tp) => tp.items.every((i) => garmentLocations.includes(i.location)) || tp.items.some((i) => garmentLocations.includes(i.location)));
  const arabicFirst = locale === "ar";
  void fonts;
  return (
    <div className="space-y-7">
      <p className="rounded-2xl bg-bone px-4 py-2.5 text-xs text-mute">{t("ستُضاف العناصر إلى:", "New elements go to:")} <b className="text-ink">{locationLabel}</b></p>

      <section className="space-y-2">
        <h2 className="label flex items-center gap-2"><ImageIcon className="size-4" /> {t("صورة أو شعار", "Image or logo")}</h2>
        <label className={cn("flex cursor-pointer flex-col items-center gap-1 rounded-2xl border-2 border-dashed border-line px-4 py-6 text-center transition hover:border-pine hover:bg-pine-soft", (uploading || !ready) && "pointer-events-none opacity-50")} aria-disabled={!ready}>
          {uploading ? <Loader2 className="size-6 animate-spin text-pine" /> : <ImagePlus className="size-6 text-pine" />}
          <span className="text-sm font-bold">{uploading ? dict.designer.uploading : dict.designer.upload}</span>
          <span className="text-xs text-mute">{t("أو اسحب الصورة وأفلتها على القميص", "or drag it onto the garment")}</span>
          <input type="file" accept={ACCEPT_DESIGN} className="sr-only" disabled={!ready} onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ""; if (f) api.upload(f); }} />
        </label>
        <p className="text-xs text-mute">{dict.designer.uploadHint}</p>
      </section>

      <section className="space-y-2">
        <h2 className="label flex items-center gap-2"><TypeIcon className="size-4" /> {t("نص", "Text")}</h2>
        <button onClick={() => api.addText()} disabled={!ready} className="btn btn-outline w-full"><TypeIcon className="size-4" /> {dict.designer.addText}</button>
        <div className="flex flex-wrap gap-1.5">
          {TEXT_PRESETS_UI.filter((p) => (arabicFirst ? true : !["kufi", "ruqaa", "lalezar"].includes(p.id))).map((p) => (
            <button key={p.id} disabled={!ready} onClick={() => api.addText(p.id)} className="chip h-9 text-xs">{locale === "ar" ? p.ar : p.en}</button>
          ))}
        </div>
      </section>

      <section className="space-y-2">
        <h2 className="label flex items-center gap-2"><Shapes className="size-4" /> {t("أشكال ورموز", "Shapes & symbols")}</h2>
        <div className="flex gap-1.5 overflow-x-auto pb-1">
          {(Object.keys(groupLabels) as (keyof typeof groupLabels)[]).map((g) => (
            <button key={g} aria-pressed={group === g} onClick={() => setGroup(g)} className="chip h-8 shrink-0 px-3 text-xs">{groupLabels[g][locale === "ar" ? 0 : 1]}</button>
          ))}
        </div>
        <div className="grid grid-cols-4 gap-2 sm:grid-cols-5">
          {shapes.map((s) => (
            <button key={s.id} disabled={!ready} onClick={() => api.addShape(s.id)} title={locale === "ar" ? s.ar : s.en} aria-label={locale === "ar" ? s.ar : s.en} className="grid aspect-square place-items-center rounded-2xl border border-line p-3 transition hover:border-pine hover:bg-pine-soft">
              <svg viewBox="0 0 100 100" className="size-full text-ink" aria-hidden><path d={s.path} fill="currentColor" fillRule={s.evenodd ? "evenodd" : "nonzero"} /></svg>
            </button>
          ))}
        </div>
      </section>

      <section className="space-y-2">
        <h2 className="label flex items-center gap-2"><LayoutTemplate className="size-4" /> {t("قوالب جاهزة", "Ready layouts")}</h2>
        <div className="grid gap-2 sm:grid-cols-2">
          {templates.map((tp) => (
            <button key={tp.id} disabled={!ready} onClick={() => api.applyTemplate(tp.id)} className="rounded-2xl border border-line p-3 text-start transition hover:border-pine hover:bg-pine-soft">
              <span className="block text-sm font-bold">{locale === "ar" ? tp.ar : tp.en}</span>
              <span className="block text-xs text-mute">{locale === "ar" ? tp.hint_ar : tp.hint_en}</span>
            </button>
          ))}
        </div>
      </section>
      <Next onClick={next}>{t("التالي: المقاسات والخيارات", "Next: sizes & options")}</Next>
    </div>
  );
}

/* ----------------------------------------------------------------------------------------- LAYERS */

export function LayersTab({ layers, selectedId, api, locationLabel, next }: { layers: LayerInfo[]; selectedId?: string; api: DesignerApi; locationLabel: (l: PrintLocation) => string | undefined; next: () => void }) {
  const { locale } = useI18n();
  const t = adminT(locale);
  const list = [...layers].reverse();
  return (
    <div className="space-y-4">
      {list.length === 0 ? (
        <div className="grid place-items-center gap-2 rounded-2xl border border-dashed border-line px-6 py-12 text-center text-sm text-mute">
          <Layers className="size-8" />
          {t("لا توجد عناصر بعد. أضف صورة أو نصاً من تبويب «التصميم».", "No elements yet. Add an image or text from the Design tab.")}
        </div>
      ) : (
        <ul className="space-y-1.5">
          {list.map((l, i) => (
            <li key={l.id} className={cn("flex items-center gap-1 rounded-2xl border px-2 py-1.5", selectedId === l.id ? "border-pine bg-pine-soft" : "border-line", l.hidden && "opacity-55")}>
              <button onClick={() => api.selectLayer(l.id)} className="flex min-w-0 flex-1 items-center gap-2 px-1 py-1 text-start">
                <span className="grid size-7 shrink-0 place-items-center rounded-lg bg-bone text-mute">{l.kind === "text" ? <TypeIcon className="size-3.5" /> : l.kind === "shape" ? <Shapes className="size-3.5" /> : <ImageIcon className="size-3.5" />}</span>
                <span className="min-w-0"><span className="block truncate text-sm font-semibold" dir="auto">{l.label}</span><span className="block text-[11px] text-mute">{locationLabel(l.location)}</span></span>
              </button>
              <Mini label={t("للأمام", "Forward")} disabled={i === 0} onClick={() => api.layerAction(l.id, "up")}><ArrowUp className="size-3.5" /></Mini>
              <Mini label={t("للخلف", "Back")} disabled={i === list.length - 1} onClick={() => api.layerAction(l.id, "down")}><ArrowDown className="size-3.5" /></Mini>
              <Mini label={l.hidden ? t("إظهار", "Show") : t("إخفاء", "Hide")} onClick={() => api.layerAction(l.id, "hide")}>{l.hidden ? <EyeOff className="size-3.5" /> : <Eye className="size-3.5" />}</Mini>
              <Mini label={l.locked ? t("فك القفل", "Unlock") : t("قفل", "Lock")} onClick={() => api.layerAction(l.id, "lock")}>{l.locked ? <Lock className="size-3.5" /> : <LockOpen className="size-3.5" />}</Mini>
              <Mini label={t("نسخ", "Duplicate")} onClick={() => api.layerAction(l.id, "duplicate")}><Copy className="size-3.5" /></Mini>
              <Mini label={t("حذف", "Delete")} onClick={() => api.layerAction(l.id, "delete")} danger><Trash2 className="size-3.5" /></Mini>
            </li>
          ))}
        </ul>
      )}
      <Next onClick={next}>{t("التالي: المقاسات والخيارات", "Next: sizes & options")}</Next>
    </div>
  );
}

function Mini({ children, label, onClick, disabled, danger }: { children: React.ReactNode; label: string; onClick: () => void; disabled?: boolean; danger?: boolean }) {
  return <button type="button" title={label} aria-label={label} disabled={disabled} onClick={onClick} className={cn("grid size-8 shrink-0 place-items-center rounded-full text-mute transition hover:bg-paper hover:text-ink disabled:opacity-30", danger && "hover:text-danger")}>{children}</button>;
}

/* ----------------------------------------------------------------------------------------- ORDER */

const groupTitle: Record<string, [string, string]> = {
  method: ["طريقة الطباعة", "Print method"],
  finish: ["اللمسة النهائية", "Finish"],
  fabric: ["الخامة", "Fabric"],
  package: ["التغليف", "Packaging"],
  addon: ["إضافات اختيارية", "Optional extras"],
};

export function OrderTab({ garment, sizes, setSizes, options, choice, setChoice, notes, setNotes, designName, setDesignName, tiers, totalQty, pct, unit, unitAfter, basePrice, placements, picked, settings, rush }: {
  garment: GarmentTypeRow; sizes: Record<string, number>; setSizes: (s: Record<string, number>) => void;
  options: DesignerOptionRow[]; choice: Choice; setChoice: (c: Choice) => void;
  notes: string; setNotes: (s: string) => void; designName: string; setDesignName: (s: string) => void;
  tiers: DesignerTierRow[]; totalQty: number; pct: number; unit: number; unitAfter: number; basePrice: number;
  placements: { code: string; label: string | undefined; price: number }[]; picked: DesignerOptionRow[]; settings: DesignerSettings; rush: boolean;
}) {
  const { locale, dict } = useI18n();
  const t = adminT(locale);
  const setQty = (s: string, q: number) => setSizes({ ...sizes, [s]: Math.max(0, Math.min(99, q)) });
  const groups = (["method", "finish", "fabric", "package"] as const).filter((g) => options.some((o) => o.group_code === g));
  const addons = options.filter((o) => o.group_code === "addon");
  const nt = nextTier(tiers, totalQty);
  const days = rush ? settings.rush_days : null;
  const name = (o: DesignerOptionRow) => (locale === "ar" ? o.name_ar : o.name_en);
  const desc = (o: DesignerOptionRow) => (locale === "ar" ? o.description_ar : o.description_en);

  return (
    <div className="space-y-7">
      <section className="space-y-2">
        <h2 className="label">{t("اسم التصميم (اختياري)", "Design name (optional)")}</h2>
        <input className="field" maxLength={80} value={designName} onChange={(e) => setDesignName(e.target.value)} placeholder={t("مثال: دفعة هندسة 2026", "e.g. Engineering class 2026")} />
      </section>

      <section className="space-y-2">
        <div className="flex items-end justify-between">
          <h2 className="label !mb-0">{t("المقاسات والكميات", "Sizes & quantities")}</h2>
          <p className="text-xs font-bold text-pine">{totalQty} {t("قطعة", "pcs")}</p>
        </div>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {garment.sizes.map((s) => {
            const q = sizes[s] ?? 0;
            return (
              <div key={s} className={cn("flex items-center justify-between rounded-2xl border px-2 py-1.5 transition", q > 0 ? "border-pine bg-pine-soft" : "border-line")}>
                <span className="ps-2 text-sm font-extrabold">{s}</span>
                <span className="flex items-center">
                  <button type="button" className="grid size-8 place-items-center rounded-full hover:bg-paper" onClick={() => setQty(s, q - 1)} aria-label={`- ${s}`}><Minus className="size-3.5" /></button>
                  <span className="w-6 text-center text-sm font-semibold tabular-nums">{q}</span>
                  <button type="button" className="grid size-8 place-items-center rounded-full hover:bg-paper" onClick={() => setQty(s, q + 1)} aria-label={`+ ${s}`}><Plus className="size-3.5" /></button>
                </span>
              </div>
            );
          })}
        </div>
        {totalQty >= 24 && <p className="text-xs text-mute">{t("تحتاج كمية أكبر أو فواتير للشركات؟", "Need a bigger run or company invoices?")} <a href={`/${locale}/bulk`} className="font-bold underline">{t("اطلب عرض سعر جملة", "Request a bulk quote")}</a></p>}
      </section>

      {groups.map((g) => (
        <section key={g} className="space-y-2">
          <h2 className="label">{groupTitle[g]![locale === "ar" ? 0 : 1]}</h2>
          <div className="grid gap-2 sm:grid-cols-2" role="radiogroup">
            {options.filter((o) => o.group_code === g).map((o) => {
              const on = choice[g] === o.code;
              return (
                <button key={o.id} role="radio" aria-checked={on} onClick={() => setChoice({ ...choice, [g]: o.code })} className={cn("rounded-2xl border p-3 text-start transition", on ? "border-pine bg-pine-soft ring-1 ring-pine" : "border-line hover:bg-bone")}>
                  <span className="flex items-center justify-between gap-2 text-sm font-bold">{name(o)}{on && <Check className="size-4 text-pine" />}</span>
                  {desc(o) && <span className="mt-0.5 block text-xs text-mute">{desc(o)}</span>}
                  <span className="mt-1 block text-xs font-semibold">{o.price > 0 ? `+${formatIQD(o.price, locale)}` : t("مشمول", "Included")}</span>
                </button>
              );
            })}
          </div>
        </section>
      ))}

      {addons.length > 0 && (
        <section className="space-y-2">
          <h2 className="label">{groupTitle.addon![locale === "ar" ? 0 : 1]}</h2>
          <div className="grid gap-2 sm:grid-cols-2">
            {addons.map((o) => {
              const on = choice.addons.includes(o.code);
              return (
                <button key={o.id} role="checkbox" aria-checked={on} onClick={() => setChoice({ ...choice, addons: on ? choice.addons.filter((c) => c !== o.code) : [...choice.addons, o.code] })} className={cn("flex items-start gap-3 rounded-2xl border p-3 text-start transition", on ? "border-pine bg-pine-soft ring-1 ring-pine" : "border-line hover:bg-bone")}>
                  <span className={cn("mt-0.5 grid size-5 shrink-0 place-items-center rounded-md border", on ? "border-pine bg-pine text-white dark:text-night" : "border-ink/30")}>{on && <Check className="size-3.5" />}</span>
                  <span className="min-w-0"><span className="block text-sm font-bold">{name(o)} <span className="text-xs font-semibold text-mute">+{formatIQD(o.price, locale)}</span></span>{desc(o) && <span className="block text-xs text-mute">{desc(o)}</span>}</span>
                </button>
              );
            })}
          </div>
        </section>
      )}

      {tiers.length > 0 && (
        <section className="space-y-2 rounded-2xl bg-bone p-4">
          <h2 className="label !mb-1">{t("خصم الكمية", "Quantity discount")}</h2>
          <div className="flex flex-wrap gap-2">
            {tiers.map((x) => (
              <span key={x.min_qty} className={cn("rounded-full border px-3 py-1 text-xs font-bold", pct === x.discount_percent ? "border-pine bg-pine text-white dark:text-night" : "border-line bg-paper")}>{x.min_qty}+ {t("قطعة", "pcs")} → -{x.discount_percent}%</span>
            ))}
          </div>
          <p className="text-xs text-mute">
            {nt ? t(`أضف ${nt.min_qty - totalQty} قطعة أخرى لتوفّر ${nt.discount_percent}% على كل قطعة.`, `Add ${nt.min_qty - totalQty} more piece(s) to save ${nt.discount_percent}% on every piece.`) : t("حصلت على أعلى خصم متاح.", "You have the best available discount.")}
            {" "}{t("الخصم يُحسب على مجموع كل قطع الطباعة في سلتك.", "The discount applies to all custom pieces in your bag.")}
          </p>
        </section>
      )}

      <section className="space-y-2">
        <label htmlFor="d-notes" className="label">{dict.designer.notes}</label>
        <textarea id="d-notes" rows={3} maxLength={1000} className="field" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder={t("مثال: الشعار بحجم أصغر قليلاً، اللون الذهبي للنص…", "e.g. logo slightly smaller, gold colour for the text…")} />
      </section>

      <section className="space-y-3 rounded-[1.75rem] bg-bone p-5">
        <p className="eyebrow text-mute">{dict.designer.estimatedPrice}</p>
        <div className="space-y-1.5 text-sm">
          <Row l={`${dict.designer.base} — ${locale === "ar" ? garment.name_ar : garment.name_en}`} v={formatIQD(basePrice, locale)} />
          {placements.map((p) => <Row key={p.code} l={`${dict.designer.printCost}: ${p.label}`} v={`+${formatIQD(p.price, locale)}`} muted />)}
          {picked.filter((o) => o.price > 0).map((o) => <Row key={o.id} l={name(o)} v={`+${formatIQD(o.price, locale)}`} muted />)}
        </div>
        <div className="space-y-1 border-t border-line pt-3 text-sm">
          <Row l={t("سعر القطعة", "Per piece")} v={formatIQD(unit, locale)} />
          {pct > 0 && <Row l={`${t("خصم الكمية", "Quantity discount")} (-${pct}%)`} v={`-${formatIQD(unit - unitAfter, locale)}`} good />}
          <Row l={`${t("الإجمالي", "Total")} (${totalQty} ${t("قطعة", "pcs")})`} v={formatIQD(unitAfter * totalQty, locale)} bold />
        </div>
        <p className="text-xs text-mute">{t("مدة التجهيز", "Production time")}: <b className="text-ink">{days ? `${days} ${t("أيام", "days")} (${t("تجهيز سريع", "rush")})` : `${settings.lead_days_min}–${settings.lead_days_max} ${t("أيام عمل", "working days")}`}</b> {t("قبل الشحن", "before dispatch")}</p>
      </section>
    </div>
  );
}

function Row({ l, v, muted, good, bold }: { l: string; v: string; muted?: boolean; good?: boolean; bold?: boolean }) {
  return <div className={cn("flex justify-between gap-3", muted && "text-mute", good && "font-semibold text-pine", bold && "text-base font-extrabold")}><span>{l}</span><span className="tabular-nums">{v}</span></div>;
}
