"use client";
import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ImagePlus, Link2, Loader2, Plus, Save, Trash2, Unlink2 } from "lucide-react";
import { useI18n } from "@/components/i18n-provider";
import { adminT } from "@/lib/admin-i18n";
import { toast } from "@/components/ui/toast";
import { checkImageFile, extOf, imageSize, uploadProductImage } from "@/lib/admin-upload";
import { clampRect, lockedAreaHeight, mockupFor, slugCode, viewAspect, type PrintAreaRow, type ProductTypeRow, type TypeViewRow } from "@/lib/print-config";
import { deletePrintArea, deleteTypeView, discardPrintFile, saveTypeView, saveViewAreas, setViewMockup } from "@/lib/actions/admin/printing";
import { cn } from "@/lib/format";
import type { Color } from "@/lib/types";
import { DragRect, MockupStage } from "./stage";

type DraftArea = Omit<PrintAreaRow, "id" | "view_id"> & { id?: string; key: string; lock: boolean };
const toDraft = (a: PrintAreaRow): DraftArea => ({ ...a, key: a.id, lock: false });

/** Views + mockups + print areas of one product type. */
export function TypeEditor({ type, colors }: { type: ProductTypeRow; colors: Color[] }) {
  const { locale } = useI18n();
  const t = adminT(locale);
  const router = useRouter();
  const views = type.product_type_views ?? [];
  const [viewId, setViewId] = useState(views[0]?.id ?? "");
  const view = views.find((v) => v.id === viewId) ?? views[0];
  const [previewColor, setPreviewColor] = useState<string>("");
  const [areas, setAreas] = useState<DraftArea[]>(() => (view?.product_print_areas ?? []).map(toDraft));
  const [sel, setSel] = useState<string>(areas[0]?.key ?? "");
  const [dirty, setDirty] = useState(false);
  const [busy, setBusy] = useState("");
  const [saving, start] = useTransition();

  // switching view (or fresh server data) reloads its areas
  useEffect(() => {
    const list = (view?.product_print_areas ?? []).map(toDraft);
    setAreas(list);
    setSel((s) => (list.some((a) => a.key === s) ? s : list[0]?.key ?? ""));
    setDirty(false);
  }, [view]);

  const typeColors = useMemo(() => {
    const def = colors.filter((c) => type.default_color_ids.includes(c.id));
    return def.length ? def : colors;
  }, [colors, type.default_color_ids]);
  const color = colors.find((c) => c.id === previewColor) ?? null;
  if (!view) return <p className="text-sm text-mute">{t("لا توجد زوايا — أضف زاوية.", "No views — add one.")}</p>;
  const mockup = mockupFor(view, type.garment_shape, color ?? typeColors[0] ?? null);
  const aspect = viewAspect(view);
  const cur = areas.find((a) => a.key === sel);

  const patch = (key: string, p: Partial<DraftArea>) => {
    setAreas((list) => list.map((a) => {
      if (a.key !== key) return a;
      let n = { ...a, ...p };
      if (n.lock) n.height = Math.min(1 - n.y, lockedAreaHeight(n, view, n.max_width_cm, n.max_height_cm));
      n = { ...n, ...clampRect(n) };
      return n;
    }));
    setDirty(true);
  };

  const addArea = () => {
    const key = crypto.randomUUID();
    const n = areas.length + 1;
    setAreas((l) => [...l, { key, code: `area-${n}`, name_ar: `منطقة ${n}`, name_en: `Area ${n}`, x: 0.32, y: 0.3, width: 0.36, height: 0.36, max_width_cm: 25, max_height_cm: 25, sort_order: l.length, is_active: true, lock: false }]);
    setSel(key);
    setDirty(true);
  };

  const removeArea = async (a: DraftArea) => {
    if (!confirm(t(`حذف «${a.name_ar}»؟`, `Delete “${a.name_en}”?`))) return;
    if (a.id) {
      const r = await deletePrintArea(a.id);
      if (!r?.ok) {
        toast.error(r && !r.ok && r.error === "in_use" ? t("منتجات تستخدم هذه المنطقة — احذف تصميمها أولاً", "Products use this area — remove their artwork first") : t("تعذّر الحذف", "Couldn't delete"));
        return;
      }
    }
    setAreas((l) => l.filter((x) => x.key !== a.key));
    toast.success(t("تم الحذف", "Deleted"));
    router.refresh();
  };

  const save = () => start(async () => {
    const payload = areas.map((a, i) => ({ id: a.id, code: slugCode(a.code) || `area-${i + 1}`, name_ar: a.name_ar.trim(), name_en: a.name_en.trim() || a.name_ar.trim(), x: a.x, y: a.y, width: a.width, height: a.height, max_width_cm: Number(a.max_width_cm), max_height_cm: Number(a.max_height_cm), sort_order: i, is_active: a.is_active }));
    if (payload.some((a) => !a.name_ar || !(a.max_width_cm > 0) || !(a.max_height_cm > 0))) {
      toast.error(t("كل منطقة تحتاج اسماً وأبعاداً بالسنتيمتر", "Every area needs a name and a size in cm"));
      return;
    }
    const r = await saveViewAreas(view.id, payload);
    if (!r?.ok) {
      toast.error(r && !r.ok && r.error === "duplicate" ? t("رمز المنطقة مكرر", "Area codes must be unique") : t("تعذّر الحفظ — تأكد أن المناطق داخل الصورة", "Couldn't save — keep the areas inside the image"));
      return;
    }
    toast.success(t("تم حفظ مناطق الطباعة", "Print areas saved"));
    setDirty(false);
    router.refresh();
  });

  const upload = async (file: File, colorId: string | null) => {
    const err = checkImageFile(file);
    if (err) {
      toast.error(err === "type" ? t("الصيغ المسموحة: JPG, PNG, WEBP, AVIF", "Allowed: JPG, PNG, WEBP, AVIF") : t("الحد ٨ ميغابايت", "Max 8 MB"));
      return;
    }
    setBusy(colorId ?? "default");
    try {
      const size = await imageSize(file);
      if (colorId && Math.abs(size.width / size.height - aspect) > 0.03 * aspect && view.mockup_url) {
        toast.info(t("تنبيه: أبعاد صورة هذا اللون تختلف عن الصورة الأساسية — قد لا تتطابق مناطق الطباعة.", "Note: this colour's photo has different proportions from the default one — print areas may not line up."));
      }
      const { url, path } = await uploadProductImage(file, `mockups/${type.id}/${view.id}/${crypto.randomUUID()}.${extOf(file.type)}`, file.type);
      const r = await setViewMockup({ view_id: view.id, color_id: colorId, url, path, width: size.width, height: size.height });
      if (!r?.ok) {
        await discardPrintFile(path);
        throw new Error("save");
      }
      toast.success(t("تم رفع صورة الموك أب", "Mockup uploaded"));
      router.refresh();
    } catch {
      toast.error(t("تعذّر رفع الصورة", "Upload failed"));
    } finally {
      setBusy("");
    }
  };
  const clearMockup = async (colorId: string | null) => {
    if (!confirm(t("إزالة هذه الصورة؟", "Remove this image?"))) return;
    const r = await setViewMockup({ view_id: view.id, color_id: colorId, url: null, path: null });
    if (r?.ok) router.refresh();
  };

  const addView = async () => {
    const name_ar = prompt(t("اسم الزاوية بالعربي (مثلاً: جانبي)", "View name in Arabic (e.g. جانبي)"))?.trim();
    if (!name_ar) return;
    const name_en = prompt(t("اسم الزاوية بالإنجليزي (مثلاً: Side)", "View name in English (e.g. Side)"))?.trim() || name_ar;
    const r = await saveTypeView({ product_type_id: type.id, name_ar, name_en, code: slugCode(name_en) || undefined, sort_order: views.length });
    if (!r?.ok) toast.error(r && !r.ok && r.error === "duplicate" ? t("الاسم مستخدم", "Name already used") : t("تعذّر الإضافة", "Couldn't add"));
    else {
      toast.success(t("تمت إضافة الزاوية — ارفع صورتها وحدد منطقة الطباعة", "View added — upload its photo and draw its print area"));
      if (r.id) setViewId(r.id);
      router.refresh();
    }
  };
  const renameView = async (v: TypeViewRow, active: boolean) => {
    const r = await saveTypeView({ id: v.id, product_type_id: type.id, name_ar: v.name_ar, name_en: v.name_en, sort_order: v.sort_order, is_active: active });
    if (r?.ok) router.refresh();
  };
  const removeView = async (v: TypeViewRow) => {
    if (!confirm(t(`حذف زاوية «${v.name_ar}» وكل مناطقها؟ تصاميم المنتجات عليها ستُحذف.`, `Delete the “${v.name_en}” view and its areas? Product artwork on it will be removed.`))) return;
    const r = await deleteTypeView(v.id);
    if (r?.ok) {
      setViewId(views.find((x) => x.id !== v.id)?.id ?? "");
      router.refresh();
    }
  };

  return (
    <div className="space-y-5">
      {/* views */}
      <div className="flex flex-wrap items-center gap-2">
        {views.map((v) => (
          <button key={v.id} onClick={() => { if (dirty && !confirm(t("لديك تغييرات غير محفوظة. المتابعة؟", "You have unsaved changes. Continue?"))) return; setViewId(v.id); }} aria-pressed={v.id === view.id} className={cn("chip h-10 px-4", !v.is_active && "opacity-50")}>
            {locale === "ar" ? v.name_ar : v.name_en} <span className="text-xs opacity-60">· {(v.product_print_areas ?? []).length}</span>
          </button>
        ))}
        <button onClick={addView} className="chip h-10 border-dashed px-4"><Plus className="size-4" /> {t("زاوية جديدة", "New view")}</button>
      </div>

      <div className="grid gap-5 lg:grid-cols-5">
        {/* stage */}
        <div className="space-y-3 lg:col-span-3">
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <span className="font-semibold text-mute">{t("معاينة باللون:", "Preview in:")}</span>
            {typeColors.map((c) => (
              <button key={c.id} onClick={() => setPreviewColor(c.id)} aria-pressed={(color ?? typeColors[0])?.id === c.id} title={locale === "ar" ? c.name_ar : c.name_en} className={cn("size-7 rounded-full border", (color ?? typeColors[0])?.id === c.id ? "ring-2 ring-pine ring-offset-2" : "border-ink/20")} style={{ background: c.hex }} />
            ))}
          </div>
          <div className="mx-auto max-w-[560px] pt-6">
            <MockupStage src={mockup} aspect={aspect}>
              {areas.map((a) => (
                <DragRect
                  key={a.key}
                  rect={a}
                  selected={a.key === sel}
                  onSelect={() => setSel(a.key)}
                  onChange={(r) => patch(a.key, a.lock ? { x: r.x, y: r.y, width: r.width } : r)}
                  aspect={a.lock ? (a.max_height_cm / a.max_width_cm) * (view.mockup_width / view.mockup_height) : null}
                  label={`${locale === "ar" ? a.name_ar : a.name_en} · ${a.max_width_cm}×${a.max_height_cm} cm`}
                  tone={a.is_active ? "area" : "muted"}
                />
              ))}
            </MockupStage>
          </div>
          <p className="text-center text-xs text-mute">{t("اسحب المنطقة لتحريكها، والزوايا البرتقالية لتغيير حجمها. القياس بالسنتيمتر يحدد أكبر حجم طباعة مسموح.", "Drag an area to move it and the orange corners to resize. The cm size is the largest print allowed.")}</p>
          <div className="flex flex-wrap justify-center gap-2">
            <button onClick={addArea} className="btn btn-outline btn-sm"><Plus className="size-4" /> {t("منطقة طباعة", "Print area")}</button>
            <button onClick={save} disabled={saving || !dirty} className="btn btn-brand btn-sm">{saving ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />} {t("حفظ المناطق", "Save areas")}{dirty ? " •" : ""}</button>
          </div>
        </div>

        {/* side panel */}
        <div className="space-y-5 lg:col-span-2">
          {cur && (
            <div className="card-admin space-y-3 p-4">
              <p className="text-sm font-bold">{t("المنطقة المحددة", "Selected area")}</p>
              <div className="grid grid-cols-2 gap-2">
                <L label={t("الاسم (عربي)", "Name (AR)")}><input className="field h-10" value={cur.name_ar} onChange={(e) => patch(cur.key, { name_ar: e.target.value })} /></L>
                <L label={t("الاسم (إنجليزي)", "Name (EN)")}><input className="field h-10" dir="ltr" value={cur.name_en} onChange={(e) => patch(cur.key, { name_en: e.target.value })} /></L>
                <L label={t("أقصى عرض (سم)", "Max width (cm)")}><input className="field h-10" type="number" min={1} max={200} step={0.5} value={cur.max_width_cm} onChange={(e) => patch(cur.key, { max_width_cm: Number(e.target.value) || 0 })} /></L>
                <L label={t("أقصى ارتفاع (سم)", "Max height (cm)")}><input className="field h-10" type="number" min={1} max={200} step={0.5} value={cur.max_height_cm} onChange={(e) => patch(cur.key, { max_height_cm: Number(e.target.value) || 0 })} /></L>
              </div>
              <button type="button" onClick={() => patch(cur.key, { lock: !cur.lock })} className={cn("flex items-center gap-2 text-xs font-semibold", cur.lock ? "text-pine" : "text-mute")}>
                {cur.lock ? <Link2 className="size-4" /> : <Unlink2 className="size-4" />} {t("اجعل شكل المنطقة مطابقاً لنسبة السنتيمترات", "Match the area's shape to its cm proportions")}
              </button>
              <div className="grid grid-cols-4 gap-2">
                {(["x", "y", "width", "height"] as const).map((k) => (
                  <L key={k} label={{ x: t("أفقي %", "X %"), y: t("عمودي %", "Y %"), width: t("العرض %", "W %"), height: t("الارتفاع %", "H %") }[k]}>
                    <input className="field h-10 px-2 text-sm" type="number" step={0.5} min={0} max={100} value={Math.round(cur[k] * 1000) / 10} onChange={(e) => patch(cur.key, { [k]: (Number(e.target.value) || 0) / 100 })} />
                  </L>
                ))}
              </div>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <label className="flex items-center gap-2 text-sm"><input type="checkbox" className="size-4 accent-ink" checked={cur.is_active} onChange={(e) => patch(cur.key, { is_active: e.target.checked })} /> {t("متاحة للطباعة", "Printing enabled")}</label>
                <button onClick={() => removeArea(cur)} className="btn btn-sm border border-danger text-danger"><Trash2 className="size-4" /> {t("حذف", "Delete")}</button>
              </div>
              <p className="text-[11px] text-mute">{t("الرمز:", "Code:")} <span dir="ltr">{cur.code}</span></p>
            </div>
          )}

          <div className="card-admin space-y-3 p-4">
            <p className="text-sm font-bold">{t("صورة القطعة الفارغة (موك أب)", "Blank product photo (mockup)")}</p>
            <p className="text-xs text-mute">{t("صورة القطعة بدون تصميم من هذه الزاوية. صورة لكل لون تعطي معاينة أدق، وإلا تُستخدم الصورة الأساسية لكل الألوان.", "The garment without any design, from this angle. One photo per colour gives the most accurate preview; otherwise the default photo is used for every colour.")}</p>
            <MockupSlot label={t("الصورة الأساسية", "Default photo")} url={view.mockup_url} busy={busy === "default"} onFile={(f) => upload(f, null)} onClear={view.mockup_url ? () => clearMockup(null) : undefined} hint={view.mockup_url ? `${view.mockup_width}×${view.mockup_height}px` : type.garment_shape ? t("حالياً: رسم القطعة المدمج", "Now: built-in drawing") : t("لا توجد صورة", "No photo")} />
            <div className="grid grid-cols-2 gap-2">
              {typeColors.map((c) => (
                <MockupSlot key={c.id} small label={locale === "ar" ? c.name_ar : c.name_en} swatch={c.hex} url={view.color_mockups?.[c.id]?.url ?? null} busy={busy === c.id} onFile={(f) => upload(f, c.id)} onClear={view.color_mockups?.[c.id] ? () => clearMockup(c.id) : undefined} />
              ))}
            </div>
          </div>

          <div className="card-admin flex flex-wrap items-center justify-between gap-2 p-4 text-sm">
            <label className="flex items-center gap-2"><input type="checkbox" className="size-4 accent-ink" checked={view.is_active} onChange={(e) => renameView(view, e.target.checked)} /> {t("الزاوية ظاهرة", "View visible")}</label>
            <button onClick={() => removeView(view)} className="text-xs font-semibold text-danger underline">{t("حذف هذه الزاوية", "Delete this view")}</button>
          </div>
        </div>
      </div>
    </div>
  );
}

