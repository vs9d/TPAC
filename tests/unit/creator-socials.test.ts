import { describe, expect, it } from "vitest";
import { normalizeSocialLink } from "@/lib/creator-labels";

describe("creator social links", () => {
  it("accepts what people type", () => {
    expect(normalizeSocialLink("instagram", "@justindapolo")).toBe("https://www.instagram.com/justindapolo");
    expect(normalizeSocialLink("instagram", "justin.da_polo")).toBe("https://www.instagram.com/justin.da_polo");
    expect(normalizeSocialLink("instagram", "instagram.com/justindapolo")).toBe("https://instagram.com/justindapolo");
    expect(normalizeSocialLink("instagram", "https://www.instagram.com/justindapolo/?igsh=x")).toBe("https://www.instagram.com/justindapolo/?igsh=x");
    expect(normalizeSocialLink("tiktok", "@artist")).toBe("https://www.tiktok.com/@artist");
    expect(normalizeSocialLink("facebook", "my.page")).toBe("https://www.facebook.com/my.page");
    expect(normalizeSocialLink("website", "mysite.com")).toBe("https://mysite.com");
    expect(normalizeSocialLink("website", "http://mysite.com/work")).toBe("https://mysite.com/work");
    expect(normalizeSocialLink("behance", "")).toBe("");
  });
  it("rejects what can't be a link", () => {
    expect(normalizeSocialLink("website", "not a site")).toBeNull();
    expect(normalizeSocialLink("website", "javascript:alert(1)")).toBeNull();
    expect(normalizeSocialLink("instagram", "ftp://x.com")).toBeNull();
  });
});
