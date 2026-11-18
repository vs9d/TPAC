"use client";
import { useActionState } from "react";
import { Loader2, FileUp } from "lucide-react";
import { useI18n } from "@/components/i18n-provider";
import { adminT } from "@/lib/admin-i18n";
import { importProducts, type ImportLine } from "@/lib/actions/admin/products";
import { toast } from "@/components/ui/toast";
import { useEffect } from "react";
import { Pill } from "./ui";

export function ImportForm() {
  const { locale } = useI18n();
  const t = adminT(locale);
  const [state, action, pending] = useActionState(importProducts, null);
  const report: ImportLine[] = state?.ok && state.extra ? JSON.parse(state.extra) : [];
  const created = report.filter((r) => r.status === "created").length;
  const failed = report.length - created;
  useEffect(() => {
    if (state?.ok) toast.success(`${created} ${t("منتج أُضيف", "products added")}${failed ? ` · ${failed} ${t("أخطاء", "errors")}` : ""}`);
    else if (state && !state.ok) {
      const m: Record<string, string> = {
        missing_columns: t("الملف ينقصه عمود الاسم أو السعر", "The file needs name and price columns"),
        too_many_rows: t("الحد الأقصى ٢٠٠ منتج بالمرة الواحدة", "Maximum 200 products at a time"),
      };
      toast.error(m[state.error] ?? t("ملف غير صالح", "Invalid file"));
    }
  }, [state]); // eslint-disable-line react-hooks/exhaustive-deps
  const why = (m: string) => {
    if (m.startsWith("category:")) return t("فئة غير موجودة", "Unknown category") + m.slice(9);
    if (m.startsWith("color:")) return t("لون غير موجود", "Unknown colour") + m.slice(6);
    if (m.startsWith("size:")) return t("مقاس غير موجود", "Unknown size") + m.slice(5);
    return ({ name: t("الاسم مفقود", "Missing name"), price: t("السعر غير صالح", "Invalid price"), duplicate: t("الرابط مكرر", "Duplicate slug"), db: t("خطأ بقاعدة البيانات", "Database error"), variants_failed: t("أُنشئ المنتج لكن فشلت المقاسات", "Product created, variants failed") } as Record<string, string>)[m] ?? m;
  };
  return (
    <div className="space-y-6">
      <form action={action} className="space-y-4">
        <label className="flex cursor-pointer flex-col items-center gap-2 rounded-2xl border-2 border-dashed border-line p-6 text-center text-sm font-semibold hover:border-pine" data-ripple>
          <FileUp className="size-7 text-pine" /> {t("اختر ملف CSV", "Choose a CSV file")}
          <input type="file" name="file" accept=".csv,text/csv" className="sr-only" />
        </label>
        <p className="text-center text-xs text-mute">{t("أو الصق المحتوى هنا (من Excel / Google Sheets: ملف ← تنزيل ← CSV)", "or paste it here (Excel / Google Sheets: File → Download → CSV)")}</p>
        <textarea name="csv" rows={6} dir="ltr" className="field font-mono text-xs" placeholder="name_ar,name_en,price,category,sizes,colors,stock,published" />
        <button disabled={pending} className="btn btn-brand">{pending ? <Loader2 className="size-4 animate-spin" /> : t("استيراد المنتجات", "Import products")}</button>
      </form>
      {report.length > 0 && (
        <div className="card-admin overflow-x-auto">
          <table className="table-admin">
            <thead><tr><th>#</th><th>{t("المنتج", "Product")}</th><th>{t("النتيجة", "Result")}</th></tr></thead>
            <tbody>
              {report.map((r) => (
                <tr key={r.row}>
                  <td className="tabular-nums">{r.row}</td>
                  <td>{r.name}</td>
                  <td>{r.status === "created" ? <><Pill tone="good">{t("تم", "Created")}</Pill> <span className="text-xs text-mute">{r.message && /^\d+$/.test(r.message) ? `${r.message} ${t("نوع", "variants")}` : why(r.message)}</span></> : <><Pill tone="bad">{t("خطأ", "Error")}</Pill> <span className="text-xs">{why(r.message)}</span></>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
