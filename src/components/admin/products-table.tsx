"use client";
import Image from "next/image";
import Link from "next/link";
import { useState } from "react";
import { useI18n } from "@/components/i18n-provider";
import { adminT } from "@/lib/admin-i18n";
import { AdminForm } from "./form";
import { Pill } from "./ui";
import { DuplicateButton } from "./duplicate-button";
import { bulkProducts } from "@/lib/actions/admin/products";
import { formatIQD } from "@/lib/format";
import { Loader2 } from "lucide-react";
import { useFormStatus } from "react-dom";

export interface ProductRow { id: string; slug: string; name_ar: string; name_en: string; base_price: number; is_published: boolean; is_featured: boolean; is_limited: boolean; is_new_arrival: boolean; sales_count: number; category: string | null; image: string | null; stock: number; variants: number }

function ApplyButton({ confirmText }: { confirmText?: string }) {
  const { pending } = useFormStatus();
  const { locale } = useI18n();
  return (
    <button type="submit" disabled={pending} className="btn btn-brand btn-sm h-10" onClick={(e) => { if (confirmText && !confirm(confirmText)) e.preventDefault(); }}>
      {pending && <Loader2 className="size-4 animate-spin" />} {locale === "ar" ? "تطبيق" : "Apply"}
    </button>
  );
}

export function ProductsTable({ rows, categories, collections }: { rows: ProductRow[]; categories: { id: string; name_ar: string; name_en: string }[]; collections: { id: string; name_ar: string; name_en: string }[] }) {
  const { locale } = useI18n();
  const t = adminT(locale);
  const [sel, setSel] = useState<Set<string>>(new Set());
  const [op, setOp] = useState("publish");
  const all = rows.length > 0 && sel.size === rows.length;
  const toggle = (id: string) => setSel((s) => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; });
  const name = (x: { name_ar: string; name_en: string }) => (locale === "ar" ? x.name_ar : x.name_en);
  const ops: [string, string][] = [
    ["publish", t("نشر", "Publish")], ["hide", t("إخفاء", "Hide")], ["feature", t("تمييز ★", "Feature ★")], ["unfeature", t("إلغاء التمييز", "Unfeature")],
    ["new_on", t("وصل حديثاً: تفعيل", "New arrival: on")], ["new_off", t("وصل حديثاً: إيقاف", "New arrival: off")],
    ["price_percent", t("تغيير السعر بنسبة ٪", "Change price by %")], ["price_set", t("تحديد سعر موحّد", "Set one price")],
    ["category", t("نقل إلى فئة", "Move to category")], ["collection", t("إضافة إلى مجموعة", "Add to collection")],
    ["duplicate", t("نسخ", "Duplicate")], ["delete", t("حذف", "Delete")],
  ];

  return (
    <AdminForm action={bulkProducts} successMessage={t("تم التطبيق", "Applied")} onSuccess={() => { setSel(new Set()); }}>
      <div className="overflow-x-auto">
        <table className="table-admin">
          <thead>
            <tr>
              <th className="w-10"><input type="checkbox" className="size-4 accent-ink" checked={all} onChange={() => setSel(all ? new Set() : new Set(rows.map((r) => r.id)))} aria-label={t("تحديد الكل", "Select all")} /></th>
              <th></th><th>{t("المنتج", "Product")}</th><th>{t("الفئة", "Category")}</th><th>{t("السعر", "Price")}</th><th>{t("المخزون", "Stock")}</th><th>{t("المبيعات", "Sold")}</th><th>{t("الحالة", "Status")}</th><th></th>
            </tr>
          </thead>
          <tbody>
            {rows.map((p) => (
              <tr key={p.id} className={sel.has(p.id) ? "bg-pine-soft/60" : ""}>
                <td><input type="checkbox" name="ids" value={p.id} className="size-4 accent-ink" checked={sel.has(p.id)} onChange={() => toggle(p.id)} aria-label={name(p)} /></td>
                <td className="w-14"><div className="relative h-14 w-11 overflow-hidden rounded-lg bg-bone">{p.image && <Image src={p.image} alt="" fill sizes="44px" className="object-cover" />}</div></td>
                <td><Link href={`/${locale}/admin/products/${p.id}`} className="font-semibold hover:underline">{name(p)}</Link><span className="block text-xs text-mute" dir="ltr">/{p.slug}</span></td>
                <td>{p.category ?? "—"}</td>
                <td className="tabular-nums">{formatIQD(p.base_price, locale)}</td>
                <td><Pill tone={p.stock === 0 ? "bad" : p.stock < 10 ? "warn" : "neutral"}>{p.stock} · {p.variants} {t("نوع", "var.")}</Pill></td>
                <td className="tabular-nums">{p.sales_count}</td>
                <td className="space-x-1 whitespace-nowrap rtl:space-x-reverse">{p.is_published ? <Pill tone="good">{t("منشور", "Live")}</Pill> : <Pill>{t("مخفي", "Hidden")}</Pill>}{p.is_featured && <Pill tone="dark">★</Pill>}{p.is_limited && <Pill tone="warn">LTD</Pill>}</td>
                <td><DuplicateButton id={p.id} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {sel.size > 0 && (
        <div className="sticky bottom-3 z-20 mt-4 flex flex-wrap items-center gap-2 rounded-2xl border border-line bg-paper/95 p-3 shadow-[0_18px_40px_-16px_rgba(0,0,0,.45)] backdrop-blur">
          <span className="rounded-full bg-pine px-3 py-1.5 text-xs font-bold text-white dark:text-night">{sel.size} {t("محدد", "selected")}</span>
          <select name="op" value={op} onChange={(e) => setOp(e.target.value)} className="field h-10 w-auto rounded-full text-sm" aria-label={t("الإجراء", "Action")}>
            {ops.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
          {op === "category" && (
            <select name="value" className="field h-10 w-auto rounded-full text-sm" defaultValue="">
              <option value="">{t("بدون فئة", "No category")}</option>
              {categories.map((c) => <option key={c.id} value={c.id}>{name(c)}</option>)}
            </select>
          )}
          {op === "collection" && (
            <select name="value" className="field h-10 w-auto rounded-full text-sm" defaultValue={collections[0]?.id}>
              {collections.map((c) => <option key={c.id} value={c.id}>{name(c)}</option>)}
            </select>
          )}
          {(op === "price_set" || op === "price_percent") && (
            <input name="value" type="number" step={op === "price_percent" ? 1 : 250} inputMode="numeric" required placeholder={op === "price_percent" ? t("مثلاً -10 أو 15", "e.g. -10 or 15") : t("السعر د.ع", "Price IQD")} className="field h-10 w-36 rounded-full text-sm" />
          )}
          <ApplyButton confirmText={op === "delete" ? t("حذف المنتجات المحددة نهائياً؟", "Permanently delete the selected products?") : undefined} />
          <button type="button" onClick={() => setSel(new Set())} className="btn btn-ghost btn-sm">{t("إلغاء التحديد", "Clear")}</button>
        </div>
      )}
    </AdminForm>
  );
}
