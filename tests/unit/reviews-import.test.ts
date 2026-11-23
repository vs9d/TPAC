import { describe, expect, it } from "vitest";
import { parseTestimonialLines } from "@/lib/reviews-import";

describe("bulk review import", () => {
  it("reads name | stars | label | text, with optional parts", () => {
    const { rows, errors } = parseTestimonialLines("علي | 5 | هوديات | القماش ثقيل\nسارة | 4 | وصل بيومين\nكلش حلو التغليف\n\n   \nزيد | 9 | نص");
    expect(rows).toEqual([
      { author_name: "علي", rating: 5, label: "هوديات", body: "القماش ثقيل" },
      { author_name: "سارة", rating: 4, label: null, body: "وصل بيومين" },
      { author_name: "زبون TPAC", rating: 5, label: null, body: "كلش حلو التغليف" },
    ]);
    expect(errors).toEqual([6]); // 9 stars is not valid
  });
  it("keeps the text when there is only a name and a text", () => {
    expect(parseTestimonialLines("حسين | المقاس مضبوط").rows[0]).toEqual({ author_name: "حسين", rating: 5, label: null, body: "المقاس مضبوط" });
  });
});

describe("numbered lists", () => {
  it("drops the line numbers", async () => {
    const { parseTestimonialLines } = await import("@/lib/reviews-import");
    const { rows, errors } = parseTestimonialLines("1. علي | 5 | هوديات | الهودي كلش حلو.\n12) سارة | 4 | تيشيرتات | وصل بيومين.\n١٠- نص فقط");
    expect(errors).toEqual([]);
    expect(rows.map((r) => [r.author_name, r.rating, r.label])).toEqual([["علي", 5, "هوديات"], ["سارة", 4, "تيشيرتات"], ["زبون TPAC", 5, null]]);
    expect(rows[2]!.body).toBe("نص فقط");
  });
});
