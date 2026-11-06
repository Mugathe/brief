import { describe, expect, it } from "vitest";
import type { Segment } from "@/lib/bulletin";
import { briefPath, captionFor, dayKey, firstSentence, headlineCard, planStories } from "@/lib/studio-feed";

const seg = (n: number, over: Partial<Segment> = {}): Segment => ({ id: `s${n}`, kind: "story", title: `Story ${n} headline`, category: "Politics", script: "", detail: `First sentence of story ${n} is here. Second one follows.`, sources: [{ name: "BBC", link: "https://a" }, { name: "BBC", link: "https://b" }, { name: "Al Jazeera", link: "https://c" }], ...over });

describe("studio feed", () => {
  it("plans only stories, in order, capped, with a link to each story in the Brief", () => {
    const segs: Segment[] = [seg(0, { kind: "intro" }), seg(1), seg(2), seg(3), seg(4, { kind: "outro" })];
    const plans = planStories(segs, "KE", "20261104", 2);
    expect(plans.map((p) => p.title)).toEqual(["Story 1 headline", "Story 2 headline"]);
    expect(plans[1]).toMatchObject({ n: 2, path: "/brief?e=KE#story-2", summary: "First sentence of story 2 is here." });
    expect(plans[0]!.sources).toEqual(["BBC", "Al Jazeera"]);
  });
  it("gives a story the same key when the bulletin is reworded, and different stories different keys", () => {
    const a = planStories([seg(1, { title: "Wording one" })], "KE", "20261104")[0]!;
    const b = planStories([seg(1, { title: "Completely other wording" })], "KE", "20261104")[0]!;
    const c = planStories([seg(2, { sources: [{ name: "X", link: "https://other" }] })], "KE", "20261104")[0]!;
    expect(a.key).toBe(b.key);
    expect(a.key).not.toBe(c.key);
    expect(a.key).toMatch(/^20261104-[0-9a-z]+$/);
    expect(a.links).toEqual(["https://a", "https://b", "https://c"]);
  });
  it("makes a headline card that quotes nobody", () => {
    const c = headlineCard(planStories([seg(1)], "KE", "d")[0]!, "x.co/brief");
    expect(c.kind).toBe("headline");
    expect(c.speaker).toBe("Reported by BBC, Al Jazeera");
  });
  it("puts the Read the Brief link in every caption", () => {
    const p = planStories([seg(1)], "world", "d")[0]!;
    expect(captionFor(p, "https://x.co", p.path)).toContain("Read the Brief: https://x.co/brief?e=world#story-1");
  });
  it("handles odd input", () => {
    expect(briefPath("KE")).toBe("/brief?e=KE");
    expect(dayKey(new Date("2026-11-04T23:30:00Z"))).toBe("20261104");
    expect(firstSentence("No full stop here but it is long enough to keep")).toContain("No full stop");
  });
});
