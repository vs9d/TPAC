"use client";
import { useEffect } from "react";
import { trackCreatorView } from "@/lib/actions/creators";

/** Counts one visit per browser session to a creator's page or product. */
export function CreatorViewTracker({ creatorId, productId }: { creatorId: string; productId?: string }) {
  useEffect(() => {
    const key = `tpac-cv-${productId ?? creatorId}`;
    try {
      if (sessionStorage.getItem(key)) return;
      sessionStorage.setItem(key, "1");
    } catch { /* private mode: count anyway */ }
    void trackCreatorView(creatorId, productId);
  }, [creatorId, productId]);
  return null;
}
