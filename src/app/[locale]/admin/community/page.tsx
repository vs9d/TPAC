import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { MessageCircle } from "lucide-react";
import { isLocale } from "@/lib/i18n/config";
import { adminT } from "@/lib/admin-i18n";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireStaff } from "@/lib/auth";
import { signedUrls } from "@/lib/storage";
import { PageHeader, Card, Pill, Empty } from "@/components/admin/ui";
import { AdminForm, Input, Submit } from "@/components/admin/form";
import { moderateCommunityDesign, updateCommunityReward } from "@/lib/actions/admin/community";
import { formatDate, formatIQD, cn } from "@/lib/format";
import { formatIraqiPhone } from "@/lib/phone";

const STATUS = ["pending", "approved", "rejected", "hidden"] as const;
type Row = { id: string; title: string; designer_name: string; designer_phone: string | null; garment_type: string; status: (typeof STATUS)[number]; preview_front_path: string | null; preview_back_path: string | null; image_front: string | null; reward_per_sale: number; rewards_paid: number; created_at: string };

export default async function AdminCommunity({ params, searchParams }: { params: Promise<{ locale: string }>; searchParams: Promise<{ status?: string }> }) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  await requireStaff(locale);
  const t = adminT(locale);
  const sp = await searchParams;
  const status = (STATUS as readonly string[]).includes(sp.status ?? "") ? (sp.status as Row["status"]) : "pending";
  const db = createAdminClient();
  const { data, error } = await db.from("community_designs").select("id, title, designer_name, designer_phone, garment_type, status, preview_front_path, preview_back_path, image_front, reward_per_sale, rewards_paid, created_at").eq("status", status).order("created_at", { ascending: false }).limit(100);
  const rows = (data ?? []) as Row[];
  // pieces sold from each design: its customers' designs → order lines → orders that were not cancelled
  const sold = new Map<string, number>();
  if (rows.length) {
    const { data: made } = await db.from("custom_designs").select("id, community_design_id").in("community_design_id", rows.map((r) => r.id));
    const owner = new Map(((made ?? []) as { id: string; community_design_id: string }[]).map((d) => [d.id, d.community_design_id]));
    if (owner.size) {
      const { data: lines } = await db.from("order_items").select("custom_design_id, quantity, order_id").in("custom_design_id", [...owner.keys()]);
      const ls = (lines ?? []) as { custom_design_id: string; quantity: number; order_id: string }[];
      const { data: ords } = ls.length ? await db.from("orders").select("id, status").in("id", [...new Set(ls.map((l) => l.order_id))]) : { data: [] };
      const live = new Set(((ords ?? []) as { id: string; status: string }[]).filter((o) => o.status !== "cancelled").map((o) => o.id));
      for (const l of ls) if (live.has(l.order_id)) {
        const c = owner.get(l.custom_design_id)!;
        sold.set(c, (sold.get(c) ?? 0) + l.quantity);
      }
    }
  }
  const urls = await signedUrls(rows.flatMap((r) => [r.preview_front_path, r.preview_back_path].filter(Boolean) as string[]));
  const base = `/${locale}/admin/community`;
  const label: Record<Row["status"], string> = { pending: t("بانتظار الموافقة", "Pending"), approved: t("منشورة", "Published"), rejected: t("مرفوضة", "Rejected"), hidden: t("مخفية", "Hidden") };

  return (
    <div className="space-y-6">
      <PageHeader title={t("صفحة تصاميم الزبائن", "Community designs")} subtitle={t("تصاميم يريد أصحابها ينشروها. وافق على المناسب فقط — لا شعارات ماركات ولا صور أشخاص بدون إذن ولا محتوى مسيء. صاحب التصميم ياخذ مكافأة على كل قطعة تنباع منه.", "Designs their makers want to share. Approve only suitable ones — no brand logos, no people's photos without consent, nothing offensive. The designer earns a reward per piece sold.")} actions={<Link href={`/${locale}/community`} target="_blank" className="btn btn-outline btn-sm">{t("عرض الصفحة", "View page")}</Link>} />
      <nav className="flex flex-wrap gap-1 rounded-full border border-line bg-bone p-1 text-sm font-bold sm:w-fit">
        {STATUS.map((k) => <Link key={k} href={`${base}?status=${k}`} className={cn("rounded-full px-4 py-2 transition", status === k ? "bg-ink text-paper" : "text-mute hover:text-ink")}>{label[k]}</Link>)}
      </nav>
      {error ? <Empty>{t("شغّل supabase/add-share-group-community.sql أولاً", "Run supabase/add-share-group-community.sql first")}</Empty> : rows.length === 0 ? <Empty>{t("ما كو تصاميم هنا", "Nothing here")}</Empty> : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {rows.map((r) => {
            const pieces = sold.get(r.id) ?? 0;
            const earned = pieces * r.reward_per_sale;
            const owed = Math.max(0, earned - r.rewards_paid);
            const front = r.image_front ?? (r.preview_front_path ? urls[r.preview_front_path] : null);
            const back = r.preview_back_path ? urls[r.preview_back_path] : null;
            return (
              <Card key={r.id} title={`«${r.title}»`}>
                <div className="grid grid-cols-2 gap-2">
                  {[front, back].map((u, i) => u ? <a key={i} href={u} target="_blank" rel="noopener noreferrer" className="relative block aspect-[6/7] overflow-hidden rounded-xl bg-bone"><Image src={u} alt="" fill sizes="200px" className="object-contain" unoptimized /></a> : <div key={i} className="aspect-[6/7] rounded-xl bg-bone" />)}
                </div>
                <dl className="mt-3 space-y-1 text-sm">
                  <div className="flex justify-between gap-2"><dt className="text-mute">{t("المصمم", "Designer")}</dt><dd className="font-semibold">{r.designer_name}</dd></div>
                  {r.designer_phone && <div className="flex justify-between gap-2"><dt className="text-mute">{t("الهاتف", "Phone")}</dt><dd><a className="inline-flex items-center gap-1 font-semibold underline" href={`https://wa.me/${r.designer_phone}`} target="_blank" rel="noopener noreferrer" dir="ltr"><MessageCircle className="size-3.5" /> {formatIraqiPhone(r.designer_phone)}</a></dd></div>}
                  <div className="flex justify-between gap-2"><dt className="text-mute">{t("القطعة", "Garment")}</dt><dd>{r.garment_type}</dd></div>
                  <div className="flex justify-between gap-2"><dt className="text-mute">{t("وصل", "Received")}</dt><dd>{formatDate(r.created_at, locale)}</dd></div>
                  <div className="flex justify-between gap-2"><dt className="text-mute">{t("انباع", "Sold")}</dt><dd className="font-semibold tabular-nums">{pieces} {t("قطعة", "pcs")}</dd></div>
                  <div className="flex justify-between gap-2"><dt className="text-mute">{t("المكافأة المستحقة", "Reward owed")}</dt><dd>{owed > 0 ? <Pill tone="warn">{formatIQD(owed, locale)}</Pill> : formatIQD(0, locale)}</dd></div>
                </dl>
                <div className="mt-4 flex flex-wrap gap-2">
                  {r.status !== "approved" && <AdminForm action={moderateCommunityDesign}><input type="hidden" name="id" value={r.id} /><input type="hidden" name="action" value="approve" /><Submit variant="brand">{t("موافقة ونشر", "Approve & publish")}</Submit></AdminForm>}
                  {r.status === "pending" && <AdminForm action={moderateCommunityDesign}><input type="hidden" name="id" value={r.id} /><input type="hidden" name="action" value="reject" /><Submit variant="outline">{t("رفض", "Reject")}</Submit></AdminForm>}
                  {r.status === "approved" && <AdminForm action={moderateCommunityDesign}><input type="hidden" name="id" value={r.id} /><input type="hidden" name="action" value="hide" /><Submit variant="outline">{t("إخفاء", "Hide")}</Submit></AdminForm>}
                </div>
                <AdminForm action={updateCommunityReward} className="mt-4 grid grid-cols-2 gap-2 border-t border-line pt-4">
                  <input type="hidden" name="id" value={r.id} />
                  <Input name="reward_per_sale" type="number" min={0} step={250} label={t("مكافأة/قطعة", "Reward / piece")} defaultValue={r.reward_per_sale} />
                  <Input name="rewards_paid" type="number" min={0} step={250} label={t("المدفوع له", "Paid so far")} defaultValue={owed > 0 ? r.rewards_paid : earned} hint={owed > 0 ? t(`صير ${earned} بعد ما تدفع`, `Set to ${earned} once paid`) : undefined} />
                  <Submit variant="outline" className="col-span-2">{t("حفظ", "Save")}</Submit>
                </AdminForm>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
