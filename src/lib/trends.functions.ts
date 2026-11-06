import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { fillMonths, fillSeries, groupHistory, growthOf, TREND_WINDOWS, type Headline, type TrailData, type TrendHistory, type TrendingResult, type TrendTerm } from "./trends";

import { cached } from "./trend-cache.server";
import { editionOf, parseEdition } from "./editions";

const edition = z.string().max(8).optional().transform((v) => parseEdition(v));

/** When the archive begins, and roughly how many stories it holds: for one edition, or for all of them when no code is given. */
async function archiveInfo(sb: Awaited<ReturnType<typeof client>>, code?: string) {
  let q = sb.from("news_archive").select("published_at", { count: "planned" });
  if (code) q = q.eq("edition", code);
  const { data, count } = await q.order("published_at", { ascending: true }).limit(1);
  return { since: data?.[0]?.published_at ?? null, total: count ?? null };
}
async function client() {
  const { publicClient } = await import("./public-client.server");
  return publicClient();
}

/* ---------------- Trending ---------------- */
export const getTrending = createServerFn({ method: "GET" })
  .inputValidator((d) => z.object({ window: z.enum(["day", "week", "month", "year", "all"]), edition }).parse(d))
  .handler(async ({ data }): Promise<TrendingResult> =>
    cached(`trend:${data.edition}:${data.window}`, async () => {
      const days = TREND_WINDOWS.find((w) => w.id === data.window)!.days;
      const empty: TrendingResult = { window: data.window, days, most: [], rising: [], archive: { total: null, since: null }, partial: false, unavailable: false, generatedAt: Date.now() };
      try {
        const sb = await client();
        const [{ data: rows, error }, info] = await Promise.all([sb.rpc("trending_terms", { _days: days, _limit: 150, _edition: data.edition }), archiveInfo(sb, data.edition)]);
        if (error) { console.error("[trends] trending_terms failed:", error.message); return { ...empty, unavailable: true }; }
        const all = (rows ?? []).map((r) => ({ term: r.term, stories: r.stories, sources: r.sources, prev: r.prev_stories, growth: growthOf(r.stories, r.prev_stories), isNew: r.prev_stories === 0 }));
        const most = all.filter((r) => r.stories >= 2).slice(0, 12);
        const rising = all
          .filter((r) => r.stories >= 3 && r.growth > 0.25 && (!r.isNew || r.stories >= 4))
          .sort((a, b) => b.growth - a.growth || b.stories - a.stories)
          .slice(0, 12);
        const chosen = [...new Map([...most, ...rising].map((r) => [r.term, r])).values()];
        const terms = chosen.map((r) => r.term);
        const since = new Date(Date.now() - days * 86400_000).toISOString();
        const [seriesRes, ...samples] = await Promise.all([
          terms.length ? sb.rpc("term_series", { _terms: terms, _days: days, _edition: data.edition }) : Promise.resolve({ data: [], error: null }),
          ...terms.map((t) =>
            sb.from("news_archive").select("title,source,link,published_at").eq("edition", data.edition).textSearch("tsv_title", t, { config: "simple", type: "plain" }).gte("published_at", since).order("published_at", { ascending: false }).limit(3),
          ),
        ]);
        const seriesBy = new Map<string, { bucket: string; stories: number }[]>();
        for (const r of seriesRes.data ?? []) seriesBy.set(r.term, [...(seriesBy.get(r.term) ?? []), { bucket: r.bucket, stories: r.stories }]);
        const full = new Map<string, TrendTerm>(
          chosen.map((r, n) => [r.term, { ...r, series: fillSeries(seriesBy.get(r.term) ?? [], days), samples: (samples[n]?.data ?? []) as Headline[] }]),
        );
        const pick = (list: typeof most) => list.map((r) => full.get(r.term)!).filter(Boolean);
        return {
          ...empty, most: pick(most), rising: pick(rising), archive: info,
          partial: !!info.since && Date.parse(info.since) > Date.now() - days * 86400_000 + 86400_000,
        };
      } catch (e) {
        console.error("[trends] failed:", e);
        return { ...empty, unavailable: true };
      }
    }),
  );

/* ---------------- Trails ---------------- */
async function trailData(query: string, since: string | null): Promise<TrailData> {
  const base: TrailData = { query, since, volume: [], stories: [], related: [], total: 0, archiveSince: null, unavailable: false };
  return cached(`trail:${query}|${since ?? ""}`, async () => {
    try {
      const sb = await client();
      const [vol, st, rel, info] = await Promise.all([
        sb.rpc("trail_volume", { _query: query, _since: since }),
        sb.rpc("trail_stories", { _query: query, _since: since, _per_month: 3, _max: 150 }),
        sb.rpc("trail_related", { _query: query, _since: since, _limit: 12 }),
        archiveInfo(sb),
      ]);
      if (vol.error) { console.error("[trails] volume failed:", vol.error.message); return { ...base, unavailable: true }; }
      const volume = fillMonths(vol.data ?? []);
      return {
        ...base, volume, total: (vol.data ?? []).reduce((n, r) => n + r.stories, 0),
        stories: (st.data ?? []) as TrailData["stories"], related: rel.data ?? [], archiveSince: info.since,
      };
    } catch (e) {
      console.error("[trails] failed:", e);
      return { ...base, unavailable: true };
    }
  });
}

