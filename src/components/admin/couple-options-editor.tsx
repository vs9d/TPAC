"use client";
import { useState } from "react";
import { ArrowDown, ArrowUp, HeartHandshake, Plus, Trash2 } from "lucide-react";
import { newFieldKey, PIECES, TYPE_LABELS, type CoupleOptions, type OptionField, type OptionFieldType } from "@/lib/couple-options";

const PRESETS: { ar: string; en: string; field: Omit<OptionField, "key"> }[] = [
  { ar: "حرف لكل هودي", en: "A letter per hoodie", field: { label_ar: "الحرف", label_en: "Letter", type: "letter", per_piece: true, required: true } },
  { ar: "اسم لكل هودي", en: "A name per hoodie", field: { label_ar: "الاسم", label_en: "Name", type: "text", per_piece: true, required: true } },
  { ar: "تاريخ للطقم", en: "A date for the set", field: { label_ar: "التاريخ", label_en: "Date", type: "date", per_piece: false, required: true } },
  { ar: "حرف الردن", en: "Sleeve letter", field: { label_ar: "حرف الردن", label_en: "Sleeve letter", type: "letter", per_piece: true, required: false } },
  { ar: "تاريخ الردن", en: "Sleeve date", field: { label_ar: "تاريخ الردن", label_en: "Sleeve date", type: "date", per_piece: false, required: false } },
];

/**
 * «خيارات الطقم»: turns a product into a couple set whose page asks for the second hoodie's size and
 * for names / letters / dates. Sent with the product form as `couple_options_json` ("" = none).
 */
