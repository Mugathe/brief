import type { Lang } from "./editions";
import { dateLocale, t } from "./i18n";

export const TREND_WINDOWS = [
  { id: "day", label: "Today", days: 1, vs: "yesterday" },
  { id: "week", label: "This week", days: 7, vs: "the week before" },
  { id: "month", label: "This month", days: 30, vs: "the month before" },
  { id: "year", label: "This year", days: 365, vs: "the year before" },
  { id: "all", label: "All time", days: 3650, vs: "" },
] as const;
export type TrendWindow = (typeof TREND_WINDOWS)[number]["id"];

export type Headline = { title: string; source: string; link: string; published_at: string };
/** A story from the archive. The extra fields are missing on a database that has not had the latest setup SQL, so readers fall back. */
export type TrailStory = Headline & { id: number; summary?: string; category?: string; platform?: string; edition?: string };
export type TrendTerm = {
  term: string; stories: number; sources: number; prev: number; growth: number; isNew: boolean;
  series: { bucket: string; stories: number }[]; samples: Headline[];
};
export type TrendingResult = {
  window: TrendWindow; days: number; most: TrendTerm[]; rising: TrendTerm[];
  archive: { total: number | null; since: string | null }; partial: boolean; unavailable: boolean; generatedAt: number;
};

export type TrailData = {
  query: string; since: string | null;
  volume: { month: string; stories: number; sources: number }[];
  stories: TrailStory[]; related: { term: string; stories: number }[];
  total: number; archiveSince: string | null; unavailable: boolean;
};

const iso = (d: Date) => d.toISOString().slice(0, 10);

/** The bucket start dates the database groups by, so charts can show empty periods as zero. */
export function bucketStarts(days: number, now = new Date()): string[] {
  const out: string[] = [];
  const end = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  const start = end - days * 86400_000;
  if (days <= 31) {
    for (let t = start + 86400_000; t <= end; t += 86400_000) out.push(iso(new Date(t)));
  } else if (days <= 120) {
    const s = new Date(start);
    let t = start - ((s.getUTCDay() + 6) % 7) * 86400_000; // Monday on or before
    for (; t <= end; t += 7 * 86400_000) out.push(iso(new Date(t)));
  } else {
    const s = new Date(start);
    let y = s.getUTCFullYear(), m = s.getUTCMonth();
    const e = new Date(end);
    while (y < e.getUTCFullYear() || (y === e.getUTCFullYear() && m <= e.getUTCMonth())) {
      out.push(iso(new Date(Date.UTC(y, m, 1))));
      if (++m > 11) { m = 0; y++; }
    }
  }
  return out;
}

export function fillSeries(raw: { bucket: string; stories: number }[], days: number, now = new Date()) {
  const by = new Map(raw.map((r) => [r.bucket, r.stories]));
  return bucketStarts(days, now).map((bucket) => ({ bucket, stories: by.get(bucket) ?? 0 }));
}

/** First-of-month dates from first to last, so a trail's volume chart has no gaps. */
export function fillMonths(raw: { month: string; stories: number; sources: number }[]) {
  if (!raw.length) return raw;
  const by = new Map(raw.map((r) => [r.month.slice(0, 7), r]));
  const first = raw[0]!.month, last = raw[raw.length - 1]!.month;
  let y = Number(first.slice(0, 4)), m = Number(first.slice(5, 7)) - 1;
  const ey = Number(last.slice(0, 4)), em = Number(last.slice(5, 7)) - 1;
  const out: typeof raw = [];
  while (y < ey || (y === ey && m <= em)) {
    const key = `${y}-${String(m + 1).padStart(2, "0")}`;
    out.push(by.get(key) ?? { month: `${key}-01`, stories: 0, sources: 0 });
    if (++m > 11) { m = 0; y++; }
  }
  return out;
}

export const growthOf = (stories: number, prev: number) => (stories - prev) / Math.max(prev, 2);

/* ---------------- Trending history (day by day, week by week, month by month) ---------------- */

/** How each view pages back through time: the first page, then every "Show earlier" click. */
export const HISTORY_UNITS = [
  { id: "day", key: "his.day", first: 8, next: 7, noun: "his.earlierDays" },
  { id: "week", key: "his.week", first: 5, next: 8, noun: "his.earlierWeeks" },
  { id: "month", key: "his.month", first: 6, next: 6, noun: "his.earlierMonths" },
] as const;
export type HistoryUnit = (typeof HISTORY_UNITS)[number]["id"];

export type HistoryTerm = { term: string; stories: number; sources: number };
export type HistoryPeriod = { start: string; terms: HistoryTerm[] };
export type TrendHistory = { unit: HistoryUnit; offset: number; periods: HistoryPeriod[]; archiveSince: string | null; unavailable: boolean };

export type HistoryRow = { period_start: string; term: string | null; stories: number | null; sources: number | null };

