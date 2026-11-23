"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ExternalLink, Layers, Loader2, Save } from "lucide-react";
import { useI18n } from "@/components/i18n-provider";
import { adminT } from "@/lib/admin-i18n";
import { toast } from "@/components/ui/toast";
import { linkGarment } from "@/lib/actions/admin/products";
import { ensureFreeArea, saveProductPrinting } from "@/lib/actions/admin/printing";
import { uploadProductImage } from "@/lib/admin-upload";
import { composeProductImage } from "@/lib/compose";
import { mapDesigns, mockupFor, normArea, viewAspect, type PrintAreaRow, type ProductDesignRow, type ProductTypeRow } from "@/lib/print-config";
import { formatIQD } from "@/lib/format";
import type { Color } from "@/lib/types";

const pendingKey = (id: string) => `tpac:garment-links:${id}`;
type Choice = Record<string, { enabled: boolean; price: string }>;

export interface GarmentLink { id: string; slug: string; type_id: string; base_price: number; is_published: boolean }

/**
 * «متوفر أيضاً كـ»: the admin offers this product's artwork on other garments (hoodie → t-shirt …) with their own
 * price. Each one becomes a linked product (shown to customers as a garment switch on the product page);
 * the artwork is carried to the same spot of the other garment and its photos are generated here.
 */
