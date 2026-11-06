import { describe, expect, it } from "vitest";
import { canonEdition, countryFromHeaders, DEFAULT_EDITION, editionForCountry, editionOf, EDITIONS, isEdition, parseEdition, placeOf, resolveEdition, validateEditionSearch, WORLD } from "@/lib/editions";
import { categorize, EDITION_CODES, feedsFor } from "@/lib/editions.server";

describe("editions", () => {
  it("has the world plus countries, each with a unique code and a valid time zone", () => {
    expect(EDITIONS[0]!.code).toBe(WORLD);
    expect(new Set(EDITIONS.map((e) => e.code)).size).toBe(EDITIONS.length);
    for (const e of EDITIONS) expect(() => new Intl.DateTimeFormat("en", { timeZone: e.tz })).not.toThrow();
  });
  it("builds country flags and Google News locales from the country code", () => {
    const ke = editionOf("KE");
    expect(ke.flag).toBe("🇰🇪");
    expect([ke.hl, ke.gl, ke.ceid, ke.trendsGeo]).toEqual(["en-KE", "KE", "KE:en", "KE"]);
    expect(editionOf("world").trendsGeo).toBeUndefined();
    expect(editionOf("GB").place).toBe("United Kingdom");
  });
  it("reads edition codes from the address in any case and falls back to the default", () => {
    expect(parseEdition("ng")).toBe("NG");
    expect(parseEdition("World")).toBe("world");
    expect(parseEdition("ZZ")).toBe(DEFAULT_EDITION);
    expect(parseEdition(undefined)).toBe(DEFAULT_EDITION);
    expect(parseEdition({})).toBe(DEFAULT_EDITION);
    expect(isEdition("KE")).toBe(true);
    expect(isEdition("ke")).toBe(false);
  });
  it("reads ?e= from the address, keeping an explicit choice of the world", () => {
    expect(canonEdition("ng")).toBe("NG");
    expect(canonEdition("WORLD")).toBe("world");
    expect(canonEdition("nonsense")).toBeUndefined();
    expect(canonEdition(5)).toBeUndefined();
    expect(validateEditionSearch({ e: "za" })).toEqual({ e: "ZA" });
    expect(validateEditionSearch({ e: "world" })).toEqual({ e: "world" });
    expect(validateEditionSearch({ e: "zz" })).toEqual({ e: undefined });
    expect(validateEditionSearch({})).toEqual({ e: undefined });
  });
  it("shows the address's edition first, then the visitor's region, then the default", () => {
    expect(resolveEdition("NG", "KE").code).toBe("NG");
    expect(resolveEdition(undefined, "KE").code).toBe("KE");
    expect(resolveEdition("zz", "KE").code).toBe("KE");
    expect(resolveEdition(undefined, undefined).code).toBe(DEFAULT_EDITION);
    expect(resolveEdition("world", "KE").code).toBe("world");
  });
  it("finds the visitor's country from the host or CDN headers", () => {
    const h = (o: Record<string, string>) => (n: string) => o[n];
    expect(countryFromHeaders(h({ "cf-ipcountry": "ke" }))).toBe("KE");
    expect(countryFromHeaders(h({ "x-vercel-ip-country": "NG" }))).toBe("NG");
    expect(countryFromHeaders(h({ "cf-ipcountry": "XX", "x-vercel-ip-country": "GH" }))).toBe("GH"); // Cloudflare's "unknown" is skipped
    expect(countryFromHeaders(h({ "cf-ipcountry": "T1" }))).toBeUndefined(); // Tor
    expect(countryFromHeaders(h({ "cf-ipcountry": "Kenya" }))).toBeUndefined();
    expect(countryFromHeaders(h({}))).toBeUndefined();
  });
  it("gives visitors from countries without an edition the world", () => {
    expect(editionForCountry("KE")).toBe("KE");
    expect(editionForCountry("JP")).toBeUndefined();
    expect(editionForCountry(undefined)).toBeUndefined();
  });
  it("words places for sentences", () => {
    expect(placeOf(editionOf("world"))).toBe("the world");
    expect(placeOf(editionOf("KE"))).toBe("Kenya");
  });
});

describe("feeds", () => {
  it("gives every edition feeds with absolute addresses and unique names", () => {
    for (const code of EDITION_CODES) {
      const feeds = feedsFor(code);
      expect(feeds.length, code).toBeGreaterThan(4);
      for (const f of feeds) expect(f.url, `${code} ${f.name}`).toMatch(/^https:\/\//);
      expect(new Set(feeds.map((f) => f.name)).size, code).toBe(feeds.length);
    }
  });
  it("keeps Kenya's hand-picked sources, including the social buzz searches", () => {
    const names = feedsFor("KE").map((f) => f.name);
    for (const n of ["Capital FM", "The Star", "Citizen TV", "r/Kenya", "TikTok buzz", "X / Twitter buzz"]) expect(names).toContain(n);
  });
  it("points each country at its own Google News edition", () => {
    const ng = feedsFor("NG").find((f) => f.name === "Google News Nigeria")!;
    expect(ng.url).toContain("hl=en-NG");
    expect(ng.url).toContain("gl=NG");
    expect(ng.url).toContain("ceid=NG:en");
  });
  it("labels Google News section feeds with their category", () => {
    const biz = feedsFor("ZA").find((f) => f.name.endsWith("Business"))!;
    expect(biz.category).toBe("Business");
    expect(feedsFor("world").some((f) => f.category === "World")).toBe(true);
  });
  it("labels each edition's own outlets by country", () => {
    expect(feedsFor("NG").find((f) => f.name === "Punch")!.platform).toBe("Nigerian outlets");
    expect(feedsFor("world").find((f) => f.name === "BBC News")!.platform).toBe("Global outlets");
    expect(feedsFor("KE").find((f) => f.name === "The Star")!.platform).toBe("Kenyan outlets");
  });
});

describe("categorize", () => {
  it("trusts a feed's own section over keyword guesses", () => {
    expect(categorize("Police arrest suspect", "KE", "Sports")).toBe("Sports");
  });
  it("uses local names first, then country-neutral rules", () => {
    expect(categorize("Safaricom posts record profit", "KE")).toBe("Business");
    expect(categorize("Naira slides against the dollar", "NG")).toBe("Business");
    expect(categorize("Missiles hit the capital as ceasefire talks fail", "world")).toBe("Conflict");
    expect(categorize("Police arrest two suspects after robbery", "GB")).toBe("Crime & Courts");
    expect(categorize("Wildfire spreads across the coast", "AU")).toBe("Climate & Weather");
  });
  it("only calls a Kenyan story World when nothing else fits", () => {
    expect(categorize("China and Russia hold talks", "KE")).toBe("World");
    expect(categorize("China tariffs hit Kenyan tea prices", "KE")).toBe("Business");
    expect(categorize("Something unremarkable happened", "KE")).toBe("General");
  });
});
