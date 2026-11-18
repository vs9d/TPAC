import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { isLocale } from "@/lib/i18n/config";
import { getDictionary } from "@/lib/i18n";
import { adminT } from "@/lib/admin-i18n";
import { createClient } from "@/lib/supabase/server";
import { PageHeader, Card, Pill, Empty, Pagination } from "@/components/admin/ui";
import { groupDesigns, loadArtwork, optionList, optionNames, type DesignRow } from "@/lib/design-admin";
import { formatDate, cn } from "@/lib/format";

const PAGE = 24;

export default async function AdminDesigns({ params, searchParams }: { params: Promise<{ locale: string }>; searchParams: Promise<{ status?: string; page?: string }> }) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const sp = await searchParams;
  const status = sp.status === "ordered" || sp.status === "draft" ? sp.status : "all";
  const page = Math.max(1, Number(sp.page) || 1);
  const t = adminT(locale);
  const dict = getDictionary(locale);
  const supabase = await createClient();

  // newest 600 saved designs are grouped by batch; "ordered" = some size of it is on an order
  const [{ data: rows }, { data: lines }, names, { data: colors }] = await Promise.all([
    supabase.from("custom_designs").select("*").order("created_at", { ascending: false }).limit(600).returns<DesignRow[]>(),
    supabase.from("order_items").select("custom_design_id, order_id, quantity, orders(order_number)").not("custom_design_id", "is", null).limit(2000),
    optionNames(supabase),
    supabase.from("colors").select("id, name_ar, name_en, hex"),
  ]);
  const colorById = new Map((colors ?? []).map((c) => [c.id as string, c]));
  type Line = { custom_design_id: string; order_id: string; quantity: number; orders: { order_number: string } | { order_number: string }[] | null };
  const orderOf = new Map<string, { id: string; number: string }>();
  for (const l of (lines ?? []) as unknown as Line[]) {
    const o = Array.isArray(l.orders) ? l.orders[0] : l.orders;
    if (!orderOf.has(l.custom_design_id)) orderOf.set(l.custom_design_id, { id: l.order_id, number: o?.order_number ?? "" });
  }
  const all = groupDesigns(rows ?? []).map((g) => ({ ...g, order: g.rows.map((r) => orderOf.get(r.id)).find(Boolean) }));
  const filtered = all.filter((g) => (status === "ordered" ? !!g.order : status === "draft" ? !g.order : true));
  const pageItems = filtered.slice((page - 1) * PAGE, page * PAGE);
  const { art, urls } = await loadArtwork(supabase, pageItems.flatMap((g) => g.rows));
  const uids = [...new Set(pageItems.map((g) => g.primary.user_id).filter(Boolean) as string[])];
  const { data: profiles } = uids.length ? await supabase.from("customer_profiles").select("id, full_name, phone").in("id", uids) : { data: [] };
  const who = new Map((profiles ?? []).map((p) => [p.id as string, p]));
  void art;
  const base = `/${locale}/admin/designs`;

  return (
    <div className="space-y-6">
      <PageHeader title={t("تصاميم العملاء", "Customer designs")} subtitle={t("كل تصميم محفوظ من أداة الطباعة — مع الخيارات والملفات الأصلية.", "Every design saved from the print designer — with options and original files.")} actions={<Link href={`/${locale}/admin/customizer`} className="btn btn-outline btn-sm">{t("إعدادات المصمم", "Designer settings")}</Link>} />
      <nav className="flex gap-1 rounded-full border border-line bg-bone p-1 text-sm font-bold sm:w-fit">
        {([["all", t("الكل", "All")], ["ordered", t("مطلوبة", "Ordered")], ["draft", t("لم تُطلب", "Not ordered")]] as const).map(([k, label]) => (
          <Link key={k} href={`${base}?status=${k}`} className={cn("rounded-full px-4 py-2 transition", status === k ? "bg-ink text-paper" : "text-mute hover:text-ink")}>{label}</Link>
        ))}
      </nav>
      {pageItems.length === 0 ? <Empty>{t("لا توجد تصاميم", "No designs")}</Empty> : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {pageItems.map((g) => {
            const d = g.primary;
            const c = colorById.get(d.color_id);
            const sizes = d.config.sizes ?? Object.fromEntries(g.rows.map((r) => [r.size_code, 1]));
            const owner = d.user_id ? who.get(d.user_id) : null;
            const objs = d.config.objects ?? [];
            return (
              <Card key={g.key} className="!p-0 overflow-hidden">
                <div className="grid grid-cols-2 bg-bone">
                  {[d.preview_front_path, d.preview_back_path].map((p, i) => (
                    <div key={i} className="relative aspect-[6/7]">{p && urls[p] && <Image src={urls[p]!} alt={i ? "back" : "front"} fill sizes="200px" className="object-contain" unoptimized />}</div>
                  ))}
                </div>
                <div className="space-y-2 p-4 text-sm">
                  <div className="flex items-start justify-between gap-2">
                    <p className="font-bold">{d.name || t("بدون اسم", "Untitled")}</p>
                    {g.order ? <Link href={`/${locale}/admin/orders/${g.order.id}`}><Pill tone="good">{g.order.number}</Pill></Link> : <Pill>{t("لم تُطلب", "Not ordered")}</Pill>}
                  </div>
                  <p className="flex items-center gap-2 text-mute"><span className="size-3 rounded-full border" style={{ background: c?.hex as string }} />{d.garment_type} · {c ? (locale === "ar" ? c.name_ar : c.name_en) : ""}</p>
                  <p><span className="font-semibold">{t("المقاسات", "Sizes")}:</span> {Object.entries(sizes).map(([s, q]) => `${s}×${q}`).join("  ")}</p>
                  <p><span className="font-semibold">{t("الأماكن", "Placements")}:</span> {d.print_locations.map((l) => dict.designer.locations[l] ?? l).join("، ")} · {objs.length} {t("عنصر", "elements")}</p>
                  {optionList(d, names, locale).length > 0 && <p className="text-xs text-mute">{optionList(d, names, locale).join(" · ")}</p>}
                  {d.notes && <p className="rounded-xl bg-bone p-2 text-xs">{d.notes}</p>}
                  <p className="text-xs text-mute">{owner ? `${owner.full_name ?? ""} ${owner.phone ?? ""}` : t("زائر", "Guest")} · {formatDate(d.created_at, locale, true)}</p>
                  {g.order && <Link href={`/${locale}/admin/orders/${g.order.id}/production`} target="_blank" className="btn btn-outline btn-sm w-full">{t("ورقة التصنيع", "Production sheet")}</Link>}
                </div>
              </Card>
            );
          })}
        </div>
      )}
      <Pagination page={page} pageSize={PAGE} total={filtered.length} href={(p) => `${base}?status=${status}&page=${p}`} />
    </div>
  );
}