export function CoupleOptionsEditor({ initial, locale }: { initial?: CoupleOptions | null; locale: "ar" | "en" }) {
  const L = (ar: string, en: string) => (locale === "ar" ? ar : en);
  const [on, setOn] = useState(!!initial);
  const [cfg, setCfg] = useState<CoupleOptions>(initial ?? { second_size: true, fields: [] });
  const setField = (i: number, patch: Partial<OptionField>) => setCfg((c) => ({ ...c, fields: c.fields.map((f, n) => (n === i ? { ...f, ...patch } : f)) }));
  const move = (i: number, d: number) =>
    setCfg((c) => {
      const f = [...c.fields];
      const j = i + d;
      if (j < 0 || j >= f.length) return c;
      [f[i], f[j]] = [f[j], f[i]];
      return { ...c, fields: f };
    });
  const addField = (field: Omit<OptionField, "key">) => setCfg((c) => (c.fields.length >= 8 ? c : { ...c, fields: [...c.fields, { key: newFieldKey(), ...field }] }));
  const valid = cfg.fields.every((f) => f.label_ar.trim());
  const json = on ? JSON.stringify({ ...cfg, fields: cfg.fields.map((f) => ({ ...f, label_ar: f.label_ar.trim(), label_en: f.label_en.trim() })) }) : "";

  return (
    <div className="card-admin space-y-4 p-5">
      <input type="hidden" name="couple_options_present" value="1" />
      <input type="hidden" name="couple_options_json" value={valid ? json : "invalid"} />
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="flex items-center gap-2 text-sm font-bold"><HeartHandshake className="size-4 text-pine" /> {L("خيارات الطقم (للمرتبطين)", "Couple set options")}</p>
          <p className="mt-1 text-xs text-mute">{L("خانات يعبّيها الزبون بصفحة المنتج: قياس الهودي الثاني، واسم أو حرف أو تاريخ لكل هودي أو للطقم. تطلع بالسلة والطلب والفاتورة.", "Boxes the customer fills in on the product page: the second hoodie's size, and a name, letter or date per hoodie or for the set. They show in the bag, the order and the invoice.")}</p>
        </div>
        <label className="flex shrink-0 items-center gap-2 text-sm font-semibold">
          <input type="checkbox" checked={on} onChange={(e) => setOn(e.target.checked)} className="size-4 accent-ink" /> {L("مفعّل", "On")}
        </label>
      </div>

      {on && (
        <>
          <label className="flex items-center gap-2.5 text-sm">
            <input type="checkbox" checked={cfg.second_size} onChange={(e) => setCfg((c) => ({ ...c, second_size: e.target.checked }))} className="size-4 accent-ink" />
            {L("اطلب قياس الهودي الثاني (القياس العادي يصير للهودي الأول)", "Ask for the second hoodie's size (the usual size becomes the first hoodie's)")}
          </label>

          {cfg.fields.length > 0 && (
            <ul className="space-y-3">
              {cfg.fields.map((f, i) => (
                <li key={f.key} className="space-y-3 rounded-2xl border border-line p-3">
                  <div className="grid gap-3 sm:grid-cols-[1fr_1fr_9rem]">
                    <input value={f.label_ar} onChange={(e) => setField(i, { label_ar: e.target.value })} maxLength={60} dir="rtl" placeholder={L("اسم الخانة (عربي) — مثلاً: الحرف", "Box name (Arabic)")} className={`field h-10 ${f.label_ar.trim() ? "" : "border-danger"}`} aria-label={L("اسم الخانة (عربي)", "Box name (Arabic)")} />
                    <input value={f.label_en} onChange={(e) => setField(i, { label_en: e.target.value })} maxLength={60} dir="ltr" placeholder={L("بالإنجليزي (اختياري)", "English (optional)")} className="field h-10" aria-label={L("اسم الخانة (إنجليزي)", "Box name (English)")} />
                    <select value={f.type} onChange={(e) => setField(i, { type: e.target.value as OptionFieldType })} className="field h-10" aria-label={L("النوع", "Type")}>
                      {(Object.keys(TYPE_LABELS) as OptionFieldType[]).map((t) => <option key={t} value={t}>{L(TYPE_LABELS[t][0], TYPE_LABELS[t][1])}</option>)}
                    </select>
                  </div>
                  <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-sm">
                    <label className="flex items-center gap-2"><input type="checkbox" checked={f.per_piece} onChange={(e) => setField(i, { per_piece: e.target.checked })} className="size-4 accent-ink" /> {L("لكل هودي (خانتين)", "Per hoodie (two boxes)")}</label>
                    <label className="flex items-center gap-2"><input type="checkbox" checked={f.required} onChange={(e) => setField(i, { required: e.target.checked })} className="size-4 accent-ink" /> {L("إجباري", "Required")}</label>
                    <span className="text-xs text-mute">
                      {f.per_piece ? `${f.label_ar || "…"} — ${PIECES[0][0]} / ${PIECES[1][0]}` : L("خانة وحدة للطقم", "One box for the set")}
                    </span>
                    <span className="ms-auto flex gap-1">
                      <button type="button" onClick={() => move(i, -1)} disabled={i === 0} className="grid size-8 place-items-center rounded-full hover:bg-bone disabled:opacity-30" aria-label={L("لفوق", "Up")}><ArrowUp className="size-4" /></button>
                      <button type="button" onClick={() => move(i, 1)} disabled={i === cfg.fields.length - 1} className="grid size-8 place-items-center rounded-full hover:bg-bone disabled:opacity-30" aria-label={L("لجوة", "Down")}><ArrowDown className="size-4" /></button>
                      <button type="button" onClick={() => setCfg((c) => ({ ...c, fields: c.fields.filter((_, n) => n !== i) }))} className="grid size-8 place-items-center rounded-full text-danger hover:bg-danger/10" aria-label={L("حذف", "Delete")}><Trash2 className="size-4" /></button>
                    </span>
                  </div>
                </li>
              ))}
            </ul>
          )}

          {cfg.fields.length < 8 && (
            <div className="flex flex-wrap gap-2">
              {PRESETS.map((p) => (
                <button key={p.ar} type="button" onClick={() => addField(p.field)} className="chip h-9 gap-1.5 text-xs"><Plus className="size-3.5" /> {L(p.ar, p.en)}</button>
              ))}
              <button type="button" onClick={() => addField({ label_ar: "", label_en: "", type: "text", per_piece: false, required: false })} className="chip h-9 gap-1.5 border-dashed text-xs"><Plus className="size-3.5" /> {L("خانة جديدة", "New box")}</button>
            </div>
          )}
          {!valid && <p className="text-xs font-semibold text-danger">{L("اكتب اسم كل خانة بالعربي — بدونه ما تنحفظ الخيارات.", "Give every box an Arabic name — otherwise the options are not saved.")}</p>}
        </>
      )}
    </div>
  );
}