function L({ label, children }: { label: string; children: React.ReactNode }) {
  return <label className="block"><span className="mb-1 block text-[11px] font-semibold text-mute">{label}</span>{children}</label>;
}

function MockupSlot({ label, url, busy, onFile, onClear, hint, swatch, small }: { label: string; url: string | null; busy: boolean; onFile: (f: File) => void; onClear?: () => void; hint?: string; swatch?: string; small?: boolean }) {
  const { locale } = useI18n();
  const t = adminT(locale);
  return (
    <div className="overflow-hidden rounded-2xl border border-line">
      <label className={cn("relative grid cursor-pointer place-items-center bg-bone", small ? "aspect-[4/3]" : "aspect-[16/9]")}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        {url ? <img src={url} alt="" className="absolute inset-0 size-full object-contain" /> : <span className="grid place-items-center gap-1 text-xs font-semibold text-mute">{busy ? <Loader2 className="size-5 animate-spin" /> : <ImagePlus className="size-5" />}{t("رفع صورة", "Upload")}</span>}
        {busy && url && <span className="absolute inset-0 grid place-items-center bg-paper/70"><Loader2 className="size-5 animate-spin" /></span>}
        <input type="file" accept="image/jpeg,image/png,image/webp,image/avif" className="sr-only" disabled={busy} onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ""; if (f) onFile(f); }} />
      </label>
      <div className="flex items-center justify-between gap-2 px-2.5 py-1.5 text-xs">
        <span className="flex min-w-0 items-center gap-1.5 truncate font-semibold">{swatch && <span className="size-3 shrink-0 rounded-full border" style={{ background: swatch }} />}{label}{hint && <span className="font-normal text-mute"> · {hint}</span>}</span>
        {onClear && <button onClick={onClear} className="shrink-0 text-danger" aria-label={t("إزالة", "Remove")}><Trash2 className="size-3.5" /></button>}
      </div>
    </div>
  );
}
