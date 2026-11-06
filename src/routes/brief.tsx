import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { forwardRef, useEffect, useImperativeHandle, useMemo, useRef, useState } from "react";
import { Pause, Play, Radio, SkipBack, SkipForward, Square } from "lucide-react";
import { getBrief, type Brief, type Segment } from "@/lib/brief.functions";
import { createBulletinController, type BulletinController } from "@/lib/bulletin-audio";
import type { PlayerState } from "@/lib/bulletin-player";
import { shareQuoteCard, shareTags, signedShareText, waLink } from "@/lib/share";
import { useSiteUrl } from "@/lib/site-url";
import { Button } from "@/components/ui/button";
import { AdSlot } from "@/components/AdSlot";
import { recordEvent } from "@/lib/tracker";
import { EditionPicker } from "@/components/EditionPicker";
import { resolveEdition, validateEditionSearch, type Edition, type Lang } from "@/lib/editions";
import { useEditionState, useT } from "@/lib/use-edition";
import { bulletinParts, bulletinTitle, categoryLabel, dateLocale, t as translate } from "@/lib/i18n";
import { voiceLocale } from "@/lib/voice-locale";
import { LEGAL } from "@/lib/legal";

export const Route = createFileRoute("/brief")({
  validateSearch: validateEditionSearch,
  head: ({ match }) => {
    const ed = resolveEdition(match.search.e, match.context.visitorEdition);
    const lang = match.context.visitorLang ?? ed.lang;
    const title = `${bulletinTitle(ed, lang)} — ${LEGAL.brand}`;
    const description = `${bulletinTitle(ed, lang)} · ${translate(lang, "brief.sub", { brand: LEGAL.brand })}`;
    return { meta: [
      { title }, { name: "description", content: description },
      { property: "og:title", content: title }, { property: "og:description", content: description },
      { property: "og:type", content: "article" },
      { name: "twitter:card", content: "summary_large_image" },
    ] };
  },
  component: BriefPage,
});

const serif = { fontFamily: "'Fraunces', serif" };
const stories = (b: Brief) => b.segments.filter((s) => s.kind === "story");

const todayIn = (ed: Edition, lang: Lang) => new Date().toLocaleDateString(dateLocale(lang), { timeZone: ed.tz, weekday: "long", day: "numeric", month: "long" });

function briefText(b: Brief, site: string, ed: Edition, lang: Lang) {
  return signedShareText([`*${ed.flag} ${bulletinTitle(ed, lang)} — ${todayIn(ed, lang)}*`, "", ...stories(b).map((s, n) => `${n + 1}. ${s.title}`), "", `${site}/brief?e=${ed.code}`].join("\n"));
}

type Voice = "amani" | "baraka";

type PlayerHandle = { begin: (from: number) => void };

