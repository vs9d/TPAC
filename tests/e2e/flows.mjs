// End-to-end browser flows against a running app (default http://localhost:3100)
// backed by tests/e2e/supabase-emulator.mjs. Run: node tests/e2e/flows.mjs
// Exits non-zero on the first failed flow; screenshots go to $E2E_SHOTS.
import { createRequire } from "node:module";
import assert from "node:assert/strict";
import { writeFileSync, readFileSync, mkdirSync } from "node:fs";
import pg from "pg";

const require = createRequire(import.meta.url);
const { chromium, devices } = require("playwright");
const BASE = process.env.E2E_BASE ?? "http://localhost:3100";
const SHOTS = process.env.E2E_SHOTS ?? "/tmp/tpac-e2e";
mkdirSync(SHOTS, { recursive: true });
const db = new pg.Pool({ host: "/tmp", port: Number(process.env.TPAC_PGPORT ?? 54329), user: "postgres", database: "tpac" });
const one = async (sql, p = []) => (await db.query(sql, p)).rows[0];
// one print placement is included in the garment price (the most expensive used); the others add their price
const extraPlacements = async (locs) => {
  const ps = (await db.query("select price from print_locations where code = any($1)", [locs])).rows.map((r) => r.price);
  return ps.reduce((a, b) => a + b, 0) - Math.max(0, ...ps);
};

const browser = await chromium.launch();
const results = [];
async function flow(name, fn, ctxOpts = { viewport: { width: 1366, height: 900 } }) {
  // E2E_ONLY=<text> runs just the flows whose name contains it
  if (process.env.E2E_ONLY && !name.includes(process.env.E2E_ONLY)) return;
  const ctx = await browser.newContext(ctxOpts);
  const page = await ctx.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("console", (m) => m.type() === "error" && !/Failed to load resource|404|favicon/.test(m.text()) && errors.push(m.text()));
  const t0 = Date.now();
  try {
    await fn(page, ctx);
    assert.deepEqual(errors, [], `browser errors: ${errors.join(" | ")}`);
    results.push(`✓ ${name} (${Date.now() - t0}ms)`);
  } catch (e) {
    await page.screenshot({ path: `${SHOTS}/FAIL-${name.replace(/\W+/g, "_")}.png`, fullPage: true }).catch(() => {});
    results.push(`✗ ${name}: ${e.message.split("\n")[0]}`);
    console.error(e);
    process.exitCode = 1;
  } finally {
    await ctx.close();
  }
}

// ---------------------------------------------------------------------------
/** The product form folds rarely used fields (fabric texts, URL & SEO) into collapsible blocks. */
const openMore = (page) => page.evaluate(() => { document.querySelectorAll("#product-form details").forEach((d) => { d.open = true; }); });

await flow("guest: browse → variant → cart → checkout (COD) → track", async (page) => {
  await page.goto(`${BASE}/ar/shop?category=oversized-t-shirts`);
  await page.getByRole("link", { name: /تيشيرت بغداد أوفرسايز/ }).first().click();
  await page.waitForURL(/product\/baghdad-oversized-tee/);
  // choose the second colour and an in-stock size
  await page.getByRole("radio", { name: "عظمي" }).click();
  const sizes = page.locator('[role=radiogroup][aria-label="اختر المقاس"] [role=radio]:not([data-disabled=true])');
  await sizes.first().click();
  const chosen = await sizes.first().innerText();
  await page.getByRole("button", { name: "أضف إلى السلة" }).click();
  await page.getByRole("dialog", { name: "سلة التسوق" }).waitFor();
  await page.getByText(chosen, { exact: false }).first().waitFor();
  await page.getByRole("link", { name: "إتمام الطلب" }).click();
  await page.waitForURL(/checkout/);
  await page.fill("#customer_name", "حسين علي");
  await page.fill("#phone", "07712345678");
  await page.selectOption("#governorate", "basra");
  await page.fill("#city", "العشار");
  await page.fill("#address_line", "شارع الوطن، قرب الجسر");
  await page.getByText("رسوم", { exact: false }).count(); // noop: just let quote settle
  await page.waitForFunction(() => document.body.innerText.includes("٧٬٠٠٠") || document.body.innerText.includes("7,000"));
  await page.screenshot({ path: `${SHOTS}/checkout.png`, fullPage: true });
  await page.getByRole("button", { name: "تأكيد الطلب" }).click();
  await page.waitForURL(/checkout\/success\?order=TP\d+/);
  const orderNumber = new URL(page.url()).searchParams.get("order");
  const o = await one("select o.status, o.total, o.delivery_fee, o.phone, i.size_code, i.color_name_ar from orders o join order_items i on i.order_id = o.id where order_number = $1", [orderNumber]);
  assert.equal(o.status, "received");
  assert.equal(o.delivery_fee, 7000);
  assert.equal(o.phone, "9647712345678");
  assert.equal(o.size_code, chosen.trim());
  assert.equal(o.color_name_ar, "عظمي");
  // cart was emptied
  assert.equal(await page.evaluate(() => JSON.parse(localStorage.getItem("tpac-cart")).state.lines.length), 0);
  // track
  await page.locator("main").getByRole("link", { name: "تتبّع الطلب" }).click();
  await page.fill("#track-phone", "0771 234 5678");
  await page.getByRole("button", { name: "تتبّع" }).click();
  await page.getByText("تم استلام الطلب").first().waitFor();
  await page.screenshot({ path: `${SHOTS}/track.png`, fullPage: true });
  // wrong phone reveals nothing
  await page.fill("#track-phone", "07800000000");
  await page.getByRole("button", { name: "تتبّع" }).click();
  await page.getByText("لم نجد طلباً").waitFor();
});

await flow("cart: stock limits, discount code, persistence across reloads", async (page) => {
  const v = await one("select v.id, p.slug, v.size_code, c.name_ar from product_variants v join products p on p.id = v.product_id join colors c on c.id = v.color_id join inventory i on i.variant_id = v.id where i.quantity between 2 and 4 and p.is_published and v.is_active and coalesce(v.price_override, p.base_price) >= 18000 limit 1");
  await db.query("update inventory set quantity = 2 where variant_id = $1", [v.id]);
  await page.goto(`${BASE}/ar/product/${v.slug}`);
  await page.getByRole("radio", { name: v.name_ar }).click();
  await page.getByRole("radio", { name: v.size_code, exact: true }).click();
  await page.getByText("باقي 2 فقط").or(page.getByText("باقي ٢ فقط")).waitFor();
  await page.getByRole("button", { name: "+" }).click();
  assert.equal(await page.getByRole("button", { name: "+" }).isDisabled(), true, "quantity capped at stock (2)");
  await page.getByRole("button", { name: "أضف إلى السلة" }).click();
  await page.goto(`${BASE}/ar/cart`);
  await page.reload();
  await page.fill("#discount", "welcome10");
  await page.getByRole("button", { name: "تطبيق" }).click();
  await page.getByText("تم تطبيق الخصم").waitFor();
  // stock drops underneath the customer -> cart flags it
  await db.query("update inventory set quantity = 1 where variant_id = $1", [v.id]);
  await page.reload();
  await page.getByText("المتوفر 1 فقط").or(page.getByText("المتوفر ١ فقط")).waitFor();
  await page.screenshot({ path: `${SHOTS}/cart-stock.png`, fullPage: true });
});

await flow("account: register → order → history → reorder → favourites", async (page) => {
  const email = `e2e${Date.now()}@example.com`;
  await page.goto(`${BASE}/en/account/register`);
  await page.fill("#full_name", "Zahraa Kareem");
  await page.fill("#email", email);
  await page.fill("#phone", "07501112233");
  await page.fill("#password", "streetwear-2026");
  await page.fill("#confirm", "streetwear-2026");
  await page.getByRole("button", { name: "Create account" }).click();
  await page.waitForURL(/\/en\/account$/);
  const prof = await one("select phone, full_name from customer_profiles cp join auth.users u on u.id = cp.id where u.email = $1", [email]);
  assert.deepEqual(prof, { phone: "9647501112233", full_name: "Zahraa Kareem" });

  await page.goto(`${BASE}/en/product/essential-hoodie`);
  await page.getByRole("button", { name: "Add to favourites" }).click();
  await page.locator('[role=radiogroup][aria-label="Select size"] [role=radio]:not([data-disabled=true])').first().click();
  await page.getByRole("button", { name: "Buy now" }).click();
  await page.waitForURL(/checkout/);
  assert.equal(await page.inputValue("#customer_name"), "Zahraa Kareem");
  await page.selectOption("#governorate", "baghdad");
  await page.getByText("Express delivery").click();
  await page.fill("#city", "Mansour");
  await page.fill("#address_line", "14 Ramadan St");
  await page.getByRole("button", { name: "Place order" }).click();
  await page.waitForURL(/success/);
  const o = await one("select delivery_method, delivery_fee, user_id is not null as linked from orders where order_number = $1", [new URL(page.url()).searchParams.get("order")]);
  assert.deepEqual(o, { delivery_method: "express", delivery_fee: 10000, linked: true });
  assert.equal((await one("select count(*)::int n from addresses a join auth.users u on u.id = a.user_id where u.email = $1", [email])).n, 1, "address saved");

  await page.goto(`${BASE}/en/account/orders`);
  await page.locator("a[href*='/account/orders/']").first().click();
  await page.getByText("Order timeline").waitFor();
  await page.getByRole("button", { name: "Reorder" }).click();
  await page.getByRole("dialog", { name: "Your bag" }).waitFor();
  await page.waitForTimeout(1500); // account cart sync is debounced
  await page.goto(`${BASE}/en/account/favorites`);
  await page.getByText("Essential Hoodie").waitFor();
  // cart persisted to the account
  let saved = { n: 0 };
  for (let i = 0; i < 30 && saved.n !== 1; i++) {
    saved = await one("select count(*)::int n from cart_items ci join carts c on c.id = ci.cart_id join auth.users u on u.id = c.user_id where u.email = $1", [email]);
    if (saved.n !== 1) await page.waitForTimeout(250);
  }
  assert.equal(saved.n, 1);
  await page.screenshot({ path: `${SHOTS}/account-favs.png`, fullPage: true });
});

await flow("designer: text + uploaded artwork → bounded → priced → ordered with files", async (page) => {
  await page.goto(`${BASE}/en/design?garment=hoodie`);
  await page.locator("canvas").first().waitFor();
  await page.getByRole("button", { name: "or write a word" }).click();
  await page.getByRole("button", { name: "Add", exact: true }).click();
  await page.locator("textarea[dir=auto]").fill("UNIVERSITY OF BAGHDAD");
  // upload a real PNG (generated)
  const png = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAYAAABytg0kAAAAEklEQVR4nGP4z8DwnwEIGGAMAEnkB/m4tK6WAAAAAElFTkSuQmCC", "base64");
  writeFileSync(`${SHOTS}/art.png`, png);
  await page.getByRole("tab", { name: "Back", exact: true }).click();
  await page.locator("input[type=file]").setInputFiles(`${SHOTS}/art.png`);
  await page.getByText(/low \(150\+ needed\)/).waitFor({ timeout: 15000 });
  // try to drag the artwork far outside the print area: it must stay inside
  const box = await page.locator("canvas.upper-canvas").boundingBox();
  await page.mouse.move(box.x + box.width / 2, box.y + box.height * 0.5);
  await page.mouse.down();
  await page.mouse.move(box.x + 5, box.y + 5, { steps: 8 });
  await page.mouse.up();
  await page.screenshot({ path: `${SHOTS}/designer.png`, fullPage: true });
  page.on("console", (m) => console.log("[designer console]", m.text().slice(0, 200)));
  await page.getByRole("button", { name: "Review & add to bag" }).click();
  await page.getByRole("dialog", { name: "Review your design" }).getByText(/printed to order/).waitFor();
  await page.getByRole("button", { name: "Confirm & add to bag" }).click();
  await page.getByRole("dialog", { name: "Your bag" }).waitFor({ timeout: 20000 });
  const d = await one("select unit_price, print_locations, config, preview_front_path, size_code, batch_id from custom_designs order by created_at desc limit 1");
  assert.equal(d.unit_price, 40000 + (await extraPlacements(d.print_locations)), "front + back: one placement included");
  assert.equal(d.size_code, "L");
  assert.deepEqual(d.print_locations.sort(), ["back", "front"]);
  const img = d.config.objects.find((o) => o.type === "image");
  const area = { x: 190, y: 236, w: 220, h: 290 }; // hoodie back
  const half = (img.width * img.scaleX) / 2;
  assert.ok(img.left - half >= area.x - 0.5 && img.left + half <= area.x + area.w + 0.5, `image x within print area (${img.left})`);
  assert.ok(img.artwork_id, "original artwork referenced");
  const art = await one("select storage_path, mime_type, custom_design_id is not null as linked from uploaded_artwork where id = $1", [img.artwork_id]);
  assert.deepEqual([art.mime_type, art.linked], ["image/png", true]);
  await page.goto(`${BASE}/en/checkout`);
  await page.fill("#customer_name", "Designer Test");
  await page.fill("#phone", "07809990000");
  await page.selectOption("#governorate", "najaf");
  await page.fill("#city", "Kufa");
  await page.fill("#address_line", "Main road");
  await page.getByRole("button", { name: "Place order" }).click();
  await page.waitForURL(/success/);
  const o = await one("select has_custom_items, subtotal from orders where order_number = $1", [new URL(page.url()).searchParams.get("order")]);
  assert.deepEqual(o, { has_custom_items: true, subtotal: d.unit_price });
});

