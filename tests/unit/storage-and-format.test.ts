import { describe, it, expect } from "vitest";
import { sniffMime, isSafeSvg } from "@/lib/storage";
import { formatIQD, inWindow, toBaghdadInput } from "@/lib/format";
import { baghdadIso } from "@/lib/actions/admin/common";
import { GARMENTS, ARTBOARD, garmentSvg } from "@/lib/garments";

describe("upload type sniffing", () => {
  it("detects real file types from magic bytes", () => {
    expect(sniffMime(new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))).toBe("image/png");
    expect(sniffMime(new Uint8Array([0xff, 0xd8, 0xff, 0xe0]))).toBe("image/jpeg");
    expect(sniffMime(new TextEncoder().encode("%PDF-1.7"))).toBe("application/pdf");
    expect(sniffMime(new TextEncoder().encode('<svg xmlns="http://www.w3.org/2000/svg"></svg>'))).toBe("image/svg+xml");
    expect(sniffMime(new TextEncoder().encode("<html><script>alert(1)</script>"))).toBeNull();
    expect(sniffMime(new TextEncoder().encode("MZ\x90\x00 executable"))).toBeNull();
  });
  it("rejects SVGs with active content", () => {
    expect(isSafeSvg('<svg><rect width="10" height="10"/></svg>')).toBe(true);
    expect(isSafeSvg("<svg><script>alert(1)</script></svg>")).toBe(false);
    expect(isSafeSvg('<svg onload="alert(1)"></svg>')).toBe(false);
    expect(isSafeSvg('<svg><a href="javascript:alert(1)">x</a></svg>')).toBe(false);
    expect(isSafeSvg("<svg><foreignObject><iframe/></foreignObject></svg>")).toBe(false);
    expect(isSafeSvg('<svg><image href="https://evil.example/x.png"/></svg>')).toBe(false);
  });
});

describe("formatting", () => {
  it("formats IQD per locale", () => {
    expect(formatIQD(25000, "en")).toBe("25,000 IQD");
    expect(formatIQD(25000, "ar")).toContain("د.ع");
  });
  it("handles Baghdad datetime inputs both ways", () => {
    expect(baghdadIso("2026-12-01T10:00")).toBe("2026-12-01T07:00:00.000Z");
    expect(toBaghdadInput("2026-12-01T07:00:00.000Z")).toBe("2026-12-01T10:00");
    expect(baghdadIso("")).toBeNull();
  });
  it("evaluates schedule windows", () => {
    const now = Date.parse("2026-11-17T12:00:00Z");
    expect(inWindow(null, null, now)).toBe(true);
    expect(inWindow("2026-11-01T00:00:00Z", "2026-11-30T00:00:00Z", now)).toBe(true);
    expect(inWindow("2026-12-01T00:00:00Z", null, now)).toBe(false);
    expect(inWindow(null, "2026-11-10T00:00:00Z", now)).toBe(false);
  });
});

describe("garment print areas", () => {
  it("every print area sits inside the artboard", () => {
    for (const [type, g] of Object.entries(GARMENTS)) {
      for (const [loc, a] of Object.entries(g.printAreas)) {
        expect(a.x, `${type}/${loc}`).toBeGreaterThanOrEqual(0);
        expect(a.y).toBeGreaterThanOrEqual(0);
        expect(a.x + a.width).toBeLessThanOrEqual(ARTBOARD.width);
        expect(a.y + a.height).toBeLessThanOrEqual(ARTBOARD.height);
        expect(a.cm.width).toBeGreaterThan(0);
      }
    }
  });
  it("renders an SVG with the requested colour", () => {
    const svg = garmentSvg("hoodie", "front", "#376352", { showPrintAreas: ["front", "back"] });
    expect(svg).toContain("#376352");
    expect(svg.match(/stroke-dasharray/g)?.length).toBe(1); // only the front-view area is drawn
  });
});
