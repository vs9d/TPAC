import { beforeEach, describe, expect, it, vi } from "vitest";

// a tiny in-memory stand-in for the database tables push.ts uses
const tables: Record<string, Record<string, unknown>[]> = {};
function query(table: string) {
  let rows = () => tables[table] ?? [];
  const filters: ((r: Record<string, unknown>) => boolean)[] = [];
  let patch: Record<string, unknown> | null = null;
  let remove = false;
  const api = {
    select: () => api, limit: () => api, maybeSingle: async () => ({ data: run()[0] ?? null }), single: async () => ({ data: run()[0] }),
    in: (k: string, v: unknown[]) => (filters.push((r) => v.includes(r[k])), api),
    eq: (k: string, v: unknown) => (filters.push((r) => r[k] === v), api),
    update: (p: Record<string, unknown>) => ((patch = p), api),
    delete: () => ((remove = true), api),
    upsert: async (row: Record<string, unknown>) => { (tables[table] ??= []).push(row); return { error: null }; },
    then: (resolve: (v: { data: unknown }) => void) => resolve({ data: run() }),
  };
  function run() {
    const hit = rows().filter((r) => filters.every((f) => f(r)));
    if (patch) hit.forEach((r) => Object.assign(r, patch));
    if (remove) tables[table] = rows().filter((r) => !hit.includes(r));
    return hit;
  }
  rows = () => tables[table] ?? [];
  return api;
}
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: () => ({ from: (t: string) => query(t) }) }));

const sent: { endpoint: string; payload: string }[] = [];
vi.mock("web-push", () => ({
  default: {
    generateVAPIDKeys: () => ({ publicKey: "pub", privateKey: "priv" }),
    sendNotification: async (sub: { endpoint: string }, payload: string) => {
      if (sub.endpoint.includes("gone")) throw Object.assign(new Error("gone"), { statusCode: 410 });
      if (sub.endpoint.includes("down")) throw Object.assign(new Error("down"), { statusCode: 503 });
      sent.push({ endpoint: sub.endpoint, payload });
    },
  },
}));

describe("push notifications", () => {
  beforeEach(() => {
    for (const k of Object.keys(tables)) delete tables[k];
    sent.length = 0;
    tables.push_subscriptions = [
      { id: "1", user_id: "u1", endpoint: "https://push.example/ok", p256dh: "k", auth: "a", locale: "en", failures: 0 },
      { id: "2", user_id: "u1", endpoint: "https://push.example/gone", p256dh: "k", auth: "a", locale: "ar", failures: 0 },
      { id: "3", user_id: "u1", endpoint: "https://push.example/down", p256dh: "k", auth: "a", locale: "ar", failures: 2 },
      { id: "4", user_id: "u2", endpoint: "https://push.example/other", p256dh: "k", auth: "a", locale: "ar", failures: 0 },
    ];
  });

  it("sends to every device of the account only, in each device's language; removes gone devices, counts failures", async () => {
    const { pushToUsers } = await import("@/lib/notifications/push");
    const r = await pushToUsers(["u1", null], (l) => ({ title: l === "ar" ? "انشحن طلبك" : "Shipped", url: "/ar/track?order=TP1" }));
    expect(r).toEqual({ sent: 1, removed: 1 });
    expect(sent).toHaveLength(1);
    expect(JSON.parse(sent[0]!.payload)).toMatchObject({ title: "Shipped", url: "/ar/track?order=TP1", lang: "en" });
    expect(tables.push_subscriptions!.map((s) => s.id).sort()).toEqual(["1", "3", "4"]);
    expect(tables.push_subscriptions!.find((s) => s.id === "3")!.failures).toBe(3);
  });

  it("creates the signing keys once and keeps them server-side", async () => {
    vi.resetModules();
    delete process.env.VAPID_PUBLIC_KEY;
    const { getVapidKeys } = await import("@/lib/notifications/push");
    expect((await getVapidKeys()).publicKey).toBe("pub");
    expect(tables.app_secrets).toHaveLength(1);
  });
});
