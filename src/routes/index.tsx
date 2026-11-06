import { StudioStrip } from "@/components/StudioStrip";
import { createFileRoute, Link } from "@tanstack/react-router";
import { queryOptions, useQuery, useSuspenseQuery } from "@tanstack/react-query";
import { Fragment, useMemo, useState } from "react";
import { AdSlot } from "@/components/AdSlot";
import { getNews } from "@/lib/news.functions";
import { Input } from "@/components/ui/input";
import { EditionPicker } from "@/components/EditionPicker";
import { resolveEdition, validateEditionSearch, WORLD } from "@/lib/editions";
import { categoryLabel, placeName, t as translate } from "@/lib/i18n";
import { useT } from "@/lib/use-edition";
import { ShareRow, StoryCard, StoryMeta, when } from "@/components/StoryCard";

const newsQuery = (edition: string) => queryOptions({
  queryKey: ["news", edition],
  queryFn: () => getNews({ data: { edition } }),
  refetchInterval: 5 * 60_000,
  staleTime: 60_000,
});

export const Route = createFileRoute("/")({
  validateSearch: validateEditionSearch,
  loaderDeps: ({ search }) => ({ e: search.e }),
  head: ({ match }) => {
    const ed = resolveEdition(match.search.e, match.context.visitorEdition);
    const lang = match.context.visitorLang ?? ed.lang;
    const place = placeName(ed, lang);
    const description = ed.code === WORLD ? translate(lang, "home.tagWorld") : translate(lang, "home.tagPlace", { where: place });
    const title = `Brief — ${ed.code === WORLD ? translate(lang, "home.tagWorld").split(" — ")[0] : place}`;
    return { meta: [
      { title }, { name: "description", content: description },
      { property: "og:title", content: title }, { property: "og:description", content: description },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ] };
  },
  loader: ({ context, deps }) => context.queryClient.ensureQueryData(newsQuery(resolveEdition(deps.e, context.visitorEdition).code)),
  component: Index,
});

const TIMES = [
  { key: "time.any", h: 0 },
  { key: "time.hour", h: 1 },
  { key: "time.today", h: 24 },
  { key: "time.week", h: 168 },
] as const;

function Chip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={`shrink-0 whitespace-nowrap border px-3 py-1 text-xs font-medium uppercase tracking-wide transition-colors ${
        active ? "border-foreground bg-foreground text-background" : "border-border text-muted-foreground hover:border-foreground hover:text-foreground"
      }`}
    >
      {children}
    </button>
  );
}

