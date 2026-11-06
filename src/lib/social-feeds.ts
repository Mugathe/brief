/** What the YouTube and X feeds return, reduced to what the Trending page shows. Pure, so it can be tested without the networks. */
export type YouTubeVideo = { id: string; title: string; channel: string; views: number | null; published: string; thumbnail: string; url: string };
export type XTrend = { name: string; posts: number | null; url: string };

const str = (v: unknown, max = 200): string => (typeof v === "string" ? v.trim().slice(0, max) : "");
const num = (v: unknown): number | null => {
  const n = typeof v === "number" ? v : typeof v === "string" && v.trim() !== "" ? Number(v) : NaN;
  return Number.isFinite(n) && n >= 0 ? n : null;
};

/** YouTube Data API `videos.list` with chart=mostPopular. */
export function parseYouTube(json: unknown, limit = 10): YouTubeVideo[] {
  const items = (json as { items?: unknown })?.items;
  if (!Array.isArray(items)) return [];
  const out: YouTubeVideo[] = [];
  for (const raw of items) {
    const it = raw as { id?: unknown; snippet?: { title?: unknown; channelTitle?: unknown; publishedAt?: unknown; thumbnails?: Record<string, { url?: unknown }> }; statistics?: { viewCount?: unknown } };
    const id = str(it.id, 20);
    const title = str(it.snippet?.title);
    if (!/^[\w-]{6,20}$/.test(id) || !title) continue;
    const thumbs = it.snippet?.thumbnails ?? {};
    const thumbnail = str(thumbs["medium"]?.url ?? thumbs["default"]?.url ?? thumbs["high"]?.url, 300);
    out.push({
      id, title, channel: str(it.snippet?.channelTitle, 100), views: num(it.statistics?.viewCount), published: str(it.snippet?.publishedAt, 40),
      thumbnail: thumbnail.startsWith("https://") ? thumbnail : "", url: `https://www.youtube.com/watch?v=${id}`,
    });
    if (out.length >= limit) break;
  }
  return out;
}

/** X API v2 `GET /2/trends/by/woeid/{id}`: `{ data: [{ trend_name, tweet_count? }] }`. */
export function parseXTrends(json: unknown, limit = 15): XTrend[] {
  const data = (json as { data?: unknown })?.data;
  if (!Array.isArray(data)) return [];
  const seen = new Set<string>();
  const out: XTrend[] = [];
  for (const raw of data) {
    const r = raw as { trend_name?: unknown; tweet_count?: unknown };
    const name = str(r.trend_name, 100);
    if (!name || seen.has(name.toLowerCase())) continue;
    seen.add(name.toLowerCase());
    out.push({ name, posts: num(r.tweet_count), url: `https://x.com/search?q=${encodeURIComponent(name)}` });
    if (out.length >= limit) break;
  }
  return out;
}

/** 1,234,000 -> "1.2M" in the reader's language. */
export const compact = (n: number, locale: string): string => new Intl.NumberFormat(locale, { notation: "compact", maximumFractionDigits: 1 }).format(n);
