import { createFileRoute, Link } from "@tanstack/react-router";
import { queryOptions, useSuspenseQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import { getNews } from "@/lib/news.functions";
import { signedShareText, waLink } from "@/lib/share";
import { AdSlot } from "@/components/AdSlot";
import { EditionPicker } from "@/components/EditionPicker";
import { resolveEdition, validateEditionSearch } from "@/lib/editions";
import { placeName, t as translate } from "@/lib/i18n";
import { useT } from "@/lib/use-edition";

const newsQuery = (edition: string) => queryOptions({ queryKey: ["news", edition], queryFn: () => getNews({ data: { edition } }), staleTime: 60_000 });

/** Kenya keeps its nickname; every other edition has a plain "Buzz Meter". */
const meterName = (code: string, lang: Parameters<typeof translate>[0]) => (code === "KE" ? "KOT Buzz Meter" : translate(lang, "buzz.name"));

export const Route = createFileRoute("/buzz")({
  validateSearch: validateEditionSearch,
  loaderDeps: ({ search }) => ({ e: search.e }),
  head: ({ match }) => {
    const ed = resolveEdition(match.search.e, match.context.visitorEdition);
    const lang = match.context.visitorLang ?? ed.lang;
    const title = `${meterName(ed.code, lang)} · ${placeName(ed, lang)} — Brief`;
    return { meta: [
      { title }, { name: "description", content: translate(lang, "buzz.intro", { place: placeName(ed, lang), where: placeName(ed, lang) }) },
      { property: "og:title", content: title }, { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" },
    ] };
  },
  loader: ({ context, deps }) => context.queryClient.ensureQueryData(newsQuery(resolveEdition(deps.e, context.visitorEdition).code)),
  component: BuzzPage,
});

const STOP = new Set("The A An And Or But Of In On At To For With By From As Is Are Was Were Be Has Have Had It Its This That These Those How Why What When Who Where After Before Over Into New Says Said Video Watch Live Le La Les Un Une Des Du De El Los Las Una Uno Del O Os As Um Uma".split(" "));
const WEIGHT: Record<string, number> = { "Viral (TikTok & X)": 3, Reddit: 2, YouTube: 1.5, "Google News": 1 };

type Row = { key: string; score: number; mentions: number; sources: Set<string>; recent: number; sample: { title: string; link: string } };

function BuzzPage() {
  const { edition, e, lang, t, place, where } = useT();
  const { data } = useSuspenseQuery(newsQuery(edition.code));
  const { topics, tags } = useMemo(() => {
    const topics = new Map<string, Row>(), tags = new Map<string, Row>();
    const own = new Set([edition.place, ...edition.place.split(" ")]); // the country's own name is in nearly every headline
    const add = (m: Map<string, Row>, key: string, i: (typeof data.items)[number]) => {
      const r = m.get(key.toLowerCase()) ?? { key, score: 0, mentions: 0, sources: new Set(), recent: 0, sample: { title: i.title, link: i.link } };
      const fresh = Date.now() - i.published < 6 * 3600_000;
      r.mentions++; r.sources.add(i.source); if (fresh) r.recent++;
      r.score += (WEIGHT[i.platform] ?? 1) * (fresh ? 1.5 : 1);
      m.set(key.toLowerCase(), r);
    };
    for (const i of data.items.filter((x) => Date.now() - x.published < 72 * 3600_000)) {
      const text = `${i.title} ${i.summary}`;
      new Set(text.match(/#[\p{L}][\p{L}\p{N}_]{2,}/gu) ?? []).forEach((h) => add(tags, h, i));
      // Topics are names that start with a capital letter. Arabic and Devanagari have no capitals, so those editions show hashtags only.
      const seen = new Set<string>();
      for (const m of i.title.matchAll(/(?<![\p{L}])(\p{Lu}[\p{Ll}'’]+(?:\s+\p{Lu}[\p{Ll}'’]+){0,2})(?![\p{L}])/gu)) {
        const k = (m[1] ?? "").split(/\s+/).filter((w) => !STOP.has(w) && !own.has(w)).join(" ");
        if (k.length < 4 || seen.has(k)) continue;
        seen.add(k); add(topics, k, i);
      }
    }
    const rank = (m: Map<string, Row>) => [...m.values()].filter((r) => r.mentions > 1 || r.key.startsWith("#")).map((r) => ({ ...r, score: r.score * (1 + r.sources.size / 4) })).sort((a, b) => b.score - a.score).slice(0, 20);
    return { topics: rank(topics), tags: rank(tags).slice(0, 12) };
  }, [data, edition]);
  const max = topics[0]?.score ?? 1;
  const name = meterName(edition.code, lang);
  const [first, ...rest] = name.split(" ");

  return (
    <div className="min-h-screen bg-background text-foreground" style={{ fontFamily: "'IBM Plex Sans', sans-serif" }}>
      <div className="flex h-1.5"><div className="flex-1 bg-foreground" /><div className="flex-1 bg-primary" /><div className="flex-1 bg-secondary" /></div>
      <AdSlot placement="buzz_top" className="mt-4" />
      <div className="mx-auto max-w-4xl px-4 py-8">
        <div className="flex flex-wrap items-center justify-between gap-3 text-xs font-semibold uppercase tracking-wider">
          <Link to="/" search={{ e }} className="hover:text-primary">{t("nav.allStories")}</Link>
          <EditionPicker />
        </div>
        <h1 className="mt-6 text-5xl font-black leading-none" style={{ fontFamily: "'Fraunces', serif" }}>{rest.length ? <>{first} <span className="text-primary">{rest.join(" ")}</span></> : <span className="text-primary">{first}</span>}</h1>
        <p className="mt-2 text-sm text-muted-foreground">{t("buzz.intro")}</p>

        {tags.length > 0 && (
          <section className="mt-8">
            <h2 className="border-b-2 border-foreground pb-1 text-xs font-bold uppercase tracking-widest">{t("buzz.hashtags")}</h2>
            <div className="mt-3 flex flex-wrap gap-2">
              {tags.map((x) => (
                <a key={x.key} href={x.sample.link} target="_blank" rel="noreferrer" className="border border-foreground px-3 py-1 text-sm font-semibold hover:bg-foreground hover:text-background">
                  {x.key} <span className="text-xs text-muted-foreground">· {x.mentions}</span>
                </a>
              ))}
            </div>
          </section>
        )}

        {topics.length > 0 ? (
          <section className="mt-8">
            <h2 className="border-b-2 border-foreground pb-1 text-xs font-bold uppercase tracking-widest">{t("buzz.topics")}</h2>
            <ol className="mt-3 space-y-4">
              {topics.map((x, n) => {
                const pct = Math.max(6, Math.round((x.score / max) * 100));
                const level = pct > 70 ? t("buzz.fire") : pct > 40 ? t("buzz.hot") : pct > 20 ? t("buzz.warm") : t("buzz.simmer");
                return (
                  <li key={x.key} className="grid grid-cols-[2rem_1fr] gap-3">
                    <span className="text-2xl font-black text-primary" style={{ fontFamily: "'Fraunces', serif" }}>{n + 1}</span>
                    <div>
                      <div className="flex flex-wrap items-baseline justify-between gap-2">
                        <span className="text-lg font-bold">{x.key}</span>
                        <span className="text-[11px] uppercase tracking-wider text-muted-foreground">
                          {level} · {x.mentions} {t("buzz.mentions")} · {x.sources.size} {t("buzz.sources")}{x.recent ? ` · ${t("buzz.recent", { n: x.recent })}` : ""}
                        </span>
                      </div>
                      <div className="mt-1 h-2 bg-muted"><div className="h-2 bg-primary" style={{ width: `${pct}%` }} /></div>
                      <div className="mt-1 flex gap-3 text-sm">
                        <a href={x.sample.link} target="_blank" rel="noreferrer" className="line-clamp-1 text-muted-foreground hover:text-primary">{x.sample.title}</a>
                        <a href={waLink(signedShareText(t("buzz.share", { topic: x.key, headline: x.sample.title }), x.sample.link, name))} target="_blank" rel="noreferrer" className="shrink-0 text-xs font-semibold text-secondary hover:underline">{t("common.whatsapp")}</a>
                      </div>
                    </div>
                  </li>
                );
              })}
            </ol>
          </section>
        ) : tags.length === 0 ? (
          <p className="mt-10 text-center text-muted-foreground">{t("buzz.nothing")}</p>
        ) : null}
      </div>
    </div>
  );
}