let proOrder = null;
await flow("designer pro: template, shape, layers, undo/redo, sizes, options, quantity discount, review, order", async (page) => {
  await page.goto(`${BASE}/en/design?garment=hoodie`);
  await page.locator("canvas").first().waitFor();
  await page.getByRole("tab", { name: "Ideas" }).click();
  await page.getByRole("button", { name: /Name & number/ }).click();
  await page.getByText(/Elements on Back · 2/).waitFor();
  await page.getByRole("tab", { name: "Shapes" }).click();
  await page.getByRole("button", { name: "Stars", exact: true }).click();
  await page.getByRole("button", { name: "Star", exact: true }).click();
  await page.getByText(/Elements on Back · 3/).waitFor();
  // undo / redo
  await page.getByRole("button", { name: "Undo" }).click();
  await page.getByText(/Elements on Back · 2/).waitFor();
  await page.getByRole("button", { name: "Redo" }).click();
  await page.getByText(/Elements on Back · 3/).waitFor();
  // select the shape from the elements list: its editor opens and the colour can be changed
  await page.getByRole("tab", { name: "Image" }).click();
  await page.getByText(/Elements on Back · 3/).click();
  await page.getByRole("button", { name: "Star", exact: true }).click();
  await page.getByRole("button", { name: "#E3963C" }).first().click();
  // sizes, options, extras
  await page.getByRole("button", { name: "Need several sizes?" }).click();
  await page.getByRole("button", { name: "+ M" }).click();
  await page.getByRole("button", { name: "+ M" }).click();
  for (let i = 0; i < 4; i++) await page.getByRole("button", { name: "+ XL" }).click();
  await page.getByText(/· 7 pcs/).first().waitFor();
  await page.getByText("Printing options").click();
  await page.getByRole("radio", { name: /Heat-press vinyl/ }).click();
  await page.getByRole("radio", { name: /3D puff/ }).click();
  await page.getByRole("checkbox", { name: /Rush production/ }).click();
  await page.getByText(/Order 12\+ pieces and save 10%/).waitFor(); // next tier
  await page.screenshot({ path: `${SHOTS}/designer-order.png`, fullPage: true });
  await page.getByRole("button", { name: "Review & add to bag" }).click();
  const dlg = page.getByRole("dialog", { name: "Review your design" });
  await dlg.getByText(/M × 2/).waitFor();
  await dlg.getByText(/XL × 4/).waitFor();
  await dlg.getByText(/Rush production/).waitFor();
  await dlg.getByRole("button", { name: "Confirm & add to bag" }).click();
  await page.getByRole("dialog", { name: "Your bag" }).waitFor({ timeout: 20000 });
  const rows = (await db.query("select size_code, unit_price, print_locations, options, options_price, batch_id, config from custom_designs where batch_id = (select batch_id from custom_designs order by created_at desc limit 1) order by size_code")).rows;
  assert.deepEqual(rows.map((r) => r.size_code), ["L", "M", "XL"], "one saved design per size");
  assert.equal(new Set(rows.map((r) => r.batch_id)).size, 1, "shared batch");
  const unit = 40000 + (await extraPlacements(rows[0].print_locations ?? [])) + 2000 + 2500 + 5000;
  assert.ok(rows.every((r) => r.unit_price === unit && r.options_price === 9500), `list price per piece ${unit}`);
  assert.equal(rows[0].options.method, "vinyl");
  assert.deepEqual(rows[0].options.addons, ["rush"]);
  assert.equal(rows[0].config.objects.length, 3);
  assert.ok(rows[0].config.objects.some((o) => o.type === "shape" && o.shape_id === "star5" && o.fill === "#E3963C"), "shape saved with its id and colour");
  assert.ok(rows[0].config.objects.some((o) => o.type === "text" && o.text === "YOUR NAME"));
  // the stored back preview really shows the design: 900 x 1050, bright text inside the back print area
  const pb = (await one("select preview_back_path p from custom_designs where batch_id = $1 limit 1", [rows[0].batch_id])).p;
  const b64 = readFileSync(`/tmp/tpac-emulator-storage/design-uploads/${pb}`).toString("base64");
  const probe = await page.evaluate(async (data) => {
    const img = new Image();
    img.src = `data:image/jpeg;base64,${data}`;
    await img.decode();
    const c = document.createElement("canvas");
    c.width = img.width; c.height = img.height;
    const x = c.getContext("2d");
    x.drawImage(img, 0, 0);
    const d = x.getImageData(285, 354, 330, 435).data;
    let n = 0;
    for (let i = 0; i < d.length; i += 4) if (d[i] > 200 && d[i + 1] > 200 && d[i + 2] > 200) n++;
    return { w: img.width, h: img.height, n };
  }, b64);
  assert.deepEqual([probe.w, probe.h], [900, 1050]);
  assert.ok(probe.n > 3000, `design is visible in the back preview (${probe.n} bright px)`);
  // 7 custom pieces -> 5% tier, applied by the server on every line
  const lines = rows.map((r) => ({ custom_design_id: r.batch_id ? null : null }));
  void lines;
  const ids = (await db.query("select id, size_code from custom_designs where batch_id = $1 order by size_code", [rows[0].batch_id])).rows;
  const qty = { L: 1, M: 2, XL: 4 };
  const q = (await db.query("select quote_cart($1::jsonb) q", [JSON.stringify({ items: ids.map((r) => ({ custom_design_id: r.id, quantity: qty[r.size_code] })) })])).rows[0].q;
  const disc = unit - Math.round((unit * 5) / 100 / 250) * 250;
  assert.ok(q.lines.every((l) => l.unit_price === disc && l.list_price === unit && l.tier_percent === 5));
  assert.equal(q.subtotal, disc * 7);
  // cart drawer shows the chosen options
  await page.getByText(/Heat-press vinyl/).first().waitFor();
  await page.goto(`${BASE}/en/checkout`);
  await page.fill("#customer_name", "Pro Designer");
  await page.fill("#phone", "07809991111");
  await page.selectOption("#governorate", "najaf");
  await page.fill("#city", "Kufa");
  await page.fill("#address_line", "Main road");
  await page.getByRole("button", { name: "Place order" }).click();
  await page.waitForURL(/success/);
  const num = new URL(page.url()).searchParams.get("order");
  const o = await one("select id, subtotal from orders where order_number = $1", [num]);
  assert.equal(o.subtotal, disc * 7);
  proOrder = o.id;
});

await flow("bulk: university request with artwork", async (page) => {
  await page.goto(`${BASE}/ar/bulk`);
  assert.equal(await page.getByText("للقطعة").count(), 0, "no public price list");
  await page.fill("#b-contact", "مصطفى");
  await page.fill("#b-phone", "07701231234");
  await page.fill("#b-org", "جامعة بغداد — كلية الهندسة");
  await page.fill("#b-qmin", "200");
  await page.fill("#b-qmax", "150");
  await page.locator("label:has(input[value=hoodie])").click();
  await page.fill("#b-color", "كحلي مع شعار ذهبي");
  await page.getByRole("button", { name: "إرسال الطلب" }).click();
  await page.getByText("الكمية \"إلى\" لازم تكون أكبر").waitFor();
  await page.fill("#b-qmax", "250");
  writeFileSync(`${SHOTS}/logo.pdf`, "%PDF-1.4\n1 0 obj<<>>endobj\ntrailer<<>>\n%%EOF");
  await page.locator("input[type=file]").setInputFiles(`${SHOTS}/logo.pdf`);
  await page.getByText("logo.pdf").waitFor();
  await page.getByRole("button", { name: "إرسال الطلب" }).click();
  const ref = (await page.getByTestId("quote-ref").innerText()).trim();
  assert.match(ref, /^BR-\d+$/);
  const r = await one("select b.request_number, b.product_type, b.quantity_min, b.quantity_max, b.estimated_quantity, b.preferred_color, (select count(*)::int from uploaded_artwork a where a.bulk_request_id = b.id) files from bulk_order_requests b order by created_at desc limit 1");
  assert.deepEqual(r, { request_number: ref, product_type: "hoodie", quantity_min: 200, quantity_max: 250, estimated_quantity: 250, preferred_color: "كحلي مع شعار ذهبي", files: 1 });
});

await flow("security: customers are kept out of admin; uploads are verified", async (page) => {
  await page.goto(`${BASE}/ar/admin`);
  await page.waitForURL(/account\/login/);
  const res = await page.request.get(`${BASE}/api/admin/orders`);
  assert.equal(res.status(), 403);
  // a fake "PNG" (HTML payload) is rejected and deleted after upload
  const sign = await (await page.request.post(`${BASE}/api/uploads/sign`, { data: { purpose: "design", type: "image/png", size: 30 } })).json();
  const put = await page.request.put(`http://localhost:54321/storage/v1/object/upload/sign/design-uploads/${sign.path}?token=${sign.token}`, { headers: { "content-type": "image/png" }, data: "<html><script>alert(1)</script></html>" });
  assert.equal(put.status(), 200);
  const done = await page.request.post(`${BASE}/api/uploads/complete`, { data: { path: sign.path } });
  assert.equal(done.status(), 400);
  assert.equal((await one("select count(*)::int n from storage.objects where name = $1", [sign.path])).n, 0);
  // oversize declared upload refused before signing
  assert.equal((await page.request.post(`${BASE}/api/uploads/sign`, { data: { purpose: "design", type: "image/png", size: 50 * 1024 * 1024 } })).status(), 400);
});

await flow("admin: dashboard, order workflow, stock, product, settings, quotation → order", async (page) => {
  const email = `admin${Date.now()}@thetpac.com`;
  await page.goto(`${BASE}/ar/account/register`);
  await page.fill("#full_name", "مدير المتجر");
  await page.fill("#email", email);
  await page.fill("#phone", "07700000001");
  await page.fill("#password", "admin-pass-2026");
  await page.fill("#confirm", "admin-pass-2026");
  await page.getByRole("button", { name: "إنشاء الحساب" }).click();
  await page.waitForURL(/account$/);
  await db.query("update customer_profiles set role = 'admin' where email = $1", [email]);

  await page.goto(`${BASE}/ar/admin`);
  await page.getByText("إجمالي المبيعات").waitFor();
  await page.screenshot({ path: `${SHOTS}/admin-dashboard.png`, fullPage: true });

  // order workflow: newest order -> confirmed -> cancelled restores stock
  const ord = await one("select o.id, i.variant_id, i.quantity from orders o join order_items i on i.order_id = o.id where o.status = 'received' and i.variant_id is not null order by o.created_at desc limit 1");
  const before = (await one("select quantity from inventory where variant_id = $1", [ord.variant_id])).quantity;
  await page.goto(`${BASE}/ar/admin/orders`);
  await page.fill("input[name=q]", "07712345678");
  await page.getByRole("button", { name: "بحث" }).click();
  await page.locator("table a[href*='/admin/orders/']").first().waitFor();
  await page.goto(`${BASE}/ar/admin/orders/${ord.id}`);
  await page.selectOption("#status", "confirmed");
  await page.getByRole("button", { name: "تحديث" }).click();
  await page.getByText("تم الحفظ").first().waitFor();
  await page.fill("#body", "اتصلنا بالعميل وأكد العنوان");
  await page.getByRole("button", { name: "إضافة" }).click();
  await page.getByText("اتصلنا بالعميل").nth(0).waitFor();
  await page.selectOption("#status", "cancelled");
  await page.getByRole("button", { name: "تحديث" }).click();
  await page.getByText("الطلب في حالة نهائية.").waitFor();
  const after = (await one("select quantity from inventory where variant_id = $1", [ord.variant_id])).quantity;
  assert.equal(after, before + ord.quantity, "stock restored on cancel");
  // invoice + CSV
  await page.goto(`${BASE}/ar/admin/orders/${ord.id}/invoice`);
  await page.getByText("فاتورة").first().waitFor();
  const csv = await page.request.get(`${BASE}/api/admin/orders?status=cancelled`);
  assert.equal(csv.status(), 200);
  assert.match(await csv.text(), /order_number/);

  // inventory adjustment
  await page.goto(`${BASE}/ar/admin/inventory?q=TP-BOT-BLA-M`);
  await page.locator("input[name=change]").first().fill("7");
  await page.locator("form:has(input[name=change]) button[type=submit]").first().click();
  await page.getByText("تم الحفظ").first().waitFor();
  const tx = await one("select change, reason, created_by is not null as who from inventory_transactions t join product_variants v on v.id = t.variant_id where v.sku = 'TP-BOT-BLA-M' order by t.id desc limit 1");
  assert.deepEqual(tx, { change: 7, reason: "restock", who: true });

  // create a product
  await page.goto(`${BASE}/ar/admin/products/new?type=none`);
  await page.fill("#name_ar", "تيشيرت تجربة");
  await openMore(page);
  await page.fill("#name_en", "Test Tee");
  await page.fill("#slug", "e2e-test-tee");
  await page.fill("#base_price", "21000");
  await page.getByRole("button", { name: "إنشاء المنتج" }).click();
  await page.waitForURL(/admin\/products\/[0-9a-f-]{36}$/);
  await page.getByText("توليد المقاسات والألوان").waitFor();
  await page.locator("input[name=color_ids]").first().check();
  await page.getByRole("button", { name: "توليد الناقص" }).click();
  await page.getByText("+5").first().waitFor();
  assert.equal((await one("select count(*)::int n from product_variants v join products p on p.id = v.product_id where p.slug = 'e2e-test-tee'")).n, 5);

  // settings: delivery fee
  await page.goto(`${BASE}/ar/admin/settings`);
  const row = page.locator("form:has(input[name=standard_fee])").first();
  await row.locator("input[name=standard_fee]").fill("5500");
  await row.locator("button[type=submit]").click();
  await page.getByText("تم الحفظ").first().waitFor();
  assert.equal((await one("select standard_fee from delivery_zones where governorate = 'baghdad'")).standard_fee, 5500);

  // bulk: quotation -> approve -> convert
  const br = await one("select id from bulk_order_requests order by created_at desc limit 1");
  await page.goto(`${BASE}/ar/admin/bulk/${br.id}`);
  const newQuote = page.locator("section:has-text('عرض سعر جديد') form");
  await newQuote.locator("select[name=status]").selectOption("approved");
  await newQuote.getByRole("button", { name: "حفظ عرض السعر" }).click();
  await page.getByRole("button", { name: "تحويل إلى طلب" }).waitFor();
  await page.getByRole("button", { name: "تحويل إلى طلب" }).click();
  await page.waitForURL(/admin\/orders\/[0-9a-f-]{36}$/);
  const conv = await one("select source, status, total from orders order by created_at desc limit 1");
  assert.equal(conv.source, "bulk");
  assert.equal(conv.status, "confirmed");
  assert.ok(conv.total > 0);

  for (const p of ["customers", "products", "categories", "attributes", "customizer", "discounts", "marketing", "homepage", "notifications", "inquiries", "activity", "reviews", "bulk/pricing", "portfolio", "whatsapp"]) {
    const r = await page.goto(`${BASE}/ar/admin/${p}`);
    assert.equal(r.status(), 200, p);
  }
  await page.goto(`${BASE}/en/admin/activity`);
  await page.getByText("order.status_changed").first().waitFor();
});

