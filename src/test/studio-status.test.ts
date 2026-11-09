import { describe, expect, it } from "vitest";
import type { StudioGroup, StudioPost } from "@/lib/studio-db";
import { FRESH_MS, KEEP_MS, sinceLabel, toStatuses } from "@/lib/studio-status";

const NOW = Date.UTC(2026, 10, 5, 12);
const post = (kind: "image" | "video", key: string): StudioPost => ({ id: 1, edition: "KE", story_key: key, kind, style: "headline", title: key, category: "News", caption: "", link: "/brief?e=KE", media_url: `https://m/${key}.${kind}`, media_path: "", mime: "", status: "published", created_at: "", published_at: null, shared: {} });
const group = (key: string, ageMs: number, kinds: ("image" | "video")[] = ["image", "video"]): StudioGroup => {
  const posts = kinds.map((k) => post(k, key));
  const image = posts.find((p) => p.kind === "image"), video = posts.find((p) => p.kind === "video");
  return { key, at: NOW - ageMs, style: "headline", title: key, category: "News", caption: "", link: "/brief?e=KE", status: "published", posts, ...(image ? { image } : {}), ...(video ? { video } : {}) };
};

describe("status row", () => {
  it("puts fresh unseen first, then fresh seen, then expired, newest first in each", () => {
    const groups = [group("old", FRESH_MS + 1000), group("seenNew", 1000), group("a", 2 * 3_600_000), group("b", 3_600_000)];
    const out = toStatuses(groups, NOW, new Set(["seenNew"]));
    expect(out.map((s) => s.key)).toEqual(["b", "a", "seenNew", "old"]);
    expect(out.map((s) => s.fresh)).toEqual([true, true, true, false]);
  });
  it("drops stories older than a week", () => {
    expect(toStatuses([group("gone", KEEP_MS + 1)], NOW, new Set())).toEqual([]);
  });
  it("shows the reel when there is one, otherwise the picture: one slide per story", () => {
    const [both] = toStatuses([group("x", 1000)], NOW, new Set());
    expect(both!.slides.map((x) => x.kind)).toEqual(["video"]);
    expect(both!.cover).toBe("https://m/x.image"); // the circle still shows the picture
    const [pic] = toStatuses([group("p", 1000, ["image"])], NOW, new Set());
    expect(pic!.slides.map((x) => x.kind)).toEqual(["image"]);
  });
  it("copes with a reel that has no picture", () => {
    const [s] = toStatuses([group("v", 1000, ["video"])], NOW, new Set());
    expect(s!.slides).toHaveLength(1);
    expect(s!.cover).toBeNull();
  });
  it("labels how long ago", () => {
    expect(sinceLabel(NOW - 30_000, NOW)).toBe("now");
    expect(sinceLabel(NOW - 5 * 60_000, NOW)).toBe("5m");
    expect(sinceLabel(NOW - 3 * 3_600_000, NOW)).toBe("3h");
    expect(sinceLabel(NOW - 2 * 86_400_000, NOW)).toBe("2d");
  });
});
