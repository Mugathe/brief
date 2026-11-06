import { describe, expect, it } from "vitest";
import { EDITIONS, editionOf, researchKey, researchScope } from "@/lib/editions";
import { feedsFor } from "@/lib/editions.server";
import { t } from "@/lib/i18n";

describe("research is kept per country", () => {
  it("shares a country's research between its editions, and keeps the world apart", () => {
    expect(researchScope(editionOf("KE"))).toBe("KE");
    expect(researchScope(editionOf("KE-sw"))).toBe("KE");
    expect(researchScope(editionOf("IN-hi"))).toBe("IN");
    expect(researchScope(editionOf("TZ-sw"))).toBe("TZ");
    expect(researchScope(editionOf("world"))).toBe("world");
  });
  it("keeps Kenya's keys as they were, so earlier research is still found", () => {
    expect(researchKey("floods", "KE")).toBe("floods");
    expect(researchKey("floods", "NG")).toBe("floods@NG");
    expect(researchKey("floods", "world")).toBe("floods@world");
  });
  it("gives every edition its own scope, and no two countries share one", () => {
    const scopes = EDITIONS.map((e) => researchScope(e));
    expect(scopes.every((s) => /^[A-Z]{2}$|^world$/.test(s))).toBe(true);
    expect(new Set(scopes).size).toBe(scopes.length - 3); // KE-sw, TZ-sw and IN-hi share with KE, TZ and IN
  });
});

describe("buzz sources everywhere", () => {
  it("has TikTok and X buzz searches in every edition, labelled as viral", () => {
    for (const e of EDITIONS) {
      const feeds = feedsFor(e.code);
      const viral = feeds.filter((f) => f.platform === "Viral (TikTok & X)");
      expect(viral.length, e.code).toBeGreaterThanOrEqual(2);
      expect(feeds.some((f) => f.name === "TikTok buzz"), e.code).toBe(true);
      expect(feeds.some((f) => f.name === "X / Twitter buzz"), e.code).toBe(true);
    }
  });
  it("searches for each country by its name in its own language", () => {
    const q = (code: string) => decodeURIComponent(feedsFor(code).find((f) => f.name === "TikTok buzz")!.url);
    expect(q("BR")).toContain("Brasil TikTok viral");
    expect(q("ES")).toContain("España TikTok viral");
    expect(q("EG")).toContain("مصر TikTok viral");
    expect(q("NG")).toContain("Nigeria TikTok viral");
    expect(q("world")).toContain("TikTok viral when:2d");
  });
  it("is translated in every language", () => {
    for (const lang of ["en", "sw", "fr", "es", "pt", "ar", "hi"] as const) {
      expect(t(lang, "buzz.name").length, lang).toBeGreaterThan(2);
      expect(t(lang, "buzz.share", { where: "W", topic: "T", headline: "H" })).toMatch(/T/);
      expect(t(lang, "buzz.recent", { n: 3 })).toContain("3");
    }
  });
});