await flow("feedback: tap ripple, top toasts, hero slideshow with admin-uploaded video", async (page, ctx) => {
  // --- tap ripple + toast placement (customer) ---
  await page.goto(`${BASE}/ar/product/essential-hoodie`);
  const size = page.locator('[role=radiogroup][aria-label="اختر المقاس"] [role=radio]:not([data-disabled=true])').first();
  await size.click();
  const add = page.getByRole("button", { name: "أضف إلى السلة" }).first();
  const box = await add.boundingBox();
  await page.mouse.move(box.x + 20, box.y + 20);
  await page.mouse.down();
  assert.ok((await add.locator(".ripple-dot").count()) > 0, "ripple appears on press");
  await page.mouse.up();
  const toast = page.locator("[role=status] >> text=أُضيف إلى السلة");
  await toast.waitFor();
  const tb = await toast.boundingBox();
  assert.ok(tb.y < 120, `toast is at the top of the screen (y=${Math.round(tb.y)})`);

  // --- admin creates a video hero slide (real upload through storage) ---
  const email = `hero${Date.now()}@thetpac.com`;
  const adminPage = await ctx.newPage();
  await adminPage.goto(`${BASE}/ar/account/register`);
  await adminPage.fill("#full_name", "Hero Admin");
  await adminPage.fill("#email", email);
  await adminPage.fill("#phone", "07700000077");
  await adminPage.fill("#password", "admin-pass-2026");
  await adminPage.fill("#confirm", "admin-pass-2026");
  await adminPage.getByRole("button", { name: "إنشاء الحساب" }).click();
  await adminPage.waitForURL(/account$/);
  await db.query("update customer_profiles set role = 'admin' where email = $1", [email]);
  const mp4 = `${SHOTS}/slide.mp4`;
  const { execFileSync } = await import("node:child_process");
  execFileSync("ffmpeg", ["-y", "-loglevel", "error", "-f", "lavfi", "-i", "testsrc2=size=360x640:rate=15,format=yuv420p", "-t", "3", "-c:v", "libx264", "-preset", "veryfast", mp4]);
  await adminPage.goto(`${BASE}/ar/admin/marketing`);
  const form = adminPage.locator("form:has(select[name=placement]):has(button:text-is('إضافة'))").last();
  await form.locator("select[name=placement]").selectOption("hero");
  await form.locator("input[name=title_ar]").fill("سلايد الفيديو");
  await form.locator("input[name=title_en]").fill("Video slide");
  await form.locator("input[name=link]").fill("/shop");
  await form.locator("input[name=sort_order]").fill("0");
  await form.locator("input[type=file][accept*=video]").setInputFiles(mp4);
  await form.locator("input[name=video_url]").evaluate((el) => new Promise((res) => { const t = setInterval(() => el.value.startsWith("http") && (clearInterval(t), res()), 100); }));
  await form.getByRole("button", { name: "إضافة", exact: true }).click();
  await adminPage.getByText("تم الحفظ").first().waitFor();
  const banner = await one("select video_url, placement from promo_banners where title_ar = 'سلايد الفيديو'");
  assert.equal(banner.placement, "hero");
  assert.match(banner.video_url, /\/storage\/v1\/object\/public\/site-media\/media\/.+\.mp4$/);
  // an oversize / wrong-type file is refused by the bucket rules
  const bad = await adminPage.request.post(`http://localhost:54321/storage/v1/object/site-media/media/x.exe`, { headers: { "content-type": "application/x-msdownload" }, data: "MZ" });
  assert.notEqual(bad.status(), 200);

  // --- storefront shows it: autoplaying muted video in the hero ---
  await page.goto(`${BASE}/ar`);
  const tabs = page.getByRole("tab");
  await tabs.first().waitFor({ timeout: 15000 }); // page content streams in after the shell
  let n = 0;
  for (let i = 0; i < 40 && n < 2; i++) { n = await tabs.count(); if (n < 2) await page.waitForTimeout(250); }
  assert.ok(n >= 2, "hero has several slides (seed slide + the new one)");
  let playing = false;
  for (let i = 0; i < n && !playing; i++) {
    await tabs.nth(i).click();
    await page.waitForTimeout(700);
    const v = page.locator("video[src*='site-media']");
    if (await v.count()) {
      await page.waitForFunction(() => { const el = document.querySelector("video"); return el && !el.paused && el.currentTime > 0; }, null, { timeout: 8000 });
      playing = true;
    }
  }
  assert.ok(playing, "the uploaded video plays in the hero");
  assert.equal(await page.locator("h1").innerText(), "سلايد الفيديو");
  await adminPage.close();
});

await flow("admin product tools: quick create, similar, duplicate, stock grid, bulk, CSV import/export", async (page) => {
  const email = `tools${Date.now()}@thetpac.com`;
  await page.goto(`${BASE}/ar/account/register`);
  await page.fill("#full_name", "Tools Admin");
  await page.fill("#email", email);
  await page.fill("#phone", "07700000055");
  await page.fill("#password", "admin-pass-2026");
  await page.fill("#confirm", "admin-pass-2026");
  await page.getByRole("button", { name: "إنشاء الحساب" }).click();
  await page.waitForURL(/account$/);
  await db.query("update customer_profiles set role = 'admin' where email = $1", [email]);

  // ---- quick create: auto slug, presets, sizes/colours/stock, photo ----
  await page.goto(`${BASE}/ar/admin/products/new?type=none`);
  await page.fill("#name_ar", "هودي تجربة سريع");
  await openMore(page);
  await page.fill("#name_en", "E2E Quick Hoodie");
  assert.equal(await page.inputValue("#slug"), "e2e-quick-hoodie", "slug is generated from the English name");
  await page.getByRole("button", { name: "قطن ثقيل ٢٤٠غ" }).click();
  assert.match(await page.inputValue("#material_ar"), /قطن/, "preset fills the fabric text");
  await page.getByRole("button", { name: "طباعة DTF" }).click();
  await page.fill("#base_price", "33000");
  for (const c of ["أسود", "أبيض"]) await page.locator("label:has(input[name=qs_colors])").filter({ hasText: c }).first().click();
  await page.fill("#qs_stock", "7");
  const png = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAYAAABytg0kAAAAEklEQVR4nGP4z8DwnwEIGGAMAEnkB/m4tK6WAAAAAElFTkSuQmCC", "base64");
  writeFileSync(`${SHOTS}/p.png`, png);
  await page.locator("input[type=file][accept*=image]").setInputFiles(`${SHOTS}/p.png`);
  await page.waitForFunction(() => JSON.parse(document.querySelector("input[name=images_json]").value).length === 1, null, { timeout: 15000 });
  // create and keep going with a similar product
  await page.getByRole("button", { name: "إنشاء وإضافة منتج شبيه" }).click();
  await page.getByText("أضف المنتج الشبيه").waitFor();
  assert.equal(await page.inputValue("#name_ar"), "", "names are cleared for the next product");
  assert.equal(await page.inputValue("#base_price"), "33000", "price is kept");
  assert.match(await page.inputValue("#material_ar"), /قطن/, "texts are kept");
  assert.equal(await page.locator("input[name=qs_colors]:checked").count(), 2, "colours are kept");
  await page.fill("#name_ar", "هودي تجربة ثاني");
  await openMore(page);
  await page.fill("#name_en", "E2E Quick Hoodie");
  assert.equal(await page.inputValue("#slug"), "e2e-quick-hoodie", "slug field regenerates");
  await page.getByRole("button", { name: "إنشاء المنتج", exact: true }).click();
  await page.waitForURL(/admin\/products\/[0-9a-f-]{36}$/);

  const rows = await db.query("select id, slug, (select count(*)::int from product_variants v where v.product_id = p.id) variants, (select coalesce(sum(i.quantity),0)::int from product_variants v join inventory i on i.variant_id = v.id where v.product_id = p.id) stock, (select count(*)::int from product_images im where im.product_id = p.id) images from products p where slug like 'e2e-quick-hoodie%' order by created_at");
  assert.equal(rows.rows.length, 2);
  assert.deepEqual(rows.rows.map((r) => [r.variants, r.stock, r.images]), [[10, 70, 1], [10, 70, 0]]);
  assert.notEqual(rows.rows[0].slug, rows.rows[1].slug, "unique slugs");
  const tx = await one("select count(*)::int n from inventory_transactions t join product_variants v on v.id = t.variant_id where v.product_id = $1 and t.reason = 'initial'", [rows.rows[0].id]);
  assert.equal(tx.n, 10, "starting stock is recorded in the stock history");

  // ---- stock grid (on the second product's edit page) ----
  const secondId = rows.rows[1].id;
  const firstId = rows.rows[0].id;
  await page.goto(`${BASE}/ar/admin/products/${firstId}`);
  await page.getByLabel("أسود M", { exact: true }).fill("12");
  await page.getByRole("button", { name: "حفظ المخزون" }).click();
  await page.getByText("تم تحديث المخزون").waitFor();
  const m = await one("select i.quantity from inventory i join product_variants v on v.id = i.variant_id join colors c on c.id = v.color_id where v.product_id = $1 and c.code = 'black' and v.size_code = 'M'", [firstId]);
  assert.equal(m.quantity, 12);
  const adj = await one("select t.change, t.reason from inventory_transactions t join product_variants v on v.id = t.variant_id where v.product_id = $1 and t.reason = 'restock'", [firstId]);
  assert.deepEqual(adj, { change: 5, reason: "restock" });

  // ---- duplicate (with and without stock) ----
  await page.getByRole("button", { name: "نسخ المنتج", exact: true }).click();
  await page.waitForURL((u) => u.pathname.endsWith(secondId) === false && /admin\/products\/[0-9a-f-]{36}$/.test(u.pathname) && !u.pathname.endsWith(firstId));
  const copy1 = await one("select p.id, p.slug, p.is_published, p.name_ar, (select count(*)::int from product_variants v where v.product_id = p.id) variants, (select coalesce(sum(i.quantity),0)::int from product_variants v join inventory i on i.variant_id = v.id where v.product_id = p.id) stock, (select count(*)::int from product_images im where im.product_id = p.id) images, (select count(*)::int from product_variants v where v.product_id = p.id and v.sku in (select sku from product_variants where product_id = $1)) shared_skus from products p where slug = $2", [firstId, "e2e-quick-hoodie-copy"]);
  assert.ok(copy1, "copy exists with a -copy slug");
  assert.equal(copy1.is_published, false, "copies start as drafts");
  assert.match(copy1.name_ar, /نسخة/);
  assert.deepEqual([copy1.variants, copy1.stock, copy1.images, copy1.shared_skus], [10, 0, 1, 0], "variants copied with fresh SKUs, no stock, image kept");
  await page.goto(`${BASE}/ar/admin/products/${firstId}`);
  await page.getByRole("button", { name: "نسخ مع المخزون" }).click();
  await page.waitForURL((u) => /admin\/products\/[0-9a-f-]{36}$/.test(u.pathname) && !u.pathname.endsWith(firstId) && !u.pathname.endsWith(copy1.id));
  const copy2 = await one("select (select coalesce(sum(i.quantity),0)::int from product_variants v join inventory i on i.variant_id = v.id where v.product_id = p.id) stock from products p where slug = 'e2e-quick-hoodie-copy-2'");
  assert.equal(copy2.stock, 75, "stock copied (70 + the 5 added in the grid)");

  // ---- bulk actions from the list ----
  await page.goto(`${BASE}/ar/admin/products?q=e2e-quick`);
  await page.getByLabel("تحديد الكل").check();
  await page.locator("select[name=op]").selectOption("hide");
  await page.getByRole("button", { name: "تطبيق" }).click();
  await page.getByText("تم التطبيق").first().waitFor();
  const hidden = await one("select count(*)::int n from products where slug like 'e2e-quick%' and is_published = false");
  assert.equal(hidden.n, 4, "all four are hidden");
  await page.getByLabel("تحديد الكل").check();
  await page.locator("select[name=op]").selectOption("price_percent");
  await page.locator("input[name=value]").fill("10");
  await page.getByRole("button", { name: "تطبيق" }).click();
  await page.waitForFunction(() => !document.querySelector("select[name=op]"));
  const price = await one("select base_price from products where id = $1", [firstId]);
  assert.equal(price.base_price, 36250, "+10% rounded to the nearest 250");

  // ---- CSV import ----
  await page.goto(`${BASE}/ar/admin/products/import`);
  const csv = [
    "name_ar,name_en,price,category,sizes,colors,stock,published",
    "منتج استيراد ١,Import One,15000,t-shirts,S|M,black,4,yes",
    "منتج استيراد ٢,Import Two,16000,t-shirts,S,purple-unicorn,4,yes",
    "منتج استيراد ٣,Import Three,abc,hoodies,S,black,1,yes",
  ].join("\n");
  await page.locator("textarea[name=csv]").fill(csv);
  await page.getByRole("button", { name: "استيراد المنتجات" }).click();
  await page.getByText("لون غير موجود").waitFor();
  await page.getByText("السعر غير صالح").waitFor();
  const imp = await one("select p.is_published, (select count(*)::int from product_variants v where v.product_id = p.id) variants, (select sum(i.quantity)::int from product_variants v join inventory i on i.variant_id = v.id where v.product_id = p.id) stock from products p where slug = 'import-one'");
  assert.deepEqual(imp, { is_published: true, variants: 2, stock: 8 });
  assert.equal((await one("select count(*)::int n from products where slug in ('import-two','import-three')")).n, 0, "invalid rows are not created");

  // ---- export + template ----
  const exp = await page.request.get(`${BASE}/api/admin/products`);
  assert.equal(exp.status(), 200);
  assert.match(await exp.text(), /import-one/);
  const tpl = await page.request.get(`${BASE}/api/admin/products?template=1`);
  assert.match(await tpl.text(), /name_ar,name_en,price/);
  // customers cannot use the tools
  const anon = await page.context().browser().newContext();
  assert.equal((await anon.request.get(`${BASE}/api/admin/products`)).status(), 403);
  await anon.close();
});

