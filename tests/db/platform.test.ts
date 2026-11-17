/**
 * Integration tests against a real PostgreSQL 16 database with all
 * migrations + seed applied, impersonating Supabase roles the same way
 * PostgREST does. Covers: registration, browsing, variants, cart maths,
 * checkout, inventory, status workflow, custom designs, admin authorisation
 * and customer data isolation.
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import pg from "pg";
import { setupDatabase, teardown, as, q, createUser, variantWithStock, stockOf, orderPayload } from "./helpers";

let pool: pg.Pool;
let alice: string, bob: string, staff: string, admin: string;

beforeAll(async () => {
  pool = setupDatabase();
  alice = await createUser("alice@example.com", { phone: "0770 111 2222" });
  bob = await createUser("bob@example.com", { phone: "07802223333" });
  staff = await createUser("staff@thetpac.com", { role: "staff" });
  admin = await createUser("admin@thetpac.com", { role: "admin" });
});
afterAll(teardown);

const svc = { role: "service_role" } as const;
const anon = { role: "anon" } as const;
const user = (uid: string) => ({ role: "authenticated", uid }) as const;
const rpc = async (c: pg.PoolClient, fn: string, arg: unknown) => (await c.query(`select public.${fn}($1::jsonb) as r`, [JSON.stringify(arg)])).rows[0].r;

describe("registration & profiles", () => {
  it("creates a customer profile with a normalised phone on sign-up", async () => {
    const [p] = await q("select role, phone, full_name from customer_profiles where id = $1", [alice]);
    expect(p).toMatchObject({ role: "customer", phone: "9647701112222", full_name: "alice" });
  });

  it("lets customers edit their profile but never their role", async () => {
    await as(user(alice), async (c) => {
      await c.query("update customer_profiles set full_name = 'Alice A' where id = $1", [alice]);
      await expect(c.query("update customer_profiles set role = 'admin' where id = $1", [alice])).rejects.toThrow(/only admins/);
    });
  });

  it("customers cannot see other profiles; staff can", async () => {
    const seen = await as(user(alice), async (c) => (await c.query("select id from customer_profiles")).rows);
    expect(seen.map((r) => r.id)).toEqual([alice]);
    const staffSeen = await as(user(staff), async (c) => (await c.query("select count(*)::int n from customer_profiles")).rows[0].n);
    expect(staffSeen).toBeGreaterThanOrEqual(4);
  });

  it("only admins can grant roles", async () => {
    await as(user(staff), async (c) => {
      const r = await c.query("update customer_profiles set role = 'admin' where id = $1", [bob]);
      expect(r.rowCount).toBe(0); // RLS: staff may read but not update other profiles
    });
    await as(user(admin), async (c) => {
      const r = await c.query("update customer_profiles set role = 'staff' where id = $1 returning role", [bob]);
      expect(r.rows[0].role).toBe("staff");
    });
  });
});

describe("product browsing", () => {
  it("anonymous visitors only see published products", async () => {
    await q("update products set is_published = false where slug = 'tigris-tee'");
    try {
      const slugs = await as(anon, async (c) => (await c.query("select slug from products")).rows.map((r) => r.slug));
      expect(slugs).not.toContain("tigris-tee");
      expect(slugs.length).toBe(15);
      const search = await as(anon, async (c) => rpc(c, "catalog_search", { q: "دجلة" }));
      expect(search.total).toBe(0);
      const staffSees = await as(user(staff), async (c) => (await c.query("select count(*)::int n from products")).rows[0].n);
      expect(staffSees).toBe(16);
    } finally {
      await q("update products set is_published = true where slug = 'tigris-tee'");
    }
  });

  it("filters by category, size, colour and price, and sorts", async () => {
    const res = await as(anon, async (c) => rpc(c, "catalog_search", { category: "hoodies", sort: "price_asc" }));
    expect(res.total).toBe(3);
    const prices = res.items.map((i: { price: number }) => i.price);
    expect(prices).toEqual([...prices].sort((a: number, b: number) => a - b));

    const amber = await as(anon, async (c) => rpc(c, "catalog_search", { colors: ["amber"] }));
    expect(amber.items.map((i: { slug: string }) => i.slug)).toEqual(["1921-tee"]);

    const ranged = await as(anon, async (c) => rpc(c, "catalog_search", { min_price: 40000, max_price: 50000 }));
    for (const i of ranged.items) expect(i.price).toBeGreaterThanOrEqual(40000), expect(i.price).toBeLessThanOrEqual(50000);

    const sized = await as(anon, async (c) => rpc(c, "catalog_search", { sizes: ["XS"] }));
    expect(sized.total).toBe(0); // seed has no XS variants

    const popular = await as(anon, async (c) => rpc(c, "catalog_search", { sort: "popular", limit: 2 }));
    expect(popular.items[0].slug).toBe("heavyweight-essential-tee");
    expect(popular.items).toHaveLength(2);
  });

  it("supports Arabic and English search", async () => {
    const ar = await as(anon, async (c) => rpc(c, "catalog_search", { q: "هودي" }));
    const en = await as(anon, async (c) => rpc(c, "catalog_search", { q: "hoodie" }));
    expect(ar.total).toBeGreaterThan(0);
    expect(en.total).toBe(ar.total);
  });
});

describe("product variants", () => {
  it("each size × colour combination is unique and stock never goes negative", async () => {
    const v = await variantWithStock(1);
    const [row] = await q<{ product_id: string; size_code: string; color_id: string }>("select product_id, size_code, color_id from product_variants where id = $1", [v.id]);
    await expect(q("insert into product_variants (product_id, sku, size_code, color_id) values ($1, 'DUP-SKU-1', $2, $3)", [row!.product_id, row!.size_code, row!.color_id])).rejects.toThrow(/duplicate key/);
    await expect(q("update inventory set quantity = -1 where variant_id = $1", [v.id])).rejects.toThrow(/check constraint/);
  });

  it("variant price overrides apply (XXL surcharge)", async () => {
    const [xxl] = await q<{ id: string; price_override: number; base_price: number }>("select v.id, v.price_override, p.base_price from product_variants v join products p on p.id = v.product_id join inventory i on i.variant_id = v.id where v.size_code = 'XXL' and i.quantity > 0 limit 1");
    const quote = await as(svc, async (c) => rpc(c, "quote_cart", { items: [{ variant_id: xxl!.id, quantity: 1 }] }));
    expect(quote.lines[0].unit_price).toBe(xxl!.base_price + 2000);
  });
});

describe("cart calculations (quote_cart)", () => {
  it("computes subtotal, delivery and total", async () => {
    const v = await variantWithStock(3);
    const qt = await as(svc, async (c) => rpc(c, "quote_cart", { items: [{ variant_id: v.id, quantity: 2 }], governorate: "basra", delivery_method: "standard" }));
    expect(qt.subtotal).toBe(v.price * 2);
    expect(qt.delivery_fee).toBe(7000);
    expect(qt.total).toBe(v.price * 2 + 7000);
    expect(qt.errors).toEqual([]);
  });

  it("applies percentage discounts with minimum order", async () => {
    const v = await variantWithStock(3);
    const small = await as(svc, async (c) => rpc(c, "quote_cart", { items: [{ variant_id: v.id, quantity: 1 }], discount_code: "welcome10" }));
    if (v.price < 30000) expect(small.discount).toMatchObject({ valid: false, error: "min_order" });
    const big = await as(svc, async (c) => rpc(c, "quote_cart", { items: [{ variant_id: v.id, quantity: 3 }], discount_code: "WELCOME10", governorate: "baghdad" }));
    expect(big.discount.valid).toBe(true);
    expect(big.discount_total).toBe(Math.floor((v.price * 3) / 10));
    expect(big.total).toBe(v.price * 3 - big.discount_total + big.delivery_fee);
  });

  it("free shipping codes and thresholds zero the delivery fee", async () => {
    const v = await variantWithStock(4);
    const n = Math.ceil(50000 / v.price);
    const fs = await as(svc, async (c) => rpc(c, "quote_cart", { items: [{ variant_id: v.id, quantity: n }], discount_code: "FREESHIP", governorate: "erbil" }));
    expect(fs.discount.valid).toBe(true);
    expect(fs.delivery_fee).toBe(0);
    const over = Math.ceil(150000 / v.price);
    const v2 = await variantWithStock(over);
    const th = await as(svc, async (c) => rpc(c, "quote_cart", { items: [{ variant_id: v2.id, quantity: over }], governorate: "basra" }));
    expect(th.delivery_fee).toBe(0);
  });

  it("flags unsupported delivery options and invalid codes", async () => {
    const v = await variantWithStock(1);
    const ex = await as(svc, async (c) => rpc(c, "quote_cart", { items: [{ variant_id: v.id, quantity: 1 }], governorate: "basra", delivery_method: "express" }));
    expect(ex.errors.map((e: { code: string }) => e.code)).toContain("express_unavailable");
    const bad = await as(svc, async (c) => rpc(c, "quote_cart", { items: [{ variant_id: v.id, quantity: 1 }], discount_code: "NOPE" }));
    expect(bad.discount).toMatchObject({ valid: false, error: "invalid_code" });
  });

  it("reports insufficient stock per line", async () => {
    const v = await variantWithStock(1);
    const qt = await as(svc, async (c) => rpc(c, "quote_cart", { items: [{ variant_id: v.id, quantity: v.quantity + 1 }] }));
    expect(qt.lines[0]).toMatchObject({ error: "insufficient_stock", available: v.quantity });
  });

  it("is not callable by browsers (anon/authenticated)", async () => {
    const v = await variantWithStock(1);
    await expect(as(anon, (c) => rpc(c, "quote_cart", { items: [{ variant_id: v.id, quantity: 1 }] }))).rejects.toThrow(/permission denied/);
    await expect(as(user(alice), (c) => rpc(c, "place_order", orderPayload([{ variant_id: v.id, quantity: 1 }])))).rejects.toThrow(/permission denied/);
  });
});

describe("checkout & inventory", () => {
  it("places an order atomically: order, items, stock, history, admin alert", async () => {
    const v = await variantWithStock(5);
    const before = await stockOf(v.id);
    const res = await as(svc, (c) => rpc(c, "place_order", { ...orderPayload([{ variant_id: v.id, quantity: 2 }]), user_id: alice, phone: "0770 111 2222" }), true);
    expect(res.order_number).toMatch(/^TP\d+$/);
    expect(await stockOf(v.id)).toBe(before - 2);
    const [o] = await q("select status, total, subtotal, phone, user_id, stock_committed from orders where id = $1", [res.order_id]);
    expect(o).toMatchObject({ status: "received", subtotal: v.price * 2, phone: "9647701112222", user_id: alice, stock_committed: true });
    const tx = await q("select change, reason from inventory_transactions where order_id = $1", [res.order_id]);
    expect(tx).toEqual([{ change: -2, reason: "sale" }]);
    expect((await q("select to_status from order_status_history where order_id = $1", [res.order_id]))[0]).toEqual({ to_status: "received" });
    expect((await q("select count(*)::int n from notifications where order_id = $1 and audience = 'admin'", [res.order_id]))[0]).toEqual({ n: 1 });
  });

  it("prevents overselling — the whole order fails and nothing is deducted", async () => {
    const a = await variantWithStock(1);
    const b = await variantWithStock(1, [a.id]);
    const stockA = await stockOf(a.id);
    const tooMany = (await stockOf(b.id)) + 1;
    await expect(
      as(svc, (c) => rpc(c, "place_order", orderPayload([{ variant_id: a.id, quantity: 1 }, { variant_id: b.id, quantity: tooMany }])), true),
    ).rejects.toThrow(/cart_invalid/);
    expect(await stockOf(a.id)).toBe(stockA);
  });

  it("handles concurrent checkouts for the last units without overselling", async () => {
    const v = await variantWithStock(1);
    await q("update inventory set quantity = 3 where variant_id = $1", [v.id]);
    const attempts = await Promise.allSettled(
      Array.from({ length: 5 }, () => as(svc, (c) => rpc(c, "place_order", orderPayload([{ variant_id: v.id, quantity: 1 }])), true)),
    );
    expect(attempts.filter((r) => r.status === "fulfilled")).toHaveLength(3);
    expect(await stockOf(v.id)).toBe(0);
  });

  it("enforces per-customer discount limits by phone, even for guests", async () => {
    const v = await variantWithStock(4);
    const n = Math.ceil(30000 / v.price);
    const p = { ...orderPayload([{ variant_id: v.id, quantity: n }]), phone: "07709998888", discount_code: "WELCOME10" };
    const first = await as(svc, (c) => rpc(c, "place_order", p), true);
    expect(first.discount_total).toBeGreaterThan(0);
    await expect(as(svc, (c) => rpc(c, "place_order", p), true)).rejects.toThrow(/discount_invalid: already_used/);
    const [usage] = await q<{ used_count: number }>("select used_count from discount_codes where code = 'WELCOME10'");
    expect(usage!.used_count).toBeGreaterThanOrEqual(1);
  });

  it("rejects invalid phones and missing address fields", async () => {
    const v = await variantWithStock(1);
    await expect(as(svc, (c) => rpc(c, "place_order", { ...orderPayload([{ variant_id: v.id, quantity: 1 }]), phone: "12345" }))).rejects.toThrow(/invalid_phone/);
    await expect(as(svc, (c) => rpc(c, "place_order", { ...orderPayload([{ variant_id: v.id, quantity: 1 }]), address_line: " " }))).rejects.toThrow(/missing_customer_fields/);
  });

  it("enforces the minimum order total from settings", async () => {
    const v = await variantWithStock(1);
    await q("update website_settings set value = jsonb_set(value, '{min_order_total}', '1000000') where key = 'checkout'");
    try {
      await expect(as(svc, (c) => rpc(c, "place_order", orderPayload([{ variant_id: v.id, quantity: 1 }])))).rejects.toThrow(/min_order_total/);
    } finally {
      await q("update website_settings set value = jsonb_set(value, '{min_order_total}', '10000') where key = 'checkout'");
    }
  });

  it("staff adjust stock through adjust_inventory with an audit trail; direct edits are blocked", async () => {
    const v = await variantWithStock(1);
    const before = await stockOf(v.id);
    const after = await as(user(staff), async (c) => (await c.query("select adjust_inventory($1, 10, 'restock', 'delivery from workshop') as q", [v.id])).rows[0].q, true);
    expect(after).toBe(before + 10);
    await expect(as(user(staff), (c) => c.query("update inventory set quantity = 999 where variant_id = $1", [v.id]))).rejects.toThrow(/use_adjust_inventory/);
    await expect(as(user(staff), (c) => c.query("select adjust_inventory($1, -100000, 'adjustment')", [v.id]))).rejects.toThrow(/check constraint/);
    await expect(as(user(alice), (c) => c.query("select adjust_inventory($1, 5, 'restock')", [v.id]))).rejects.toThrow(/not_authorized/);
    const [log] = await q("select reason, change, note, created_by from inventory_transactions where variant_id = $1 order by id desc limit 1", [v.id]);
    expect(log).toMatchObject({ reason: "restock", change: 10, note: "delivery from workshop", created_by: staff });
  });

  it("low stock crossing creates an admin alert", async () => {
    const v = await variantWithStock(6);
    await q("update inventory set quantity = 6, low_stock_threshold = 3 where variant_id = $1", [v.id]);
    await as(svc, (c) => rpc(c, "place_order", orderPayload([{ variant_id: v.id, quantity: 4 }])), true);
    const [n] = await q<{ n: number }>("select count(*)::int n from notifications where event = 'inventory.low_stock' and body like $1", [`${v.sku}%`]);
    expect(n!.n).toBe(1);
  });
});

describe("order status workflow", () => {
  async function newOrder(qty = 2) {
    const v = await variantWithStock(qty);
    const res = await as(svc, (c) => rpc(c, "place_order", { ...orderPayload([{ variant_id: v.id, quantity: qty }]), user_id: bob }), true);
    return { v, orderId: res.order_id as string };
  }
  const setStatus = (who: string, orderId: string, status: string, note: string | null = null) =>
    as(user(who), async (c) => (await c.query("select update_order_status($1, $2, $3) as r", [orderId, status, note])).rows[0].r, true);

  it("moves forward with timestamped history and customer notification", async () => {
    const { orderId } = await newOrder();
    for (const s of ["confirmed", "printing", "quality_check", "shipped", "delivered"]) await setStatus(staff, orderId, s);
    const hist = await q<{ to_status: string; changed_by: string }>("select to_status, changed_by from order_status_history where order_id = $1 order by id", [orderId]);
    expect(hist.map((h) => h.to_status)).toEqual(["received", "confirmed", "printing", "quality_check", "shipped", "delivered"]);
    expect(hist.slice(1).every((h) => h.changed_by === staff)).toBe(true);
    const [o] = await q("select payment_status from orders where id = $1", [orderId]);
    expect(o).toEqual({ payment_status: "paid" }); // COD settled on delivery
    const [n] = await q<{ n: number }>("select count(*)::int n from notifications where order_id = $1 and audience = 'customer' and user_id = $2", [orderId, bob]);
    expect(n!.n).toBe(5);
  });

  it("rejects backwards and post-terminal transitions", async () => {
    const { orderId } = await newOrder();
    await setStatus(staff, orderId, "shipped");
    await expect(setStatus(staff, orderId, "printing")).rejects.toThrow(/invalid_transition/);
    await setStatus(staff, orderId, "delivered");
    await expect(setStatus(staff, orderId, "cancelled")).rejects.toThrow(/invalid_transition/);
  });

  it("cancellation before shipping restores stock exactly once", async () => {
    const { v, orderId } = await newOrder(3);
    const mid = await stockOf(v.id);
    const r = await setStatus(staff, orderId, "cancelled", "customer asked");
    expect(r.stock_restored).toBe(true);
    expect(await stockOf(v.id)).toBe(mid + 3);
    const [tx] = await q("select reason, change from inventory_transactions where order_id = $1 and reason = 'cancellation'", [orderId]);
    expect(tx).toEqual({ reason: "cancellation", change: 3 });
  });

  it("customers cannot change statuses or edit order money", async () => {
    const { orderId } = await newOrder();
    await expect(setStatus(bob, orderId, "delivered")).rejects.toThrow(/not_authorized/);
    const r = await as(user(bob), (c) => c.query("update orders set total = 1 where id = $1", [orderId]));
    expect(r.rowCount).toBe(0);
    await expect(as(user(staff), (c) => c.query("update orders set total = 1 where id = $1", [orderId]))).rejects.toThrow(/protected_order_columns/);
    await expect(as(user(staff), (c) => c.query("update orders set status = 'delivered' where id = $1", [orderId]))).rejects.toThrow(/protected_order_columns/);
  });
});

describe("customer data isolation", () => {
  let aliceOrder: string;
  beforeAll(async () => {
    const v = await variantWithStock(1);
    aliceOrder = (await as(svc, (c) => rpc(c, "place_order", { ...orderPayload([{ variant_id: v.id, quantity: 1 }]), user_id: alice, phone: "07701112222" }), true)).order_id;
    await q("insert into addresses (user_id, full_name, phone, governorate, city, address_line) values ($1, 'Alice', '9647701112222', 'baghdad', 'Mansour', 'Secret street 7')", [alice]);
  });

  it("customers only see their own orders, items, history and addresses", async () => {
    await as(user(bob), async (c) => {
      expect((await c.query("select id from orders where id = $1", [aliceOrder])).rowCount).toBe(0);
      expect((await c.query("select id from order_items where order_id = $1", [aliceOrder])).rowCount).toBe(0);
      expect((await c.query("select id from order_status_history where order_id = $1", [aliceOrder])).rowCount).toBe(0);
      expect((await c.query("select id from addresses where user_id = $1", [alice])).rowCount).toBe(0);
      const ins = c.query("insert into addresses (user_id, full_name, phone, governorate, city, address_line) values ($1, 'x', 'x', 'baghdad', 'x', 'x')", [alice]);
      await expect(ins).rejects.toThrow(/row-level security/);
    });
    await as(user(alice), async (c) => {
      expect((await c.query("select id from orders where id = $1", [aliceOrder])).rowCount).toBe(1);
      expect((await c.query("select id from addresses")).rowCount).toBe(1);
    });
  });

  it("anonymous visitors can read no private tables", async () => {
    await as(anon, async (c) => {
      for (const t of ["orders", "order_items", "addresses", "customer_profiles", "discount_codes", "custom_designs", "uploaded_artwork", "notifications", "newsletter_subscribers", "bulk_order_requests", "rate_limits", "admin_activity_logs"]) {
        expect((await c.query(`select 1 from ${t} limit 1`)).rowCount, t).toBe(0);
      }
    });
  });

  it("order tracking requires both the order number and the matching phone", async () => {
    const [{ order_number }] = await q<{ order_number: string }>("select order_number from orders where id = $1", [aliceOrder]);
    const ok = await as(anon, async (c) => (await c.query("select track_order($1, $2) as r", [order_number, "+964 770 111 2222"])).rows[0].r);
    expect(ok.order_number).toBe(order_number);
    expect(ok).not.toHaveProperty("address_line");
    expect(ok).not.toHaveProperty("phone");
    const wrong = await as(anon, async (c) => (await c.query("select track_order($1, $2) as r", [order_number, "07809999999"])).rows[0].r);
    expect(wrong).toBeNull();
  });

  it("private artwork storage is unreadable to customers", async () => {
    await q("insert into storage.objects (bucket_id, name) values ('design-uploads', 'uploads/design/2026-11/x.png'), ('product-images', 'products/p/1.webp')");
    const visible = await as(user(alice), async (c) => (await c.query("select bucket_id from storage.objects")).rows.map((r) => r.bucket_id));
    expect(visible).toEqual(["product-images"]);
    const staffVisible = await as(user(staff), async (c) => (await c.query("select bucket_id from storage.objects order by 1")).rows.map((r) => r.bucket_id));
    expect(staffVisible).toEqual(["design-uploads", "product-images"]);
  });
});

describe("admin authorisation", () => {
  it("customers cannot write catalog, settings or discounts", async () => {
    // each statement in its own transaction: a failed statement aborts a Postgres transaction
    await expect(as(user(alice), (c) => c.query("insert into products (slug, name_ar, name_en, base_price) values ('hack', 'x', 'x', 1)"))).rejects.toThrow(/row-level security/);
    expect((await as(user(alice), (c) => c.query("update products set base_price = 1"))).rowCount).toBe(0);
    expect((await as(user(alice), (c) => c.query("update website_settings set value = '{}'"))).rowCount).toBe(0);
    expect((await as(user(alice), (c) => c.query("select * from discount_codes"))).rowCount).toBe(0);
    await expect(as(user(alice), (c) => c.query("select admin_dashboard_stats()"))).rejects.toThrow(/not_authorized/);
    await expect(as(user(alice), (c) => c.query("select admin_customers()"))).rejects.toThrow(/not_authorized/);
  });

  it("staff manage the catalog but only admins change settings and delivery fees", async () => {
    await as(user(staff), async (c) => {
      const r = await c.query("insert into products (slug, name_ar, name_en, base_price) values ('staff-made', 'س', 'S', 1000) returning id");
      expect(r.rowCount).toBe(1);
      expect((await c.query("update website_settings set value = '{}' where key = 'brand'")).rowCount).toBe(0);
      expect((await c.query("update delivery_zones set standard_fee = 0")).rowCount).toBe(0);
      const stats = (await c.query("select admin_dashboard_stats() as s")).rows[0].s;
      expect(stats).toHaveProperty("total_sales");
    });
    await as(user(admin), async (c) => {
      expect((await c.query("update delivery_zones set standard_fee = 5500 where governorate = 'baghdad'")).rowCount).toBe(1);
    });
  });

  it("customer list aggregates registered and guest buyers", async () => {
    const res = await as(user(staff), async (c) => (await c.query("select admin_customers(null, 200, 0, false) as r")).rows[0].r);
    const roles = new Set(res.items.map((i: { role: string }) => i.role));
    expect(roles.has("guest")).toBe(true);
    expect(roles.has("customer")).toBe(true);
    const repeat = await as(user(staff), async (c) => (await c.query("select admin_customers(null, 200, 0, true) as r")).rows[0].r);
    expect(repeat.items.every((i: { order_count: number }) => i.order_count >= 2)).toBe(true);
  });
});

describe("custom designs", () => {
  async function design(owner: string | null, price = 28000) {
    const [{ id }] = await q<{ id: string }>(
      `insert into custom_designs (user_id, garment_type, color_id, size_code, print_locations, config, unit_price)
       values ($1, 'tshirt', (select id from colors where code = 'black'), 'L', '{front}', '{"objects":[]}', $2) returning id`,
      [owner, price],
    );
    return id;
  }

  it("prices custom lines from the stored design and orders them without stock", async () => {
    const id = await design(null);
    const res = await as(svc, (c) => rpc(c, "place_order", orderPayload([{ custom_design_id: id, quantity: 2 }])), true);
    const [o] = await q("select subtotal, has_custom_items from orders where id = $1", [res.order_id]);
    expect(o).toEqual({ subtotal: 56000, has_custom_items: true });
    const [n] = await q<{ n: number }>("select count(*)::int n from notifications where order_id = $1 and event = 'custom_design.created'", [res.order_id]);
    expect(n!.n).toBe(1);
  });

  it("a customer cannot order someone else's saved design", async () => {
    const id = await design(alice);
    const qt = await as(svc, (c) => rpc(c, "quote_cart", { items: [{ custom_design_id: id, quantity: 1 }], user_id: bob }));
    expect(qt.lines[0].error).toBe("unavailable");
  });

  it("customers can read only their own designs", async () => {
    const mine = await design(alice);
    const theirs = await design(bob);
    const ids = await as(user(alice), async (c) => (await c.query("select id from custom_designs where id = any($1)", [[mine, theirs]])).rows.map((r) => r.id));
    expect(ids).toEqual([mine]);
  });
});

describe("bulk orders & quotations", () => {
  it("suggests quantity-based unit prices", async () => {
    const price = await as(anon, async (c) => (await c.query("select bulk_unit_price('tshirt', 120) as p")).rows[0].p);
    expect(price).toBe(11500);
    const none = await as(anon, async (c) => (await c.query("select bulk_unit_price('tshirt', 5) as p")).rows[0].p);
    expect(none).toBeNull();
  });

  it("converts an approved quotation into an order, once", async () => {
    const [br] = await q<{ id: string }>("insert into bulk_order_requests (organization_name, contact_name, phone, product_type, estimated_quantity) values ('Univ', 'Sara', '9647801234567', 'tshirt', 100) returning id");
    const [{ n: alerts }] = await q<{ n: number }>("select count(*)::int n from notifications where event = 'bulk_request.created' and link like $1", [`%${br!.id}`]);
    expect(alerts).toBe(1);
    const [qt] = await q<{ id: string }>(`insert into quotations (bulk_request_id, items, subtotal, total, status) values ($1, '[{"description":"Tee","size":"M","quantity":100,"unit_price":11500}]', 1150000, 1150000, 'draft') returning id`, [br!.id]);
    await expect(as(user(staff), (c) => c.query("select convert_quotation_to_order($1)", [qt!.id]))).rejects.toThrow(/quotation_not_approved/);
    await q("update quotations set status = 'approved' where id = $1", [qt!.id]);
    await expect(as(user(alice), (c) => c.query("select convert_quotation_to_order($1)", [qt!.id]))).rejects.toThrow(/not_authorized/);
    const res = await as(user(staff), async (c) => (await c.query("select convert_quotation_to_order($1) as r", [qt!.id])).rows[0].r, true);
    const [o] = await q("select source, status, total from orders where id = $1", [res.order_id]);
    expect(o).toEqual({ source: "bulk", status: "confirmed", total: 1150000 });
    await expect(as(user(staff), (c) => c.query("select convert_quotation_to_order($1)", [qt!.id]))).rejects.toThrow(/quotation_not_approved/);
  });
});

describe("rate limiting", () => {
  it("allows up to N calls per window", async () => {
    const results = await as(svc, async (c) => {
      const out: boolean[] = [];
      for (let i = 0; i < 4; i++) out.push((await c.query("select check_rate_limit('test:1.2.3.4', 3, 60) as ok")).rows[0].ok);
      return out;
    });
    expect(results).toEqual([true, true, true, false]);
    await expect(as(anon, (c) => c.query("select check_rate_limit('x', 1, 60)"))).rejects.toThrow(/permission denied/);
  });
});
