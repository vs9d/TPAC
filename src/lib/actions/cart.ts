"use server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { getSession } from "@/lib/auth";
import { quoteSchema, cartLinesSchema } from "@/lib/validation";
import { rateLimit } from "@/lib/rate-limit";
import { isSupabaseConfigured } from "@/lib/env";
import { signedUrls } from "@/lib/storage";
import type { CartQuote } from "@/lib/types";

type Result<T> = { ok: true; data: T } | { ok: false; error: string };

/** Authoritative price/stock/discount/delivery calculation (public.quote_cart). */
export async function quoteCart(input: unknown): Promise<Result<CartQuote>> {
  if (!isSupabaseConfigured()) return { ok: false, error: "service_unavailable" };
  const parsed = quoteSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "invalid_input" };
  if (!(await rateLimit("quote"))) return { ok: false, error: "rate_limited" };
  const session = await getSession();
  const { data, error } = await createAdminClient().rpc("quote_cart", {
    payload: { ...parsed.data, user_id: session?.userId ?? null },
  });
  if (error) {
    console.error("quote_cart", error);
    return { ok: false, error: "quote_failed" };
  }
  const quote = data as CartQuote;
  // Custom design previews live in a private bucket: hand out short-lived signed URLs.
  const paths = quote.lines.map((l) => l.preview_path).filter(Boolean) as string[];
  if (paths.length) {
    const urls = await signedUrls(paths, "design-uploads", 3600);
    for (const l of quote.lines) if (l.preview_path) l.image_url = urls[l.preview_path] ?? null;
  }
  return { ok: true, data: quote };
}

type Line = { variant_id?: string; custom_design_id?: string; quantity: number };

async function loadServerCart(userId: string) {
  const supabase = await createClient();
  let { data: cart } = await supabase.from("carts").select("id").eq("user_id", userId).maybeSingle();
  if (!cart) {
    const res = await supabase.from("carts").insert({ user_id: userId }).select("id").single();
    cart = res.data;
  }
  if (!cart) throw new Error("cart_unavailable");
  const { data: items } = await supabase.from("cart_items").select("variant_id, custom_design_id, quantity").eq("cart_id", cart.id);
  return { supabase, cartId: cart.id as string, items: (items ?? []) as Line[] };
}

/** On sign-in: merge the browser cart into the saved account cart and return the result. */
export async function syncCart(localLines: unknown): Promise<Result<Line[]>> {
  const session = await getSession();
  if (!session) return { ok: false, error: "not_signed_in" };
  const parsed = cartLinesSchema.safeParse(localLines);
  if (!parsed.success) return { ok: false, error: "invalid_input" };
  const { supabase, cartId, items } = await loadServerCart(session.userId);
  const key = (l: Line) => l.variant_id ?? `d:${l.custom_design_id}`;
  const merged = new Map<string, Line>();
  for (const l of items) merged.set(key(l), { variant_id: l.variant_id ?? undefined, custom_design_id: l.custom_design_id ?? undefined, quantity: l.quantity });
  for (const l of parsed.data as Line[]) {
    const cur = merged.get(key(l));
    merged.set(key(l), { ...l, quantity: Math.min(99, Math.max(cur?.quantity ?? 0, l.quantity)) });
  }
  const lines = [...merged.values()].slice(0, 50);
  await supabase.from("cart_items").delete().eq("cart_id", cartId);
  if (lines.length) {
    await supabase.from("cart_items").insert(
      lines.map((l) => ({ cart_id: cartId, variant_id: l.variant_id ?? null, custom_design_id: l.custom_design_id ?? null, quantity: l.quantity })),
    );
  }
  return { ok: true, data: lines };
}

/** Persist the account cart after local changes (debounced on the client). */
export async function saveCart(lines: unknown): Promise<Result<null>> {
  const session = await getSession();
  if (!session) return { ok: false, error: "not_signed_in" };
  const parsed = cartLinesSchema.safeParse(lines);
  if (!parsed.success) return { ok: false, error: "invalid_input" };
  const { supabase, cartId } = await loadServerCart(session.userId);
  await supabase.from("cart_items").delete().eq("cart_id", cartId);
  if (parsed.data.length) {
    const rows = (parsed.data as Line[]).map((l) => ({ cart_id: cartId, variant_id: l.variant_id ?? null, custom_design_id: l.custom_design_id ?? null, quantity: l.quantity }));
    const { error } = await supabase.from("cart_items").insert(rows);
    if (error) return { ok: false, error: "save_failed" };
  }
  return { ok: true, data: null };
}