await flow("admin print designer: options, tiers, customer designs, production sheet", async (page) => {
  const email = `pro${Date.now()}@thetpac.com`;
  await page.goto(`${BASE}/en/account/register`);
  await page.fill("#full_name", "Print Admin");
  await page.fill("#email", email);
  await page.fill("#phone", "07700000077");
  await page.fill("#password", "admin-pass-2026");
  await page.fill("#confirm", "admin-pass-2026");
  await page.getByRole("button", { name: "Create account" }).click();
  await page.waitForURL(/account$/);
  await db.query("update customer_profiles set role = 'admin' where email = $1", [email]);
  // options: add a finish, then edit its price
  await page.goto(`${BASE}/en/admin/customizer?tab=options`);
  const finish = page.locator("details", { hasText: "Add an option" }).nth(1);
  await finish.locator("summary").click();
  await finish.locator("input[name=name_ar]").fill("ذهبي معدني");
  await finish.locator("input[name=name_en]").fill("Metallic gold");
  await finish.locator("input[name=code]").fill("gold_foil");
  await finish.locator("input[name=price]").fill("4000");
  await finish.getByRole("button", { name: "Add", exact: true }).click();
  await page.getByText("Saved", { exact: true }).first().waitFor();
  assert.equal((await one("select group_code, price, is_active from designer_options where code = 'gold_foil'")).group_code, "finish");
  // the new option is offered to customers
  const ctx2 = await page.context().browser().newContext();
  const guest = await ctx2.newPage();
  await guest.goto(`${BASE}/en/design?garment=hoodie`);
  await guest.getByText("Printing options").click();
  await guest.getByRole("radio", { name: /Metallic gold/ }).waitFor();
  await ctx2.close();
  // tiers
  await page.goto(`${BASE}/en/admin/customizer?tab=tiers`);
  const add = page.locator("form").filter({ has: page.getByRole("button", { name: "Add tier" }) });
  await add.locator("input[name=min_qty]").fill("100");
  await add.locator("input[name=discount_percent]").fill("30");
  await add.getByRole("button", { name: "Add tier" }).click();
  await page.getByText("Saved", { exact: true }).first().waitFor();
  assert.equal((await one("select discount_percent from designer_tiers where min_qty = 100")).discount_percent, 30);
  // settings (admin only)
  await page.goto(`${BASE}/en/admin/customizer?tab=settings`);
  await page.locator("input[name=lead_days_max]").fill("7");
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await page.getByText("Saved", { exact: true }).first().waitFor();
  assert.equal((await one("select value ->> 'lead_days_max' v from website_settings where key = 'designer'")).v, "7");
  // customer designs gallery shows the ordered design and links to the order
  await page.goto(`${BASE}/en/admin/designs?status=ordered`);
  await page.getByText("Print designer").first().waitFor().catch(() => {});
  await page.getByRole("link", { name: /Production sheet/ }).first().waitFor();
  // production sheet: sizes with ordered quantities, options, placements in cm
  await page.goto(`${BASE}/en/admin/orders/${proOrder}/production`);
  await page.getByText("PRODUCTION SHEET").waitFor();
  await page.getByText("7 pcs").waitFor();
  await page.getByText("Rush production").first().waitFor();
  await page.getByText("«YOUR NAME»").waitFor();
  await page.screenshot({ path: `${SHOTS}/production.png`, fullPage: true });
  // order page links to the sheet and lists options
  await page.goto(`${BASE}/en/admin/orders/${proOrder}`);
  await page.getByRole("link", { name: /Production sheet/ }).waitFor();
  await page.getByText(/Print options/).waitFor();
});

await flow("admin printing: type mockup & areas → product from template with artwork → generated photos → store print details → edit in place", async (page) => {
  const email = `print${Date.now()}@thetpac.com`;
  await page.goto(`${BASE}/en/account/register`);
  await page.fill("#full_name", "Print Admin 2");
  await page.fill("#email", email);
  await page.fill("#phone", "07700000088");
  await page.fill("#password", "admin-pass-2026");
  await page.fill("#confirm", "admin-pass-2026");
  await page.getByRole("button", { name: "Create account" }).click();
  await page.waitForURL(/account$/);
  await db.query("update customer_profiles set role = 'admin' where email = $1", [email]);
  // test images drawn in the browser: a blank garment photo (800 x 1000) and a transparent logo (1200 x 800)
  const png = async (w, h, kind) => {
    const b64 = await page.evaluate(([w, h, kind]) => {
      const c = document.createElement("canvas"); c.width = w; c.height = h;
      const x = c.getContext("2d");
      if (kind === "mock") { x.fillStyle = "#EFECE6"; x.fillRect(0, 0, w, h); x.fillStyle = "#2b2b2b"; x.fillRect(w * 0.25, h * 0.12, w * 0.5, h * 0.8); }
      else { x.fillStyle = "#E3963C"; x.fillRect(40, 40, w - 80, h - 80); x.fillStyle = "#376352"; x.beginPath(); x.arc(w / 2, h / 2, h / 4, 0, 7); x.fill(); }
      return c.toDataURL("image/png").split(",")[1];
    }, [w, h, kind]);
    const file = `${SHOTS}/${kind}.png`;
    writeFileSync(file, Buffer.from(b64, "base64"));
    return file;
  };
  const mock = await png(800, 1000, "mock");
  const art = await png(1200, 800, "art");

  // 1) product type: upload the hoodie's front mockup, resize the main print area to 30 x 40 cm
  const hoodie = (await one("select id from product_types where code = 'hoodie'")).id;
  await page.goto(`${BASE}/en/admin/product-types/${hoodie}`);
  await page.getByText("Default photo").first().waitFor();
  await page.locator("label:has-text('Upload') input[type=file]").first().setInputFiles(mock);
  await page.getByText("Mockup uploaded").first().waitFor({ timeout: 20000 });
  await page.waitForTimeout(500);
  const front = await one("select id, mockup_width, mockup_height, mockup_url from product_type_views where product_type_id = $1 and code = 'front'", [hoodie]);
  assert.deepEqual([front.mockup_width, front.mockup_height], [800, 1000], "mockup keeps its real proportions");
  await page.getByLabel("Max width (cm)").fill("30");
  await page.getByLabel("Max height (cm)").fill("40");
  await page.getByRole("button", { name: /Save areas/ }).click();
  await page.getByText("Print areas saved").waitFor();
  const area = await one("select id, max_width_cm, max_height_cm from product_print_areas where view_id = $1 and code = 'front'", [front.id]);
  assert.deepEqual([Number(area.max_width_cm), Number(area.max_height_cm)], [30, 40]);
  assert.equal((await one("select count(*)::int n from product_print_areas where view_id = $1", [front.id])).n, 4, "saving updates the areas in place");

  // 2) new product: type picker → hoodie → artwork on front + back → create
  await page.goto(`${BASE}/en/admin/products/new`);
  await page.getByRole("link", { name: /Custom product/ }).waitFor();
  await page.getByRole("link", { name: /Hoodie/ }).first().click();
  await page.waitForURL(/type=/);
  assert.equal(await page.inputValue("#base_price"), "40000", "price comes from the type");
  const studioInput = page.locator("input[accept='image/png,image/jpeg,image/webp,image/avif']");
  await studioInput.setInputFiles(art);
  await page.getByText(/Print size: (≈ )?\d/).waitFor({ timeout: 20000 });
  await page.getByRole("button", { name: "Back", exact: true }).click();
  await studioInput.setInputFiles(art);
  await page.waitForFunction(() => document.body.innerText.includes("Print size:"), null, { timeout: 20000 });
  // free placement: the back artwork goes to the very top of the garment, outside every print area
  await page.getByRole("button", { name: "To the top" }).click();
  // while adding: the same design should also be sold as an oversized tee at 30,000
  await page.getByLabel("Available as Oversized tee").check();
  await page.getByLabel("Oversized tee price").fill("30000");
  await page.fill("#name_ar", "هودي الشعار");
  await openMore(page);
  await page.fill("#name_en", "E2E Logo Hoodie");
  await page.getByRole("button", { name: "Create product", exact: true }).click();
  await page.waitForURL(/admin\/products\/[0-9a-f-]{36}$/, { timeout: 60000 });
  const pid = page.url().split("/").pop();
  const prod = await one("select slug, product_type_id = $2 as typed, print_enabled from products where id = $1", [pid, hoodie]);
  assert.ok(prod.typed && prod.print_enabled);
  const designs = (await db.query("select id, area_id, x, y, width, height, artwork_path from product_designs where product_id = $1 order by sort_order", [pid])).rows;
  assert.equal(designs.length, 2);
  assert.ok(designs.every((d) => Number(d.x) + Number(d.width) <= 1.0001 && Number(d.y) + Number(d.height) <= 1.0001), "artwork stays inside its area");
  assert.ok(designs.every((d) => d.artwork_path.startsWith(`products/${pid}/art/`)), "official artwork stored with the product");
  const codes = (await db.query("select a.code, d.y from product_designs d join product_print_areas a on a.id = d.area_id where d.product_id = $1 order by d.sort_order", [pid])).rows;
  assert.deepEqual(codes.map((c) => c.code), ["free", "free"], "admin artwork is placed freely on the garment");
  assert.ok(codes.some((c) => Number(c.y) === 0), "free artwork can sit outside the print areas");
  const gen = (await db.query("select (select code from colors where id = color_id) color, (select code from product_type_views where id = view_id) view from product_images where product_id = $1 and is_generated order by sort_order", [pid])).rows;
  assert.deepEqual(gen.map((g) => `${g.color}/${g.view}`).sort(), ["black/back", "black/front", "white/back", "white/front"], "one photo per colour and angle");
  assert.equal((await one("select count(*)::int n from product_variants where product_id = $1", [pid])).n, 10);

  // 3) storefront: angles, artwork on the mockup, print dimensions
  const shop = await page.context().browser().newContext({ viewport: { width: 1366, height: 900 } });
  const s = await shop.newPage();
  await s.goto(`${BASE}/en/product/${prod.slug}`);
  await s.getByText("Print details").waitFor();
  await s.getByText(/× \d+(\.\d)? cm/).first().waitFor();
  assert.ok((await s.locator(`img[src*="products/${pid}/art/"]`).count()) >= 2, "artwork shown on both angles");
  await s.getByRole("button", { name: "Print area" }).first().click();
  await s.getByText("30×40 cm").first().waitFor();
  await s.screenshot({ path: `${SHOTS}/printing-store.png` });
  // customers cannot touch official artwork
  const anonPut = await s.request.post("http://localhost:54321/rest/v1/product_designs", { headers: { apikey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "", "content-type": "application/json" }, data: { product_id: pid, area_id: designs[0].area_id, artwork_url: "/evil.png", x: 0, y: 0, width: 1, height: 1 } });
  assert.ok(anonPut.status() >= 400, "anonymous writes are refused");
  await shop.close();

  // the oversized tee chosen while adding is created right away, with the artwork carried over and its own photos
  await page.getByText("Now also available as Oversized tee").waitFor({ timeout: 60000 });
  const over = await one("select p.id, p.slug, p.base_price, p.is_published, p.design_group from products p join product_types t on t.id = p.product_type_id where t.code = 'oversized' and p.design_group = $1", [pid]);
  assert.ok(over && over.is_published && over.base_price === 30000, "linked oversized tee at the admin's price");
  assert.equal((await one("select count(*)::int n from product_designs d join product_print_areas a on a.id = d.area_id where d.product_id = $1 and a.code = 'free'", [over.id])).n, 2, "artwork carried to front and back");
  assert.ok((await one("select count(*)::int n from product_images where product_id = $1 and is_generated", [over.id])).n >= 2, "photos generated for the tee");

  // 4) edit: recolour the artwork, enlarge it and save — same rows updated, photos replaced not duplicated
  await page.getByRole("button", { name: "Largest size" }).first().click();
  await page.getByRole("button", { name: "Colour all" }).click();
  await page.getByText("Artwork updated").waitFor({ timeout: 20000 });
  await page.getByRole("button", { name: /Save printing & photos/ }).click();
  await page.getByText("Printing saved and product photos updated").waitFor({ timeout: 60000 });
  const after = (await db.query("select id, width from product_designs where product_id = $1", [pid])).rows;
  assert.deepEqual(after.map((d) => d.id).sort(), designs.map((d) => d.id).sort(), "designs updated in place");
  const frontBefore = designs[0];
  assert.ok(Number(after.find((d) => d.id === frontBefore.id).width) > Number(frontBefore.width), "front artwork enlarged");
  assert.equal((await one("select count(*)::int n from product_images where product_id = $1 and is_generated", [pid])).n, 4, "no duplicate photos");
  assert.equal((await db.query("select 1 from product_designs where product_id = $1 and artwork_path = $2", [pid, designs[0].artwork_path])).rows.length, 0, "recoloured artwork saved as a new file");

  // 5) same design on a t-shirt with its own price, then the customer switches garments on the product page
  await page.getByLabel("Available as T-shirt").check();
  await page.getByLabel("T-shirt price").fill("25000");
  await page.getByLabel("T-shirt price").locator("xpath=ancestor::div[1]").getByRole("button", { name: "Save" }).click();
  await page.getByText("Now also available as T-shirt").waitFor({ timeout: 60000 });
  const tee = await one("select p.slug, p.base_price from products p join product_types t on t.id = p.product_type_id where t.code = 'tshirt' and p.design_group = $1", [pid]);
  assert.equal(tee.base_price, 25000);
  const c2 = await page.context().browser().newContext({ viewport: { width: 1366, height: 900 } });
  const s2 = await c2.newPage();
  await s2.goto(`${BASE}/en/product/${prod.slug}`);
  await s2.getByText("Same design on:").waitFor();
  await s2.locator(`a[href$='/product/${tee.slug}']`).click();
  await s2.waitForURL(new RegExp(`/product/${tee.slug}$`));
  await s2.getByText("Print details").waitFor();
  assert.ok(await s2.getByText("25,000").first().isVisible(), "the tee shows the admin's price");
  await s2.screenshot({ path: `${SHOTS}/garment-switch.png` });
  await c2.close();
  // turning it off hides it from customers
  await page.getByLabel("Available as T-shirt").uncheck();
  await page.getByLabel("T-shirt price").locator("xpath=ancestor::div[1]").getByRole("button", { name: "Save" }).click();
  await page.getByText("Hidden", { exact: true }).first().waitFor();
  assert.equal((await one("select is_published from products where slug = $1", [tee.slug])).is_published, false);
});

