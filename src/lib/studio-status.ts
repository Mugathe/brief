import type { StudioGroup } from "./studio-db";

/** Like WhatsApp Status: a story is fresh for a day, then drops to the end of the row, and is gone after a week. */
export const FRESH_MS = 24 * 3_600_000;
export const KEEP_MS = 7 * 86_400_000;
export const IMAGE_MS = 4_500;

export type Slide = { kind: "image" | "video"; url: string };
export type Status = { key: string; title: string; category: string; link: string; caption: string; at: number; fresh: boolean; seen: boolean; cover: string | null; slides: Slide[] };

/** Fresh and unseen first, then fresh and seen, then expired; newest first inside each. */
export function toStatuses(groups: StudioGroup[], now: number, seen: ReadonlySet<string>): Status[] {
  return groups
    .filter((g) => now - g.at < KEEP_MS && (g.image || g.video))
    .map((g): Status => ({
      key: g.key, title: g.title, category: g.category, link: g.link, caption: g.caption, at: g.at,
      fresh: now - g.at < FRESH_MS, seen: seen.has(g.key),
      cover: g.image?.media_url ?? null,
      // One slide per story: the reel when there is one, otherwise the picture.
      slides: g.video ? [{ kind: "video" as const, url: g.video.media_url }] : g.image ? [{ kind: "image" as const, url: g.image.media_url }] : [],
    }))
    .sort((a, b) => rank(a) - rank(b) || b.at - a.at);
}
const rank = (s: Status) => (!s.fresh ? 2 : s.seen ? 1 : 0);

const SEEN_KEY = "brief-status-seen";
export function readSeen(): Set<string> {
  try { return new Set(JSON.parse(localStorage.getItem(SEEN_KEY) ?? "[]") as string[]); } catch { return new Set(); }
}
export function writeSeen(keys: Set<string>) {
  try { localStorage.setItem(SEEN_KEY, JSON.stringify([...keys].slice(-200))); } catch { /* storage unavailable: statuses simply show as new again */ }
}

export const sinceLabel = (at: number, now = Date.now()) => {
  const m = Math.max(0, Math.floor((now - at) / 60_000));
  return m < 1 ? "now" : m < 60 ? `${m}m` : m < 1440 ? `${Math.round(m / 60)}h` : `${Math.round(m / 1440)}d`;
};
