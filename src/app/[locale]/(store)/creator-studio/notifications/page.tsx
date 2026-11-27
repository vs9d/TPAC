import { PushToggle } from "@/components/pwa/push-toggle";
import Link from "next/link";
import { notFound } from "next/navigation";
import { isLocale } from "@/lib/i18n/config";
import { getMyCreator } from "@/lib/creators";
import { createAdminClient } from "@/lib/supabase/admin";
import { MarkCreatorRead } from "@/components/creators/mark-read";
import { formatDate, cn } from "@/lib/format";

export default async function CreatorNotifications({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const ar = locale === "ar";
  const me = (await getMyCreator())!;
  const { data } = await createAdminClient().from("creator_notifications").select("*").eq("creator_id", me.user_id).order("created_at", { ascending: false }).limit(100);
  const list = (data ?? []) as { id: string; title: string; body: string | null; link: string | null; read_at: string | null; created_at: string }[];
  return (
    <section className="space-y-4">
      <MarkCreatorRead unread={list.filter((n) => !n.read_at).length} />
      <h2 className="display text-2xl">{ar ? "الإشعارات" : "Notifications"}</h2>
      <PushToggle context="creator" />
      {list.length === 0 ? <p className="rounded-[1.5rem] bg-bone p-8 text-center text-mute">{ar ? "ماكو إشعارات بعد." : "No notifications yet."}</p> : (
        <ul className="divide-y divide-line rounded-[1.5rem] border border-line bg-paper">
          {list.map((n) => (
            <li key={n.id} className={cn("p-4", !n.read_at && "bg-amber/5")}>
              <p className="flex items-center gap-2 font-bold">{!n.read_at && <span className="size-2 rounded-full bg-amber" aria-label={ar ? "جديد" : "new"} />}{n.title}</p>
              {n.body && <p className="mt-0.5 text-sm text-mute">{n.body}</p>}
              <p className="mt-1 flex gap-3 text-xs text-mute">{formatDate(n.created_at, locale, true)}{n.link && <Link href={`/${locale}${n.link}`} className="font-semibold underline">{ar ? "فتح" : "Open"}</Link>}</p>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
