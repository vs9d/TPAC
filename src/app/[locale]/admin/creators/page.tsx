import Link from "next/link";
import { notFound } from "next/navigation";
import { MessageCircle } from "lucide-react";
import { isLocale } from "@/lib/i18n/config";
import { adminT } from "@/lib/admin-i18n";
import { createAdminClient } from "@/lib/supabase/admin";
import { PageHeader, Card, Pill, Empty } from "@/components/admin/ui";
import { AdminForm, Submit } from "@/components/admin/form";
import { CreatorsTabs } from "@/components/admin/creators-tabs";
import { setCreatorStatus } from "@/lib/actions/admin/creators";
import { creatorQueueCounts, creatorTotals } from "@/lib/data/creators-admin";
import { formatDate, formatIQD, cn } from "@/lib/format";
import { formatIraqiPhone } from "@/lib/phone";
import type { Creator } from "@/lib/creators";

const STATUSES = ["pending", "approved", "suspended", "rejected"] as const;

export default async function AdminCreators({ params, searchParams }: { params: Promise<{ locale: string }>; searchParams: Promise<{ status?: string }> }) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const t = adminT(locale);
  const sp = await searchParams;
  const status = (STATUSES as readonly string[]).includes(sp.status ?? "") ? sp.status! : "pending";
  const { data, error } = await createAdminClient().from("creators").select("*").eq("status", status).order("created_at", { ascending: false }).limit(200);
  const list = (data ?? []) as Creator[];
  const [totals, counts] = await Promise.all([creatorTotals(list.map((c) => c.user_id)), creatorQueueCounts().catch(() => undefined)]);
  const label: Record<string, string> = { pending: t("بانتظار الموافقة", "Pending"), approved: t("مفعّل", "Active"), suspended: t("موقوف", "Suspended"), rejected: t("مرفوض", "Rejected") };
  return (
    <div className="space-y-6">
      <PageHeader title="TPAC Creators" subtitle={t("المبدعين ومتاجرهم داخل الموقع: الموافقة، الإيقاف، النسب، المبيعات والأرباح.", "Creators and their stores: approval, suspension, commission, sales and earnings.")} actions={<Link href={`/${locale}/creators`} target="_blank" className="btn btn-outline btn-sm">{t("صفحة المبدعين", "Creators page")}</Link>} />
      <CreatorsTabs locale={locale} active="list" counts={counts} />
      <nav className="flex flex-wrap gap-1 text-sm font-bold">
        {STATUSES.map((s) => <Link key={s} href={`/${locale}/admin/creators?status=${s}`} className={cn("rounded-full border px-4 py-2", status === s ? "border-ink bg-ink text-paper" : "border-line text-mute")}>{label[s]}</Link>)}
      </nav>
      {error ? <Empty>{t("شغّل supabase/add-creators.sql أولاً", "Run supabase/add-creators.sql first")}</Empty> : list.length === 0 ? <Empty>{t("ماكو أحد هنا", "Nobody here")}</Empty> : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {list.map((c) => { const x = totals.get(c.user_id); return (
            <Card key={c.user_id} title={c.display_name} actions={<Pill tone={c.status === "approved" ? "good" : c.status === "pending" ? "warn" : "neutral"}>{label[c.status]}</Pill>}>
              <div className="flex items-center gap-3">
                {c.avatar_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={c.avatar_url} alt="" className="size-14 rounded-full object-cover" />
                ) : <div className="size-14 rounded-full bg-bone" />}
                <div className="min-w-0 text-sm">
                  <p className="font-semibold" dir="ltr">@{c.username}</p>
                  {c.phone && <a href={`https://wa.me/${c.phone}`} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-xs underline" dir="ltr"><MessageCircle className="size-3" /> {formatIraqiPhone(c.phone)}</a>}
                  <p className="text-xs text-mute">{formatDate(c.created_at, locale)}</p>
                </div>
              </div>
              {c.bio && <p className="mt-3 line-clamp-3 text-sm text-mute">{c.bio}</p>}
              <dl className="mt-3 grid grid-cols-3 gap-2 text-center text-xs">
                <div className="rounded-xl bg-bone p-2"><dt className="text-mute">{t("تصاميم", "Designs")}</dt><dd className="font-bold">{x?.published ?? 0}/{x?.listings ?? 0}</dd></div>
                <div className="rounded-xl bg-bone p-2"><dt className="text-mute">{t("قطع", "Pieces")}</dt><dd className="font-bold">{x?.pieces ?? 0}</dd></div>
                <div className="rounded-xl bg-bone p-2"><dt className="text-mute">{t("أرباحه", "Earned")}</dt><dd className="font-bold">{formatIQD(x?.earned ?? 0, locale)}</dd></div>
              </dl>
              <div className="mt-4 flex flex-wrap gap-2">
                <Link href={`/${locale}/admin/creators/${c.user_id}`} className="btn btn-outline btn-sm">{t("التفاصيل", "Details")}</Link>
                {c.status !== "approved" && <AdminForm action={setCreatorStatus}><input type="hidden" name="id" value={c.user_id} /><input type="hidden" name="status" value="approved" /><Submit variant="brand">{c.status === "pending" ? t("موافقة", "Approve") : t("تفعيل", "Activate")}</Submit></AdminForm>}
                {c.status === "pending" && <AdminForm action={setCreatorStatus}><input type="hidden" name="id" value={c.user_id} /><input type="hidden" name="status" value="rejected" /><Submit variant="outline">{t("رفض", "Reject")}</Submit></AdminForm>}
                {c.status === "approved" && <AdminForm action={setCreatorStatus}><input type="hidden" name="id" value={c.user_id} /><input type="hidden" name="status" value="suspended" /><Submit variant="danger">{t("إيقاف", "Suspend")}</Submit></AdminForm>}
              </div>
            </Card>
          ); })}
        </div>
      )}
    </div>
  );
}
