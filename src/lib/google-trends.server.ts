import { XMLParser } from "fast-xml-parser";

export type SearchTrend = { term: string; traffic: string; publishedAt: string | null; news: { title: string; url: string; source: string } | null };

const parser = new XMLParser({ ignoreAttributes: true, trimValues: true });
const arr = <T,>(v: T | T[] | undefined | null): T[] => (v == null ? [] : Array.isArray(v) ? v : [v]);
const text = (v: unknown) => (typeof v === "string" ? v : typeof v === "number" ? String(v) : "").trim();

/** Parses Google's public "Trending now" RSS feed. Tolerant of missing fields. */
export function parseTrendsFeed(xml: string): SearchTrend[] {
  const doc = parser.parse(xml) as { rss?: { channel?: { item?: unknown } } };
  return arr(doc.rss?.channel?.item as Record<string, unknown> | Record<string, unknown>[] | undefined).map((it) => {
    const n = arr(it["ht:news_item"] as Record<string, unknown> | Record<string, unknown>[] | undefined)[0];
    const url = n ? text(n["ht:news_item_url"]) : "";
    const pub = text(it["pubDate"]);
    return {
      term: text(it["title"]),
      traffic: text(it["ht:approx_traffic"]),
      publishedAt: pub && !Number.isNaN(Date.parse(pub)) ? new Date(pub).toISOString() : null,
      news: n && /^https?:\/\//i.test(url) ? { title: text(n["ht:news_item_title"]), url, source: text(n["ht:news_item_source"]) } : null,
    };
  }).filter((t) => t.term.length >= 2).slice(0, 20);
}

const caches = new Map<string, { at: number; items: SearchTrend[] }>();

/** What people in a country are searching on Google right now. Cached for 30 minutes per country; returns the last good list if Google is unreachable. */
export async function loadSearchTrends(geo: string): Promise<SearchTrend[]> {
  const hit = caches.get(geo);
  if (hit && Date.now() - hit.at < 30 * 60_000) return hit.items;
  try {
    const res = await fetch(`https://trends.google.com/trending/rss?geo=${encodeURIComponent(geo)}`, { headers: { "User-Agent": "Brief/1.0 (+news aggregator)" }, signal: AbortSignal.timeout(8000) });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const items = parseTrendsFeed(await res.text());
    caches.set(geo, { at: Date.now(), items });
    return items;
  } catch (e) {
    console.error(`[google-trends] could not load ${geo}:`, e instanceof Error ? e.message : e);
    return hit?.items ?? [];
  }
}
