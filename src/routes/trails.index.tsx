import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Search } from "lucide-react";
import { listTrails, trailNewCounts } from "@/lib/trends.functions";
import { useFollowed } from "@/lib/follow";
import { PageShell } from "@/components/PageShell";
import { AdSlot } from "@/components/AdSlot";
import { Sparkline } from "@/components/charts";
import { TrendingHistory } from "@/components/TrendingHistory";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { resolveEdition, validateEditionSearch } from "@/lib/editions";
import { t as translate } from "@/lib/i18n";
import { useT } from "@/lib/use-edition";
import { LEGAL } from "@/lib/legal";

export const Route = createFileRoute("/trails/")({
  validateSearch: validateEditionSearch,
  head: ({ match }) => {
    const ed = resolveEdition(match.search.e, match.context.visitorEdition);
    const lang = match.context.visitorLang ?? ed.lang;
    return { meta: [
      { title: `${translate(lang, "nav.trails")} — ${LEGAL.brand}` },
      { name: "description", content: translate(lang, "trl.intro") },
    ] };
  },
  component: TrailsPage,
});

function TrailsPage() {
  const { edition, e, t } = useT();
  const navigate = useNavigate();
  const [text, setText] = useState("");
  const trails = useQuery({ queryKey: ["trail-list", edition.code], queryFn: () => listTrails({ data: { edition: edition.code } }), staleTime: 5 * 60_000 });
  const { items: followed, ready } = useFollowed();
  const counts = useQuery({
    queryKey: ["follow-counts", followed.map((f) => `${f.key}@${f.seen}`).join("|")],
    queryFn: () => trailNewCounts({ data: { items: followed.map((f) => ({ key: f.key, query: f.query, since: f.seen })) } }),
    enabled: ready && followed.length > 0,
  });
  const go = (ev: React.FormEvent) => { ev.preventDefault(); if (text.trim().length >= 2) void navigate({ to: "/trails/search", search: { q: text.trim(), e } }); };

  return (
    <PageShell picker kicker={LEGAL.brand} title={t("trl.title")} accent={t("trl.accent")} intro={t("trl.intro")}>
      <AdSlot placement="trails_top" className="mt-4" />
      <main className="mx-auto max-w-6xl px-4 py-8">
        <form onSubmit={go} className="flex max-w-2xl gap-2">
          <Input value={text} onChange={(e) => setText(e.target.value)} placeholder={t("trl.placeholder")} className="rounded-none" aria-label={t("trl.topic")} maxLength={80} />
          <Button type="submit" className="rounded-none"><Search className="me-2 h-4 w-4" />{t("trl.trace")}</Button>
        </form>

        {followed.length > 0 && (
          <section className="mt-10">
            <h2 className="border-b-2 border-foreground pb-2 text-xl font-bold" style={{ fontFamily: "'Fraunces', serif" }}>{t("trl.followed")}</h2>
            <ul className="mt-3 divide-y divide-border">
              {followed.map((f) => {
                const n = counts.data?.[f.key] ?? 0;
                return (
                  <li key={f.key} className="flex items-center justify-between gap-3 py-3">
                    {f.slug ? <Link to="/trails/$slug" params={{ slug: f.slug }} className="font-semibold hover:text-primary">{f.title}</Link> : <Link to="/trails/search" search={{ q: f.query }} className="font-semibold hover:text-primary">{f.title}</Link>}
                    {n > 0 ? <span className="bg-primary px-2 py-0.5 text-xs font-bold text-primary-foreground">{t("trl.newCount", { n })}</span> : <span className="text-xs text-muted-foreground">{t("trl.nothingNew")}</span>}
                  </li>
                );
              })}
            </ul>
          </section>
        )}

        <TrendingHistory edition={edition} />

        <section className="mt-10">
          <h2 className="border-b-2 border-foreground pb-2 text-xl font-bold" style={{ fontFamily: "'Fraunces', serif" }}>{t("trl.featured")}</h2>
          {trails.isLoading ? <p className="py-10 text-center text-muted-foreground">{t("common.loading")}</p> : !(trails.data ?? []).length ? (
            <p className="mt-4 text-sm text-muted-foreground">{t("trl.none")}</p>
          ) : (
            <ul className="mt-4 grid gap-4 md:grid-cols-2">
              {(trails.data ?? []).map((tr) => (
                <li key={tr.slug} className="border border-border p-5">
                  <Link to="/trails/$slug" params={{ slug: tr.slug }} className="text-2xl font-black leading-tight hover:text-primary" style={{ fontFamily: "'Fraunces', serif" }}>{tr.title}</Link>
                  <p className="mt-2 text-sm text-muted-foreground">{tr.description}</p>
                  <div className="mt-4 flex items-end justify-between gap-4">
                    <p className="text-xs text-muted-foreground"><strong className="text-foreground">{tr.total.toLocaleString()}</strong> {t("trl.stories")}{tr.events ? <> · <strong className="text-foreground">{tr.events}</strong> {t("trl.milestones")}</> : null}</p>
                    <Sparkline values={tr.spark} label={tr.title} />
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      </main>
    </PageShell>
  );
}
