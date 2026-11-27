import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { isLocale } from "@/lib/i18n/config";
import { getGroupByToken, getPreviewKits } from "@/lib/data/group";
import { createAdminClient } from "@/lib/supabase/admin";
import { signedUrls } from "@/lib/storage";
import { GroupManage } from "@/components/group/manage";
import { formatDate } from "@/lib/format";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { robots: { index: false, follow: false }, referrer: "no-referrer" };

export default async function GroupManagePage({ params, searchParams }: { params: Promise<{ locale: string; token: string }>; searchParams: Promise<{ new?: string }> }) {
  const { locale, token } = await params;
  if (!isLocale(locale)) notFound();
  const ar = locale === "ar";
  const found = await getGroupByToken(token);
  if (!found) notFound();
  const { new: fresh } = await searchParams;
  const { group: g, members, request_number } = found;
  const kit = g.garment ? (await getPreviewKits().catch(() => [])).find((k) => k.garment === g.garment) ?? null : null;
  const fixed = Object.fromEntries(Object.entries(g.template.fixed).filter(([, v]) => v).map(([k, v]) => [k, `/api/art/${v}?group=${g.code}`]));
  // each member's own design, for the organiser only (short-lived signed links)
  const artIds = members.map((m) => m.artwork_id).filter((x): x is string => !!x);
  const { data: arts } = artIds.length ? await createAdminClient().from("uploaded_artwork").select("id, storage_path").in("id", artIds) : { data: [] };
  const paths = new Map(((arts ?? []) as { id: string; storage_path: string }[]).map((a) => [a.id, a.storage_path]));
  const previewPaths = members.flatMap((m) => [m.preview_front_path, m.preview_back_path].filter((x): x is string => !!x));
  const signed = await signedUrls([...paths.values(), ...previewPaths]);
  const previews = Object.fromEntries(members.filter((m) => m.preview_front_path && signed[m.preview_front_path]).map((m) => [m.id, { front: signed[m.preview_front_path!]!, back: m.preview_back_path ? signed[m.preview_back_path] ?? null : null }]));
  const memberArt = Object.fromEntries([...paths.entries()].map(([id, p]) => [id, signed[p]]).filter(([, u]) => u)) as Record<string, string>;
  return (
    <div className="container-x max-w-3xl space-y-6 py-10 md:py-14">
      <header className="space-y-2">
        <p className="eyebrow text-pine">{ar ? "صفحة المنظّم" : "Organiser page"}</p>
        <h1 className="display text-3xl md:text-5xl">{g.title}</h1>
        <p className="text-sm text-mute">
          {g.product ? (ar ? g.product.name_ar : g.product.name_en) : null}
          {g.deadline ? ` · ${ar ? "آخر موعد" : "until"} ${formatDate(g.deadline, locale)}` : ""}
          {g.status === "closed" ? ` · ${ar ? "التسجيل مقفول" : "list closed"}` : ""}
        </p>
        {fresh && <p className="rounded-2xl bg-amber/15 px-4 py-3 text-sm font-semibold">{ar ? "انسوّى الرابط ✓ احفظ هالصفحة بالمفضلة أو انسخ عنوانها، لأن منها تدير الطلب." : "Your link is ready ✓ Bookmark this page or copy its address — it's where you manage the order."}</p>}
      </header>
      <GroupManage token={token} group={g} members={members} requestNumber={request_number} kit={kit} fixed={fixed} memberArt={memberArt} previews={previews} />
    </div>
  );
}
