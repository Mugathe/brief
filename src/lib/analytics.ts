/**
 * How visits are counted. One DEVICE (a browser) is one visitor, however many pages it opens.
 *  - visitors: distinct devices
 *  - visits:   distinct sessions (a device coming back later is a new visit)
 *  - views:    every page load, so one device can make many
 * On each page, every device is counted once, and its extra loads show separately as views.
 */
export type ViewRow = { visitor_id: string; session_id: string; path: string; referrer: string | null; country: string | null; device: string | null; created_at: string };
export type EventRow = { visitor_id: string; type: string; target: string | null; created_at: string };
export type Ranked = { label: string; visitors: number; views: number };

export const sectionOf = (path: string) =>
  path === "/" ? "Home" : path.startsWith("/brief") ? "Daily brief" : path.startsWith("/buzz") ? "KOT Buzz"
  : path === "/manifestos" ? "Manifesto Watch (list)" : path.startsWith("/manifestos/") ? "Manifesto profiles"
  : path.startsWith("/trending") ? "Trending" : path.startsWith("/trails") ? "Trails" : "Other";

/** Groups rows by key. `visitors` = distinct devices in the group, `views` = rows in the group. */
export function rank<T>(rows: T[], key: (r: T) => string | null | undefined, who: (r: T) => string, limit = 10, empty = "(direct)"): Ranked[] {
  const groups = new Map<string, { people: Set<string>; rows: number }>();
  for (const r of rows) {
    const k = key(r) || empty;
    const g = groups.get(k) ?? { people: new Set<string>(), rows: 0 };
    g.people.add(who(r)); g.rows++;
    groups.set(k, g);
  }
  return [...groups].map(([label, g]) => ({ label, visitors: g.people.size, views: g.rows }))
    .sort((a, b) => b.visitors - a.visitors || b.views - a.views || a.label.localeCompare(b.label)).slice(0, limit);
}

/** The first page load of each session: that is where a visit really starts. */
export function firstViews(v: ViewRow[]): ViewRow[] {
  const first = new Map<string, ViewRow>();
  for (const r of v) { const f = first.get(r.session_id); if (!f || r.created_at < f.created_at) first.set(r.session_id, r); }
  return [...first.values()];
}

export function summarize(v: ViewRow[], ev: EventRow[], days: number, now = Date.now()) {
  const devices = new Set(v.map((r) => r.visitor_id));
  const visits = new Set(v.map((r) => r.session_id));
  const sessionsByDevice = new Map<string, Set<string>>();
  for (const r of v) { const s = sessionsByDevice.get(r.visitor_id) ?? new Set<string>(); s.add(r.session_id); sessionsByDevice.set(r.visitor_id, s); }
  const returning = [...sessionsByDevice.values()].filter((s) => s.size > 1).length;

  const daily = new Map<string, { views: number; devices: Set<string> }>();
  for (let i = days - 1; i >= 0; i--) daily.set(new Date(now - i * 86400_000).toISOString().slice(0, 10), { views: 0, devices: new Set() });
  for (const r of v) { const d = daily.get(r.created_at.slice(0, 10)); if (d) { d.views++; d.devices.add(r.visitor_id); } }

  const starts = firstViews(v);
  const hourly = Array.from({ length: 24 }, (_, hour) => ({ hour, visits: 0 }));
  for (const r of starts) hourly[(new Date(r.created_at).getUTCHours() + 3) % 24]!.visits++; // East Africa Time

  const hourAgo = now - 3600_000;
  const recent = v.filter((r) => Date.parse(r.created_at) > hourAgo);
  const avgViewsPerHour = v.length / (days * 24);

  const ads = new Map<string, { views: number; clicks: number; seen: Set<string>; clicked: Set<string> }>();
  for (const e of ev) {
    if (e.type !== "ad_view" && e.type !== "ad_click") continue;
    const a = ads.get(e.target ?? "") ?? { views: 0, clicks: 0, seen: new Set<string>(), clicked: new Set<string>() };
    if (e.type === "ad_view") { a.views++; a.seen.add(e.visitor_id); } else { a.clicks++; a.clicked.add(e.visitor_id); }
    ads.set(e.target ?? "", a);
  }

  return {
    totals: {
      visitors: devices.size,
      returningVisitors: returning,
      newVisitors: devices.size - returning,
      visits: visits.size,
      views: v.length,
      viewsPerVisit: visits.size ? Math.round((v.length / visits.size) * 10) / 10 : 0,
      liveNow: new Set(v.filter((r) => Date.parse(r.created_at) > now - 5 * 60_000).map((r) => r.visitor_id)).size,
      lastHourViews: recent.length,
      lastHourVisitors: new Set(recent.map((r) => r.visitor_id)).size,
      avgViewsPerHour: Math.round(avgViewsPerHour * 10) / 10,
      shares: ev.filter((e) => e.type === "whatsapp_share" || e.type === "quote_card").length,
      audioPlays: ev.filter((e) => e.type === "audio_play").length,
      storyClicks: ev.filter((e) => e.type === "story_click").length,
    },
    daily: [...daily.entries()].map(([day, d]) => ({ day, views: d.views, visitors: d.devices.size })),
    hourly,
    sections: rank(v, (r) => sectionOf(r.path), (r) => r.visitor_id, 10),
    topPages: rank(v, (r) => r.path, (r) => r.visitor_id, 15),
    manifestoProfiles: rank(v.filter((r) => r.path.startsWith("/manifestos/") && r.path !== "/manifestos/submit"), (r) => r.path.replace("/manifestos/", ""), (r) => r.visitor_id, 10),
    // A visit's referrer is the same on every page of that visit, so count it once per visit.
    referrers: rank(starts, (r) => r.referrer, (r) => r.visitor_id, 10),
    countries: rank(v, (r) => r.country, (r) => r.visitor_id, 10, "(unknown)"),
    devices: rank(v, (r) => r.device, (r) => r.visitor_id, 10, "(unknown)"),
    events: rank(ev, (e) => e.type, (e) => e.visitor_id, 12),
    topStories: rank(ev.filter((e) => e.type === "story_click"), (e) => e.target, (e) => e.visitor_id, 10, "(unknown)"),
    ads: Object.fromEntries([...ads].map(([id, a]) => [id, { views: a.views, clicks: a.clicks, reach: a.seen.size, clickers: a.clicked.size }])) as Record<string, { views: number; clicks: number; reach: number; clickers: number }>,
    spike: recent.length > Math.max(50, avgViewsPerHour * 5),
  };
}
