import { describe, expect, it } from "vitest";
import { parseTrendsFeed } from "@/lib/google-trends.server";

const FEED = `<?xml version="1.0" encoding="UTF-8"?>
<rss xmlns:ht="https://trends.google.com/trending/rss" version="2.0"><channel><title>Daily Search Trends</title>
<item><title>mai mahiu floods</title><ht:approx_traffic>20,000+</ht:approx_traffic><pubDate>Sat, 10 Oct 2026 06:20:00 +0300</pubDate>
  <ht:news_item><ht:news_item_title>Floods displace families</ht:news_item_title><ht:news_item_url>https://nation.africa/x</ht:news_item_url><ht:news_item_source>Nation</ht:news_item_source></ht:news_item>
  <ht:news_item><ht:news_item_title>Second story</ht:news_item_title><ht:news_item_url>https://citizen.digital/y</ht:news_item_url><ht:news_item_source>Citizen</ht:news_item_source></ht:news_item></item>
<item><title>harambee stars</title><ht:approx_traffic>5,000+</ht:approx_traffic></item>
<item><title>x</title></item>
<item><title>bad link item</title><ht:news_item><ht:news_item_title>t</ht:news_item_title><ht:news_item_url>javascript:alert(1)</ht:news_item_url></ht:news_item></item>
</channel></rss>`;

describe("Google Trends feed", () => {
  const items = parseTrendsFeed(FEED);
  it("reads terms, traffic and the first related story", () => {
    expect(items[0]).toMatchObject({ term: "mai mahiu floods", traffic: "20,000+", news: { title: "Floods displace families", url: "https://nation.africa/x", source: "Nation" } });
    expect(items[0]!.publishedAt).toBe("2026-10-10T03:20:00.000Z");
  });
  it("copes with missing fields, drops junk terms and unsafe links", () => {
    expect(items.map((i) => i.term)).toEqual(["mai mahiu floods", "harambee stars", "bad link item"]);
    expect(items[1]).toMatchObject({ traffic: "5,000+", news: null, publishedAt: null });
    expect(items[2]!.news).toBeNull();
  });
  it("handles an empty or odd feed", () => {
    expect(parseTrendsFeed("<rss><channel></channel></rss>")).toEqual([]);
    expect(parseTrendsFeed("<rss><channel><item><title>Only one</title></item></channel></rss>")).toHaveLength(1);
  });
});
