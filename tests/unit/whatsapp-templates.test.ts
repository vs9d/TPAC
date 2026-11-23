import { describe, expect, it } from "vitest";
import { DEFAULT_WA, renderWa, validTemplateName, waParam, waSettingsFrom } from "@/lib/whatsapp-templates";
import { normalizeIraqiPhone } from "@/lib/phone";

describe("WhatsApp templates", () => {
  it("fills the placeholders", () => {
    expect(renderWa(DEFAULT_WA.statuses.confirmed.text, { customer_name: "سارة", order_number: "TP100123" })).toBe("مرحباً سارة ❤️\nتم تأكيد طلبك من TPAC بنجاح.\nرقم الطلب: #TP100123\nشكراً لثقتك بينا!");
    expect(renderWa("{unknown} {order_number}", { customer_name: "a", order_number: "TP1" })).toBe("{unknown} TP1");
  });
  it("makes Meta-safe template variables (no new lines, tabs or long spaces)", () => {
    const p = waParam("سطر١\n\nسطر٢\tو      مسافات");
    expect(p).toBe("سطر١ — سطر٢ و   مسافات");
    expect(p).not.toMatch(/[\n\t]| {4}/);
  });
  it("merges saved settings over the defaults", () => {
    const s = waSettingsFrom({ enabled: false, statuses: { shipped: { enabled: false, text: "  ", template: "order_shipped" } } });
    expect(s.enabled).toBe(false);
    expect(s.statuses.shipped).toEqual({ enabled: false, text: DEFAULT_WA.statuses.shipped.text, template: "order_shipped" });
    expect(s.statuses.delivered).toEqual(DEFAULT_WA.statuses.delivered);
    expect(waSettingsFrom(null).language).toBe("ar");
  });
  it("checks template names", () => {
    expect(validTemplateName("order_update_ar")).toBe(true);
    expect(validTemplateName("Order Update")).toBe(false);
    expect(validTemplateName("")).toBe(true);
  });
  it("normalises Iraqi numbers to +964", () => {
    for (const n of ["07701234567", "+964 770 123 4567", "009647701234567", "٠٧٧٠١٢٣٤٥٦٧"]) expect(normalizeIraqiPhone(n)).toBe("9647701234567");
    expect(normalizeIraqiPhone("0612345")).toBeNull();
  });
});
