import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { ArrowUpRight, Flame, TrendingUp } from "lucide-react";
import { getTrending } from "@/lib/trends.functions";
import { getSocialPulse } from "@/lib/social.functions";
import { platformLabel } from "@/lib/social";
import { LEGAL } from "@/lib/legal";
import { TREND_WINDOWS, type TrendTerm, type TrendWindow } from "@/lib/trends";
import { signedShareText, waLink } from "@/lib/share";
import { useSiteUrl } from "@/lib/site-url";
import { PageShell } from "@/components/PageShell";
import { resolveEdition, validateEditionSearch, type Edition, type Lang } from "@/lib/editions";
import { dateLocale, placeName, t as translate } from "@/lib/i18n";
import { useT } from "@/lib/use-edition";
import { compact } from "@/lib/social-feeds";
import { AdSlot } from "@/components/AdSlot";
import { Sparkline } from "@/components/charts";
import { Button } from "@/components/ui/button";

const IDS = TREND_WINDOWS.map((w) => w.id) as readonly string[];

export const Route = createFileRoute("/trending")({
  validateSearch: (s: Record<string, unknown>): { w?: TrendWindow; e?: string | undefined } => ({
    ...(IDS.includes(String(s["w"])) ? { w: s["w"] as TrendWindow } : {}),
    ...validateEditionSearch(s),
  }),
  head: ({ match }) => {
    const ed = resolveEdition(match.search.e, match.context.visitorEdition);
    const lang = match.context.visitorLang ?? ed.lang;
    return { meta: [
      { title: `${translate(lang, "nav.trending")} · ${placeName(ed, lang)} — ${LEGAL.brand}` },
      { name: "description", content: translate(lang, "tr.intro") },
    ] };
  },
  component: TrendingPage,
});

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
const when = (iso: string, lang: Lang) => new Date(iso).toLocaleDateString(dateLocale(lang), { day: "numeric", month: "short" });

function TermCard({ t, n, windowLabel, vs, siteUrl }: { t: TrendTerm; n: number; windowLabel: string; vs: string; siteUrl: string }) {
  const { e, t: tr, lang } = useT();
  const change = t.isNew ? tr("tr.newPeriod") : tr("tr.vs", { pct: Math.round(t.growth * 100), vs });
  const text = tr("tr.share", { term: cap(t.term), window: windowLabel.toLowerCase(), stories: t.stories, sources: t.sources });
  return (
    <li className="border border-border p-4">
      <div className="flex flex-wrap items-start gap-x-4 gap-y-2">
        <span className="text-3xl font-black text-muted-foreground/40" style={{ fontFamily: "'Fraunces', serif" }}>{n}</span>
        <div className="min-w-0 flex-1">
          <h3 className="text-2xl font-black leading-tight" style={{ fontFamily: "'Fraunces', serif" }}>{cap(t.term)}</h3>
          <p className="mt-1 text-xs text-muted-foreground">
            <strong className="text-foreground">{t.stories}</strong> {tr("tr.stories")} · <strong className="text-foreground">{t.sources}</strong> {t.sources === 1 ? tr("tr.outlet") : tr("tr.outlets")}
            {t.prev > 0 || t.isNew ? <> · <span className={t.growth > 0 ? "font-semibold text-primary" : ""}>{vs ? change : ""}</span></> : null}
          </p>
        </div>
        <Sparkline values={t.series.map((s) => s.stories)} label={t.term} />
      </div>
      <ul className="mt-3 space-y-1.5 border-t border-border pt-3 text-sm">
        {t.samples.map((h) => (
          <li key={h.link}>
            <a href={h.link} target="_blank" rel="noreferrer noopener" data-track="story_click" data-track-target={h.link} className="group inline-flex items-start gap-1 hover:text-primary">
              <span>{h.title}</span><ArrowUpRight className="mt-0.5 h-3.5 w-3.5 shrink-0 opacity-50 group-hover:opacity-100" />
            </a>
            <span className="text-xs text-muted-foreground"> · {h.source} · {when(h.published_at, lang)}</span>
          </li>
        ))}
      </ul>
      <div className="mt-3 flex flex-wrap gap-3 text-xs font-semibold">
        <Link to="/trails/search" search={{ q: t.term, e }} className="underline underline-offset-4 hover:text-primary">{tr("tr.follow")}</Link>
        <a href={waLink(signedShareText(text, `${siteUrl}/trails/search?q=${encodeURIComponent(t.term)}`, tr("nav.trending")))} target="_blank" rel="noreferrer" className="text-muted-foreground hover:text-primary">{tr("tr.shareWa")}</a>
      </div>
    </li>
  );
}