const Player = forwardRef<PlayerHandle, { brief: Brief; onState: (s: PlayerState) => void }>(function Player({ brief, onState }, ref) {
  const { t, edition, lang } = useT();
  const [voice, setVoice] = useState<Voice>("amani");
  const [state, setState] = useState<PlayerState>({ status: "idle", index: 0, total: brief.segments.length });
  const [deviceVoice, setDeviceVoice] = useState(false);
  const [error, setError] = useState("");
  const ctl = useRef<BulletinController | null>(null);

  const update = (s: PlayerState) => { setState(s); onState(s); };
  const stopAll = () => { ctl.current?.dispose(); ctl.current = null; };
  useEffect(() => stopAll, []);
  useEffect(() => { stopAll(); update({ status: "idle", index: 0, total: brief.segments.length }); setDeviceVoice(false); /* a fresh bulletin or voice starts clean */ }, [brief.generatedAt, voice]); // eslint-disable-line react-hooks/exhaustive-deps

  const begin = async (from = 0) => {
    setError("");
    try {
      if (!ctl.current) ctl.current = createBulletinController(brief.segments, voice, voiceLocale(edition, lang), update, () => setDeviceVoice(true));
      recordEvent("audio_play", `bulletin-${voice}`);
      await ctl.current.start(from);
    } catch {
      setError(t("brief.noAudio"));
    }
  };

  useImperativeHandle(ref, () => ({ begin: (from: number) => void begin(from) }));

  const playing = state.status === "playing", paused = state.status === "paused";
  const seg = brief.segments[state.index];
  const label = state.status === "idle" || state.status === "done" ? null : seg?.kind === "story" ? t("brief.storyOf", { n: brief.segments.slice(0, state.index + 1).filter((s) => s.kind === "story").length, total: stories(brief).length, title: seg.title }) : seg?.title;

  return (
    <div className="w-full border-2 border-foreground p-4" role="group" aria-label={t("brief.player")}>
      <div className="flex flex-wrap items-center gap-2">
        {playing || paused ? (
          <>
            <Button onClick={() => (playing ? ctl.current?.pause() : ctl.current?.resume())} className="rounded-none">{playing ? <><Pause className="me-2 h-4 w-4" />{t("brief.pause")}</> : <><Play className="me-2 h-4 w-4" />{t("brief.resume")}</>}</Button>
            <Button variant="outline" size="icon" className="rounded-none" aria-label={t("brief.previous")} onClick={() => ctl.current?.previous()}><SkipBack className="h-4 w-4" /></Button>
            <Button variant="outline" size="icon" className="rounded-none" aria-label={t("brief.next")} onClick={() => ctl.current?.next()}><SkipForward className="h-4 w-4" /></Button>
            <Button variant="outline" size="icon" className="rounded-none" aria-label={t("brief.stop")} onClick={() => ctl.current?.stop()}><Square className="h-4 w-4" /></Button>
          </>
        ) : (
          <Button onClick={() => void begin(0)} className="rounded-none"><Radio className="me-2 h-4 w-4" />{state.status === "done" ? t("brief.playAgain") : t("brief.listen")}</Button>
        )}
        <div className="ms-auto flex gap-1 text-xs" role="radiogroup" aria-label={t("brief.presenter")}>
          {(["amani", "baraka"] as const).map((v) => (
            <button key={v} role="radio" aria-checked={voice === v} onClick={() => setVoice(v)} className={`border px-3 py-1.5 font-semibold capitalize ${voice === v ? "border-foreground bg-foreground text-background" : "border-border text-muted-foreground hover:border-foreground"}`}>{v}</button>
          ))}
        </div>
      </div>
      <p className="mt-3 min-h-5 text-sm" aria-live="polite">{label ?? t("brief.about")}</p>
      {deviceVoice && <p className="mt-1 text-xs text-muted-foreground">{t("brief.device")}</p>}
      {error && <p role="alert" className="mt-2 text-sm font-semibold text-primary">{error}</p>}
    </div>
  );
});

function StoryCard({ s, n, active, onPlay, canPlay }: { s: Segment; n: number; active: boolean; onPlay: () => void; canPlay: boolean }) {
  const { t, lang } = useT();
  return (
    <article id={`story-${n}`} className={`scroll-mt-4 grid gap-x-5 border-t border-border py-6 md:grid-cols-[3.5rem_1fr] ${active ? "bg-accent/40 outline outline-2 outline-primary" : ""}`} aria-current={active || undefined}>
      <p className="text-4xl font-black text-muted-foreground/40" style={serif} aria-hidden>{n}</p>
      <div>
        {s.category && <p className="text-[11px] font-bold uppercase tracking-widest text-primary">{categoryLabel(lang, s.category)}</p>}
        <h2 className="mt-1 text-2xl font-black leading-tight" style={serif}>{s.title}</h2>
        <p className="mt-3 leading-relaxed">{s.detail ?? s.script}</p>
        {s.sources.length > 0 && (
          <p className="mt-3 text-xs text-muted-foreground">
            {t("brief.sources")} {s.sources.map((x, i) => <span key={x.link}>{i > 0 && ", "}<a href={x.link} target="_blank" rel="noreferrer noopener" data-track="story_click" data-track-target={x.link} className="underline hover:text-primary">{x.name} ↗</a></span>)}
          </p>
        )}
        <div className="mt-3 flex flex-wrap gap-4 text-xs font-semibold">
          {canPlay && <button onClick={onPlay} className="inline-flex items-center gap-1 text-primary hover:underline"><Play className="h-3.5 w-3.5" />{t("brief.playHere")}</button>}
          <a href={waLink(signedShareText(`${s.title}\n\n${s.detail ?? ""}`.trim(), s.sources[0]?.link, s.category))} target="_blank" rel="noreferrer" className="text-secondary hover:underline">{t("common.whatsapp")}</a>
          <button onClick={() => shareQuoteCard(s.title, s.sources[0]?.name || LEGAL.brand, s.category || "News")} className="text-muted-foreground hover:text-primary">{t("common.quoteCard")}</button>
        </div>
      </div>
    </article>
  );
}

