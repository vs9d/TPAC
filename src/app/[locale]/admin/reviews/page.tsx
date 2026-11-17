import Link from "next/link";
import { notFound } from "next/navigation";
import { isLocale } from "@/lib/i18n/config";
import { adminT } from "@/lib/admin-i18n";
import { createClient } from "@/lib/supabase/server";
import { PageHeader, Pill, Empty } from "@/components/admin/ui";
import { AdminForm } from "@/components/admin/form";
import { moderateReview } from "@/lib/actions/admin/catalog";
import { formatDate } from "@/lib/format";

export default async function AdminReviews({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const t = adminT(locale);
  const supabase = await createClient();
  const { data } = await supabase.from("reviews").select("id, rating, body, author_name, is_approved, created_at, product:products(id, name_ar, name_en)").order("is_approved").order("created_at", { ascending: false }).limit(200);
  const rows = (data ?? []) as unknown as { id: string; rating: number; body: string | null; author_name: string | null; is_approved: boolean; created_at: string; product: { id: string; name_ar: string; name_en: string } | null }[];
  return (
    <div>
      <PageHeader title={t("التقييمات", "Reviews")} subtitle={t("لا يظهر التقييم في المتجر إلا بعد الموافقة.", "Reviews appear in the store only after approval.")} />
      <div className="card-admin overflow-x-auto">
        {!rows.length ? <Empty>—</Empty> : (
          <table className="table-admin">
            <tbody>
              {rows.map((r) => (
                <tr key={r.id}>
                  <td><Link href={`/${locale}/admin/products/${r.product?.id}`} className="font-semibold hover:underline">{locale === "ar" ? r.product?.name_ar : r.product?.name_en}</Link><p className="text-xs text-mute">{r.author_name} · {formatDate(r.created_at, locale)}</p></td>
                  <td className="text-amber-deep">{"★".repeat(r.rating)}</td>
                  <td className="max-w-md text-sm">{r.body}</td>
                  <td>{r.is_approved ? <Pill tone="good">{t("منشور", "Approved")}</Pill> : <Pill tone="warn">{t("بانتظار", "Pending")}</Pill>}</td>
                  <td className="whitespace-nowrap">
                    {(["approve", "unapprove", "delete"] as const).filter((op) => (op === "approve" ? !r.is_approved : op === "unapprove" ? r.is_approved : true)).map((op) => (
                      <AdminForm key={op} action={moderateReview} className="inline">
                        <input type="hidden" name="id" value={r.id} /><input type="hidden" name="op" value={op} />
                        <button className={`me-3 text-xs underline ${op === "delete" ? "text-danger" : ""}`}>{op === "approve" ? t("موافقة", "Approve") : op === "unapprove" ? t("إخفاء", "Hide") : t("حذف", "Delete")}</button>
                      </AdminForm>
                    ))}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