function SocialPulse({ edition }: { edition: Edition }) {
  const { t, lang } = useT();
  const q = useQuery({ queryKey: ["social-pulse", edition.code], queryFn: () => getSocialPulse({ data: { edition: edition.code } }), staleTime: 10 * 60_000 });
  const board = q.data?.board ?? [], searching = q.data?.searching ?? [], youtube = q.data?.youtube ?? [], x = q.data?.x ?? [];
  if (!board.length && !searching.length && !youtube.length && !x.length) return null;
  const locale = dateLocale(lang);
  return (
    <section className="mt-12" aria-labelledby="pulse">
      <h2 id="pulse" className="border-b-2 border-foreground pb-2 text-2xl font-bold" style={{ fontFamily: "'Fraunces', serif" }}>{t("tr.beyond")}</h2>
      <div className="mt-5 grid gap-8 md:grid-cols-2">
        {board.length > 0 && (
          <div>
            <h3 className="text-xs font-bold uppercase tracking-widest">{t("tr.social")}</h3>
            <p className="mt-1 text-xs text-muted-foreground">{t("tr.socialNote")}</p>
            <ul className="mt-3 space-y-3">
              {board.map((i) => (
                <li key={i.id} className="text-sm">
                  <span className="me-2 bg-foreground px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-background">{platformLabel(i.platform)}</span>
                  {i.url ? <a href={i.url} target="_blank" rel="noreferrer noopener" className="font-semibold hover:text-primary">{i.topic} ↗</a> : <span className="font-semibold">{i.topic}</span>}
                  {i.note && <span className="block text-muted-foreground">{i.note}</span>}
                </li>
              ))}
            </ul>
          </div>
        )}
        {searching.length > 0 && (
          <div>
            <h3 className="text-xs font-bold uppercase tracking-widest">{t("tr.google")}</h3>
            <p className="mt-1 text-xs text-muted-foreground">{t("tr.googleNote")}</p>
            <ol className="mt-3 space-y-3">
              {searching.slice(0, 10).map((g, n) => (
                <li key={g.term} className="text-sm">
                  <span className="me-2 text-muted-foreground/60">{n + 1}</span><span className="font-semibold">{g.term}</span>
                  {g.traffic && <span className="ms-2 text-xs text-muted-foreground">{g.traffic} {t("tr.searches")}</span>}
                  {g.news && <a href={g.news.url} target="_blank" rel="noreferrer noopener" className="block text-xs text-muted-foreground hover:text-primary">{g.news.title}{g.news.source ? ` · ${g.news.source}` : ""} ↗</a>}
                </li>
              ))}
            </ol>
          </div>
        )}
        {x.length > 0 && (
          <div>
            <h3 className="text-xs font-bold uppercase tracking-widest">{t("tr.x")}</h3>
            <p className="mt-1 text-xs text-muted-foreground">{t("tr.xNote")}</p>
            <ol className="mt-3 space-y-2">
              {x.slice(0, 10).map((tr, n) => (
                <li key={tr.name} className="text-sm">
                  <span className="me-2 text-muted-foreground/60">{n + 1}</span>
                  <a href={tr.url} target="_blank" rel="noreferrer noopener" className="font-semibold hover:text-primary">{tr.name} ↗</a>
                  {tr.posts != null && <span className="ms-2 text-xs text-muted-foreground">{compact(tr.posts, locale)} {t("tr.posts")}</span>}
                </li>
              ))}
            </ol>
          </div>
        )}
        {youtube.length > 0 && (
          <div>
            <h3 className="text-xs font-bold uppercase tracking-widest">{t("tr.youtube")}</h3>
            <p className="mt-1 text-xs text-muted-foreground">{t("tr.youtubeNote")}</p>
            <ol className="mt-3 space-y-3">
              {youtube.slice(0, 6).map((v) => (
                <li key={v.id}>
                  <a href={v.url} target="_blank" rel="noreferrer noopener" className="group flex gap-3">
                    {v.thumbnail && <img src={v.thumbnail} alt="" loading="lazy" width={120} height={68} className="h-[68px] w-[120px] shrink-0 object-cover" />}
                    <span className="min-w-0 text-sm">
                      <span className="line-clamp-2 font-semibold group-hover:text-primary">{v.title}</span>
                      <span className="block text-xs text-muted-foreground">{v.channel}{v.views != null ? ` · ${compact(v.views, locale)} ${t("tr.views")}` : ""}</span>
                    </span>
                  </a>
                </li>
              ))}
            </ol>
          </div>
        )}
      </div>
      <p className="mt-4 text-xs text-muted-foreground">{t("tr.tip")} <a className="underline" href={`mailto:${LEGAL.email}?subject=${encodeURIComponent(t("tr.tipSubject"))}`}>{t("tr.tell")}</a>.</p>
    </section>
  );
}

