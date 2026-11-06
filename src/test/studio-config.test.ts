import { describe, expect, it } from "vitest";
import { DEFAULT_STUDIO, parseStudio } from "@/lib/studio-config";

describe("studio settings", () => {
  it("is off by default and survives junk", () => {
    expect(parseStudio(undefined).enabled).toBe(false);
    expect(parseStudio("nonsense")).toEqual(DEFAULT_STUDIO);
    expect(parseStudio({ enabled: "yes", perRun: "9" }).enabled).toBe(false);
  });
  it("keeps only real editions and clamps the numbers", () => {
    const c = parseStudio({ enabled: true, autoPublish: false, editions: ["KE", "KE", "ZZ", 5], perRun: 99, perDay: 0 });
    expect(c).toEqual({ enabled: true, autoPublish: false, editions: ["KE"], perRun: 5, perDay: 1, voice: "off", facebook: false, youtube: false });
    expect(parseStudio({ voice: "baraka", facebook: true }).voice).toBe("baraka");
    expect(parseStudio({ voice: "robot" }).voice).toBe("off");
  });
  it("publishes at once unless told otherwise", () => {
    expect(parseStudio({ enabled: true }).autoPublish).toBe(true);
  });
});
