"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { markCreatorNotificationsRead } from "@/lib/actions/creators";

export function MarkCreatorRead({ unread }: { unread: number }) {
  const router = useRouter();
  useEffect(() => {
    if (unread > 0) void markCreatorNotificationsRead().then(() => router.refresh());
  }, [unread, router]);
  return null;
}
