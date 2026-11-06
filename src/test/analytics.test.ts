import { describe, expect, it } from "vitest";
import { firstViews, rank, summarize, type EventRow, type ViewRow } from "@/lib/analytics";

const NOW = Date.parse("2026-10-12T12:00:00Z");
let n = 0;
const view = (visitor: string, session: string, path: string, minsAgo: number, over: Partial<ViewRow> = {}): ViewRow => ({
  visitor_id: visitor, session_id: session, path, referrer: null, country: "KE", device: "mobile", created_at: new Date(NOW - minsAgo * 60_000 - n++).toISOString(), ...over,
});
const ev = (visitor: string, type: string, target: string | null = null): EventRow => ({ visitor_id: visitor, type, target, created_at: new Date(NOW).toISOString() });

describe("one device browsing many pages (the reported problem)", () => {
  // One phone: 14 page loads across 5 different pages, in one visit.
  const paths = ["/", "/brief", "/brief", "/trending", "/trending", "/trending", "/trails", "/", "/brief", "/manifestos", "/manifestos", "/", "/trending", "/brief"];
  const views = paths.map((p, i) => view("phone-1", "s1", p, 30 - i));
  const s = summarize(views, [], 7, NOW);

  it("is one visitor and one visit overall, not fourteen", () => {
    expect(s.totals.visitors).toBe(1);
    expect(s.totals.visits).toBe(1);
    expect(s.totals.views).toBe(14);
    expect(s.totals.viewsPerVisit).toBe(14);
  });
  it("counts the device once on each page it opened, with the extra loads shown separately", () => {
    const home = s.topPages.find((p) => p.label === "/")!;
    expect(home).toEqual({ label: "/", visitors: 1, views: 3 });
    expect(s.topPages.every((p) => p.visitors === 1)).toBe(true);
    expect(s.topPages.reduce((t, p) => t + p.views, 0)).toBe(14);
  });
  it("does not add the pages up into a bigger audience (5 pages is still 1 visitor)", () => {
    expect(s.sections.every((x) => x.visitors === 1)).toBe(true);
    expect(s.countries).toEqual([{ label: "KE", visitors: 1, views: 14 }]);
    expect(s.devices[0]).toMatchObject({ label: "mobile", visitors: 1 });
  });
});

describe("several devices", () => {
  const views = [
    ...["/", "/brief", "/trending"].map((p, i) => view("a", "a1", p, 50 - i)),
    ...["/", "/brief"].map((p, i) => view("b", "b1", p, 40 - i)),
    view("b", "b2", "/", 5),                       // b comes back later: same visitor, second visit
    view("c", "c1", "/trending", 3),
  ];
  const s = summarize(views, [], 7, NOW);
  it("counts devices, visits and views separately", () => {
    expect(s.totals).toMatchObject({ visitors: 3, visits: 4, views: 7, returningVisitors: 1, newVisitors: 2 });
  });
  it("ranks pages by how many different devices opened them", () => {
    expect(s.topPages.map((p) => [p.label, p.visitors, p.views])).toEqual([["/", 2, 3], ["/brief", 2, 2], ["/trending", 2, 2]]);
  });
});

describe("referrers and busiest hours count visits, not page loads", () => {
  const views = [
    view("a", "a1", "/", 60, { referrer: "https://t.co/x" }), view("a", "a1", "/brief", 59, { referrer: "https://t.co/x" }), view("a", "a1", "/trending", 58, { referrer: "https://t.co/x" }),
    view("b", "b1", "/", 30, { referrer: null }),
  ];
  const s = summarize(views, [], 7, NOW);
  it("one visit through a link is one visit from that source, however many pages follow", () => {
    expect(s.referrers).toEqual([{ label: "(direct)", visitors: 1, views: 1 }, { label: "https://t.co/x", visitors: 1, views: 1 }].sort((x, y) => x.label.localeCompare(y.label)).reverse().sort((x, y) => y.visitors - x.visitors || y.views - x.views || x.label.localeCompare(y.label)));
    expect(s.referrers.reduce((t, r) => t + r.views, 0)).toBe(2);
  });
  it("hours show visits starting, so a long browsing session does not inflate one hour", () => {
    expect(s.hourly.reduce((t, h) => t + h.visits, 0)).toBe(2);
  });
  it("finds the first page of each visit", () => expect(firstViews(views).map((r) => r.path).sort()).toEqual(["/", "/"]));
});

describe("actions and ads", () => {
  const events = [ev("a", "story_click", "https://x/1"), ev("a", "story_click", "https://x/1"), ev("a", "story_click", "https://x/2"), ev("b", "story_click", "https://x/1"),
    ev("a", "ad_view", "AD1"), ev("a", "ad_view", "AD1"), ev("b", "ad_view", "AD1"), ev("a", "ad_click", "AD1"), ev("a", "ad_click", "AD1")];
  const s = summarize([view("a", "a1", "/", 1)], events, 7, NOW);
  it("ranks stories by distinct devices who clicked, with total clicks alongside", () => {
    expect(s.topStories[0]).toEqual({ label: "https://x/1", visitors: 2, views: 3 });
  });
  it("reports an ad's reach in devices as well as impressions", () => {
    expect(s.ads["AD1"]).toEqual({ views: 3, clicks: 2, reach: 2, clickers: 1 });
  });
});

describe("edge cases", () => {
  it("handles no traffic", () => {
    const s = summarize([], [], 7, NOW);
    expect(s.totals).toMatchObject({ visitors: 0, visits: 0, views: 0, viewsPerVisit: 0 });
    expect(s.topPages).toEqual([]);
    expect(s.daily).toHaveLength(7);
  });
  it("ranks ties alphabetically so the order is stable", () => {
    expect(rank([{ k: "b", w: "1" }, { k: "a", w: "2" }], (r) => r.k, (r) => r.w).map((r) => r.label)).toEqual(["a", "b"]);
  });
  it("leaves out the contact form from profile counts", () => {
    const s = summarize([view("a", "s", "/manifestos/submit", 1), view("a", "s", "/manifestos/jane-doe", 1)], [], 7, NOW);
    expect(s.manifestoProfiles.map((p) => p.label)).toEqual(["jane-doe"]);
  });
});
