import Link from "next/link";
import { UserRound } from "lucide-react";
import type { CreatorCard } from "@/lib/data/creators";

/** A creator in a list: cover, photo, name, @username and what they've done. */
export function CreatorCardView({ c, locale, rank, stat }: { c: CreatorCard; locale: "ar" | "en"; rank?: number; stat?: string }) {
  return (
    <Link href={`/${locale}/creator/${c.username}`} className="group block overflow-hidden rounded-[1.5rem] border border-line bg-paper transition hover:-translate-y-0.5 hover:border-pine hover:shadow-lg">
      <div className="relative h-24 bg-gradient-to-br from-pine to-ink">
        {c.cover_url && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={c.cover_url} alt="" className="absolute inset-0 size-full object-cover" loading="lazy" />
        )}
        {rank != null && <span className="absolute start-3 top-3 grid size-9 place-items-center rounded-full bg-amber text-sm font-black text-ink">{rank}</span>}
      </div>
      <div className="-mt-9 space-y-1 px-4 pb-4">
        <div className="grid size-[4.5rem] place-items-center overflow-hidden rounded-full border-4 border-paper bg-bone">
          {c.avatar_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={c.avatar_url} alt="" className="size-full object-cover" loading="lazy" />
          ) : <UserRound className="size-7 text-mute" aria-hidden="true" />}
        </div>
        <p className="truncate pt-1 font-bold">{c.display_name}</p>
        <p className="truncate text-xs text-mute" dir="ltr">@{c.username}</p>
        {stat && <p className="pt-1 text-xs font-semibold text-pine">{stat}</p>}
      </div>
    </Link>
  );
}
