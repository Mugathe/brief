import { parseXTrends, parseYouTube, type XTrend, type YouTubeVideo } from "./social-feeds";

/**
 * Live trending lists from YouTube and X, through their official APIs. Each is optional: without its key the list is
 * simply empty. Keys stay on the server (sent in headers, never in an address or a log line).
 *   YOUTUBE_API_KEY   a YouTube Data API v3 key (free quota)
 *   X_BEARER_TOKEN    an X API bearer token with access to the trends endpoint (paid by X)
 *   X_TRENDS_TTL_MINUTES   how long X results are kept before asking again (default 60: each ask can cost money)
 */
type Entry<T> = { at: number; ttl: number; items: T[] };
const GOOD = 30 * 60_000;          // keep a good YouTube answer this long
const SOON = 5 * 60_000;           // try again soon after a network error
const LONG = 6 * 3600_000;         // after "not allowed" or "out of credit", stop asking for hours

const caches = new Map<string, Entry<unknown>>();
const inflight = new Map<string, Promise<unknown[]>>();

async function cached<T>(key: string, load: () => Promise<{ items: T[]; ttl: number }>): Promise<T[]> {
  const hit = caches.get(key) as Entry<T> | undefined;
  if (hit && Date.now() - hit.at < hit.ttl) return hit.items;
  const running = inflight.get(key) as Promise<T[]> | undefined;
  if (running) return running;
  const job = (async () => {
    const { items, ttl } = await load();
    caches.set(key, { at: Date.now(), ttl, items });
    return items;
  })().finally(() => inflight.delete(key));
  inflight.set(key, job);
  return job;
}

export const youtubeConfigured = () => !!process.env["YOUTUBE_API_KEY"];
export const xConfigured = () => !!process.env["X_BEARER_TOKEN"];

export function loadYouTube(region: string): Promise<YouTubeVideo[]> {
  const key = process.env["YOUTUBE_API_KEY"];
  if (!key || !/^[A-Z]{2}$/.test(region)) return Promise.resolve([]);
  return cached(`yt:${region}`, async () => {
    try {
      const url = `https://www.googleapis.com/youtube/v3/videos?part=snippet,statistics&chart=mostPopular&regionCode=${region}&maxResults=12`;
      const res = await fetch(url, { headers: { "x-goog-api-key": key }, signal: AbortSignal.timeout(8000) });
      if (!res.ok) {
        console.error(`[youtube] ${region}: HTTP ${res.status}`);
        return { items: [], ttl: res.status === 400 || res.status === 403 ? LONG : SOON };
      }
      return { items: parseYouTube(await res.json(), 10), ttl: GOOD };
    } catch (e) {
      console.error(`[youtube] ${region}: ${e instanceof Error ? e.name : "failed"}`);
      return { items: [], ttl: SOON };
    }
  });
}

export function loadXTrends(woeid: number): Promise<XTrend[]> {
  const token = process.env["X_BEARER_TOKEN"];
  if (!token || !Number.isInteger(woeid) || woeid < 1) return Promise.resolve([]);
  const minutes = Math.max(10, Number(process.env["X_TRENDS_TTL_MINUTES"]) || 60);
  return cached(`x:${woeid}`, async () => {
    try {
      const res = await fetch(`https://api.x.com/2/trends/by/woeid/${woeid}`, { headers: { Authorization: `Bearer ${token}` }, signal: AbortSignal.timeout(8000) });
      if (!res.ok) {
        console.error(`[x] woeid ${woeid}: HTTP ${res.status}${res.status === 404 ? " (unknown location?)" : res.status === 401 || res.status === 402 || res.status === 403 ? " (check the token, plan or credit)" : ""}`);
        return { items: [], ttl: res.status === 429 ? SOON : LONG };
      }
      return { items: parseXTrends(await res.json(), 15), ttl: minutes * 60_000 };
    } catch (e) {
      console.error(`[x] woeid ${woeid}: ${e instanceof Error ? e.name : "failed"}`);
      return { items: [], ttl: SOON };
    }
  });
}