function BriefPage() {
  const { edition, e, lang, t } = useT();
  const { data, isLoading, refetch, isFetching } = useQuery({ queryKey: ["brief", edition.code, lang], queryFn: () => getBrief({ data: { edition: edition.code, lang } }), staleTime: 10 * 60_000 });
  const site = useSiteUrl();
  const [state, setState] = useState<PlayerState>({ status: "idle", index: 0, total: 0 });
  const list = useMemo(() => (data ? stories(data) : []), [data]);
  const player = useRef<PlayerHandle>(null);
  const activeId = state.status === "playing" || state.status === "paused" ? data?.segments[state.index]?.id : undefined;

  return (
    <div className="min-h-screen bg-background text-foreground" style={{ fontFamily: "'IBM Plex Sans', sans-serif" }}>
      <div className="flex h-1.5"><div className="flex-1 bg-foreground" /><div className="flex-1 bg-primary" /><div className="flex-1 bg-secondary" /></div>
      <AdSlot placement="brief_top" className="mt-4" />
      <div className="mx-auto max-w-3xl px-4 py-8">
        <div className="flex items-center justify-between text-xs uppercase tracking-wider">
          <Link to="/" search={{ e }} className="font-semibold hover:text-primary">{t("nav.allStories")}</Link>
          <EditionPicker />
          <button onClick={() => refetch()} className="border border-foreground px-3 py-1 hover:bg-foreground hover:text-background">{isFetching ? t("common.writing") : t("common.refresh")}</button>
        </div>
        <h1 className="mt-6 text-5xl font-black leading-none" style={serif}>{bulletinParts(edition, lang).lead} <span className="text-primary">{bulletinParts(edition, lang).accent}</span></h1>
        <p className="mt-2 text-sm text-muted-foreground">{todayIn(edition, lang)} · {t("brief.sub", { brand: LEGAL.brand })}</p>

        {isLoading ? (
          <p className="py-20 text-center text-muted-foreground">{t("brief.reading")}</p>
        ) : data?.error ? (
          <p className="py-20 text-center text-muted-foreground">{data.error}</p>
        ) : data ? (
          <>
            <div className="mt-6"><Player ref={player} brief={data} onState={setState} /></div>
            <div className="mt-3 flex flex-wrap gap-2">
              <a href={waLink(briefText(data, site, edition, lang))} target="_blank" rel="noreferrer" className="bg-secondary px-4 py-2 text-sm font-semibold text-secondary-foreground hover:opacity-90">{t("brief.share")}</a>
            </div>
            {data.note && <p className="mt-3 text-xs text-muted-foreground">{data.note}</p>}

            <section className="mt-10" aria-labelledby="headlines">
              <h2 id="headlines" className="border-b-2 border-foreground pb-1 text-xs font-bold uppercase tracking-widest">{t("brief.headlines")}</h2>
              <ol className="mt-3 space-y-1.5 text-lg font-semibold leading-snug" style={serif}>
                {list.map((s, n) => <li key={s.id}><a href={`#${s.id}`} className="hover:text-primary"><span className="me-2 text-primary">{n + 1}.</span>{s.title}</a></li>)}
              </ol>
            </section>

            <div className="mt-10">
              {list.map((s, n) => (
                <div key={s.id} id={s.id} className="scroll-mt-6">
                  <StoryCard s={s} n={n + 1} active={activeId === s.id} canPlay={true} onPlay={() => { window.scrollTo({ top: 0, behavior: "smooth" }); player.current?.begin(data.segments.findIndex((x) => x.id === s.id)); }} />
                </div>
              ))}
            </div>
            <p className="mt-10 border-t border-border pt-4 text-xs text-muted-foreground">{t("brief.ai")} <Link to="/editorial" className="underline">{t("brief.aiLink")}</Link>. {shareTags()}</p>
          </>
        ) : null}
      </div>
      <AdSlot placement="brief_bottom" className="mb-8" />
    </div>
  );
}
