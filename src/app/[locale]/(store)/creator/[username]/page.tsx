import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Globe, UserRound } from "lucide-react";
import { isLocale } from "@/lib/i18n/config";
import { getCreatorByUsername } from "@/lib/creators";
import { creatorListings, creatorFollowers } from "@/lib/data/creators";
import { getSession } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { publicEnv } from "@/lib/env";
import { formatIQD } from "@/lib/format";
import { ShareButtons } from "@/components/creators/share-buttons";
import { FollowButton } from "@/components/creators/follow-button";
import { CreatorViewTracker } from "@/components/creators/view-tracker";

export const revalidate = 120;

export async function generateMetadata({ params }: { params: Promise<{ locale: string; username: string }> }): Promise<Metadata> {
  const { locale, username } = await params;
  const c = await getCreatorByUsername(username);
  if (!c) return {};
  const ar = locale === "ar";
  const title = `${c.display_name} (@${c.username}) — TPAC Creators`;
  const description = c.bio ?? (ar ? `تصاميم ${c.display_name} على هوديات وتيشيرتات TPAC.` : `${c.display_name}'s designs on TPAC hoodies and tees.`);
  const image = c.cover_url ?? c.avatar_url ?? undefined;
  return {
    title, description,
    alternates: { canonical: `/${locale}/creator/${c.username}` },
    openGraph: { title, description, type: "profile", url: `${publicEnv.siteUrl}/${locale}/creator/${c.username}`, images: image ? [{ url: image }] : undefined },
    twitter: { card: image ? "summary_large_image" : "summary", title, description, images: image ? [image] : undefined },
  };
}

const SOCIAL_LABEL: Record<string, string> = { instagram: "Instagram", tiktok: "TikTok", facebook: "Facebook", behance: "Behance", website: "Website" };

export default async function CreatorPage({ params }: { params: Promise<{ locale: string; username: string }> }) {
  const { locale, username } = await params;
  if (!isLocale(locale)) notFound();
  const ar = locale === "ar";
  const c = await getCreatorByUsername(username);
  if (!c) notFound();
  const [items, followers, session] = await Promise.all([creatorListings(c.user_id, { publishedOnly: true }), creatorFollowers(c.user_id), getSession()]);
  const following = session ? !!(await createAdminClient().from("creator_follows").select("user_id").eq("user_id", session.userId).eq("creator_id", c.user_id).maybeSingle()).data : false;
  const url = `/${locale}/creator/${c.username}`;
  return (
    <div>
      <CreatorViewTracker creatorId={c.user_id} />
      <section className="relative">
        <div className="relative h-44 bg-gradient-to-br from-pine via-ink to-ink md:h-64">
          {c.cover_url && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={c.cover_url} alt="" className="absolute inset-0 size-full object-cover" />
          )}
        </div>
        <div className="container-x">
          <div className="-mt-14 flex flex-wrap items-end gap-5 md:-mt-16">
            <div className="grid size-28 shrink-0 place-items-center overflow-hidden rounded-full border-4 border-paper bg-bone md:size-32">
              {c.avatar_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={c.avatar_url} alt={c.display_name} className="size-full object-cover" />
              ) : <UserRound className="size-10 text-mute" aria-hidden="true" />}
            </div>
            <div className="min-w-0 flex-1 pb-2">
              <p className="eyebrow text-pine">TPAC Creator</p>
              <h1 className="display text-3xl md:text-4xl">{c.display_name}</h1>
              <p className="text-sm text-mute" dir="ltr">@{c.username}</p>
            </div>
            <div className="pb-2"><FollowButton creatorId={c.user_id} initial={following} followers={followers} username={c.username} /></div>
          </div>
          {c.bio && <p className="mt-5 max-w-2xl whitespace-pre-line leading-relaxed text-ink/80">{c.bio}</p>}
          <div className="mt-4 flex flex-wrap items-center gap-2 text-sm">
            <span className="rounded-full bg-bone px-3 py-1.5 font-semibold">{ar ? `${items.length} تصميم متوفر` : `${items.length} designs available`}</span>
            {Object.entries(c.socials ?? {}).filter(([, v]) => v).map(([k, v]) => (
              <a key={k} href={v} target="_blank" rel="noopener noreferrer nofollow" className="inline-flex items-center gap-1.5 rounded-full border border-line px-3 py-1.5 font-semibold hover:border-ink"><Globe className="size-3.5" aria-hidden="true" /> {SOCIAL_LABEL[k] ?? k}</a>
            ))}
          </div>
          <div className="mt-4"><ShareButtons url={url} text={ar ? `شوف تصاميم ${c.display_name} على TPAC 🔥` : `Check out ${c.display_name}'s designs on TPAC 🔥`} /></div>
        </div>
      </section>
      <section className="container-x py-10 md:py-14">
        <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
          <h2 className="display text-2xl md:text-3xl">{ar ? "التصاميم" : "Designs"}</h2>
          <p className="text-sm text-mute">{ar ? `💚 كل قطعة تطلبها تدعم ${c.display_name} مباشرة` : `💚 Every piece you order supports ${c.display_name} directly`}</p>
        </div>
        {items.length === 0 ? (
          <p className="rounded-[1.5rem] bg-bone p-8 text-center text-mute">{ar ? "التصاميم بالطريق — تابعه حتى يوصلك أول ما ينزل." : "Designs are on their way — follow to hear first."}</p>
        ) : (
          <ul className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4">
            {items.map((p) => (
              <li key={p.id}>
                <Link href={`/${locale}/product/${p.slug}`} className="group block overflow-hidden rounded-[1.25rem] border border-line bg-paper transition hover:border-pine">
                  <div className="relative aspect-[4/5] bg-bone">
                    {p.image && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={p.image} alt={p.title} className="absolute inset-0 size-full object-cover transition group-hover:scale-[1.03]" loading="lazy" />
                    )}
                  </div>
                  <div className="space-y-0.5 p-3">
                    <p className="truncate font-bold">{p.title}</p>
                    <p className="text-sm tabular-nums">{formatIQD(p.price, locale)}</p>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
