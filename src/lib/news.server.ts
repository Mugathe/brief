import { XMLParser } from "fast-xml-parser";
import { getContentSettings } from "./settings.server";
import { archiveStories } from "./archive.server";
import type { ContentSettings } from "./site-types";
import { DEFAULT_EDITION } from "./editions";
import { categorize, EDITION_CODES, feedsFor, type Feed } from "./editions.server";

export type NewsItem = {
  id: string;
  title: string;
  link: string;
  summary: string;
  source: string;
  /** Where it came from: "Google News", "Reddit", "YouTube", "Viral (TikTok & X)" or the edition's outlets, e.g. "Kenyan outlets". */
  platform: string;
  category: string;
  published: number;
  image?: string;
};

const BANNED = [
  "fuck", "shit", "bitch", "cunt", "dick", "pussy", "porn", "xxx", "nsfw", "nude", "nudes",
  "sex tape", "slut", "whore", "bastard", "asshole", "motherfucker", "malaya", "matako", "kuma", "msenge",
];
const bannedRe = new RegExp(`\\b(${BANNED.map((w) => w.replace(/ /g, "\\s+")).join("|")})\\b`, "i");
export const isClean = (s: string) => !bannedRe.test(s);

const parser = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: "@" });
const text = (v: unknown): string =>
  typeof v === "string" ? v : typeof v === "object" && v ? String((v as any)["#text"] ?? "") : v == null ? "" : String(v);
const strip = (s: string) =>
  s.replace(/<[^>]*>/g, " ").replace(/&nbsp;|&#160;/g, " ").replace(/&amp;/g, "&").replace(/&quot;/g, '"').replace(/&#39;|&#039;/g, "'").replace(/\s+/g, " ").trim();

async function fetchFeed(feed: Feed, edition: string): Promise<NewsItem[]> {
  try {
    const res = await fetch(feed.url, {
      headers: { "User-Agent": "Mozilla/5.0 (Brief news aggregator)" },
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) return [];
    const doc = parser.parse(await res.text());
    const raw: any[] = [].concat(doc?.rss?.channel?.item ?? doc?.feed?.entry ?? []);
    return raw.slice(0, 40).map((it) => {
      const link = typeof it.link === "object" ? it.link?.["@href"] ?? text(it.link) : text(it.link);
      let title = strip(text(it.title));
      let source = feed.name;
      const srcName = text(it.source);
      if (feed.platform !== "Reddit" && srcName) source = srcName;
      if (srcName && title.endsWith(` - ${srcName}`)) title = title.slice(0, -srcName.length - 3);
      const summary = strip(text(it.description ?? it.summary ?? it.content)).slice(0, 260);
      const date = Date.parse(text(it.pubDate ?? it.published ?? it.updated)) || Date.now();
      const image = it["media:content"]?.["@url"] ?? it["media:thumbnail"]?.["@url"] ?? it.enclosure?.["@url"];
      return {
        id: link || title,
        title,
        link,
        summary: summary === title ? "" : summary,
        source,
        platform: feed.platform,
        category: categorize(`${title} ${summary}`, edition, feed.category),
        published: date,
        image,
      } satisfies NewsItem;
    });
  } catch {
    return [];
  }
}

type Cached = { at: number; items: NewsItem[] };
const caches = new Map<string, Cached>();
/** Refreshes already under way, so a crowd arriving as the cache expires triggers one refresh, not one each. */
const inflight = new Map<string, Promise<NewsItem[]>>();

export type FeedReport = { name: string; stories: number };
export type EditionReport = { edition: string; stories: number; feeds: FeedReport[]; at: number };
const reports = new Map<string, EditionReport>();
/** What each feed returned on the latest refresh. A feed showing 0 is down or has a wrong address. */
export const feedReports = (): EditionReport[] => EDITION_CODES.map((c) => reports.get(c)).filter((r): r is EditionReport => !!r);

async function refresh(code: string): Promise<NewsItem[]> {
  const feeds = feedsFor(code);
  const results = await Promise.all(feeds.map(async (f) => ({ f, items: await fetchFeed(f, code) })));
  const all = results.flatMap((r) => r.items);
  const seen = new Set<string>();
  const items = all
    .filter((i) => i.title && i.link && isClean(`${i.title} ${i.summary}`))
    .filter((i) => {
      const k = i.title.toLowerCase().slice(0, 60);
      if (seen.has(k)) return false;
      seen.add(k);
      return true;
    })
    .sort((a, b) => b.published - a.published);
  caches.set(code, { at: Date.now(), items });
  reports.set(code, { edition: code, stories: items.length, feeds: results.map((r) => ({ name: r.f.name, stories: r.items.length })), at: Date.now() });
  // Keep every headline for trends and trails. Capped at 4 seconds so a slow database never slows the page.
  await Promise.race([archiveStories(items, code), new Promise((r) => setTimeout(r, 4000))]);
  return items;
}

async function loadRawNews(code: string, force = false): Promise<NewsItem[]> {
  const hit = caches.get(code);
  if (!force && hit && Date.now() - hit.at < 5 * 60_000) return hit.items;
  const running = inflight.get(code);
  if (running) return running;
  const job = refresh(code).finally(() => inflight.delete(code));
  inflight.set(code, job);
  return job;
}

const esc = (w: string) => w.trim().replace(/[.*+?^${}()|[\]\\]/g, "\\$&").replace(/\s+/g, "\\s+");

/** Applies the editors' rules: hidden stories, blocked sources, extra blocked words, pinned stories first. */
export function applyContentRules(items: NewsItem[], rules: ContentSettings): NewsItem[] {
  const hidden = new Set(rules.hiddenLinks);
  const sources = new Set(rules.blockedSources.map((x) => x.toLowerCase().trim()));
  const words = rules.blockedWords.filter((w) => w.trim());
  const wordRe = words.length ? new RegExp(`(^|\\W)(${words.map(esc).join("|")})(\\W|$)`, "i") : null;
  const kept = items.filter(
    (i) => !hidden.has(i.link) && !sources.has(i.source.toLowerCase().trim()) && !(wordRe && wordRe.test(`${i.title} ${i.summary}`)),
  );
  const rank = new Map(rules.pinnedLinks.map((l, n) => [l, n]));
  const pinned = kept.filter((i) => rank.has(i.link)).sort((a, b) => rank.get(a.link)! - rank.get(b.link)!);
  return [...pinned, ...kept.filter((i) => !rank.has(i.link))];
}

/** Unfiltered feed, for the admin story picker only. */
export const loadUnfilteredNews = (edition: string = DEFAULT_EDITION) => loadRawNews(edition);
/**
 * Fetches fresh feeds now and archives them (used by the scheduler endpoint). Every edition is refreshed, a few at a time
 * so Google News is not hit by all of them at once. Returns the total number of stories.
 */
export async function refreshAndArchive(): Promise<number> {
  let total = 0;
  const queue = [...EDITION_CODES];
  await Promise.all(Array.from({ length: 3 }, async () => {
    for (let code = queue.shift(); code; code = queue.shift()) total += (await loadRawNews(code, true)).length;
  }));
  return total;
}

export async function loadNews(edition: string = DEFAULT_EDITION): Promise<NewsItem[]> {
  return applyContentRules(await loadRawNews(edition), await getContentSettings(edition));
}