await flow("print-on-demand images: admin uploads → preview → save → customers see it → delete falls back", async (page) => {
  const email = `pod${Date.now()}@thetpac.com`;
  await page.goto(`${BASE}/en/account/register`);
  await page.fill("#full_name", "POD Admin");
  await page.fill("#email", email);
  await page.fill("#phone", "07700000099");
  await page.fill("#password", "admin-pass-2026");
  await page.fill("#confirm", "admin-pass-2026");
  await page.getByRole("button", { name: "Create account" }).click();
  await page.waitForURL(/account$/);
  const b64 = await page.evaluate(() => {
    const c = document.createElement("canvas"); c.width = 900; c.height = 1000;
    const x = c.getContext("2d"); x.fillStyle = "#ECE9E2"; x.fillRect(0, 0, 900, 1000); x.fillStyle = "#1d3b5a"; x.fillRect(220, 120, 460, 820);
    return c.toDataURL("image/png").split(",")[1];
  });
  const file = `${SHOTS}/pod-tee.png`;
  writeFileSync(file, Buffer.from(b64, "base64"));

  // a customer can't reach the settings, and can't write the image records
  await page.goto(`${BASE}/en/admin/customizer`);
  await page.waitForURL((u) => !u.pathname.includes("/admin"));
  await db.query("update customer_profiles set role = 'admin' where email = $1", [email]);

  // Dashboard → Print designer → Printing images (first tab)
  await page.goto(`${BASE}/en/admin/customizer`);
  await page.getByRole("tab", { name: "T-shirt", exact: true }).click();
  await page.getByText("Built-in drawing").first().waitFor();
  await page.getByLabel("Image Default image (all colours)").setInputFiles(file);
  await page.getByText("Preview — not saved").waitFor();
  const before = await one("select v.mockup_url from product_type_views v join product_types t on t.id = v.product_type_id where t.code = 'tshirt' and v.code = 'front'");
  assert.equal(before.mockup_url, null, "nothing is stored before Save");
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await page.getByText("Image saved — customers see it now").waitFor({ timeout: 20000 });
  await page.getByText("Current image").first().waitFor();
  const saved = await one("select v.mockup_url, v.mockup_width, v.mockup_height from product_type_views v join product_types t on t.id = v.product_type_id where t.code = 'tshirt' and v.code = 'front'");
  assert.ok(saved.mockup_url?.includes("/product-images/mockups/"), "stored in the product-images bucket");
  assert.deepEqual([saved.mockup_width, saved.mockup_height], [900, 1000]);

  // customer side: the studio loads the new photo, and previews (canvas export) still work with it
  const ctx = await page.context().browser().newContext({ viewport: { width: 1366, height: 900 } });
  const c = await ctx.newPage();
  const photo = c.waitForResponse((r) => r.url() === saved.mockup_url && r.status() === 200, { timeout: 20000 });
  await c.goto(`${BASE}/en/design?garment=tshirt`);
  await photo;
  await c.getByRole("button", { name: "or write a word" }).click();
  await c.getByRole("button", { name: "Add", exact: true }).click();
  await c.getByRole("button", { name: "Review & add to bag" }).click();
  await c.getByRole("dialog", { name: "Review your design" }).waitFor();
  await c.screenshot({ path: `${SHOTS}/pod-customer.png` });
  // still there after a reload (persisted, not cached in the browser)
  await c.reload();
  await c.waitForResponse((r) => r.url() === saved.mockup_url, { timeout: 20000 });
  await ctx.close();

  // delete → customers get the built-in drawing again
  page.once("dialog", (d) => d.accept());
  await page.getByRole("button", { name: "Delete" }).first().click();
  await page.getByText("Image deleted").waitFor();
  assert.equal((await one("select v.mockup_url from product_type_views v join product_types t on t.id = v.product_type_id where t.code = 'tshirt' and v.code = 'front'")).mockup_url, null);
  assert.equal((await one("select count(*)::int n from storage.objects where name = $1", [saved.mockup_url.split("/product-images/")[1]])).n, 0, "the old file is removed from storage");
});

await flow("hoodie photos: 5 colours × front / back / both sleeves, sleeve design saved with its own preview", async (page) => {
  await db.query(readFileSync(new URL("../../supabase/add-hoodie-photos.sql", import.meta.url), "utf8"));
  await page.goto(`${BASE}/en/design?garment=hoodie`);
  await page.locator("canvas").first().waitFor();
  // only the photographed colours are offered
  for (const c of ["Black", "White", "Brown", "Navy", "Maroon"]) await page.getByRole("radio", { name: c, exact: true }).waitFor();
  assert.equal(await page.getByRole("radio", { name: "Sand", exact: true }).count(), 0);
  await page.getByRole("radio", { name: "Maroon", exact: true }).click();
  const sleevePhoto = page.waitForResponse((r) => r.url().includes("/mockups/hoodie-maroon-right.webp") && r.status() === 200, { timeout: 20000 });
  await page.getByRole("tab", { name: "Right sleeve" }).click();
  await sleevePhoto;
  await page.getByRole("button", { name: "or write a word" }).click();
  await page.getByLabel("Text").first().fill("TPAC");
  await page.getByRole("button", { name: "Add", exact: true }).click();
  await page.getByRole("button", { name: "Review & add to bag" }).click();
  const dlg = page.getByRole("dialog", { name: "Review your design" });
  await dlg.getByRole("figure", { name: "Right sleeve" }).waitFor();
  await dlg.getByRole("button", { name: "Confirm & add to bag" }).click();
  await page.getByRole("dialog", { name: "Your bag" }).waitFor({ timeout: 20000 });
  const d = await one("select print_locations, config from custom_designs order by created_at desc limit 1");
  assert.deepEqual(d.print_locations, ["sleeve"]);
  assert.ok(d.config.previews?.right?.endsWith("/right.jpg"), "sleeve preview stored");
  assert.deepEqual(d.config.areas.sleeve.cm, { width: 8, height: 28 }, "the sleeve's own print size");
  assert.equal((await one("select count(*)::int n from storage.objects where name = $1", [d.config.previews.right])).n, 1);
});

await flow("t-shirt photos + hoodie front-and-back photo: studio sleeves, copy artwork, cover photo", async (page) => {
  await db.query(readFileSync(new URL("../../supabase/add-tee-photos.sql", import.meta.url), "utf8"));
  // customers: the t-shirt studio uses the new photos, sleeves on their own photos
  const front = page.waitForResponse((r) => /\/mockups\/tee-[a-z]+-front\.webp/.test(r.url()) && r.status() === 200, { timeout: 20000 });
  await page.goto(`${BASE}/en/design?garment=tshirt`);
  await front;
  const sleeve = page.waitForResponse((r) => /\/mockups\/tee-[a-z]+-right\.webp/.test(r.url()) && r.status() === 200, { timeout: 20000 });
  await page.getByRole("tab", { name: "Right sleeve" }).click();
  await sleeve;
  for (const c of ["Black", "White", "Heather grey", "Navy", "Maroon", "Brown"]) await page.getByRole("radio", { name: c, exact: true }).waitFor();

  // admin: hoodie with a back print → copied onto the "front + back" photo, which becomes the cover
  const email = `combo${Date.now()}@thetpac.com`;
  await page.goto(`${BASE}/en/account/register`);
  await page.fill("#full_name", "Combo Admin");
  await page.fill("#email", email);
  await page.fill("#phone", "07700000097");
  await page.fill("#password", "admin-pass-2026");
  await page.fill("#confirm", "admin-pass-2026");
  await page.getByRole("button", { name: "Create account" }).click();
  await page.waitForURL(/account$/);
  await db.query("update customer_profiles set role = 'admin' where email = $1", [email]);
  const hoodie = (await one("select id from product_types where code = 'hoodie'")).id;
  await page.goto(`${BASE}/en/admin/products/new?type=${hoodie}`);
  await page.getByRole("button", { name: "Back", exact: true }).click();
  await page.locator("input[accept='image/png,image/jpeg,image/webp,image/avif']").setInputFiles(`${SHOTS}/art.png`);
  await page.getByText(/Print size: (≈ )?\d/).waitFor({ timeout: 20000 });
  await page.getByRole("button", { name: /Front \+ back \(one photo\)/ }).click();
  await page.getByRole("button", { name: "Copy the front & back artwork here" }).click();
  await page.getByText("Copied 1 design(s)").waitFor();
  await page.screenshot({ path: `${SHOTS}/combo-studio.png` });
  await page.fill("#name_ar", "هودي أمام وخلف");
  await openMore(page);
  await page.fill("#name_en", "E2E Combo Hoodie");
  await page.getByRole("button", { name: "Create product", exact: true }).click();
  await page.waitForURL(/admin\/products\/[0-9a-f-]{36}$/, { timeout: 60000 });
  const pid = page.url().split("/").pop();
  const rows = (await db.query("select v.code view, d.artwork_path from product_designs d join product_print_areas a on a.id = d.area_id join product_type_views v on v.id = a.view_id where d.product_id = $1 order by d.sort_order", [pid])).rows;
  assert.deepEqual(rows.map((r) => r.view).sort(), ["back", "combo"]);
  assert.equal(rows[0].artwork_path, rows[1].artwork_path, "same artwork file, no copy");
  const cover = await one("select v.code from product_images i join product_type_views v on v.id = i.view_id where i.product_id = $1 order by i.sort_order limit 1", [pid]);
  assert.equal(cover.code, "combo", "the front + back photo is the cover");
});

