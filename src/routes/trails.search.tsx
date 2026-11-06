import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { Search } from "lucide-react";
import { searchTrail } from "@/lib/trends.functions";
import { PageShell } from "@/components/PageShell";
import { TrailView } from "@/components/TrailView";
import { AdSlot } from "@/components/AdSlot";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { validateEditionSearch } from "@/lib/editions";
import { useT } from "@/lib/use-edition";
import { LEGAL } from "@/lib/legal";

export const Route = createFileRoute("/trails/search")({
  validateSearch: (s: Record<string, unknown>): { q: string; e?: string | undefined } => ({ q: typeof s["q"] === "string" ? s["q"].trim().slice(0, 80) : "", ...validateEditionSearch(s) }),
  loaderDeps: ({ search }) => ({ q: search.q }),
  loader: ({ deps }) => (deps.q.length >= 2 ? searchTrail({ data: { q: deps.q } }) : null),
  head: ({ match }) => ({ meta: [{ title: `${match.search.q ? `“${match.search.q}” trail` : "Search the news trail"} — ${LEGAL.brand}` }] }),
  component: SearchPage,
});

function SearchPage() {
  const { q } = Route.useSearch();
  const { e, t } = useT();
  const data = Route.useLoaderData();
  const navigate = useNavigate();
  const [text, setText] = useState(q);
  const go = (ev: React.FormEvent) => { ev.preventDefault(); if (text.trim().length >= 2) void navigate({ to: "/trails/search", search: { q: text.trim(), e } }); };
  return (
    <PageShell picker kicker={t("ts.kicker")} title={t("ts.title")} accent={t("ts.accent")} intro={t("ts.intro")}>
      <AdSlot placement="trails_top" className="mt-4" />
      <main className="mx-auto max-w-6xl px-4 py-8">
        <form onSubmit={go} className="flex max-w-2xl gap-2">
          <Input value={text} onChange={(e) => setText(e.target.value)} placeholder={t("ts.placeholder")} className="rounded-none" aria-label={t("trl.topic")} maxLength={80} />
          <Button type="submit" className="rounded-none"><Search className="me-2 h-4 w-4" />{t("trl.trace")}</Button>
        </form>
        <div className="mt-8">
          {data ? <TrailView key={q} title={`“${q}”`} query={q} slug={null} data={data} events={[]} /> : <p className="text-sm text-muted-foreground">{t("ts.min")}</p>}
        </div>
      </main>
    </PageShell>
  );
}
