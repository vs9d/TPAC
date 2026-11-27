import Link from "next/link";
import { notFound } from "next/navigation";
import { isLocale } from "@/lib/i18n/config";
import { adminT } from "@/lib/admin-i18n";
import { createAdminClient } from "@/lib/supabase/admin";
import { PageHeader, Card, Empty } from "@/components/admin/ui";
import { AdminForm, Submit, Textarea } from "@/components/admin/form";
import { CreatorsTabs } from "@/components/admin/creators-tabs";
import { reviewCreatorDesign } from "@/lib/actions/admin/creators";
import { creatorQueueCounts } from "@/lib/data/creators-admin";
import { STATUS_LABEL } from "@/lib/creator-labels";
import { formatDate, formatIQD, cn } from "@/lib/format";

const FILTERS = ["pending", "approved", "changes_requested", "rejected", "hidden"] as const;

export default async function AdminCreatorDesigns({ params, searchParams }: { params: Promise<{ locale: string }>; searchParams: Promise<{ status?: string }> }) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const t = adminT(locale);
  const ar = locale === "ar";
  const sp = await searchParams;
  const status = (FILTERS as readonly string[]).includes(sp.status ?? "") ? sp.status! : "pending";
  const db = createAdminClient();
  const { data } = await db.from("creator_products")
    .select("id, title, description, category, tags, markup, base_price, status, submitted_at, review_note, creators(username, display_name), products(slug, base_price, product_images(url, sort_order), product_designs(artwork_url))")
    .eq("status", status).order("submitted_at", { ascending: status !== "pending" }).limit(100);
  type Row = { id: string; title: string; description: string | null; category: string | null; tags: string[]; markup: number; base_price: number; status: string; submitted_at: string | null; review_note: string | null; creators: { username: string; display_name: string }; products: { slug: string; base_price: number; product_images: { url: string; sort_order: number }[]; product_designs: { artwork_url: string }[] } };
  const rows = (data ?? []) as unknown as Row[];
  const counts = await creatorQueueCounts().catch(() => undefined);
  return (
    <div className="space-y-6">
      <PageHeader title={t("مراجعة تصاميم المبدعين", "Creator design review")} subtitle={t("انشر بس الشغل الأصلي: بدون شعارات ماركات، بدون شخصيات محمية، بدون صور أشخاص بلا إذن، بدون محتوى مسيء.", "Publish original work only: no brand logos, protected characters, people's photos without consent, or offensive content.")} />
      <CreatorsTabs locale={locale} active="designs" counts={counts} />
      <nav className="flex flex-wrap gap-1 text-sm font-bold">
        {FILTERS.map((s) => { const l = STATUS_LABEL[s]!; return <Link key={s} href={`/${locale}/admin/creators/designs?status=${s}`} className={cn("rounded-full border px-4 py-2", status === s ? "border-ink bg-ink text-paper" : "border-line text-mute")}>{ar ? l[0] : l[1]}</Link>; })}
      </nav>
      {rows.length === 0 ? <Empty>{t("ماكو تصاميم هنا", "Nothing here")}</Empty> : (
        <div className="grid gap-4 md:grid-cols-2">
          {rows.map((r) => {
            const imgs = [...r.products.product_images].sort((a, b) => a.sort_order - b.sort_order).slice(0, 4);
            return (
              <Card key={r.id} title={`«${r.title}» — @${r.creators.username}`}>
                <div className="grid grid-cols-4 gap-2">
                  {imgs.map((im) => (
                    <a key={im.url} href={im.url} target="_blank" rel="noopener noreferrer" className="relative block aspect-square overflow-hidden rounded-lg bg-bone">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={im.url} alt="" className="absolute inset-0 size-full object-cover" />
                    </a>
                  ))}
                </div>
                {r.products.product_designs.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-2">
                    <span className="text-xs text-mute">{t("ملفات التصميم:", "Artwork files:")}</span>
                    {r.products.product_designs.map((d) => <a key={d.artwork_url} href={d.artwork_url} target="_blank" rel="noopener noreferrer" className="text-xs underline">{t("فتح", "open")}</a>)}
                  </div>
                )}
                <dl className="mt-3 space-y-1 text-sm">
                  <div className="flex justify-between"><dt className="text-mute">{t("السعر", "Price")}</dt><dd>{formatIQD(r.base_price, locale)} + {formatIQD(r.markup, locale)} = <b>{formatIQD(r.products.base_price, locale)}</b></dd></div>
                  {r.category && <div className="flex justify-between"><dt className="text-mute">{t("التصنيف", "Category")}</dt><dd>{r.category}</dd></div>}
                  {r.submitted_at && <div className="flex justify-between"><dt className="text-mute">{t("أُرسل", "Submitted")}</dt><dd>{formatDate(r.submitted_at, locale, true)}</dd></div>}
                </dl>
                {r.description && <p className="mt-2 text-sm text-mute">{r.description}</p>}
                <AdminForm action={reviewCreatorDesign} className="mt-4 space-y-2">
                  <input type="hidden" name="id" value={r.id} />
                  <Textarea name="note" label={t("ملاحظة للمبدع (للرفض أو التعديل)", "Note to the creator (for reject / changes)")} rows={2} defaultValue={r.review_note ?? ""} />
                  <div className="flex flex-wrap gap-2">
                    {r.status !== "approved" && <Submit variant="brand" name="action" value="approve">{t("قبول ونشر", "Approve & publish")}</Submit>}
                    {r.status !== "changes_requested" && <Submit variant="outline" name="action" value="changes">{t("طلب تعديل", "Request changes")}</Submit>}
                    {r.status !== "rejected" && <Submit variant="outline" name="action" value="reject">{t("رفض", "Reject")}</Submit>}
                    {r.status !== "hidden" && <Submit variant="danger" name="action" value="hide">{t("إخفاء", "Hide")}</Submit>}
                    <Link href={`/${locale}/product/${r.products.slug}`} target="_blank" className="btn btn-outline btn-sm">{t("صفحة المنتج", "Product page")}</Link>
                  </div>
                </AdminForm>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
