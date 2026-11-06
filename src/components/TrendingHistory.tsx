import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { useInfiniteQuery } from "@tanstack/react-query";
import { getTrendHistory } from "@/lib/trends.functions";
import { archiveCoverage, HISTORY_UNITS, periodLabel, type HistoryUnit } from "@/lib/trends";
import { Button } from "@/components/ui/button";
import type { Edition } from "@/lib/editions";
import { dateLocale } from "@/lib/i18n";
import { useT } from "@/lib/use-edition";

const heading = { fontFamily: "'Fraunces', serif" } as const;

/**
 * "What trended" going back in time: yesterday, every day of last week, then week by week and month by month.
 * Every word links to its trail, so a day's trend can be followed into the full story.
 */
export function TrendingHistory({ edition }: { edition: Edition }) {
  const { t, lang } = useT();
  const [unit, setUnit] = useState<HistoryUnit>("day");
  const cfg = HISTORY_UNITS.find((u) => u.id === unit)!;

  const q = useInfiniteQuery({
    queryKey: ["trend-history", edition.code, unit],
    initialPageParam: 0,
    queryFn: ({ pageParam }) => getTrendHistory({ data: { unit, offset: pageParam, periods: pageParam === 0 ? cfg.first : cfg.next, edition: edition.code } }),
    // Keep going back while the oldest period shown is fully inside the archive; older ones would be empty.
    getNextPageParam: (last, all) => {
      const loaded = all.reduce((n, p) => n + p.periods.length, 0);
      const oldest = last.periods.at(-1)?.start;
      if (last.unavailable || !oldest || loaded >= 400) return undefined;
      return archiveCoverage(unit, oldest, last.archiveSince) === "full" ? loaded : undefined;
    },
    staleTime: 5 * 60_000,
  });

  const periods = q.data?.pages.flatMap((p) => p.periods) ?? [];
  const since = q.data?.pages[0]?.archiveSince ?? null;
  const sinceText = since ? new Date(since).toLocaleDateString(dateLocale(lang), { day: "numeric", month: "long", year: "numeric" }) : null;
  const now = new Date();

  return (
    <section className="mt-10" aria-labelledby="trend-history-heading">
      <h2 id="trend-history-heading" className="border-b-2 border-foreground pb-2 text-xl font-bold" style={heading}>{t("his.heading", { view: t(cfg.key) })}</h2>
      <p className="mt-3 max-w-3xl text-sm text-muted-foreground">
        {t("his.intro", { zone: edition.code === "world" ? t("his.zoneUtc") : t("his.zone") })}
      </p>

      <nav className="mt-4 flex flex-wrap gap-2" aria-label={t("his.views")}>
        {HISTORY_UNITS.map((u) => (
          <button key={u.id} onClick={() => setUnit(u.id)} aria-pressed={unit === u.id} className={`border px-3 py-1.5 text-xs font-bold uppercase tracking-wide ${unit === u.id ? "border-foreground bg-foreground text-background" : "border-border text-muted-foreground hover:border-foreground hover:text-foreground"}`}>{t(u.key)}</button>
        ))}
      </nav>

      {q.isLoading ? <p className="py-10 text-center text-muted-foreground">{t("his.loading")}</p>
        : q.data?.pages[0]?.unavailable ? (
          <p className="mt-6 border border-dashed border-foreground p-6 text-center text-sm">{t("his.notReady")}</p>
        ) : (
          <>
            <ol className="mt-4 divide-y divide-border border-y border-border">
              {periods.map((p) => {
                const { title, sub } = periodLabel(unit, p.start, now, edition.tz, lang);
                const cover = archiveCoverage(unit, p.start, since);
                return (
                  <li key={p.start} className="grid gap-2 py-4 md:grid-cols-[12rem_1fr] md:gap-6">
                    <div>
                      <h3 className="font-bold leading-tight" style={heading}>{title}</h3>
                      <p className="text-xs text-muted-foreground">{sub}</p>
                    </div>
                    <div>
                      {p.terms.length > 0 ? (
                        <ul className="flex flex-wrap gap-2">
                          {p.terms.map((t, n) => (
                            <li key={t.term}>
                              <Link
                                to="/trails/search"
                                search={{ q: t.term }}
                                title={`${t.stories} ${t.stories === 1 ? "story" : "stories"} from ${t.sources} ${t.sources === 1 ? "outlet" : "outlets"}. Trace “${t.term}”`}
                                className={`inline-flex items-baseline gap-1.5 border px-2.5 py-1 text-sm capitalize hover:border-primary hover:text-primary ${n === 0 ? "border-foreground font-bold" : "border-border"}`}
                              >
                                {t.term}<span className="text-xs font-normal normal-case text-muted-foreground">{t.stories}</span>
                              </Link>
                            </li>
                          ))}
                        </ul>
                      ) : (
                        <p className="text-sm text-muted-foreground">
                          {cover === "none" ? t("his.before") : cover === "partial" ? t("his.partial") : t("his.nothing")}
                        </p>
                      )}
                      {p.terms.length > 0 && cover === "partial" && sinceText && (
                        <p className="mt-2 text-xs text-muted-foreground">{t("his.partialNote", { date: sinceText })}</p>
                      )}
                    </div>
                  </li>
                );
              })}
            </ol>
            {q.hasNextPage ? (
              <Button variant="outline" className="mt-4 rounded-none" onClick={() => void q.fetchNextPage()} disabled={q.isFetchingNextPage}>
                {q.isFetchingNextPage ? t("common.loading") : t("his.earlier", { unit: t(cfg.noun) })}
              </Button>
            ) : periods.length > 0 && sinceText ? (
              <p className="mt-4 text-xs text-muted-foreground">{t("his.farthest", { date: sinceText })}</p>
            ) : null}
          </>
        )}
    </section>
  );
}
