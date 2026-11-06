import { describe, expect, it } from "vitest";
import { editionOf } from "@/lib/editions";
import { buildIntro, buildSegments, clusterStories, dayPart, extractivePicks, leadIn, validatePicks, type Story } from "@/lib/bulletin";

const s = (source: string, title: string, summary = "", category = "General"): Story => ({ source, title, summary, category, link: `https://${source.toLowerCase()}.test/${encodeURIComponent(title).slice(0, 20)}` });

const items: Story[] = [
  s("Nation", "Floods displace thousands of families in Mai Mahiu after river bursts banks", "Heavy rains caused the Mai Mahiu river to burst its banks overnight. Residents moved to higher ground."),
  s("Citizen", "Mai Mahiu floods: thousands of families displaced as river bursts", "Families were moved to a nearby school."),
  s("Star", "Budget debate continues in Parliament as MPs split over new taxes", "MPs traded barbs on the Finance Bill."),
  s("Standard", "Thousands displaced by Mai Mahiu floods as river bursts banks", ""),
  s("Tuko", "Celebrity couple announces engagement in Nairobi ceremony", "A private ceremony was held."),
];

describe("clustering", () => {
  it("groups the same event from different outlets and ranks it first", () => {
    const c = clusterStories(items);
    expect(c[0]!.items).toHaveLength(3);
    expect(c[0]!.sources).toBe(3);
    expect(c.map((x) => x.items.length).sort()).toEqual([1, 1, 3]);
  });
  it("keeps unrelated stories apart", () => {
    const c = clusterStories([s("A", "Drought worsens in Turkana county as rains fail"), s("B", "Safaricom reports record half year profit today")]);
    expect(c).toHaveLength(2);
  });
});

const KE = editionOf("KE");
describe("script", () => {
  const now = new Date("2026-10-10T06:30:00Z"); // 09:30 in Nairobi
  it("greets by Nairobi time of day", () => {
    expect(dayPart(now, KE.tz)).toBe("morning");
    expect(dayPart(new Date("2026-10-10T13:00:00Z"), KE.tz)).toBe("afternoon");
    expect(dayPart(new Date("2026-10-10T17:30:00Z"), KE.tz)).toBe("evening");
  });
  it("opens with the headlines and says when it is", () => {
    const t = buildIntro(now, ["First thing", "Second thing"], KE);
    expect(t).toContain("Good morning");
    expect(t).toContain("9:30 AM");
    expect(t).toContain("Saturday, 10 October");
    expect(t).toContain("One: First thing. Two: Second thing.");
  });
  it("names the bulletin after the edition and keeps its own clock", () => {
    const world = buildIntro(now, ["First thing"], editionOf("world"));
    expect(world).toContain("welcome to The World in a Nutshell, your Brief news bulletin");
    expect(world).toContain("6:30 AM UTC");
    const lagos = buildIntro(new Date("2026-10-10T22:30:00Z"), ["First thing"], editionOf("NG")); // 23:30 in Lagos, still Saturday
    expect(lagos).toContain("Good evening");
    expect(lagos).toContain("Nigeria in a Nutshell");
    expect(lagos).toContain("Saturday, 10 October");
    const sydney = buildIntro(new Date("2026-10-10T22:30:00Z"), ["First thing"], editionOf("AU")); // already Sunday morning there
    expect(sydney).toContain("Sunday, 11 October");
    expect(sydney).toContain("Good morning");
  });
  it("signals each story: top story, transitions, and 'and finally'", () => {
    expect([0, 1, 2, 3, 4].map((n) => leadIn(n, 5))).toEqual(["Our top story", "Next", "Also making news", "Turning now to", "And finally"]);
  });
  it("builds intro, one segment per story with sources, and a sign-off", () => {
    const clusters = clusterStories(items);
    const picks = extractivePicks(clusters, 3);
    const seg = buildSegments(now, picks, clusters, KE);
    expect(seg.map((x) => x.kind)).toEqual(["intro", "story", "story", "story", "outro"]);
    expect(seg[1]!.script.startsWith("Our top story. ")).toBe(true);
    expect(seg[1]!.sources.map((x) => x.name)).toEqual(["Nation", "Citizen", "Standard"]);
    expect(seg[1]!.script).toContain("being reported by Nation, Citizen and Standard");
    expect(seg.at(-1)!.script).toContain("Thank you for listening");
    expect(seg.every((x) => x.script.length >= 20)).toBe(true);
  });
});

describe("model output validation", () => {
  const clusters = clusterStories(items);
  const good = { cluster: 0, category: "Weather", title: "Floods displace thousands in Mai Mahiu", detail: "The Nation reports that heavy rain made the river burst its banks overnight. The Citizen says families moved to a nearby school." };
  it("keeps good picks and drops invalid ones", () => {
    const p = validatePicks([good, { ...good }, { ...good, cluster: 99 }, { ...good, cluster: 1, detail: "short" }, null, { cluster: 2, title: "A fine headline here", detail: "x".repeat(60) }], clusters);
    expect(p.map((x) => x.cluster)).toEqual([0, 2]);
  });
  it("copes with junk", () => { expect(validatePicks("nope", clusters)).toEqual([]); expect(validatePicks(undefined, clusters)).toEqual([]); });
  it("strips markup", () => expect(validatePicks([{ ...good, detail: "<b>Bold</b> text &amp; more words to pass the length check okay" }], clusters)[0]!.detail).toBe("Bold text & more words to pass the length check okay"));
});

describe("sentences with numbers", () => {
  it("never splits a decimal, so money and percentages survive the fallback bulletin", () => {
    const clusters = clusterStories([s("Star", "Treasury sets Sh1.5 trillion target for 8.5% growth", "Treasury targets Sh1.5 trillion in 2027. Growth is forecast at 8.5% next year. A third sentence follows.")]);
    const pick = extractivePicks(clusters, 1)[0]!;
    expect(pick.detail).toContain("Sh1.5 trillion in 2027. Growth is forecast at 8.5% next year");
    expect(pick.detail).not.toContain("Sh1. 5");
  });
});

describe("spoken script", () => {
  it("is prepared for the voice without changing the text shown on the page", async () => {
    const { prepareSpeech } = await import("@/lib/pronounce");
    const clusters = clusterStories([s("Nation", "IEBC asks for Sh2.5 billion for Murang'a by-election", "The commission says it needs Sh2.5 billion, up 8% on 2022.")]);
    const seg = buildSegments(new Date("2026-10-10T06:30:00Z"), extractivePicks(clusters, 1), clusters, KE);
    const story = seg.find((x) => x.kind === "story")!;
    const spoken = prepareSpeech(story.script);
    expect(spoken).toContain("I E B C");
    expect(spoken).toContain("2.5 billion shillings");
    expect(spoken).toContain("8 percent");
    expect(spoken).toContain("Muranga");
    expect(story.detail).toContain("Sh2.5 billion");
    expect(story.title).toContain("Murang'a");
  });
});
