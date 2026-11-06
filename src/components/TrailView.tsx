import { Link } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowUpRight, Bell, BellOff, Flag } from "lucide-react";
import type { TrailData } from "@/lib/trends";
import type { TrailEvent } from "@/lib/trends.functions";
import { trailKey, useFollowed } from "@/lib/follow";
import { signedShareText, waLink } from "@/lib/share";
import { useSiteUrl } from "@/lib/site-url";
import { VolumeChart } from "@/components/charts";
import { AiHistory } from "@/components/AiHistory";
import { Button } from "@/components/ui/button";
import { StoryCard } from "@/components/StoryCard";
import { useT } from "@/lib/use-edition";
import { dateLocale } from "@/lib/i18n";
import type { Lang } from "@/lib/editions";

type Item =
  | { kind: "milestone"; date: string; title: string; summary: string; url: string | null; publisher: string; id: string }
  | { kind: "story"; date: string; title: string; source: string; link: string; id: string; published: number; summary: string; category: string; platform: string };

const fmtMonth = (d: string, lang: Lang) => new Date(d + "T00:00:00Z").toLocaleDateString(dateLocale(lang), { month: "long", year: "numeric", timeZone: "UTC" });
const fmtDay = (d: string, lang: Lang) => new Date(d.length === 10 ? d + "T00:00:00Z" : d).toLocaleDateString(dateLocale(lang), { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });
const serif = { fontFamily: "'Fraunces', serif" };

