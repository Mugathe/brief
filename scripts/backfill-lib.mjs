// Logic for filling the news archive with past years of headlines. Used by backfill.mjs and tested in src/test.
import { XMLParser } from "fast-xml-parser";

const DAY = 86400_000;
const iso = (ms) => new Date(ms).toISOString().slice(0, 10);
const utc = (s) => { const m = /^(\d{4})-(\d{2})(?:-(\d{2}))?$/.exec(s); if (!m) throw new Error(`Bad date "${s}". Use YYYY-MM or YYYY-MM-DD.`); return Date.UTC(+m[1], +m[2] - 1, m[3] ? +m[3] : 1); };

/** Month-sized windows from `from` up to `to` (end is exclusive, so "before" is the first day of the next month). */
export function monthWindows(from, to) {
  const out = [];
  const end = utc(typeof to === "string" ? to : iso(to)) + DAY; // include the final day
  let cur = utc(from);
  while (cur < end) {
    const d = new Date(cur);
    const next = Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 1);
    out.push({ after: iso(cur), before: iso(Math.min(next, end)) });
    cur = next;
  }
  return out;
}

/** Splits a window into two halves. Returns null when it is already a single day. */
export function splitWindow(w) {
  const a = utc(w.after), b = utc(w.before), days = Math.round((b - a) / DAY);
  if (days <= 1) return null;
  const mid = a + Math.floor(days / 2) * DAY;
  return [{ after: iso(a), before: iso(mid) }, { after: iso(mid), before: iso(b) }];
}

export function buildQuery(base, sites, w, addKenya = true) {
  const scope = sites.length ? ` (${sites.map((s) => `site:${s}`).join(" OR ")})` : addKenya ? " Kenya" : "";
  return `(${base})${scope} after:${w.after} before:${w.before}`;
}
export const rssUrl = (q) => `https://news.google.com/rss/search?q=${encodeURIComponent(q)}&hl=en-KE&gl=KE&ceid=KE:en`;

const parser = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: "@", trimValues: true });
const str = (v) => (typeof v === "string" ? v : typeof v === "number" ? String(v) : v && typeof v === "object" && "#text" in v ? String(v["#text"]) : "").trim();
const strip = (s) => s.replace(/<[^>]*>/g, " ").replace(/&nbsp;|&#160;/g, " ").replace(/&amp;/g, "&").replace(/&quot;/g, '"').replace(/&#39;|&apos;/g, "'").replace(/\s+/g, " ").trim();

/** Reads an RSS feed into rows ready for the news_archive table. Skips anything incomplete or in the future. */
export function parseRss(xml, now = Date.now()) {
  const doc = parser.parse(xml);
  const raw = [].concat(doc?.rss?.channel?.item ?? []);
  const rows = [];
  for (const it of raw) {
    const link = str(it.link);
    const source = strip(str(it.source));
    let title = strip(str(it.title));
    if (source && title.endsWith(` - ${source}`)) title = title.slice(0, -source.length - 3);
    const when = Date.parse(str(it.pubDate));
    if (!/^https?:\/\//i.test(link) || link.length > 1000 || title.length < 3 || Number.isNaN(when) || when > now + DAY) continue;
    const summary = strip(str(it.description)).slice(0, 600);
    rows.push({ link, title: title.slice(0, 400), summary: summary === title ? "" : summary, source: (source || "Google News").slice(0, 120), platform: "Google News (backfill)", category: "General", published_at: new Date(when).toISOString() });
  }
  return rows;
}

/**
 * Walks month by month, splitting any window that hit Google's ~100-result cap into smaller ones,
 * and hands every batch of rows to `write`. `state` remembers finished windows so a re-run resumes.
 */
export async function runBackfill({ query, sites = [], from, to, addKenya = true, delayMs = 3000, state = { done: [] }, fetchText, write, log = () => {}, sleep = (ms) => new Promise((r) => setTimeout(r, ms)), saveState = () => {}, cap = 90 }) {
  const stats = { requests: 0, rows: 0, windows: 0, skipped: 0, capped: 0 };
  const done = new Set(state.done);

  async function visit(w) {
    const id = `${w.after}..${w.before}`;
    if (done.has(id)) { stats.skipped++; return; }
    const q = buildQuery(query, sites, w, addKenya);
    stats.requests++;
    const rows = parseRss(await fetchText(rssUrl(q)));
    const halves = rows.length >= cap ? splitWindow(w) : null;
    if (halves) { log(`  ${id}: ${rows.length} results (near the cap), splitting`); await sleep(delayMs); for (const h of halves) await visit(h); return; }
    if (rows.length >= cap) { stats.capped++; log(`  ${id}: ${rows.length} results on a single day, some may be missing`); }
    if (rows.length) { await write(rows); stats.rows += rows.length; }
    stats.windows++;
    done.add(id); state.done = [...done]; saveState(state);
    log(`  ${id}: ${rows.length} headlines`);
    await sleep(delayMs);
  }

  for (const w of monthWindows(from, to)) await visit(w);
  return stats;
}

export function parseArgs(argv) {
  const out = { _: [] };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (!a.startsWith("--")) { out._.push(a); continue; }
    const key = a.slice(2), next = argv[i + 1];
    if (next === undefined || next.startsWith("--")) out[key] = true; else { out[key] = next; i++; }
  }
  return out;
}
