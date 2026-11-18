// End-to-end browser flows against a running app (default http://localhost:3100)
// backed by tests/e2e/supabase-emulator.mjs. Run: node tests/e2e/flows.mjs
// Exits non-zero on the first failed flow; screenshots go to $E2E_SHOTS.
import { createRequire } from "node:module";
import assert from "node:assert/strict";
import { writeFileSync, mkdirSync } from "node:fs";
import pg from "pg";

const require = createRequire(import.meta.url);
const { chromium, devices } = require("playwright");
const BASE = process.env.E2E_BASE ?? "http://localhost:3100";
const SHOTS = process.env.E2E_SHOTS ?? "/tmp/tpac-e2e";
mkdirSync(SHOTS, { recursive: true });
const db = new pg.Pool({ host: "/tmp", port: Number(process.env.TPAC_PGPORT ?? 54329), user: "postgres", database: "tpac" });
const one = async (sql, p = []) => (await db.query(sql, p)).rows[0];

const browser = await chromium.launch();
const results = [];
async function flow(name, fn, ctxOpts = { viewport: { width: 1366, height: 900 } }) {
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
  const saved = await one("select count(*)::int n from cart_items ci join carts c on c.id = ci.cart_id join auth.users u on u.id = c.user_id where u.email = $1", [email]);
  assert.equal(saved.n, 1);
  await page.screenshot({ path: `${SHOTS}/account-favs.png`, fullPage: true });
});

await flow("designer: text + uploaded artwork → bounded → priced → ordered with files", async (page) => {
  await page.goto(`${BASE}/en/design?garment=hoodie`);
  await page.locator("canvas").first().waitFor();
  await page.getByRole("button", { name: "Add text" }).click();
  await page.fill("#d-text", "UNIVERSITY OF BAGHDAD");
  // upload a real PNG (generated)
  const png = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAYAAABytg0kAAAAEklEQVR4nGP4z8DwnwEIGGAMAEnkB/m4tK6WAAAAAElFTkSuQmCC", "base64");
  writeFileSync(`${SHOTS}/art.png`, png);
  await page.getByRole("button", { name: /Back/ }).first().click();
  await page.locator("input[type=file]").setInputFiles(`${SHOTS}/art.png`);
  await page.getByText("low resolution").waitFor({ timeout: 15000 });
  // try to drag the artwork far outside the print area: it must stay inside
  const box = await page.locator("canvas.upper-canvas").boundingBox();
  await page.mouse.move(box.x + box.width / 2, box.y + box.height * 0.5);
  await page.mouse.down();
  await page.mouse.move(box.x + 5, box.y + 5, { steps: 8 });
  await page.mouse.up();
  await page.getByText("Printing: Back").waitFor();
  await page.screenshot({ path: `${SHOTS}/designer.png` });
  page.on("console", (m) => console.log("[designer console]", m.text().slice(0, 200)));
  await page.getByRole("button", { name: "Add design to bag" }).click();
  await page.getByRole("dialog", { name: "Your bag" }).waitFor({ timeout: 20000 });
  const d = await one("select unit_price, print_locations, config, preview_front_path from custom_designs order by created_at desc limit 1");
  assert.equal(d.unit_price, 40000 + 8000 + 10000);
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
  assert.deepEqual(o, { has_custom_items: true, subtotal: 58000 });
});

await flow("bulk: university request with artwork", async (page) => {
  await page.goto(`${BASE}/ar/bulk`);
  await page.fill("#b-org", "جامعة بغداد — كلية الهندسة");
  await page.fill("#b-contact", "مصطفى");
  await page.fill("#b-phone", "07701231234");
  await page.selectOption("#b-type", "hoodie");
  await page.fill("#b-qty", "150");
  await page.getByLabel("توزيع المقاسات M").fill("60");
  await page.getByLabel("توزيع المقاسات L").fill("90");
  writeFileSync(`${SHOTS}/logo.pdf`, "%PDF-1.4\n1 0 obj<<>>endobj\ntrailer<<>>\n%%EOF");
  await page.locator("input[type=file]").setInputFiles(`${SHOTS}/logo.pdf`);
  await page.getByText("logo.pdf").waitFor();
  await page.getByRole("button", { name: "إرسال الطلب" }).click();
  await page.getByText(/تم استلام طلبك برقم BR-\d+/).waitFor();
  const r = await one("select b.size_breakdown, b.estimated_quantity, (select count(*)::int from uploaded_artwork a where a.bulk_request_id = b.id) files from bulk_order_requests b order by created_at desc limit 1");
  assert.deepEqual(r, { size_breakdown: { M: 60, L: 90 }, estimated_quantity: 150, files: 1 });
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
  await page.goto(`${BASE}/ar/admin/products/new`);
  await page.fill("#name_ar", "تيشيرت تجربة");
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

  for (const p of ["customers", "products", "categories", "attributes", "customizer", "discounts", "marketing", "homepage", "notifications", "inquiries", "activity", "reviews", "bulk/pricing"]) {
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
  await page.goto(`${BASE}/ar/admin/products/new`);
  await page.fill("#name_ar", "هودي تجربة سريع");
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

console.log(results.join("\n"));
await browser.close();
await db.end();
