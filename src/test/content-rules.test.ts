import { describe, expect, it } from "vitest";
import { applyContentRules, type NewsItem } from "@/lib/news.server";
import { parsePillars, parseSources, rowToAspirant } from "@/lib/entries";
import { parseContent } from "@/lib/site-types";

const item = (n: number, over: Partial<NewsItem> = {}): NewsItem => ({
  id: `l${n}`, title: `Story ${n}`, link: `https://x.test/${n}`, summary: "", source: "Outlet", platform: "Kenyan outlets",
  category: "General", published: 1000 - n, ...over,
});
const rules = (o: Partial<ReturnType<typeof parseContent>> = {}) => ({ ...parseContent({}), ...o });

describe("applyContentRules", () => {
  const items = [item(1), item(2, { source: "Tuko" }), item(3, { title: "Scandal involving Foo Bar" }), item(4), item(5)];
  it("hides links, blocks sources and words", () => {
    const out = applyContentRules(items, rules({ hiddenLinks: ["https://x.test/4"], blockedSources: ["tuko"], blockedWords: ["foo bar"] }));
    expect(out.map((i) => i.id)).toEqual(["l1", "l5"]);
  });
  it("matches whole words only and escapes regex characters", () => {
    expect(applyContentRules([item(1, { title: "Classic car" })], rules({ blockedWords: ["ass"] }))).toHaveLength(1);
    expect(applyContentRules([item(1, { title: "Cost (2026) up" })], rules({ blockedWords: ["(2026)"] }))).toHaveLength(0);
  });
  it("pins stories first in pin order", () => {
    const out = applyContentRules(items, rules({ pinnedLinks: ["https://x.test/5", "https://x.test/2"] }));
    expect(out.slice(0, 2).map((i) => i.id)).toEqual(["l5", "l2"]);
  });
  it("does nothing with empty rules", () => expect(applyContentRules(items, rules())).toHaveLength(5));
});

describe("manifesto entries", () => {
  it("always yields the five pillars and drops non-http sources", () => {
    expect(parsePillars([]).map((p) => p.label)).toHaveLength(5);
    expect(parseSources([{ title: "a", url: "javascript:alert(1)" }, { title: "b", url: "https://ok.test", kind: "Candidate or party" }])).toHaveLength(1);
  });
  it("adapts a database row", () => {
    const a = rowToAspirant({ id: "1", slug: "jane-doe", name: "Jane Doe", office: "Governor", region: "Nairobi", affiliation: null, status: "Declared intent", status_note: "", evidence_state: "Not yet assessed", overview: "o", priorities: [], gaps: [], sources: [], pillars: [], published: true, reviewed_at: null, updated_at: "" });
    expect(a.office).toBe("Governor");
    expect(a.affiliation).toBe("Not stated");
    expect(a.pillars).toHaveLength(5);
  });
});
