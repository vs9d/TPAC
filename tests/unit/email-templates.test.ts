import { describe, expect, it } from "vitest";
import { adminNewOrderEmail, customerOrderEmail } from "@/lib/notifications/email-templates";
import type { Order } from "@/lib/types";

const order = {
  id: "o1", order_number: "TP100200", user_id: null, customer_name: "<b>سارة</b>", phone: "9647712345678", email: "s@example.com",
  governorate: "baghdad", city: "الكرادة", address_line: "شارع ٦٢", delivery_notes: "قرب <script>", delivery_method: "standard", payment_method: "cod", payment_status: "unpaid",
  status: "shipped", subtotal: 65000, discount_total: 5000, delivery_fee: 5000, total: 65000, discount_code: "TPAC10", locale: "ar", source: "web", has_custom_items: true,
  created_at: "", updated_at: "",
} as Order;
const items = [{ name_ar: "هودي", name_en: "Hoodie", size_code: "L", color_name_ar: "أسود", color_name_en: "Black", quantity: 2, unit_price: 30000, line_total: 60000, image_url: "/mockups/x.webp" }];
const ctx = { siteUrl: "https://thetpac.com", whatsapp: "9647734194129", instagram: null };

describe("order emails", () => {
  it("customer email: status, items, totals, tracking link, escaped input", () => {
    const m = customerOrderEmail(order, items, ctx);
    expect(m.subject).toBe("طلبك بالطريق إلك 🚚 — #TP100200");
    expect(m.html).toContain('dir="rtl"');
    expect(m.html).toContain("https://thetpac.com/ar/track?order=TP100200");
    expect(m.html).toContain("https://thetpac.com/mockups/x.webp");
    expect(m.html).toContain("https://wa.me/9647734194129");
    expect(m.html).toContain("&lt;b&gt;سارة&lt;/b&gt;");
    expect(m.html).not.toContain("<b>سارة</b>");
    expect(m.text).toContain("هودي L أسود ×2");
  });
  it("English customers get English emails", () => {
    const m = customerOrderEmail({ ...order, locale: "en", status: "delivered" }, items, ctx);
    expect(m.subject).toBe("Delivered ❤️ — #TP100200");
    expect(m.html).toContain('dir="ltr"');
  });
  it("admin alert: total, customer, links, notes escaped", () => {
    const m = adminNewOrderEmail(order, items, ctx);
    expect(m.subject).toContain("طلب جديد TP100200");
    expect(m.subject).toContain("(تصميم خاص)");
    expect(m.html).toContain("https://thetpac.com/ar/admin/orders/o1");
    expect(m.html).toContain("https://wa.me/9647712345678");
    expect(m.html).not.toContain("<script>");
  });
});