await flow("size finder + suggested description + product face colour + sizes S→5XL", async (page) => {
  // customer: height + weight + fit → TPAC size from the chart
  await page.goto(`${BASE}/ar/size-finder`);
  await page.getByLabel("الطول (سم)").fill("175");
  await page.getByLabel("الوزن (كغ)").fill("75");
  await page.getByRole("button", { name: "اعرف قياسي" }).click();
  assert.equal((await page.getByTestId("size-result").innerText()).trim(), "M");
  await page.getByRole("radio", { name: /واسع/ }).click();
  assert.equal((await page.getByTestId("size-result").innerText()).trim(), "L", "a looser fit goes a size up");
  await page.getByRole("radio", { name: /أطفال/ }).click();
  await page.getByLabel("الطول (سم)").fill("104");
  await page.getByLabel("الوزن (كغ)").fill("17");
  await page.getByRole("radio", { name: /طبيعي/ }).click();
  await page.getByRole("button", { name: "اعرف قياسي" }).click();
  assert.equal((await page.getByTestId("size-result").innerText()).trim(), "4 سنوات");
  await page.screenshot({ path: `${SHOTS}/size-finder.png`, fullPage: true });

  // admin: S→5XL, the hoodie description in one tap, white as the product's face
  await db.query(readFileSync(new URL("../../supabase/add-sizes-5xl.sql", import.meta.url), "utf8"));
  const email = `face${Date.now()}@thetpac.com`;
  await page.goto(`${BASE}/en/account/register`);
  await page.fill("#full_name", "Face Admin");
  await page.fill("#email", email);
  await page.fill("#phone", "07700000096");
  await page.fill("#password", "admin-pass-2026");
  await page.fill("#confirm", "admin-pass-2026");
  await page.getByRole("button", { name: "Create account" }).click();
  await page.waitForURL(/account$/);
  await db.query("update customer_profiles set role = 'admin' where email = $1", [email]);
  const hoodie = (await one("select id from product_types where code = 'hoodie'")).id;
  await page.goto(`${BASE}/en/admin/products/new?type=${hoodie}`);
  for (const sz of ["S", "3XL", "4XL", "5XL"]) assert.ok(await page.locator(`input[name=qs_sizes][value="${sz}"]`).isChecked(), `${sz} on by default`);
  await page.getByRole("button", { name: "Hoodie description" }).click();
  assert.match(await page.inputValue("#description_ar"), /^دفء، راحة، وجودة/);
  assert.match(await page.inputValue("#description_en"), /TPAC — الحلو يلبس حلو\.$/);
  await page.locator("input[accept='image/png,image/jpeg,image/webp,image/avif']").setInputFiles(`${SHOTS}/art.png`);
  await page.getByText(/Print size: (≈ )?\d/).waitFor({ timeout: 20000 });
  await page.getByRole("button", { name: "White", exact: true }).click();
  await page.getByRole("button", { name: "Make it the product face" }).click();
  await page.getByRole("button", { name: "Product face" }).waitFor();
  await page.fill("#name_ar", "هودي الواجهة البيضاء");
  await openMore(page);
  await page.fill("#name_en", "E2E White Face Hoodie");
  await page.getByRole("button", { name: "Create product", exact: true }).click();
  await page.waitForURL(/admin\/products\/[0-9a-f-]{36}$/, { timeout: 60000 });
  const pid = page.url().split("/").pop();
  const first = await one("select c.code from product_images i join colors c on c.id = i.color_id where i.product_id = $1 order by i.sort_order limit 1", [pid]);
  assert.equal(first.code, "white", "white photos come first");
  const v = await one("select count(distinct size_code)::int sizes, max(size_code) filter (where size_code = '5XL') x from product_variants where product_id = $1", [pid]);
  assert.equal(v.sizes, 8);
  const p = await one("select slug, description_ar from products where id = $1", [pid]);
  assert.match(p.description_ar, /المميزات:/);
  await page.goto(`${BASE}/en/product/${p.slug}`);
  await page.getByText("Colour: White").waitFor();
  await page.getByRole("link", { name: /Find your size from your height/ }).waitFor();
});

async function becomeAdmin(page, tag) {
  // many test sign-ups from one address would hit the site's sign-up rate limit
  await db.query("delete from rate_limits");
  const email = `${tag}${Date.now()}@thetpac.com`;
  await page.goto(`${BASE}/en/account/register`);
  await page.fill("#full_name", `${tag} admin`);
  await page.fill("#email", email);
  await page.fill("#phone", `0770${String(Date.now()).slice(-7)}`);
  await page.fill("#password", "admin-pass-2026");
  await page.fill("#confirm", "admin-pass-2026");
  await page.getByRole("button", { name: "Create account" }).click();
  await page.waitForURL(/account$/);
  await db.query("update customer_profiles set role = 'admin' where email = $1", [email]);
}
const waitFor = async (sql, params, test, ms = 15000) => {
  const end = Date.now() + ms;
  for (;;) {
    const row = await one(sql, params);
    if (row && test(row)) return row;
    if (Date.now() > end) throw new Error(`timed out waiting for ${sql} → ${JSON.stringify(row)}`);
    await new Promise((r) => setTimeout(r, 250));
  }
};

await flow("quotation: request → under review → price → approved → order", async (page) => {
  await page.goto(`${BASE}/ar/bulk`);
  await page.fill("#b-contact", "زينب");
  await page.fill("#b-phone", "07801112222");
  await page.fill("#b-org", "شركة الرافدين");
  await page.fill("#b-qmin", "100");
  await page.fill("#b-qmax", "120");
  await page.locator("label:has(input[value=tshirt])").click();
  await page.fill("#b-color", "أبيض");
  await page.getByRole("button", { name: "إرسال الطلب" }).click();
  const ref = (await page.getByTestId("quote-ref").innerText()).trim();
  const req = await one("select id from bulk_order_requests where request_number = $1", [ref]);
  await becomeAdmin(page, "quote");
  await page.goto(`${BASE}/ar/admin/bulk`);
  await page.getByRole("link", { name: ref }).waitFor();
  await page.goto(`${BASE}/ar/admin/bulk/${req.id}`);
  const follow = page.locator("form:has(input[name=quoted_unit_price])");
  await follow.locator("select[name=status]").selectOption("contacted");
  await follow.getByRole("button", { name: "حفظ" }).click();
  await waitFor("select status from bulk_order_requests where id = $1", [req.id], (r) => r.status === "contacted");
  await page.reload();
  await follow.locator("select[name=status]").selectOption("approved");
  await follow.locator("input[name=quoted_unit_price]").fill("15000");
  await follow.locator("input[name=quoted_quantity]").fill("120");
  await follow.getByRole("button", { name: "حفظ" }).click();
  await page.getByText("١٬٨٠٠٬٠٠٠").first().waitFor();
  const wa = await page.getByRole("link", { name: "أرسل العرض على الواتساب" }).getAttribute("href");
  assert.ok(wa.startsWith("https://wa.me/9647801112222?text=") && decodeURIComponent(wa).includes("سعر القطعة"), "WhatsApp message carries the quote");
  await page.getByRole("button", { name: "تحويل إلى طلب" }).click();
  await page.waitForURL(/admin\/orders\/[0-9a-f-]{36}$/);
  const o = await one("select o.source, o.status, o.total, i.quantity, i.unit_price from orders o join order_items i on i.order_id = o.id where o.id = $1", [page.url().split("/").pop()]);
  assert.deepEqual(o, { source: "bulk", status: "confirmed", total: 1800000, quantity: 120, unit_price: 15000 });
  assert.equal((await one("select status from bulk_order_requests where id = $1", [req.id])).status, "converted");
});

await flow("portfolio: real clients' logos, admin project with photos, filters, gallery", async (page) => {
  await db.query(readFileSync(new URL("../../supabase/add-portfolio-clients.sql", import.meta.url), "utf8"));
  await page.goto(`${BASE}/ar/portfolio`);
  assert.equal(await page.locator('ul[aria-label="عملاؤنا"] li').count(), 8, "only the named, visible clients");
  await page.getByText("صور المشاريع جاية قريباً.").waitFor();
  const png = async (color, name) => {
    const b64 = await page.evaluate((c) => { const k = document.createElement("canvas"); k.width = 1200; k.height = 900; const x = k.getContext("2d"); x.fillStyle = c; x.fillRect(0, 0, 1200, 900); x.fillStyle = "#fff"; x.fillRect(400, 300, 400, 300); return k.toDataURL("image/png").split(",")[1]; }, color);
    writeFileSync(`${SHOTS}/${name}.png`, Buffer.from(b64, "base64"));
    return `${SHOTS}/${name}.png`;
  };
  const photos = [await png("#1d3b5a", "proj1"), await png("#7a2a2a", "proj2")];
  await becomeAdmin(page, "folio");
  await page.goto(`${BASE}/ar/admin/portfolio`);
  const form = page.locator("form:has(input[name=photos_json])").last();
  await form.locator("input[name=title_ar]").fill("هوديات تخرج دفعة ٢٠٢٦");
  await form.locator("select[name=client_id]").selectOption({ label: "IFMSA-Iraq" });
  await form.locator("select[name=category]").selectOption("organization");
  await form.locator("textarea[name=description_ar]").fill("٣٠٠ هودي بشعار المنظمة.");
  await form.getByLabel("صور المشروع").setInputFiles(photos);
  await page.waitForFunction(() => JSON.parse([...document.querySelectorAll("input[name=photos_json]")].pop().value).length === 2, null, { timeout: 20000 });
  await form.getByText("مشروع مميّز").click();
  await form.getByRole("button", { name: "إضافة" }).click();
  const pr = await waitFor("select id, photos, is_featured, category from portfolio_projects order by created_at desc limit 1", [], (r) => !!r);
  assert.equal(pr.photos.length, 2);
  assert.ok(pr.photos.every((x) => x.path.startsWith("portfolio/")) && pr.is_featured && pr.category === "organization");
  await page.goto(`${BASE}/ar/portfolio?category=organization`);
  await page.getByRole("link", { name: /هوديات تخرج دفعة ٢٠٢٦/ }).click();
  await page.waitForURL(/portfolio\/[0-9a-f-]{36}$/);
  await page.getByText("٣٠٠ هودي بشعار المنظمة.").waitFor();
  await page.getByRole("button", { name: /هوديات تخرج دفعة ٢٠٢٦ — 1/ }).click();
  await page.getByRole("dialog").waitFor();
  await page.keyboard.press("Escape");
  await page.getByRole("dialog").waitFor({ state: "detached" });
  await page.goto(`${BASE}/ar/portfolio?category=company`);
  assert.equal(await page.getByRole("link", { name: /هوديات تخرج دفعة ٢٠٢٦/ }).count(), 0, "category filter");
  await page.goto(`${BASE}/ar/portfolio`);
  await page.screenshot({ path: `${SHOTS}/portfolio.png`, fullPage: true });
});

