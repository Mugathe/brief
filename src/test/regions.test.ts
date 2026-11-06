import { describe, expect, it } from "vitest";
import { ALL, canManageEditions, canManageScope, editionsLabel, manageAll, scopesFor, scopeLabel, type Access } from "@/lib/regions";
import { bannerFor, runsIn } from "@/lib/ads";
import { EMPTY_CONTENT, mergeContent } from "@/lib/site-types";
import { when } from "@/components/StoryCard";

const admin: Access = { isAdmin: true, regions: ["*"] };
const everywhereEditor: Access = { isAdmin: false, regions: ["*"] };
const ngEditor: Access = { isAdmin: false, regions: ["NG"] };
const twoRegions: Access = { isAdmin: false, regions: ["NG", "GH"] };
const nobody: Access = { isAdmin: false, regions: [] };

describe("who manages what", () => {
  it("lets admins and people with all regions manage everything, including site-wide settings", () => {
    for (const a of [admin, everywhereEditor]) {
      expect(manageAll(a)).toBe(true);
      expect(canManageScope(a, ALL)).toBe(true);
      expect(canManageScope(a, "KE")).toBe(true);
      expect(canManageEditions(a, [])).toBe(true);
    }
  });
  it("keeps a regional editor inside their regions", () => {
    expect(manageAll(ngEditor)).toBe(false);
    expect(canManageScope(ngEditor, "NG")).toBe(true);
    expect(canManageScope(ngEditor, "KE")).toBe(false);
    expect(canManageScope(ngEditor, ALL)).toBe(false);
  });
  it("lets a regional editor change an ad only when every region it runs in is theirs", () => {
    expect(canManageEditions(ngEditor, ["NG"])).toBe(true);
    expect(canManageEditions(ngEditor, ["NG", "KE"])).toBe(false);
    expect(canManageEditions(ngEditor, [])).toBe(false); // "everywhere" ads belong to people who manage everything
    expect(canManageEditions(twoRegions, ["NG", "GH"])).toBe(true);
    expect(canManageEditions(nobody, ["NG"])).toBe(false);
  });
  it("offers only the right choices in the admin's region picker", () => {
    expect(scopesFor(admin)[0]).toBe(ALL);
    expect(scopesFor(admin).length).toBeGreaterThan(10);
    expect(scopesFor(ngEditor)).toEqual(["NG"]);
    expect(scopesFor(twoRegions)).toEqual(["GH", "NG"].sort((a, b) => scopesFor(twoRegions).indexOf(a) - scopesFor(twoRegions).indexOf(b)));
    expect(scopesFor(nobody)).toEqual([]);
  });
  it("describes scopes and targets in words", () => {
    expect(scopeLabel(ALL)).toBe("Whole site (all regions)");
    expect(scopeLabel("NG")).toContain("Nigeria");
    expect(editionsLabel([])).toBe("Everywhere");
    expect(editionsLabel(["NG", "KE"])).toBe("Nigeria, Kenya");
  });
});

describe("regional ads and banners", () => {
  it("shows an ad with no regions everywhere, and a targeted ad only where it is meant", () => {
    expect(runsIn({ editions: [] }, "KE")).toBe(true);
    expect(runsIn({}, "KE")).toBe(true);
    expect(runsIn({ editions: null }, "KE")).toBe(true);
    expect(runsIn({ editions: ["NG"] }, "NG")).toBe(true);
    expect(runsIn({ editions: ["NG"] }, "KE")).toBe(false);
    expect(runsIn({ editions: ["NG", "GH"] }, "GH")).toBe(true);
  });
  it("uses a region's own banner only while it is switched on", () => {
    const site = { active: true, text: "Site" };
    const regional = { NG: { active: true, text: "Nigeria" }, GH: { active: false, text: "Ghana" } };
    expect(bannerFor(site, regional, "NG").text).toBe("Nigeria");
    expect(bannerFor(site, regional, "GH").text).toBe("Site");
    expect(bannerFor(site, regional, "KE").text).toBe("Site");
    expect(bannerFor(site, undefined, "KE").text).toBe("Site");
  });
});

describe("content rules for a region", () => {
  it("adds a region's rules to the site-wide ones without duplicates", () => {
    const site = { ...EMPTY_CONTENT, blockedWords: ["spam"], hiddenLinks: ["a"] };
    const region = { ...EMPTY_CONTENT, blockedWords: ["spam", "scam"], pinnedLinks: ["p"] };
    const merged = mergeContent(site, region);
    expect(merged.blockedWords).toEqual(["spam", "scam"]);
    expect(merged.hiddenLinks).toEqual(["a"]);
    expect(merged.pinnedLinks).toEqual(["p"]);
  });
});

describe("story dates", () => {
  const now = Date.parse("2026-10-17T12:00:00Z");
  it("says how long ago for recent stories and gives the date for older ones", () => {
    expect(when(now - 5 * 60_000, now)).toBe("5m ago");
    expect(when(now - 3 * 3600_000, now)).toBe("3h ago");
    expect(when(now - 5 * 86400_000, now)).toBe("5d ago");
    expect(when(Date.parse("2026-08-02T10:00:00Z"), now)).toBe("2 Aug");
    expect(when(Date.parse("2024-03-09T10:00:00Z"), now)).toBe("9 Mar 2024");
  });
});
