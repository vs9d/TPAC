import Link from "next/link";
import { notFound } from "next/navigation";
import { Eye, Plus } from "lucide-react";
import { isLocale } from "@/lib/i18n/config";
import { getMyCreator } from "@/lib/creators";
import { creatorListings } from "@/lib/data/creators";
import { formatIQD, cn } from "@/lib/format";
import { STATUS_LABEL } from "@/lib/creator-labels";


export default async function CreatorDesigns({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const ar = locale === "ar";
  const me = (await getMyCreator())!;
  const list = await creatorListings(me.user_id);
  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="display text-2xl">{ar ? "تصاميمي" : "My designs"} <span className="text-base text-mute">({list.length})</span></h2>
        <Link href={`/${locale}/creator-studio/designs/new`} className="btn btn-brand h-11"><Plus className="size-4" /> {ar ? "تصميم جديد" : "New design"}</Link>
      </div>
      {list.length === 0 ? (
        <p className="rounded-[1.5rem] bg-bone p-8 text-center text-mute">{ar ? "ماكو تصاميم بعد. ارفع أول تصميم وخلّي الناس تلبس فنّك 🎨" : "No designs yet. Upload your first and let people wear your art 🎨"}</p>
      ) : (
        <ul className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4">
          {list.map((p) => {
            const st = STATUS_LABEL[p.status] ?? STATUS_LABEL.draft!;
            return (
              <li key={p.id}>
                <Link href={`/${locale}/creator-studio/designs/${p.id}`} className="block overflow-hidden rounded-[1.25rem] border border-line bg-paper transition hover:border-pine">
                  <div className="relative aspect-[4/5] bg-bone">
                    {p.image && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={p.image} alt="" className="absolute inset-0 size-full object-cover" loading="lazy" />
                    )}
                    <span className={cn("absolute start-2 top-2 rounded-full px-2.5 py-1 text-[11px] font-bold", st[2])}>{ar ? st[0] : st[1]}</span>
                  </div>
                  <div className="space-y-0.5 p-3 text-sm">
                    <p className="truncate font-bold">{p.title}</p>
                    <p className="flex justify-between text-mute"><span className="tabular-nums">{formatIQD(p.price, locale)}</span><span className="inline-flex items-center gap-1"><Eye className="size-3.5" aria-hidden="true" /> {p.view_count}</span></p>
                    {p.review_note && (p.status === "rejected" || p.status === "changes_requested") && <p className="line-clamp-2 text-xs text-danger">{p.review_note}</p>}
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