await flow("WhatsApp: opt-in at checkout → status messages via Cloud API, dedupe, retry, receipts, resend", async (page) => {
  const http = await import("node:http");
  const { createHmac } = await import("node:crypto");
  const sent = [];
  let failNext = false;
  const mock = http.createServer((req, res) => {
    let body = "";
    req.on("data", (c) => (body += c));
    req.on("end", () => {
      if (failNext) { failNext = false; res.writeHead(503, { "content-type": "application/json" }); return res.end(JSON.stringify({ error: { message: "temporarily unavailable", code: 131000 } })); }
      const j = JSON.parse(body || "{}");
      sent.push({ path: req.url, auth: req.headers.authorization, ...j });
      res.writeHead(200, { "content-type": "application/json" });
      res.end(JSON.stringify({ messages: [{ id: `wamid.e2e${sent.length}` }] }));
    });
  });
  await new Promise((r) => mock.listen(4099, "127.0.0.1", r));
  try {
    // customer checks out with the WhatsApp box ticked
    await page.goto(`${BASE}/ar/product/baghdad-oversized-tee`);
    await page.locator('[role=radiogroup][aria-label="اختر المقاس"] [role=radio]:not([data-disabled=true])').first().click();
    await page.getByRole("button", { name: "أضف إلى السلة" }).click();
    await page.getByRole("dialog", { name: "سلة التسوق" }).waitFor();
    await page.getByRole("link", { name: "إتمام الطلب" }).click();
    await page.waitForURL(/checkout/);
    await page.fill("#customer_name", "سارة محمد");
    await page.fill("#phone", "0771 234 5679");
    await page.selectOption("#governorate", "baghdad");
    await page.fill("#city", "الكرادة");
    await page.fill("#address_line", "شارع ٦٢");
    const opt = page.getByRole("checkbox", { name: /أرسلولي تحديثات الطلب على الواتساب/ });
    assert.equal(await opt.isChecked(), false, "opt-in is never pre-ticked");
    await opt.check();
    await page.getByRole("button", { name: "تأكيد الطلب" }).click();
    await page.waitForURL(/checkout\/success\?order=TP\d+/);
    const num = new URL(page.url()).searchParams.get("order");
    const order = await one("select id, whatsapp_opt_in from orders where order_number = $1", [num]);
    assert.equal(order.whatsapp_opt_in, true);
    await page.waitForTimeout(800);
    assert.equal((await one("select count(*)::int n from notifications where channel = 'whatsapp' and order_id = $1", [order.id])).n, 0, "'received' is off by default");

    await becomeAdmin(page, "wa");
    const setStatus = async (value) => {
      await page.goto(`${BASE}/ar/admin/orders/${order.id}`);
      const f = page.locator("form:has(textarea[name=note])");
      await f.locator("select[name=status]").selectOption(value);
      await f.getByRole("button", { name: "تحديث" }).click();
      await waitFor("select status from orders where id = $1", [order.id], (r) => r.status === value);
    };
    // confirmed → one template message to +964
    await setStatus("confirmed");
    const n1 = await waitFor("select * from notifications where channel = 'whatsapp' and order_id = $1 and event = 'order.confirmed'", [order.id], (r) => r.status === "sent");
    assert.equal(n1.recipient, "+9647712345679");
    assert.equal(n1.provider_message_id, "wamid.e2e1");
    const m1 = sent[0];
    assert.equal(m1.path, "/123456/messages");
    assert.equal(m1.auth, "Bearer e2e-token");
    assert.deepEqual([m1.to, m1.type, m1.template.name, m1.template.language.code], ["9647712345679", "template", "order_update", "ar"]);
    const params = m1.template.components[0].parameters.map((p) => p.text);
    assert.equal(params[0], "سارة محمد");
    assert.equal(params[1], num);
    assert.ok(params[2].includes("تم تأكيد طلبك من TPAC بنجاح") && !params[2].includes("\n"), "message as one-line variable");

    // temporary failure → queued retry with back-off → the retry endpoint sends it
    failNext = true;
    await setStatus("preparing");
    const n2 = await waitFor("select * from notifications where channel = 'whatsapp' and order_id = $1 and event = 'order.preparing'", [order.id], (r) => r.attempts === 1);
    assert.equal(n2.status, "pending");
    assert.ok(new Date(n2.next_attempt_at) > new Date(), "retry is scheduled");
    assert.equal((await page.request.get(`${BASE}/api/cron/notifications`)).status(), 403, "retry endpoint needs the secret");
    await db.query("update notifications set next_attempt_at = now() - interval '1 minute' where id = $1", [n2.id]);
    const cron = await page.request.get(`${BASE}/api/cron/notifications`, { headers: { authorization: "Bearer e2e-cron" } });
    assert.equal(cron.status(), 200);
    const n2b = await waitFor("select * from notifications where id = $1", [n2.id], (r) => r.status === "sent");
    assert.equal(n2b.attempts, 2);

    // delivery receipts (signed webhook)
    const payload = JSON.stringify({ entry: [{ changes: [{ value: { statuses: [{ id: "wamid.e2e1", status: "delivered" }] } }] }] });
    const sig = `sha256=${createHmac("sha256", "e2e-app-secret").update(payload).digest("hex")}`;
    assert.equal((await page.request.post(`${BASE}/api/whatsapp/webhook`, { data: payload, headers: { "content-type": "application/json", "x-hub-signature-256": "sha256=bad" } })).status(), 401);
    assert.equal((await page.request.post(`${BASE}/api/whatsapp/webhook`, { data: payload, headers: { "content-type": "application/json", "x-hub-signature-256": sig } })).status(), 200);
    assert.equal((await one("select provider_status from notifications where id = $1", [n1.id])).provider_status, "delivered");
    const verify = await page.request.get(`${BASE}/api/whatsapp/webhook?hub.mode=subscribe&hub.verify_token=e2e-verify&hub.challenge=42`);
    assert.equal(await verify.text(), "42");

    // dashboard: edit the "preparing" text, then resend from the order page (no dedupe for manual resends)
    await page.goto(`${BASE}/ar/admin/whatsapp`);
    await page.getByText("wamid", { exact: false }).count();
    await page.locator("#wa-preparing-text").fill("مرحباً {customer_name}، طلبك #{order_number} بالتجهيز ✂️");
    await page.getByRole("button", { name: "حفظ" }).click();
    await page.getByText("تم الحفظ").first().waitFor();
    await page.goto(`${BASE}/ar/admin/orders/${order.id}`);
    await page.getByRole("button", { name: "أرسل رسالة الحالة الحالية" }).click();
    await page.getByText("انرسلت ✅").first().waitFor();
    const last = sent[sent.length - 1].template.components[0].parameters.map((p) => p.text);
    assert.equal(last[2], `مرحباً سارة محمد، طلبك #${num} بالتجهيز ✂️`);
    assert.equal((await one("select count(*)::int n from notifications where order_id = $1 and event = 'order.preparing'", [order.id])).n, 2);
    // the automatic message for a status is sent once only
    assert.equal((await one("select count(*)::int n from notifications where dedupe_key = $1", [`order:${order.id}:confirmed`])).n, 1);
    // customers who did not opt in never get a message
    assert.equal((await one("select count(*)::int n from notifications n join orders o on o.id = n.order_id where n.channel = 'whatsapp' and not o.whatsapp_opt_in")).n, 0);
    await page.goto(`${BASE}/ar/admin/whatsapp`);
    await page.screenshot({ path: `${SHOTS}/whatsapp-admin.png`, fullPage: true });
  } finally {
    mock.close();
  }
});

await flow("coupons: usage statistics and who used each code", async (page) => {
  const used = await one("select c.code, count(u.*)::int n from discount_codes c join discount_usage u on u.discount_code_id = c.id group by c.code order by n desc limit 1");
  await becomeAdmin(page, "coupon");
  await page.goto(`${BASE}/ar/admin/discounts`);
  await page.getByText("مرات الاستخدام").first().waitFor();
  if (used) {
    await page.locator("summary", { hasText: used.code }).click();
    await page.locator("details[open] table tbody tr").first().waitFor();
    assert.ok((await page.locator("details[open] table tbody tr").count()) >= 1, "customers who used the code are listed");
  }
});

await flow("batch: several hoodies with their own artwork, names and collections → publish all", async (page) => {
  await becomeAdmin(page, "batch");
  const hoodie = (await one("select id from product_types where code = 'hoodie'")).id;
  const cols = (await db.query("select id, name_ar from collections order by sort_order limit 2")).rows;
  await page.goto(`${BASE}/ar/admin/products/new?type=${hoodie}`);
  await page.getByRole("link", { name: "عدة منتجات مرة وحدة" }).click();
  await page.waitForURL(/products\/batch\?type=/);
  const art = (n) => `${SHOTS}/${n}.png`;
  // product 1
  const p1 = page.getByRole("region", { name: "المنتج 1" });
  await p1.getByLabel("اسم المنتج 1").fill("هودي دفعة أولى");
  await p1.getByRole("button", { name: cols[0].name_ar }).click();
  await p1.locator("input[accept='image/png,image/jpeg,image/webp,image/avif']").setInputFiles(art("art"));
  await p1.getByText(/حجم الطباعة/).first().waitFor({ timeout: 20000 });
  // product 2 — and a 3rd one left without a name: nothing is published until it is fixed
  await page.getByRole("button", { name: /إضافة هودي آخر/ }).click();
  const p2 = page.getByRole("region", { name: "المنتج 2" });
  await p2.getByLabel("اسم المنتج 2").fill("هودي دفعة ثانية");
  await p2.getByRole("button", { name: cols[1].name_ar }).click();
  await p2.getByLabel("سعر خاص 2").fill("45000");
  await p2.locator("input[accept='image/png,image/jpeg,image/webp,image/avif']").setInputFiles(art("proj2"));
  await p2.getByText(/حجم الطباعة/).first().waitFor({ timeout: 20000 });
  await page.getByRole("button", { name: /إضافة هودي آخر/ }).click();
  const before = (await one("select count(*)::int n from products")).n;
  await page.getByRole("button", { name: /نشر الكل \(3\)/ }).click();
  await page.getByText("الاسم ناقص").first().waitFor();
  assert.equal((await one("select count(*)::int n from products")).n, before, "nothing half-published");
  await page.getByRole("button", { name: "حذف المنتج 3" }).click();
  await page.getByRole("button", { name: /نشر الكل \(2\)/ }).click();
  await page.getByText("انضافت 2 منتجات ونُشرت ✅").waitFor({ timeout: 90000 });
  const rows = (await db.query(`select p.id, p.name_ar, p.base_price, p.is_published, p.product_type_id = $1 typed,
      (select array_agg(c.collection_id::text) from product_collections c where c.product_id = p.id) cols,
      (select count(*)::int from product_designs d where d.product_id = p.id and d.artwork_path like 'products/' || p.id || '/art/%') designs,
      (select count(*)::int from product_images i where i.product_id = p.id and i.is_generated) photos,
      (select count(*)::int from product_variants v where v.product_id = p.id) variants
    from products p where p.name_ar like 'هودي دفعة%' order by p.name_ar`, [hoodie])).rows;
  assert.equal(rows.length, 2);
  assert.deepEqual(rows.map((r) => [r.name_ar, r.is_published, r.typed, r.cols, r.designs]), [["هودي دفعة أولى", true, true, [cols[0].id], 1], ["هودي دفعة ثانية", true, true, [cols[1].id], 1]]);
  assert.equal(rows[1].base_price, 45000, "own price");
  assert.ok(rows.every((r) => r.photos >= 1 && r.variants > 0), "each has its photos and variants");
  await page.screenshot({ path: `${SHOTS}/batch.png`, fullPage: true });
});

await flow("studio: love shapes, barcode + QR, inside the hood, couple design → both pieces in the bag", async (page) => {
  await db.query(readFileSync(new URL("../../supabase/add-hood-print.sql", import.meta.url), "utf8"));
  await page.goto(`${BASE}/en/design?garment=hoodie`);
  await page.locator("canvas").first().waitFor();
  // the first-step buttons sit under the garment, not on it
  const up = await page.getByRole("button", { name: /Upload your design for the/ }).first().boundingBox();
  const canvasBox = await page.locator("canvas").first().boundingBox();
  assert.ok(up.y >= canvasBox.y + canvasBox.height - 2, "upload button is below the preview");

  // love shapes
  await page.getByRole("tab", { name: "Shapes" }).click();
  await page.getByRole("button", { name: "Love", exact: true }).click();
  await page.getByRole("button", { name: "Heart outline" }).click();
  // barcode + QR from the customer's text (vector artwork)
  await page.getByRole("button", { name: "Barcode & QR" }).click();
  await page.getByLabel("Barcode text").fill("20.09.2020");
  await page.getByRole("button", { name: /QR code/ }).last().click();
  await page.getByRole("button", { name: /Elements on/ }).click();
  await page.getByText("QR code", { exact: true }).waitFor({ timeout: 20000 });
  await page.getByRole("button", { name: /Barcode$/ }).last().click();
  await page.getByText("Barcode", { exact: true }).last().waitFor({ timeout: 20000 });

  // inside the hood: its own close-up photo
  const hoodPhoto = page.waitForResponse((r) => /\/mockups\/hoodie-[a-z]+-hood\.webp/.test(r.url()) && r.status() === 200, { timeout: 20000 });
  await page.getByRole("tab", { name: "Inside the hood" }).click();
  await hoodPhoto;

  // couple: one idea fills both pieces, each with its own colour
  await page.getByRole("tab", { name: "Front", exact: true }).click();
  await page.getByRole("tab", { name: "Ideas" }).click();
  await page.getByRole("button", { name: /Part of me · part of you/ }).click();
  await page.getByRole("tab", { name: "Piece 2" }).waitFor();
  await page.getByRole("tab", { name: "Piece 2" }).click();
  await page.getByText("part of you ..", { exact: false }).first().waitFor();
  await page.getByRole("tab", { name: "Piece 1" }).click();
  await page.getByRole("button", { name: "Review & add to bag" }).click();
  const dlg = page.getByRole("dialog", { name: "Review your design" });
  await dlg.getByRole("region", { name: "Piece 1" }).waitFor({ timeout: 30000 });
  await dlg.getByRole("region", { name: "Piece 2" }).waitFor();
  await dlg.getByText("Inside the hood").count();
  await page.screenshot({ path: `${SHOTS}/couple-review.png` });
  const before = (await one("select count(distinct (config->>'objects'))::int n from custom_designs")).n;
  await dlg.getByRole("button", { name: "Confirm & add both" }).click();
  await page.getByRole("dialog", { name: "Your bag" }).waitFor({ timeout: 40000 });
  const rows = (await db.query("select color_id, name, print_locations, config from custom_designs order by created_at desc limit 2")).rows;
  assert.equal((await one("select count(distinct (config->>'objects'))::int n from custom_designs")).n, before + 2, "two designs saved");
  assert.notEqual(rows[0].color_id, rows[1].color_id, "each piece keeps its own colour");
  assert.ok(rows.every((r) => /couple|للمرتبطين/i.test(r.name ?? "")), "named as a couple design");
  const texts = rows.flatMap((r) => r.config.objects.filter((o) => o.type === "text").map((o) => o.text));
  assert.ok(texts.includes("part of me ..") && texts.includes("part of you .."), "each piece has its own words");
  const p1 = rows.find((r) => r.config.objects.some((o) => o.text === "part of me .."));
  assert.ok(p1.print_locations.includes("hood") === false || p1.config.previews?.hood, "hood design carries its preview");
  const lines = await page.evaluate(() => JSON.parse(localStorage.getItem("tpac-cart")).state.lines);
  assert.equal(lines.filter((l) => / — couple \([12]\/2\)$/.test(l.snapshot?.name_en ?? "")).length, 2, "both pieces are in the bag");
});

await flow("couples page: admin adds a hoodie to «للمرتبطين» → listed on /couples, studio opens with two pieces", async (page) => {
  const hoodie = await one("select p.id, p.slug, p.name_en from products p join categories c on c.id = p.category_id where c.slug = 'hoodies' and p.is_published order by p.created_at limit 1");
  await becomeAdmin(page, "couples");
  await page.goto(`${BASE}/en/admin/products/${hoodie.id}`);
  await page.getByLabel("For couples", { exact: true }).check();
  await page.getByRole("button", { name: "Save changes", exact: true }).click();
  await waitFor("select count(*)::int n from product_collections pc join collections c on c.id = pc.collection_id where c.slug = 'couples' and pc.product_id = $1", [hoodie.id], (r) => r.n === 1);
  await page.goto(`${BASE}/en/admin/products?collection=couples`);
  await page.getByText(hoodie.name_en).first().waitFor();
  // the public page
  await page.goto(`${BASE}/ar/couples`);
  await page.getByRole("heading", { level: 1, name: /للمرتبطين/ }).waitFor();
  await page.locator(`a[href$="/product/${hoodie.slug}"]`).first().waitFor();
  await page.getByRole("link", { name: "للمرتبطين 💞" }).first().waitFor();
  await page.screenshot({ path: `${SHOTS}/couples-page.png`, fullPage: true });
  await page.getByRole("link", { name: /صمّموا طقمكم بنفسكم/ }).click();
  await page.waitForURL(/design\?garment=hoodie&couple=1/);
  await page.getByRole("tab", { name: "القطعة 2" }).waitFor({ timeout: 20000 });
});

