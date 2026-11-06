import { beforeEach, describe, expect, it, vi } from "vitest";
import { dayKey, planStories } from "@/lib/studio-feed";
import type { Segment } from "@/lib/bulletin";

const story = (n: number, links: string[]): Segment => ({ id: `s${n}`, kind: "story", title: `Story ${n}`, category: "Politics", script: "", detail: `Story ${n} happened. More.`, sources: links.map((l) => ({ name: "BBC", link: l })) });
const SEGMENTS = [story(1, ["https://a/1"]), story(2, ["https://a/2"]), story(3, ["https://a/3", "https://a/1b"]), story(4, ["https://a/4"]), story(5, ["https://a/5"])];

let rows: { story_key: string; kind: string; source_links: string[] }[] = [];
let settings: Record<string, unknown> = { enabled: true, perRun: 2, perDay: 4, editions: ["KE"] };

vi.mock("@/integrations/supabase/client.server", () => ({
  supabaseAdmin: { from: () => ({ select: () => ({ eq: () => ({ like: async () => ({ data: rows, error: null }) }) }) }) },
}));
vi.mock("@/lib/public-client.server", () => ({
  publicClient: () => ({ from: () => ({ select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: { value: settings } }) }) }) }) }),
}));
vi.mock("@/lib/brief.functions", () => ({ getBrief: async () => ({ segments: SEGMENTS, headline: "", generatedAt: 0 }) }));

const keys = (plans: Segment[]) => planStories(plans, "KE", dayKey(), 8);

describe("studio plan", () => {
  beforeEach(() => { rows = []; settings = { enabled: true, perRun: 2, perDay: 4, editions: ["KE"] }; });

  it("takes the first stories up to the per-run limit", async () => {
    const { planFor } = await import("@/lib/studio.server");
    const out = await planFor("KE", "https://x.co");
    expect(out.stories.map((s) => s.title)).toEqual(["Story 1", "Story 2"]);
    expect(out.stories[0]!.caption).toContain("https://x.co/brief?e=KE#story-1");
  });

  it("skips a story that already has its reel, and one that shares an outlet link with it", async () => {
    const [one] = keys(SEGMENTS);
    rows = [{ story_key: one!.key, kind: "video", source_links: ["https://a/1", "https://a/1b"] }];
    const { planFor } = await import("@/lib/studio.server");
    const out = await planFor("KE", "https://x.co");
    expect(out.stories.map((s) => s.title)).toEqual(["Story 2", "Story 4"]); // story 3 shares https://a/1b
    expect(out.madeToday).toBe(1);
  });

  it("makes the story again if only its picture exists (the reel failed last time)", async () => {
    const [one] = keys(SEGMENTS);
    rows = [{ story_key: one!.key, kind: "image", source_links: ["https://a/1"] }];
    const { planFor } = await import("@/lib/studio.server");
    expect((await planFor("KE", "https://x.co")).stories[0]!.title).toBe("Story 1");
  });

  it("stops at the daily limit", async () => {
    const all = keys(SEGMENTS);
    rows = all.slice(0, 3).map((p) => ({ story_key: p.key, kind: "video", source_links: p.links }));
    const { planFor } = await import("@/lib/studio.server");
    const out = await planFor("KE", "https://x.co");
    expect(out.stories).toHaveLength(1); // perDay 4, three done
  });

  it("refuses an unknown edition", async () => {
    const { planFor } = await import("@/lib/studio.server");
    await expect(planFor("ZZ", "https://x.co")).rejects.toThrow("Unknown edition");
  });
});
