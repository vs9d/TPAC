import Link from "next/link";
import { notFound } from "next/navigation";
import { BadgeCheck } from "lucide-react";
import { isLocale } from "@/lib/i18n/config";
import { adminT } from "@/lib/admin-i18n";
import { createClient } from "@/lib/supabase/server";
import { resolvePhotos } from "@/lib/data/reviews";
import { PageHeader, Card, Pill, Empty } from "@/components/admin/ui";
import { AdminForm, Input, Select, Textarea, Checkbox, Submit } from "@/components/admin/form";
import { MediaUrlInput } from "@/components/admin/media-upload";
import { moderateReview, addTestimonial } from "@/lib/actions/admin/catalog";
import { formatDate } from "@/lib/format";

type Row = { id: string; avatar_url: string | null; label: string | null; rating: number; body: string | null; author_name: string | null; author_city: string | null; photos: string[]; source: string; is_verified: boolean; is_featured: boolean; is_approved: boolean; created_at: string; product: { id: string; name_ar: string; name_en: string } | null };

export default async function AdminReviews({ params, searchParams }: { params: Promise<{ locale: string }>; searchParams: Promise<{ status?: string }> }) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const t = adminT(locale);
  const { status } = await searchParams;
  const supabase = await createClient();
  let q = supabase
    .from("reviews")
    .select("id, avatar_url, label, rating, body, author_name, author_city, photos, source, is_verified, is_featured, is_approved, created_at, product:products(id, name_ar, name_en)")
    .order("is_approved")
    .order("created_at", { ascending: false })
    .limit(200);
  if (status === "pending") q = q.eq("is_approved", false);
  if (status === "published") q = q.eq("is_approved", true);
  const [{ data }, { data: products }] = await Promise.all([q, supabase.from("products").select("id, name_ar, name_en").order("name_ar")]);
  const rows = (data ?? []) as unknown as Row[];
  await resolvePhotos(rows);
  const ops = (r: Row) =>
    [
      !r.is_approved && ["approve", t("نشر", "Publish")],
      r.is_approved && ["unapprove", t("إخفاء", "Hide")],
      !r.is_featured && ["feature", t("تثبيت بالأعلى", "Pin to top")],
      r.is_featured && ["unfeature", t("إلغاء التثبيت", "Unpin")],
      ["delete", t("حذف", "Delete")],
    ].filter(Boolean) as [string, string][];
  return (
    <div className="space-y-6">
      <PageHeader
        title={t("آراء الزبائن والتقييمات", "Customer reviews")}
        subtitle={t("الآراء الجديدة لا تظهر للزبائن إلا بعد النشر.", "New reviews are only visible after you publish them.")}
        actions={<>
          <Link href={`/${locale}/reviews`} target="_blank" className="btn btn-outline btn-sm">{t("عرض الصفحة", "View page")}</Link>
          {[["", t("الكل", "All")], ["pending", t("بانتظار المراجعة", "Pending")], ["published", t("منشور", "Published")]].map(([k, l]) => (
            <Link key={k} href={k ? `?status=${k}` : "?"} className={`btn btn-sm ${(status ?? "") === k ? "btn-primary" : "btn-outline"}`}>{l}</Link>
          ))}
        </>}
      />

      <Card title={t("إضافة رأي يدوياً (مثلاً لقطة شاشة من إنستغرام أو واتساب)", "Add a testimonial manually (e.g. an Instagram / WhatsApp screenshot)")}>
        <AdminForm action={addTestimonial} resetOnSuccess className="grid gap-3 sm:grid-cols-4">
          <Input name="author_name" label={t("اسم الزبون", "Customer name")} required />
          <Input name="author_city" label={t("المدينة", "City")} />
          <Select name="rating" label={t("التقييم", "Rating")} defaultValue="5" options={[5, 4, 3, 2, 1].map((n) => ({ value: String(n), label: "★".repeat(n) }))} />
          <Select name="source" label={t("المصدر", "Source")} defaultValue="instagram" options={[{ value: "instagram", label: "Instagram" }, { value: "whatsapp", label: "WhatsApp" }, { value: "tiktok", label: "TikTok" }, { value: "site", label: t("الموقع", "Website") }, { value: "other", label: t("أخرى", "Other") }]} />
          <div className="sm:col-span-2"><MediaUrlInput name="avatar_url" label={t("صورة الزبون الشخصية (دائرية)", "Customer profile photo (round)")} /></div>
          <Input name="label" label={t("التصنيف", "Category label")} placeholder={t("تيشيرتات / هوديات / طلبات خاصة", "T-shirts / Hoodies / Custom orders")} list="review-labels" className="sm:col-span-2" />
          <datalist id="review-labels"><option value="تيشيرتات" /><option value="هوديات" /><option value="سويتشيرتات" /><option value="طلبات خاصة" /><option value="طلبات الجملة" /></datalist>
          <Textarea name="body" label={t("كلام الزبون", "Review text")} rows={3} className="sm:col-span-2" />
          <Select name="product_id" label={t("المنتج (اختياري)", "Product (optional)")} options={[{ value: "", label: "—" }, ...(products ?? []).map((p) => ({ value: p.id, label: locale === "ar" ? p.name_ar : p.name_en }))]} className="sm:col-span-2" />
          <Checkbox name="is_featured" label={t("تثبيت بالأعلى", "Pin to top")} className="self-end pb-2" />
          <Submit className="self-end">{t("إضافة ونشر", "Add & publish")}</Submit>
        </AdminForm>
      </Card>

      {!rows.length ? <Empty>—</Empty> : (
        <div className="columns-1 gap-4 md:columns-2 xl:columns-3">
          {rows.map((r) => (
            <div key={r.id} className={`card-admin mb-4 break-inside-avoid ${r.is_approved ? "" : "border-amber"}`}>
              {r.photos.length > 0 && (
                <div className="grid grid-cols-2 gap-1">
                  {r.photos.map((src) => (
                    <a key={src} href={src} target="_blank" rel="noopener noreferrer" className="block aspect-square overflow-hidden bg-bone">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={src} alt="" className="h-full w-full object-cover" />
                    </a>
                  ))}
                </div>
              )}
              <div className="space-y-2 p-4 text-sm">
                {r.avatar_url && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={r.avatar_url} alt="" className="size-10 rounded-full object-cover" />
                )}
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-amber-deep">{"★".repeat(r.rating)}</span>
                  {r.is_approved ? <Pill tone="good">{t("منشور", "Published")}</Pill> : <Pill tone="warn">{t("بانتظار", "Pending")}</Pill>}
                  {r.is_featured && <Pill tone="dark">{t("مثبّت", "Pinned")}</Pill>}
                  {r.is_verified && <span className="inline-flex items-center gap-1 text-xs font-semibold text-pine"><BadgeCheck className="size-3.5" /> {t("موثّق", "Verified")}</span>}
                  <Pill>{r.source}</Pill>
                </div>
                {r.body && <p className="whitespace-pre-line">{r.body}</p>}
                <p className="text-xs text-mute">
                  {r.author_name}{r.label && ` · ${r.label}`}{r.author_city && ` · ${r.author_city}`} · {formatDate(r.created_at, locale)}
                  {r.product && <> · <Link href={`/${locale}/admin/products/${r.product.id}`} className="underline">{locale === "ar" ? r.product.name_ar : r.product.name_en}</Link></>}
                </p>
                <div className="flex flex-wrap gap-x-4 gap-y-1 border-t border-line pt-2">
                  {ops(r).map(([op, label]) => (
                    <AdminForm key={op} action={moderateReview} className="inline">
                      <input type="hidden" name="id" value={r.id} /><input type="hidden" name="op" value={op} />
                      <button className={`text-xs font-semibold underline ${op === "delete" ? "text-danger" : ""}`}>{label}</button>
                    </AdminForm>
                  ))}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