await flow("collections: admin uploads a cover photo from the device → shown in the store", async (page) => {
  const email = `col${Date.now()}@thetpac.com`;
  await page.goto(`${BASE}/en/account/register`);
  await page.fill("#full_name", "Collections Admin");
  await page.fill("#email", email);
  await page.fill("#phone", "07700000098");
  await page.fill("#password", "admin-pass-2026");
  await page.fill("#confirm", "admin-pass-2026");
  await page.getByRole("button", { name: "Create account" }).click();
  await page.waitForURL(/account$/);
  await db.query("update customer_profiles set role = 'admin' where email = $1", [email]);
  const b64 = await page.evaluate(() => {
    const c = document.createElement("canvas"); c.width = 2400; c.height = 1500;
    const x = c.getContext("2d"); x.fillStyle = "#0e1a2b"; x.fillRect(0, 0, 2400, 1500); x.fillStyle = "#E3963C"; x.beginPath(); x.arc(1800, 400, 220, 0, 7); x.fill();
    return c.toDataURL("image/png").split(",")[1];
  });
  const file = `${SHOTS}/collection.png`;
  writeFileSync(file, Buffer.from(b64, "base64"));
  const col = await one("select id, slug, name_en from collections order by sort_order limit 1");
  await page.goto(`${BASE}/en/admin/categories`);
  const box = page.locator("details").filter({ has: page.locator("summary", { hasText: col.name_en }) });
  await box.locator("summary").click();
  await box.getByLabel("Collection image", { exact: true }).setInputFiles(file);
  await page.getByText("Image uploaded — press Save").waitFor({ timeout: 20000 });
  await box.getByRole("button", { name: "Save", exact: true }).click();
  let saved;
  for (let i = 0; i < 40 && !saved?.startsWith("http"); i++) { await page.waitForTimeout(250); saved = (await one("select image_url from collections where id = $1", [col.id])).image_url; }
  assert.match(saved ?? "", /\/storage\/v1\/object\/public\/product-images\/collections\/[0-9a-f-]{36}\.jpg$/, "uploaded photo saved on the collection");
  const obj = await one("select name from storage.objects where name = $1", [saved.split("/product-images/")[1]]);
  assert.ok(obj, "file stored");
  await page.goto(`${BASE}/en/collections`);
  await page.locator(`img[src*="collections%2F"], img[src*="/collections/"]`).first().waitFor({ timeout: 15000 });

  // reviews import: a numbered list of 100 lines goes in at once, and again is skipped
  const lines = Array.from({ length: 100 }, (_, i) => `${i + 1}. مختبر ${i + 1} | 5 | اختبار | سطر اختبار الاستيراد رقم ${i + 1} للتأكد من أن القائمة المرقمة الطويلة تدخل كاملة.`).join("\n");
  for (const expected of ["100 added", "100 already there"]) {
    await page.goto(`${BASE}/en/admin/reviews`);
    await page.locator("textarea[name=lines]").fill(lines);
    await page.getByRole("button", { name: "Import", exact: true }).click();
    await page.getByText(expected).first().waitFor({ timeout: 20000 });
  }
  const imported = await one("select count(*)::int n, count(*) filter (where author_name like '1%')::int numbered from reviews where label = 'اختبار'");
  assert.deepEqual([imported.n, imported.numbered], [100, 0], "line numbers dropped from the names");
  await page.screenshot({ path: `${SHOTS}/collections-cover.png` });
});

await flow("studio: no design? upload a photo of a hoodie you liked + «I want one like this» → bag → staff see it", async (page) => {
  const sharp = require("sharp");
  const photo = `${SHOTS}/liked-hoodie.png`;
  writeFileSync(photo, await sharp({ create: { width: 600, height: 700, channels: 3, background: "#6E1F2B" } }).png().toBuffer());
  await page.goto(`${BASE}/en/design?garment=hoodie`);
  await page.locator("canvas").first().waitFor();
  await page.getByRole("button", { name: /Don't have a design\?/ }).click();
  const panel = page.getByRole("region", { name: "Design from a photo" });
  await panel.locator("input[type=file]").setInputFiles(photo);
  await panel.getByRole("img", { name: "Your reference photo" }).waitFor({ timeout: 20000 });
  await panel.getByLabel("What exactly do you want?").fill("Same artwork as the photo, on the back, with my name");
  await panel.getByRole("button", { name: "Back", exact: true }).click();
  assert.equal(await panel.getByRole("button", { name: "Back", exact: true }).getAttribute("aria-pressed"), "true");
  // nothing drawn on the canvas, yet the order can go ahead
  await page.getByRole("button", { name: "Review & add to bag" }).click();
  const dlg = page.getByRole("dialog", { name: "Review your design" });
  await dlg.getByText("We'll design it like these photos").waitFor({ timeout: 30000 });
  await dlg.getByText("Same artwork as the photo, on the back, with my name").waitFor();
  await page.screenshot({ path: `${SHOTS}/reference-review.png` });
  await dlg.getByRole("button", { name: "Confirm & add to bag" }).click();
  await page.getByRole("dialog", { name: "Your bag" }).waitFor({ timeout: 40000 });
  const row = await one("select id, print_locations, unit_price, config from custom_designs order by created_at desc limit 1");
  assert.deepEqual([...row.print_locations].sort(), ["back", "front"], "priced on the picked placements");
  assert.equal(row.config.objects.length, 0);
  assert.equal(row.config.reference.note, "Same artwork as the photo, on the back, with my name");
  assert.equal(row.config.reference.artwork_ids.length, 1);
  const art = await one("select custom_design_id, storage_path from uploaded_artwork where id = $1", [row.config.reference.artwork_ids[0]]);
  assert.equal(art.custom_design_id, row.id, "photo linked to the design");
  const hoodie = await one("select base_price from custom_garment_types where code = 'hoodie'");
  const extra = await extraPlacements(["front", "back"]);
  assert.ok(extra > 0);
  assert.equal(row.unit_price, hoodie.base_price + extra, "one placement included, the second one charged");

  // staff see the photo and the request on the designs page
  await becomeAdmin(page, "reference");
  await page.goto(`${BASE}/en/admin/designs`);
  await page.getByText("No design file — the customer wants it like these photos").first().waitFor();
  await page.getByText("Same artwork as the photo, on the back, with my name").first().waitFor();
  await page.getByRole("img", { name: "Customer reference photo" }).first().waitFor();
  await page.screenshot({ path: `${SHOTS}/reference-admin.png` });
});

await flow("studio: packaging is optional, gift box with the customer's words on the lid, no size hint", async (page) => {
  // even when the admin marks the paid box as the default, nobody pays for it unless they pick it
  await db.query("update designer_options set is_default = (code = 'gift') where group_code = 'package'");
  const gift = await one("select name_en, price from designer_options where group_code = 'package' and code = 'gift'");
  const base = (await one("select base_price from custom_garment_types where code = 'hoodie'")).base_price;
  try {
    await page.goto(`${BASE}/en/design?garment=hoodie`);
    await page.locator("canvas").first().waitFor();
    await page.getByRole("tab", { name: "Ideas" }).click();
    await page.getByRole("button", { name: /Name & number/ }).click();
    await page.getByText(/Elements on Back · 2/).waitFor();
    assert.equal(await page.getByText(/fits roughly/).count(), 0, "size hint removed");
    const bar = page.locator("div.fixed.inset-x-0.bottom-0");
    const priceText = async () => (await bar.locator("p.display").innerText()).replace(/\D/g, "");
    assert.equal(await priceText(), String(base), "one placement, no box: exactly the garment price");

    const sw = page.getByRole("switch", { name: /Gift box/ });
    assert.equal(await sw.getAttribute("aria-checked"), "false");
    await page.getByRole("img", { name: /علبة هدية TPAC/ }).first().waitFor();
    await sw.click();
    await page.getByLabel("What should we write on the box?").fill("إلى أجمل قلب");
    await page.getByRole("img", { name: /إلى أجمل قلب/ }).waitFor();
    assert.equal(await priceText(), String(base + gift.price), "the box adds its price");
    await page.screenshot({ path: `${SHOTS}/gift-box.png` });

    await page.getByRole("button", { name: "Review & add to bag" }).click();
    const dlg = page.getByRole("dialog", { name: "Review your design" });
    await dlg.getByText(`${gift.name_en} «إلى أجمل قلب»`).first().waitFor({ timeout: 30000 });
    await dlg.getByRole("button", { name: "Confirm & add to bag" }).click();
    await page.getByRole("dialog", { name: "Your bag" }).waitFor({ timeout: 40000 });
    const row = await one("select unit_price, options from custom_designs order by created_at desc limit 1");
    assert.equal(row.options.package, "gift");
    assert.equal(row.options.box_text, "إلى أجمل قلب");
    assert.equal(row.unit_price, base + gift.price);
    const lines = await page.evaluate(() => JSON.parse(localStorage.getItem("tpac-cart")).state.lines);
    assert.ok(lines.some((l) => (l.snapshot?.extras ?? "").includes("«إلى أجمل قلب»")), "the words travel with the bag line");
  } finally {
    await db.query("update designer_options set is_default = (code = 'standard') where group_code = 'package'");
  }
});

await flow("gift box on any product: words on the lid, priced per piece by the server, kept on the order", async (page) => {
  await db.query(readFileSync(new URL("../../supabase/add-gift-box-all-products.sql", import.meta.url), "utf8"));
  const gift = await one("select name_ar, price from designer_options where group_code = 'package' and code = 'gift'");
  await page.goto(`${BASE}/ar/product/baghdad-oversized-tee`);
  const sizes = page.locator('[role=radiogroup][aria-label="اختر المقاس"] [role=radio]:not([data-disabled=true])');
  await sizes.first().click();
  const chosen = (await sizes.first().innerText()).trim();
  const sw = page.getByRole("switch", { name: /علبة هدية/ });
  await sw.scrollIntoViewIfNeeded();
  await sw.click();
  await page.getByLabel("شنو نكتب على العلبة؟").fill("ليت العناق يُرسل");
  await page.getByRole("img", { name: /ليت العناق يُرسل/ }).first().waitFor();
  await page.getByRole("button", { name: "+" }).first().click(); // two pieces
  await page.screenshot({ path: `${SHOTS}/product-gift.png` });
  await page.getByRole("button", { name: "أضف إلى السلة" }).click();
  await page.getByRole("dialog", { name: "سلة التسوق" }).waitFor();
  await page.getByRole("link", { name: "إتمام الطلب" }).click();
  await page.waitForURL(/checkout/);
  await page.fill("#customer_name", "زبون هدية");
  await page.fill("#phone", "07712345679");
  await page.selectOption("#governorate", "basra");
  await page.fill("#city", "العشار");
  await page.fill("#address_line", "شارع الوطن");
  await page.waitForFunction(() => document.body.innerText.includes("٧٬٠٠٠") || document.body.innerText.includes("7,000"));
  await page.getByRole("button", { name: "تأكيد الطلب" }).click();
  await page.waitForURL(/checkout\/success\?order=TP\d+/);
  const number = new URL(page.url()).searchParams.get("order");
  const o = await one("select o.subtotal, i.unit_price, i.quantity, i.options, i.size_code, coalesce(v.price_override, p.base_price) as base from orders o join order_items i on i.order_id = o.id join product_variants v on v.id = i.variant_id join products p on p.id = v.product_id where o.order_number = $1", [number]);
  assert.equal(o.size_code, chosen);
  assert.equal(o.quantity, 2);
  assert.equal(o.unit_price, o.base + gift.price, "box priced per piece by the server");
  assert.equal(o.subtotal, (o.base + gift.price) * 2);
  const box = o.options.find((x) => x.key === "gift_box");
  assert.ok(box && box.value === "ليت العناق يُرسل" && box.label_ar === gift.name_ar, "the words are kept on the order");

  // the browser cannot set its own price for the box: a forged cart line is re-priced
  const q = await db.query("select public.quote_cart($1::jsonb) q", [JSON.stringify({ items: [{ variant_id: (await one("select variant_id from order_items i join orders o on o.id = i.order_id where o.order_number = $1", [number])).variant_id, quantity: 1, options: { gift_box: "1", box_text: "x" }, unit_price: 1 }] })]);
  assert.equal(q.rows[0].q.lines[0].unit_price, o.base + gift.price);
  // with no paid box in the dashboard, nothing is added
  await db.query("update designer_options set is_active = false where group_code = 'package' and price > 0");
  try {
    const q2 = await db.query("select public.quote_cart($1::jsonb) q", [JSON.stringify({ items: [{ variant_id: q.rows[0].q.lines[0].variant_id, quantity: 1, options: { gift_box: "1" } }] })]);
    assert.equal(q2.rows[0].q.lines[0].unit_price, o.base);
  } finally {
    await db.query("update designer_options set is_active = true where group_code = 'package'");
  }
});

console.log(results.join("\n"));
await browser.close();
await db.end();
if (results.some((r) => r.startsWith("✗"))) process.exitCode = 1;