export const searchTrail = createServerFn({ method: "GET" })
  .inputValidator((d) => z.object({ q: z.string().trim().min(2).max(80) }).parse(d))
  .handler(({ data }) => trailData(data.q, null));

export type TrailEvent = { id: string; event_date: string; title: string; summary: string; url: string | null; publisher: string };
export type TrailPage = { trail: { slug: string; title: string; description: string; query: string; since: string | null }; events: TrailEvent[]; data: TrailData };

export const getTrail = createServerFn({ method: "GET" })
  .inputValidator((d) => z.object({ slug: z.string().max(80) }).parse(d))
  .handler(async ({ data }): Promise<TrailPage | null> => {
    const sb = await client();
    const { data: trail } = await sb.from("trails").select("id,slug,title,description,query,since").eq("slug", data.slug).eq("published", true).maybeSingle();
    if (!trail) return null;
    const { data: events } = await sb.from("trail_events").select("id,event_date,title,summary,url,publisher").eq("trail_id", trail.id).order("event_date", { ascending: false });
    return { trail: { slug: trail.slug, title: trail.title, description: trail.description, query: trail.query, since: trail.since }, events: events ?? [], data: await trailData(trail.query, trail.since) };
  });

export type TrailCard = { slug: string; title: string; description: string; query: string; total: number; spark: number[]; events: number; lastDate: string | null };

/** The featured trails for an edition: those made for it and those made for every edition. */
export const listTrails = createServerFn({ method: "GET" })
  .inputValidator((d) => z.object({ edition }).parse(d ?? {}))
  .handler(async ({ data: input }): Promise<TrailCard[]> =>
  cached(`trail-list:${input.edition}`, async () => {
    try {
      const sb = await client();
      const base = () => sb.from("trails").select("id,slug,title,description,query,since").eq("published", true).order("title");
      const scoped = await base().or(`edition.is.null,edition.eq.${input.edition}`);
      // A database without the regions update has no edition column: show every trail, as before.
      const { data: trails } = scoped.error ? await base() : scoped;
      const { data: ev } = await sb.from("trail_events").select("trail_id");
      return Promise.all((trails ?? []).map(async (t) => {
        const d = await trailData(t.query, t.since);
        const last = d.volume.filter((v) => v.stories > 0).at(-1)?.month ?? null;
        return { slug: t.slug, title: t.title, description: t.description, query: t.query, total: d.total, spark: d.volume.slice(-24).map((v) => v.stories), events: (ev ?? []).filter((e) => e.trail_id === t.id).length, lastDate: last };
      }));
    } catch (e) {
      console.error("[trails] list failed:", e);
      return [];
    }
  }));

/** For "N new since you last looked" on followed trails. */
export const trailNewCounts = createServerFn({ method: "POST" })
  .inputValidator((d) => z.object({ items: z.array(z.object({ key: z.string().max(100), query: z.string().trim().min(2).max(200), since: z.string().max(40) })).max(20) }).parse(d))
  .handler(async ({ data }) => {
    const sb = await client();
    const out: Record<string, number> = {};
    await Promise.all(data.items.map(async (i) => {
      const ts = Number.isNaN(Date.parse(i.since)) ? new Date(Date.now() - 7 * 86400_000).toISOString() : new Date(i.since).toISOString();
      const { data: n } = await sb.rpc("trail_count_since", { _query: i.query, _ts: ts });
      out[i.key] = n ?? 0;
    }));
    return out;
  });

/* ---------------- Trending history: what trended in each past day, week or month ---------------- */
export const getTrendHistory = createServerFn({ method: "GET" })
  .inputValidator((d) =>
    z.object({
      unit: z.enum(["day", "week", "month"]),
      periods: z.number().int().min(1).max(30),
      offset: z.number().int().min(0).max(500),
      edition,
    }).parse(d),
  )
  .handler(async ({ data }): Promise<TrendHistory> =>
    cached(`history:${data.edition}:${data.unit}:${data.offset}:${data.periods}`, async () => {
      const empty: TrendHistory = { unit: data.unit, offset: data.offset, periods: [], archiveSince: null, unavailable: false };
      try {
        const sb = await client();
        const [{ data: rows, error }, info] = await Promise.all([
          sb.rpc("trending_history", { _unit: data.unit, _periods: data.periods, _offset: data.offset, _per: 8, _edition: data.edition, _tz: editionOf(data.edition).tz }),
          archiveInfo(sb, data.edition),
        ]);
        if (error) { console.error("[trends] trending_history failed:", error.message); return { ...empty, unavailable: true }; }
        return { ...empty, periods: groupHistory(rows ?? []), archiveSince: info.since };
      } catch (e) {
        console.error("[trends] history failed:", e);
        return { ...empty, unavailable: true };
      }
    }),
  );
