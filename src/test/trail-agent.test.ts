import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { collectGrounding, normalizeQuery, normalizeUrl, parseEventDate, researchTopic, validateEvents, visitorAllowed, _resetThrottle } from "@/lib/trail-agent.server";

const searchResults = {
  type: "web_search_tool_result",
  content: [
    { type: "web_search_result", url: "https://www.nation.africa/kenya/news/floods-2023?utm_source=x", title: "Floods" },
    { type: "web_search_result", url: "https://www.kmd.go.ke/el-nino-outlook/", title: "Outlook" },
    { type: "web_search_result", url: "https://twitter.com/someone/status/1", title: "Tweet" },
  ],
};

describe("normalisation", () => {
  it("treats tracking params, www, trailing slash and scheme as the same page", () => {
    expect(normalizeUrl("http://www.Nation.africa/a/b/?utm_source=z#top")).toBe(normalizeUrl("https://nation.africa/a/b"));
  });
  it("rejects non-web links", () => { expect(normalizeUrl("javascript:alert(1)")).toBeNull(); expect(normalizeUrl("nonsense")).toBeNull(); });
  it("maps differently typed topics to one key", () => expect(normalizeQuery('  “El  Nino” FLOODS ')).toBe("el nino floods"));
});

describe("dates", () => {
  it("accepts day, month and year precision", () => {
    expect(parseEventDate("2023-11-20", "day")).toEqual({ iso: "2023-11-20", precision: "day" });
    expect(parseEventDate("2023-11", "month")).toEqual({ iso: "2023-11-01", precision: "month" });
    expect(parseEventDate("1997", "year")).toEqual({ iso: "1997-01-01", precision: "year" });
  });
  it("rejects impossible, future and pre-independence dates", () => {
    expect(parseEventDate("2023-02-30", "day")).toBeNull();
    expect(parseEventDate("2999-01-01", "day")).toBeNull();
    expect(parseEventDate("1900-01-01", "day")).toBeNull();
    expect(parseEventDate("last year", "year")).toBeNull();
  });
});

describe("grounding: the anti-invention rule", () => {
  const g = collectGrounding([searchResults, { type: "text", citations: [{ url: "https://example.org/cited", title: "c" }] }]);
  const ev = (over: Record<string, unknown>) => ({ date: "2023-11-20", precision: "day", title: "A headline", summary: "s", url: "https://nation.africa/kenya/news/floods-2023", publisher: "Nation", ...over });

  it("keeps an event whose link was in the search results, using the real URL", () => {
    const r = validateEvents([ev({})], g);
    expect(r.items).toHaveLength(1);
    expect(r.items[0]!.url).toBe("https://www.nation.africa/kenya/news/floods-2023?utm_source=x");
  });
  it("drops an event whose link the model invented", () => {
    const r = validateEvents([ev({ url: "https://invented.example/story" })], g);
    expect(r.items).toHaveLength(0);
    expect(r.dropped[0]).toMatch(/not from search results/);
  });
  it("accepts links the model cited even if not in a result list", () => expect(validateEvents([ev({ url: "https://example.org/cited" })], g).items).toHaveLength(1));
  it("drops social-media sources, bad dates and duplicates", () => {
    const r = validateEvents([ev({ url: "https://twitter.com/someone/status/1" }), ev({ date: "nope" }), ev({}), ev({ title: "Same page again" })], g);
    expect(r.items).toHaveLength(1);
    expect(r.dropped.some((d) => /social media/.test(d))).toBe(true);
    expect(r.dropped.some((d) => /bad date/.test(d))).toBe(true);
  });
  it("orders oldest to newest and trims long summaries", () => {
    const r = validateEvents([ev({ date: "2024-01-01", summary: "x".repeat(900) }), ev({ date: "1997-10", precision: "month", url: "https://kmd.go.ke/el-nino-outlook" })], g);
    expect(r.items.map((i) => i.date)).toEqual(["1997-10-01", "2024-01-01"]);
    expect(r.items[1]!.summary.length).toBeLessThanOrEqual(320);
  });
  it("handles junk safely", () => { expect(validateEvents(null, g).items).toEqual([]); expect(validateEvents([null, 5, {}], g).items).toEqual([]); });
});

describe("researchTopic with a mocked Anthropic API", () => {
  beforeEach(() => { process.env["ANTHROPIC_API_KEY"] = "sk-test"; });
  afterEach(() => vi.unstubAllGlobals());

  it("asks for web search, follows pause_turn, and returns only grounded events", async () => {
    const calls: { body: Record<string, unknown> }[] = [];
    const responses = [
      { stop_reason: "pause_turn", content: [{ type: "server_tool_use", name: "web_search" }, searchResults], usage: { input_tokens: 100, output_tokens: 10, server_tool_use: { web_search_requests: 2 } } },
      { stop_reason: "end_turn", content: [{ type: "text", text: 'Here you go: {"events":[{"date":"2023-11-20","precision":"day","title":"Floods","summary":"Reported.","url":"https://nation.africa/kenya/news/floods-2023","publisher":"Nation"},{"date":"2022-01-01","precision":"day","title":"Made up","summary":"x","url":"https://fake.example/1","publisher":"Fake"}]}' }], usage: { input_tokens: 50, output_tokens: 60, server_tool_use: { web_search_requests: 1 } } },
    ];
    vi.stubGlobal("fetch", vi.fn(async (_u: string, init: RequestInit) => { calls.push({ body: JSON.parse(String(init.body)) }); return new Response(JSON.stringify(responses[calls.length - 1]), { status: 200 }); }));
    const r = await researchTopic("floods");
    expect(calls).toHaveLength(2);
    const tool = (calls[0]!.body["tools"] as { type: string; max_uses: number }[])[0]!;
    expect(tool.type).toBe("web_search_20250305");
    expect(tool.max_uses).toBeLessThanOrEqual(6);
    expect(calls[1]!.body["messages"] as unknown[]).toHaveLength(2); // the paused turn was carried forward
    expect(r.items.map((i) => i.title)).toEqual(["Floods"]);
    expect(r.dropped).toHaveLength(1);
    expect(r.searches).toBe(3);
    expect(r.inputTokens).toBe(150);
  });
  it("explains a disabled web-search account", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response("web search tool is not enabled for your organization", { status: 400 })));
    await expect(researchTopic("floods")).rejects.toThrow(/Web search is not enabled/);
  });
  it("fails clearly when the model returns no JSON", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({ stop_reason: "end_turn", content: [{ type: "text", text: "Sorry." }] }), { status: 200 })));
    await expect(researchTopic("floods")).rejects.toThrow(/structured results/);
  });
});

describe("visitor throttle", () => {
  it("allows three an hour per address", () => {
    _resetThrottle();
    expect([1, 2, 3, 4].map(() => visitorAllowed("1.2.3.4"))).toEqual([true, true, true, false]);
    expect(visitorAllowed("5.6.7.8")).toBe(true);
  });
});