export function GarmentLinks({ productId, sourceType, designs, types, colors, colorIds, links }: {
  productId: string; sourceType: ProductTypeRow; designs: ProductDesignRow[]; types: ProductTypeRow[];
  colors: Color[]; colorIds: string[]; links: GarmentLink[];
}) {
  const { locale } = useI18n();
  const t = adminT(locale);
  const router = useRouter();
  const others = types.filter((x) => x.id !== sourceType.id && x.is_active && (x.product_type_views ?? []).some((v) => v.is_active));
  const [rows, setRows] = useState(() => Object.fromEntries(others.map((x) => {
    const l = links.find((y) => y.type_id === x.id);
    return [x.id, { enabled: l ? l.is_published : false, price: String(l?.base_price ?? x.default_price ?? 0) }];
  })));
  const [busy, setBusy] = useState("");
  const [status, setStatus] = useState("");

  /** carries the saved artwork to the other garment and generates its photos */
  const build = async (siblingId: string, dst: ProductTypeRow) => {
    const mapped = mapDesigns(sourceType, designs, dst);
    if (!mapped.length) return 0;
    const free: Record<string, PrintAreaRow> = {};
    for (const m of mapped) {
      if (free[m.view.id]) continue;
      const r = await ensureFreeArea(m.view.id);
      if (!r.ok) throw new Error("free area");
      free[m.view.id] = normArea(r.area as unknown as PrintAreaRow);
    }
    const files = new Map<string, { url: string; path: string }>();
    const items = [];
    for (const m of mapped) {
      let f = files.get(m.source.artwork_url);
      if (!f) {
        const blob = await (await fetch(m.source.artwork_url)).blob();
        const ext = (blob.type.split("/")[1] ?? "png").replace("jpeg", "jpg").replace(/[^a-z0-9]/g, "") || "png";
        f = await uploadProductImage(blob, `products/${siblingId}/art/${crypto.randomUUID()}.${ext}`, blob.type || "image/png");
        files.set(m.source.artwork_url, f);
      }
      items.push({ m, f });
    }
    const views = [...new Map(mapped.map((m) => [m.view.id, m.view])).values()].slice(0, 4);
    const cols = colors.filter((c) => colorIds.includes(c.id)).slice(0, 6);
    const jobs = (cols.length ? cols : [null]).flatMap((c) => views.map((v) => ({ c, v })));
    const images = [];
    let done = 0;
    for (const { c, v } of jobs) {
      const src = mockupFor(v, dst.garment_shape, c);
      if (!src) continue;
      setStatus(t(`جارِ تجهيز الصور ${++done}/${jobs.length}…`, `Preparing photos ${done}/${jobs.length}…`));
      const blob = await composeProductImage(src, viewAspect(v), items.filter((x) => x.m.view.id === v.id).map((x) => ({ url: x.f.url, ...x.m.rect })));
      const up = await uploadProductImage(blob, `products/${siblingId}/gen/${crypto.randomUUID()}.jpg`, "image/jpeg");
      images.push({ url: up.url, storage_path: up.path, color_id: c?.id ?? null, view_id: v.id });
    }
    const r = await saveProductPrinting({
      product_id: siblingId, product_type_id: dst.id, print_enabled: true, disabled_print_area_ids: [],
      designs: items.map(({ m, f }) => ({ area_id: free[m.view.id]!.id, artwork_url: f.url, artwork_path: f.path, artwork_width: Math.round(m.source.artwork_width ?? 1000), artwork_height: Math.round(m.source.artwork_height ?? 1000), ...m.rect })),
      images,
    });
    if (!r?.ok) throw new Error("save");
    return items.length;
  };

  const save = async (dst: ProductTypeRow, given?: { enabled: boolean; price: string }) => {
    const row = given ?? rows[dst.id]!;
    const price = Math.round(Number(row.price));
    if (!Number.isFinite(price) || price < 0) { toast.error(t("اكتب سعراً صحيحاً", "Enter a valid price")); return; }
    const existing = links.find((l) => l.type_id === dst.id);
    if (!existing && !row.enabled) { toast.info(t("فعّل الخيار أولاً", "Turn it on first")); return; }
    setBusy(dst.id);
    setStatus(t("جارِ الحفظ…", "Saving…"));
    try {
      const r = await linkGarment({ product_id: productId, type_id: dst.id, price, enabled: row.enabled });
      if (!r.ok) {
        toast.error(r.error === "needs_sql" ? t("شغّل ملف supabase/add-garment-links.sql أولاً", "Run supabase/add-garment-links.sql first") : t("تعذّر الحفظ", "Couldn't save"));
        return;
      }
      // the artwork follows the original product (also re-synced on every save while it is on)
      // (the original product of the group keeps its own artwork)
      if (row.enabled && !r.root) await build(r.id, dst);
      toast.success(row.enabled ? t(`صار متوفر كـ${dst.name_ar} بسعر ${formatIQD(price, "ar")}`, `Now also available as ${dst.name_en} at ${formatIQD(price, "en")}`) : t("تم الإخفاء", "Hidden"));
      router.refresh();
    } catch (e) {
      console.error(e);
      toast.error(t("تعذّر تجهيز المنتج — حاول مرة ثانية", "Couldn't prepare the product — try again"));
    } finally {
      setBusy("");
      setStatus("");
    }
  };

  // choices made while adding the product: applied once, right after it was created
  const auto = useRef(false);
  useEffect(() => {
    if (auto.current) return;
    auto.current = true;
    let pending: Choice | null = null;
    try { pending = JSON.parse(sessionStorage.getItem(pendingKey(productId)) ?? "null"); sessionStorage.removeItem(pendingKey(productId)); } catch { pending = null; }
    if (!pending || links.length) return;
    const todo = others.filter((x) => pending![x.id]?.enabled);
    if (!todo.length) return;
    setRows((m) => ({ ...m, ...Object.fromEntries(todo.map((x) => [x.id, pending![x.id]!])) }));
    void (async () => {
      for (const x of todo) await save(x, pending![x.id]);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!others.length) return <p className="text-sm text-mute">{t("ماكو أنواع ثانية — أضفها من «أنواع المنتجات».", "No other product types — add them under Product types.")}</p>;
  return (
    <div className="relative space-y-3">
      <p className="text-sm text-mute">{t("الزبون اللي يشوف هذا المنتج يگدر يختار نفس التصميم على قطعة ثانية. فعّل القطعة وحدد سعرها — التصميم ينتقل لنفس المكان وصورها تتجهز تلقائياً.", "Customers viewing this product can pick the same design on another garment. Turn a garment on and set its price — the artwork moves to the same spot and its photos are generated automatically.")}</p>
      {others.map((x) => {
        const row = rows[x.id]!;
        const link = links.find((l) => l.type_id === x.id);
        return (
          <div key={x.id} className="flex flex-wrap items-center gap-3 rounded-2xl border border-line p-3">
            <label className="flex min-w-40 flex-1 items-center gap-2 text-sm font-bold">
              <input type="checkbox" className="size-5 accent-[var(--color-pine)]" checked={row.enabled} onChange={(e) => setRows((m) => ({ ...m, [x.id]: { ...row, enabled: e.target.checked } }))} aria-label={t(`متوفر كـ${x.name_ar}`, `Available as ${x.name_en}`)} />
              <Layers className="size-4 text-pine" /> {locale === "ar" ? x.name_ar : x.name_en}
              {link && <span className={link.is_published ? "rounded-full bg-pine/10 px-2 text-[11px] text-pine" : "rounded-full bg-bone px-2 text-[11px] text-mute"}>{link.is_published ? t("ظاهر", "Live") : t("مخفي", "Hidden")}</span>}
            </label>
            <label className="flex items-center gap-2 text-xs font-semibold text-mute">
              {t("السعر", "Price")}
              <input type="number" inputMode="numeric" min={0} step={250} value={row.price} onChange={(e) => setRows((m) => ({ ...m, [x.id]: { ...row, price: e.target.value } }))} className="field h-10 w-32" aria-label={t(`سعر ${x.name_ar}`, `${x.name_en} price`)} />
            </label>
            <button type="button" disabled={!!busy} onClick={() => save(x)} className="btn btn-brand btn-sm">{busy === x.id ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />} {t("حفظ", "Save")}</button>
            {link && <Link href={`/${locale}/admin/products/${link.id}`} className="btn btn-outline btn-sm"><ExternalLink className="size-4" /> {t("فتح", "Open")}</Link>}
          </div>
        );
      })}
      {!designs.length && <p className="text-xs text-amber">{t("احفظ التصميم على المنتج أولاً حتى ينتقل للقطع الثانية.", "Save the artwork on this product first so it can move to the other garments.")}</p>}
      {status && <div className="absolute inset-0 z-20 grid place-items-center rounded-2xl bg-paper/80"><p className="flex items-center gap-2 text-sm font-semibold"><Loader2 className="size-4 animate-spin" /> {status}</p></div>}
    </div>
  );
}

/** Same choice while ADDING a product: remembered in this tab and applied as soon as the product is created. */
export function GarmentLinksDraft({ productId, types, currentTypeId }: { productId: string; types: ProductTypeRow[]; currentTypeId: string }) {
  const { locale } = useI18n();
  const t = adminT(locale);
  const others = types.filter((x) => x.id !== currentTypeId && x.is_active && (x.product_type_views ?? []).some((v) => v.is_active));
  const [rows, setRows] = useState<Choice>(() => Object.fromEntries(others.map((x) => [x.id, { enabled: false, price: String(x.default_price ?? 0) }])));
  useEffect(() => {
    try {
      if (Object.values(rows).some((r) => r.enabled)) sessionStorage.setItem(pendingKey(productId), JSON.stringify(rows));
      else sessionStorage.removeItem(pendingKey(productId));
    } catch { /* private mode */ }
  }, [rows, productId]);
  if (!others.length) return null;
  return (
    <div className="space-y-2">
      <p className="text-xs text-mute">{t("فعّل القطع اللي تريد نفس التصميم يكون متوفر عليها وحدد سعرها. تنعمل تلقائياً بعد إنشاء المنتج.", "Turn on the garments that should also carry this design and set their price. They are created right after the product.")}</p>
      {others.map((x) => {
        const row = rows[x.id]!;
        return (
          <div key={x.id} className="flex flex-wrap items-center gap-3 rounded-2xl border border-line p-3">
            <label className="flex min-w-40 flex-1 items-center gap-2 text-sm font-bold">
              <input type="checkbox" className="size-5 accent-[var(--color-pine)]" checked={row.enabled} onChange={(e) => setRows((m) => ({ ...m, [x.id]: { ...row, enabled: e.target.checked } }))} aria-label={t(`متوفر كـ${x.name_ar}`, `Available as ${x.name_en}`)} />
              <Layers className="size-4 text-pine" /> {locale === "ar" ? x.name_ar : x.name_en}
            </label>
            <label className="flex items-center gap-2 text-xs font-semibold text-mute">
              {t("السعر", "Price")}
              <input type="number" inputMode="numeric" min={0} step={250} value={row.price} disabled={!row.enabled} onChange={(e) => setRows((m) => ({ ...m, [x.id]: { ...row, price: e.target.value } }))} className="field h-10 w-32" aria-label={t(`سعر ${x.name_ar}`, `${x.name_en} price`)} />
            </label>
          </div>
        );
      })}
    </div>
  );
}