function TrendingPage() {
  const search = Route.useSearch();
  const w: TrendWindow = search.w ?? "week";
  const { edition, e, lang, t, where } = useT();
  const navigate = useNavigate();
  const siteUrl = useSiteUrl();
  const [sort, setSort] = useState<"most" | "rising">("most");
  const win = TREND_WINDOWS.find((x) => x.id === w)!;
  const q = useQuery({ queryKey: ["trending", edition.code, w], queryFn: () => getTrending({ data: { window: w, edition: edition.code } }), staleTime: 5 * 60_000 });
  const list = sort === "most" ? q.data?.most : q.data?.rising;

  return (
    <PageShell picker kicker={LEGAL.brand} title={t("tr.title")} accent={t("tr.accent")} intro={t("tr.intro")}>
      <AdSlot placement="trending_top" className="mt-4" />
      <main className="mx-auto max-w-6xl px-4 py-8">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <nav className="flex flex-wrap gap-2" aria-label={t("tr.period")}>
            {TREND_WINDOWS.map((x) => (
              <button key={x.id} onClick={() => void navigate({ to: "/trending", search: { w: x.id, e } })} className={`border px-3 py-1.5 text-xs font-bold uppercase tracking-wide ${w === x.id ? "border-foreground bg-foreground text-background" : "border-border text-muted-foreground hover:border-foreground hover:text-foreground"}`}>{t(`win.${x.id}`)}</button>
            ))}
          </nav>
          <div className="flex gap-2" role="group" aria-label={t("tr.sort")}>
            <Button size="sm" variant={sort === "most" ? "default" : "outline"} className="rounded-none" onClick={() => setSort("most")}><Flame className="me-1 h-4 w-4" />{t("tr.most")}</Button>
            <Button size="sm" variant={sort === "rising" ? "default" : "outline"} className="rounded-none" onClick={() => setSort("rising")} disabled={w === "all"}><TrendingUp className="me-1 h-4 w-4" />{t("tr.rising")}</Button>
          </div>
        </div>

        {q.data?.partial && q.data.archive.since && (
          <p className="mt-4 border-s-4 border-secondary ps-3 text-sm text-muted-foreground">
            {t("tr.since", { date: new Date(q.data.archive.since).toLocaleDateString(dateLocale(lang), { day: "numeric", month: "long", year: "numeric" }), window: t(`win.${win.id}`).toLowerCase() })}
          </p>
        )}

        {q.isLoading ? <p className="py-20 text-center text-muted-foreground">{t("tr.analysing")}</p>
          : q.data?.unavailable ? (
            <p className="mt-8 border border-dashed border-foreground p-8 text-center text-sm">{t("tr.notReady")}</p>
          ) : !list?.length ? (
            <p className="mt-8 border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
              {sort === "rising" ? t("tr.nothingRising") : t("tr.notEnough")}
            </p>
          ) : (
            <ol className="mt-6 grid gap-4 md:grid-cols-2">
              {list.map((term, n) => <TermCard key={term.term} t={term} n={n + 1} windowLabel={t(`win.${win.id}`)} vs={win.id === "all" ? "" : t(`vs.${win.id}`)} siteUrl={siteUrl} />)}
            </ol>
          )}
        <SocialPulse edition={edition} />
        <p className="mt-8 text-xs text-muted-foreground">{t("tr.basis")}</p>
      </main>
    </PageShell>
  );
}