export function TrailView({ title, description, query, slug, data, events }: { title: string; description?: string; query: string; slug: string | null; data: TrailData; events: TrailEvent[] }) {
  const siteUrl = useSiteUrl();
  const { t, lang } = useT();
  const { items: followed, ready, follow, unfollow, markSeen } = useFollowed();
  const key = trailKey(slug, query);
  const isFollowing = followed.some((f) => f.key === key);
  // What the visitor had already seen before this visit, so new stories can be flagged.
  const seenBefore = useRef<string | null>(null);
  const [highlightAfter, setHighlightAfter] = useState<string | null>(null);

  useEffect(() => {
    if (!ready) return;
    const f = followed.find((x) => x.key === key);
    if (f && seenBefore.current === null) { seenBefore.current = f.seen; setHighlightAfter(f.seen); markSeen(key); }
  }, [ready, followed, key, markSeen]);

  const groups = useMemo(() => {
    const all: Item[] = [
      ...events.map((e): Item => ({ kind: "milestone", date: e.event_date, title: e.title, summary: e.summary, url: e.url, publisher: e.publisher, id: `e-${e.id}` })),
      ...data.stories.map((s): Item => ({ kind: "story", date: s.published_at.slice(0, 10), title: s.title, source: s.source, link: s.link, id: `s-${s.id}`, published: Date.parse(s.published_at), summary: s.summary ?? "", category: s.category ?? "General", platform: s.platform ?? "" })),
    ].sort((a, b) => b.date.localeCompare(a.date));
    const byMonth = new Map<string, Item[]>();
    for (const i of all) byMonth.set(i.date.slice(0, 7), [...(byMonth.get(i.date.slice(0, 7)) ?? []), i]);
    return [...byMonth.entries()];
  }, [events, data.stories]);

  const busiest = data.volume.reduce((b, v) => (v.stories > b.stories ? v : b), { month: "", stories: 0, sources: 0 });
  const first = data.volume.find((v) => v.stories > 0)?.month ?? null;
  const path = slug ? `/trails/${slug}` : `/trails/search?q=${encodeURIComponent(query)}`;
  const share = waLink(signedShareText(`*${title}*: follow the story through time`, siteUrl + path, "Trails"));

  return (
    <div>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="max-w-3xl">
          <h2 className="text-4xl font-black leading-tight md:text-5xl" style={serif}>{title}</h2>
          {description && <p className="mt-3 text-base leading-relaxed text-muted-foreground">{description}</p>}
        </div>
        <div className="flex flex-wrap gap-2">
          <Button className="rounded-none" variant={isFollowing ? "default" : "outline"} onClick={() => (isFollowing ? unfollow(key) : follow({ key, title, query, slug }))}>
            {isFollowing ? <BellOff className="me-2 h-4 w-4" /> : <Bell className="me-2 h-4 w-4" />}{isFollowing ? t("tv.following") : t("tv.follow")}
          </Button>
          <Button asChild variant="outline" className="rounded-none"><a href={share} target="_blank" rel="noreferrer">{t("tv.share")}</a></Button>
        </div>
      </div>
      {!isFollowing && <p className="mt-2 text-xs text-muted-foreground">{t("tv.privacy")}</p>}

      {data.unavailable ? (
        <p className="mt-8 border border-dashed border-foreground p-8 text-center text-sm">{t("tv.notReady")}</p>
      ) : (
        <>
          <dl className="mt-8 grid gap-px border border-border bg-border sm:grid-cols-2 lg:grid-cols-4">
            {[
              [t("tv.statStories"), data.total.toLocaleString()],
              [t("tv.statMilestones"), String(events.length)],
              [t("tv.statBusiest"), busiest.stories ? `${fmtMonth(busiest.month, lang)} (${busiest.stories})` : "—"],
              [t("tv.statFirst"), first ? fmtMonth(first, lang) : "—"],
            ].map(([k, v]) => (
              <div key={k} className="bg-background p-4"><dt className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">{k}</dt><dd className="mt-1 text-lg font-bold">{v}</dd></div>
            ))}
          </dl>

          {data.volume.length > 0 && (
            <section className="mt-8">
              <h3 className="text-xs font-bold uppercase tracking-widest">{t("tv.volume")}</h3>
              <div className="mt-3"><VolumeChart data={data.volume} /></div>
            </section>
          )}

          {data.archiveSince && (
            <p className="mt-6 border-s-4 border-secondary ps-3 text-sm text-muted-foreground">
              {t("tv.since", { date: fmtDay(data.archiveSince, lang) })}
            </p>
          )}

          {data.related.length > 0 && (
            <section className="mt-8">
              <h3 className="text-xs font-bold uppercase tracking-widest">{t("tv.branch")}</h3>
              <div className="mt-3 flex flex-wrap gap-2">
                {data.related.map((r) => (
                  <Link key={r.term} to="/trails/search" search={{ q: r.term }} className="border border-border px-2.5 py-1 text-sm hover:border-foreground hover:text-primary">{r.term} <span className="text-xs text-muted-foreground">{r.stories}</span></Link>
                ))}
              </div>
            </section>
          )}

          <section className="mt-10">
            <h3 className="border-b-2 border-foreground pb-2 text-2xl font-bold" style={serif}>{t("tv.trail")}</h3>
            {groups.length === 0 ? (
              <p className="mt-6 text-sm text-muted-foreground">{t("tv.empty")}</p>
            ) : (
              <ol className="mt-2">
                {groups.map(([month, list]) => (
                  <li key={month} className="grid gap-x-6 border-b border-border py-5 md:grid-cols-[10rem_1fr]">
                    <h4 className="text-sm font-bold uppercase tracking-wider text-primary">{fmtMonth(month + "-01", lang)}</h4>
                    <ul className="mt-2 grid gap-x-8 gap-y-6 md:mt-0 md:grid-cols-2">
                      {list.map((i) => {
                        const fresh = highlightAfter !== null && i.date > highlightAfter.slice(0, 10);
                        return i.kind === "milestone" ? (
                          <li key={i.id} className="border-s-4 border-primary bg-accent/40 p-3 md:col-span-2">
                            <p className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-primary"><Flag className="h-3.5 w-3.5" />{t("tv.milestone")} · {fmtDay(i.date, lang)}</p>
                            <p className="mt-1 font-semibold leading-snug">{i.url ? <a href={i.url} target="_blank" rel="noreferrer noopener" className="hover:text-primary">{i.title}<ArrowUpRight className="ms-0.5 inline h-3.5 w-3.5" /></a> : i.title}</p>
                            {i.summary && <p className="mt-1 text-sm text-muted-foreground">{i.summary}</p>}
                            {i.publisher && <p className="mt-1 text-xs text-muted-foreground">Source: {i.publisher}</p>}
                          </li>
                        ) : (
                          <li key={i.id}>
                            <StoryCard i={i} referenceTime={i.published} fresh={fresh} dateOnly />
                          </li>
                        );
                      })}
                    </ul>
                  </li>
                ))}
              </ol>
            )}
          </section>

          <AiHistory query={query} />
        </>
      )}
    </div>
  );
}
