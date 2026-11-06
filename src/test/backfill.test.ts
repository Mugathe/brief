import { describe, expect, it } from "vitest";
import { monthWindows, splitWindow, buildQuery, rssUrl, parseRss, runBackfill, parseArgs } from "../../scripts/backfill-lib.mjs";

const item = (n: number, date: string, title = `Story ${n}`) =>
  `<item><title>${title} - Nation</title><link>https://news.google.com/rss/articles/${n}</link><pubDate>${new Date(date + "T08:00:00Z").toUTCString()}</pubDate><description>&lt;a&gt;${title}&lt;/a&gt;</description><source url="https://nation.africa">Nation</source></item>`;
const feed = (items: string[]) => `<?xml version="1.0"?><rss version="2.0"><channel><title>x</title>${items.join("")}</channel></rss>`;

describe("windows", () => {
  it("steps month by month and ends on the right day", () => {
    const w = monthWindows("2023-11", "2024-01-15");
    expect(w).toEqual([{ after: "2023-11-01", before: "2023-12-01" }, { after: "2023-12-01", before: "2024-01-01" }, { after: "2024-01-01", before: "2024-01-16" }]);
  });
  it("splits a window in half until it is one day", () => {
    expect(splitWindow({ after: "2023-11-01", before: "2023-12-01" })).toEqual([{ after: "2023-11-01", before: "2023-11-16" }, { after: "2023-11-16", before: "2023-12-01" }]);
    expect(splitWindow({ after: "2023-11-05", before: "2023-11-06" })).toBeNull();
  });
  it("rejects a badly written date", () => expect(() => monthWindows("last year", "2024-01")).toThrow(/Bad date/));
});

describe("query", () => {
  it("scopes to Kenya or to named sites, and adds the date range", () => {
    const w = { after: "2023-11-01", before: "2023-12-01" };
    expect(buildQuery("flood OR floods", [], w)).toBe("(flood OR floods) Kenya after:2023-11-01 before:2023-12-01");
    expect(buildQuery("flood", ["nation.africa", "the-star.co.ke"], w)).toBe("(flood) (site:nation.africa OR site:the-star.co.ke) after:2023-11-01 before:2023-12-01");
    expect(rssUrl("a b")).toContain("q=a%20b");
  });
});

describe("reading the feed", () => {
  it("keeps good rows, trims the outlet suffix, and drops junk and future dates", () => {
    const rows = parseRss(feed([item(1, "2023-11-20", "Floods hit Mai Mahiu"), `<item><title>No link</title><pubDate>${new Date().toUTCString()}</pubDate></item>`, item(3, "2999-01-01")]));
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ title: "Floods hit Mai Mahiu", source: "Nation", platform: "Google News (backfill)", published_at: "2023-11-20T08:00:00.000Z" });
  });
  it("copes with an empty feed", () => expect(parseRss(feed([]))).toEqual([]));
});

describe("backfill run", () => {
  // A fake Google News: a window of N days returns min(100, 4*N) results, numbered uniquely by date.
  const fake = () => {
    const requests: string[] = [];
    const fetchText = async (url: string) => {
      const q = decodeURIComponent(url.split("q=")[1]!.split("&")[0]!);
      requests.push(q);
      const after = /after:(\S+)/.exec(q)![1]!, before = /before:(\S+)/.exec(q)![1]!;
      const days = Math.round((Date.parse(before) - Date.parse(after)) / 86400_000);
      const n = Math.min(100, days * 4);
      return feed(Array.from({ length: n }, (_, i) => item(Date.parse(after) / 1000 + i, new Date(Date.parse(after) + Math.floor(i / 4) * 86400_000).toISOString().slice(0, 10))));
    };
    return { fetchText, requests };
  };

  it("splits windows that hit the cap so nothing is silently lost, then saves everything once", async () => {
    const { fetchText, requests } = fake();
    const saved: { link: string }[] = [];
    const stats = await runBackfill({ query: "flood", from: "2023-11", to: "2023-12-31", delayMs: 0, fetchText, write: async (r) => { saved.push(...r); }, sleep: async () => {} });
    // Nov has 30 days -> 100-capped at month level, so it must have been split down to windows under the cap
    expect(requests.length).toBeGreaterThan(2);
    expect(stats.rows).toBe(saved.length);
    expect(new Set(saved.map((r) => r.link)).size).toBe(saved.length);
    expect(saved.length).toBe(61 * 4); // every day of Nov and Dec, 4 each: nothing dropped
  });
  it("resumes: windows already done are skipped", async () => {
    const { fetchText, requests } = fake();
    const state = { done: [] as string[] };
    const run = () => runBackfill({ query: "flood", from: "2023-11", to: "2023-11-10", delayMs: 0, state, fetchText, write: async () => {}, sleep: async () => {}, saveState: (s) => { state.done = s.done; } });
    await run();
    const first = requests.length;
    const again = await run();
    expect(requests.length).toBe(first);
    expect(again.skipped).toBeGreaterThan(0);
    expect(again.requests).toBe(0);
  });
});

describe("arguments", () => {
  it("reads flags and values", () => expect(parseArgs(["--query", "flood OR el nino", "--trails", "--from", "2015-01", "--dry-run"])).toMatchObject({ query: "flood OR el nino", trails: true, from: "2015-01", "dry-run": true }));
});
