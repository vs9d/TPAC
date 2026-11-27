"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Heart, Loader2 } from "lucide-react";
import { useI18n } from "@/components/i18n-provider";
import { toast } from "@/components/ui/toast";
import { toggleFollow } from "@/lib/actions/creators";
import { cn } from "@/lib/format";

export function FollowButton({ creatorId, initial, followers, username }: { creatorId: string; initial: boolean; followers: number; username: string }) {
  const { locale } = useI18n();
  const ar = locale === "ar";
  const router = useRouter();
  const [on, setOn] = useState(initial);
  const [n, setN] = useState(followers);
  const [pending, start] = useTransition();
  return (
    <button type="button" aria-pressed={on} disabled={pending}
      onClick={() => start(async () => {
        const r = await toggleFollow(creatorId);
        if (!r.ok) {
          if (r.error === "login") router.push(`/${locale}/account/login?next=/${locale}/creator/${username}`);
          else toast.error(ar ? "صار خطأ" : "Something went wrong");
          return;
        }
        setOn(r.following);
        setN((x) => x + (r.following ? 1 : -1));
      })}
      className={cn("btn h-11 gap-2", on ? "btn-outline" : "btn-brand")}>
      {pending ? <Loader2 className="size-4 animate-spin" /> : <Heart className={cn("size-4", on && "fill-current")} />} {on ? (ar ? "تتابعه" : "Following") : ar ? "تابع" : "Follow"} <span className="tabular-nums opacity-70">{n}</span>
    </button>
  );
}
