import { describe, it, expect } from "vitest";
import { normalizeIraqiPhone, formatIraqiPhone } from "@/lib/phone";

describe("Iraqi phone numbers", () => {
  it.each([
    ["07701234567", "9647701234567"],
    ["0770 123 4567", "9647701234567"],
    ["+964 770 123 4567", "9647701234567"],
    ["009647801234567", "9647801234567"],
    ["7501234567", "9647501234567"],
    ["٠٧٧٠١٢٣٤٥٦٧", "9647701234567"],
    ["۰۷۷۰۱۲۳۴۵۶۷", "9647701234567"],
  ])("normalises %s", (input, expected) => {
    expect(normalizeIraqiPhone(input)).toBe(expected);
  });

  it.each(["", "12345", "0612345678", "+1 555 123 4567", "077012345", "0770123456789"])("rejects %s", (input) => {
    expect(normalizeIraqiPhone(input)).toBeNull();
  });

  it("formats for display", () => {
    expect(formatIraqiPhone("9647701234567")).toBe("0770 123 4567");
    expect(formatIraqiPhone(null)).toBe("");
  });
});