/** Folds the database rows (newest period first; empty periods have a null term) into one entry per period. */
export function groupHistory(rows: HistoryRow[]): HistoryPeriod[] {
  const out = new Map<string, HistoryPeriod>();
  for (const r of rows) {
    const p = out.get(r.period_start) ?? { start: r.period_start, terms: [] };
    if (r.term) p.terms.push({ term: r.term, stories: r.stories ?? 0, sources: r.sources ?? 0 });
    out.set(r.period_start, p);
  }
  return [...out.values()].sort((a, b) => (a.start < b.start ? 1 : -1));
}

const DAY = 86400_000;
const atUtc = (d: string) => Date.parse(`${d}T00:00:00Z`);

/** Calendar date and weekday (0 = Sunday) of an instant in a time zone. */
function localDate(now: Date, tz: string): { y: number; m: number; d: number; dow: number } {
  const parts = new Intl.DateTimeFormat("en-US", { timeZone: tz, year: "numeric", month: "numeric", day: "numeric", weekday: "short" }).formatToParts(now);
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "";
  return { y: Number(get("year")), m: Number(get("month")) - 1, d: Number(get("day")), dow: ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(get("weekday")) };
}

/** Start date (YYYY-MM-DD) of the day, week (Monday) or month that contains "now" in the given time zone. */
export function currentPeriodStart(unit: HistoryUnit, now = new Date(), tz = "UTC"): string {
  const { y, m, d, dow } = localDate(now, tz);
  if (unit === "month") return iso(new Date(Date.UTC(y, m, 1)));
  const day = Date.UTC(y, m, d);
  if (unit === "day") return iso(new Date(day));
  return iso(new Date(day - ((dow + 6) % 7) * DAY));
}

/** First date after the period (exclusive end). */
export function periodEnd(unit: HistoryUnit, start: string): string {
  const s = new Date(atUtc(start));
  if (unit === "day") return iso(new Date(s.getTime() + DAY));
  if (unit === "week") return iso(new Date(s.getTime() + 7 * DAY));
  return iso(new Date(Date.UTC(s.getUTCFullYear(), s.getUTCMonth() + 1, 1)));
}

const fmt = (d: string, o: Intl.DateTimeFormatOptions, lang: Lang = "en") => new Date(atUtc(d)).toLocaleDateString(dateLocale(lang), { timeZone: "UTC", ...o });

/** Start of the period just before the one starting on `start`. */
function previousStart(unit: HistoryUnit, start: string): string {
  const s = new Date(atUtc(start));
  if (unit === "day") return iso(new Date(s.getTime() - DAY));
  if (unit === "week") return iso(new Date(s.getTime() - 7 * DAY));
  return iso(new Date(Date.UTC(s.getUTCFullYear(), s.getUTCMonth() - 1, 1)));
}

/** Friendly heading for a period: "Yesterday", "Last week", "September 2026"... in the reader's language. */
export function periodLabel(unit: HistoryUnit, start: string, now = new Date(), tz = "UTC", lang: Lang = "en"): { title: string; sub: string } {
  const cur = currentPeriodStart(unit, now, tz);
  const isCurrent = start === cur;
  const isPrevious = start === previousStart(unit, cur);
  if (unit === "day") {
    const sub = fmt(start, { weekday: "long", day: "numeric", month: "long", year: "numeric" }, lang);
    if (isCurrent) return { title: t(lang, "his.today"), sub };
    if (isPrevious) return { title: t(lang, "his.yesterday"), sub };
    return { title: fmt(start, { weekday: "long", day: "numeric", month: "short" }, lang), sub: fmt(start, { year: "numeric" }, lang) };
  }
  if (unit === "week") {
    const last = iso(new Date(atUtc(start) + 6 * DAY));
    const range = t(lang, "his.to", { a: fmt(start, { day: "numeric", month: "short" }, lang), b: fmt(last, { day: "numeric", month: "short", year: "numeric" }, lang) });
    if (isCurrent) return { title: t(lang, "his.thisWeek"), sub: range };
    if (isPrevious) return { title: t(lang, "his.lastWeek"), sub: range };
    return { title: t(lang, "his.to", { a: fmt(start, { day: "numeric", month: "short" }, lang), b: fmt(last, { day: "numeric", month: "short" }, lang) }), sub: fmt(last, { year: "numeric" }, lang) };
  }
  const sub = fmt(start, { month: "long", year: "numeric" }, lang);
  if (isCurrent) return { title: t(lang, "his.thisMonth"), sub };
  if (isPrevious) return { title: t(lang, "his.lastMonth"), sub };
  return { title: fmt(start, { month: "long" }, lang), sub: fmt(start, { year: "numeric" }, lang) };
}

/** Where a period sits against the archive: before it began, partly covered, or fully covered. */
export function archiveCoverage(unit: HistoryUnit, start: string, archiveSince: string | null): "none" | "partial" | "full" {
  if (!archiveSince) return "none";
  const since = Date.parse(archiveSince);
  if (Number.isNaN(since)) return "full";
  if (atUtc(periodEnd(unit, start)) <= since) return "none";
  return atUtc(start) < since - DAY / 2 ? "partial" : "full";
}