function Index() {
  const { edition, e, lang, t } = useT();
  const { data, refetch, isFetching } = useSuspenseQuery(newsQuery(edition.code));
  const [q, setQ] = useState("");
  const [cat, setCat] = useState("All");
  const [plat, setPlat] = useState("All");
  const [hours, setHours] = useState(0);

  const cats = useMemo(() => ["All", ...Array.from(new Set(data.items.map((i) => i.category))).sort()], [data]);
  // Only the sources this edition actually has, most common first.
  const plats = useMemo(() => {
    const count = new Map<string, number>();
    for (const i of data.items) count.set(i.platform, (count.get(i.platform) ?? 0) + 1);
    return ["All", ...[...count].sort((a, b) => b[1] - a[1]).map(([p]) => p)];
  }, [data]);

  const items = data.items.filter(
    (i) =>
      (cat === "All" || i.category === cat) &&
      (plat === "All" || i.platform === plat) &&
      (!hours || Date.now() - i.published < hours * 3600_000) &&
      (!q || `${i.title} ${i.summary} ${i.source}`.toLowerCase().includes(q.toLowerCase())),
  );
  const [lead, ...rest] = items;

  return (
    <div className="min-h-screen bg-background text-foreground" style={{ fontFamily: "'IBM Plex Sans', sans-serif" }}>
      <div className="flex h-1.5">
        <div className="flex-1 bg-foreground" />
        <div className="flex-1 bg-primary" />
        <div className="flex-1 bg-secondary" />
      </div>
      <header className="border-b-2 border-foreground">
        <div className="mx-auto flex max-w-6xl flex-wrap items-end justify-between gap-4 px-4 py-6">
          <div>
            <h1 className="text-5xl font-black leading-none md:text-6xl" style={{ fontFamily: "'Fraunces', serif" }}>
              <span className="text-primary">Brief</span>
            </h1>
            <p className="mt-2 text-sm text-muted-foreground">
              {edition.code === WORLD ? t("home.tagWorld") : t("home.tagPlace")}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
            <EditionPicker />
            <Link to="/trending" search={{ e }} className="border border-foreground px-3 py-1 font-semibold text-foreground hover:bg-foreground hover:text-background">{t("nav.trending")}</Link>
            <Link to="/trails" search={{ e }} className="border border-foreground px-3 py-1 font-semibold text-foreground hover:bg-foreground hover:text-background">{t("nav.trails")}</Link>
            <Link to="/brief" search={{ e }} className="bg-primary px-3 py-1 font-semibold text-primary-foreground hover:opacity-90">{t("nav.brief")}</Link>
            {edition.code === "KE" && <Link to="/manifestos" className="border border-foreground px-3 py-1 font-semibold text-foreground hover:bg-foreground hover:text-background">{t("nav.manifesto")}</Link>}
            <Link to="/buzz" search={{ e }} className="bg-secondary px-3 py-1 font-semibold text-secondary-foreground hover:opacity-90">{edition.code === "KE" ? t("nav.buzz") : t("buzz.name")}</Link>
            <span className="flex items-center gap-1.5">
              <span className="h-2 w-2 animate-pulse rounded-full bg-primary" /> {t("home.count", { n: data.items.length, when: when(data.fetchedAt, data.fetchedAt, lang) })}
            </span>
            <button onClick={() => refetch()} className="border border-foreground px-3 py-1 font-medium text-foreground hover:bg-foreground hover:text-background">
              {isFetching ? t("common.refreshing") : t("common.refresh")}
            </button>
          </div>
        </div>
      </header>

      <div className="z-10 border-b border-border bg-background/95 backdrop-blur md:sticky md:top-0">
        <div className="mx-auto max-w-6xl space-y-2 px-4 py-3">
          <Input placeholder={t("home.search")} value={q} onChange={(e) => setQ(e.target.value)} className="rounded-none" />
          <div className="flex gap-2 overflow-x-auto pb-1">
            {cats.map((c) => <Chip key={c} active={cat === c} onClick={() => setCat(c)}>{c === "All" ? t("common.all") : categoryLabel(lang, c)}</Chip>)}
          </div>
          <div className="flex gap-2 overflow-x-auto pb-1 md:flex-wrap">
            {plats.map((p) => <Chip key={p} active={plat === p} onClick={() => setPlat(p)}>{p === "All" ? t("common.all") : p}</Chip>)}
            <span className="mx-1 w-px shrink-0 bg-border" />
            {TIMES.map((x) => <Chip key={x.h} active={hours === x.h} onClick={() => setHours(x.h)}>{t(x.key)}</Chip>)}
          </div>
        </div>
      </div>

      <AdSlot placement="home_top" className="mt-4" />
      <main className="mx-auto max-w-6xl px-4 py-8">
        <StudioStrip edition={edition.code} />
        {!lead ? (
          <p className="py-20 text-center text-muted-foreground">{t("home.none")}</p>
        ) : (
          <>
            <div className="mb-8 border-b border-border pb-8">
              <a href={lead.link} target="_blank" rel="noreferrer" className="group block">
                 <StoryMeta i={lead} referenceTime={data.fetchedAt} />
                <h2 className="mt-2 text-3xl font-bold leading-tight group-hover:text-primary md:text-5xl" style={{ fontFamily: "'Fraunces', serif" }}>
                  {lead.title}
                </h2>
                {lead.summary && <p className="mt-3 max-w-3xl text-muted-foreground">{lead.summary}</p>}
              </a>
              <ShareRow i={lead} />
            </div>
            <div className="grid gap-x-8 gap-y-6 md:grid-cols-2 lg:grid-cols-3">
              {rest.map((i, n) => (
                <Fragment key={i.id}>
                {n > 0 && n % 9 === 0 && <div className="col-span-full"><AdSlot placement="home_inline" inline /></div>}
                <StoryCard i={{ ...i, id: i.id }} referenceTime={data.fetchedAt} />
                </Fragment>
              ))}
            </div>
          </>
        )}
      </main>
      {edition.code !== WORLD && <WorldStrip />}
      <AdSlot placement="home_bottom" className="mb-6" />
    </div>
  );
}

/** Below a country's stories: the world's top stories, so every visit ends with the bigger picture. */
function WorldStrip() {
  const { t } = useT();
  const q = useQuery({ ...newsQuery(WORLD), staleTime: 5 * 60_000 });
  const items = (q.data?.items ?? []).slice(0, 9);
  if (!items.length) return null;
  return (
    <section className="mx-auto max-w-6xl px-4 pb-10" aria-labelledby="world-strip-heading">
      <div className="flex items-end justify-between border-b-2 border-foreground pb-2">
        <h2 id="world-strip-heading" className="text-2xl font-bold" style={{ fontFamily: "'Fraunces', serif" }}>{t("home.worldStrip")}</h2>
        <Link to="/" search={{ e: WORLD }} className="text-xs font-semibold uppercase tracking-wider hover:text-primary">{t("home.allWorld")}</Link>
      </div>
      <div className="mt-5 grid gap-x-8 gap-y-6 md:grid-cols-2 lg:grid-cols-3">
        {items.map((i) => <StoryCard key={i.id} i={i} referenceTime={q.data!.fetchedAt} />)}
      </div>
      <p className="mt-6 text-xs text-muted-foreground"><Link to="/brief" search={{ e: WORLD }} className="underline underline-offset-4 hover:text-primary">{t("home.hearWorld")}</Link></p>
    </section>
  );
}
