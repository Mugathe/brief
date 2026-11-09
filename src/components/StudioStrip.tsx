import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { listPublishedStudio } from "@/lib/studio-db";
import { IMAGE_MS, readSeen, sinceLabel, toStatuses, writeSeen, type Status } from "@/lib/studio-status";
import { categoryLabel } from "@/lib/i18n";
import { shareLinks, shareStatus, shareText } from "@/lib/studio-share";
import { useT } from "@/lib/use-edition";

const HOLD_MS = 220;
/** A slide that "ends" sooner than this did not really play (a broken file can end at once), so it must not rush the viewer on. */
const MIN_SLIDE_MS = 700;
const SERIF = "'Fraunces', Georgia, serif";
const absolute = (link: string) => `${window.location.origin}${link.startsWith("/brief") ? link : "/brief"}`; // only our own Read the Brief page, whatever is stored

/**
 * A full-screen viewer in the style of WhatsApp Status: bars along the top, tap to move, hold to pause, swipe down or Esc to close. No player controls.
 * It deliberately never touches the browser's history: the router wraps history.pushState, so adding an entry made it reload the page underneath
 * and the viewer vanished the moment it opened.
 */
function StatusViewer({ statuses, start, onClose, onSeen }: { statuses: Status[]; start: number; onClose: () => void; onSeen: (key: string) => void }) {
  const { t, lang } = useT();
  const [si, setSi] = useState(start);
  const [pi, setPi] = useState(0);
  const [progress, setProgress] = useState(0);
  const [paused, setPaused] = useState(false);
  const [muted, setMuted] = useState(false);
  const [sheet, setSheet] = useState(false);
  const [copied, setCopied] = useState(false);
  const [ready, setReady] = useState(false); // the reel is actually playing
  const [failed, setFailed] = useState(false); // the reel cannot be played: show its picture instead, never skip past it
  const [needsTap, setNeedsTap] = useState(false); // the browser wants a tap before it will play
  const stopped = paused || sheet; // held by a finger, or the share sheet is open
  const elapsed = useRef(0);
  const startedAt = useRef(0);
  const video = useRef<HTMLVideoElement>(null);
  const closeBtn = useRef<HTMLButtonElement>(null);
  const press = useRef<{ x: number; y: number; held: boolean; timer: ReturnType<typeof setTimeout> | undefined }>({ x: 0, y: 0, held: false, timer: undefined });
  const status = statuses[si]!;
  const slide = status.slides[pi]!;
  const timed = slide.kind === "image" || failed; // pictures, and reels that would not play, run on a timer

  const next = useCallback(() => {
    if (pi < status.slides.length - 1) setPi(pi + 1);
    else if (si < statuses.length - 1) { setSi(si + 1); setPi(0); }
    else onClose();
  }, [pi, si, status.slides.length, statuses.length, onClose]);
  const prev = useCallback(() => {
    if (pi > 0) setPi(pi - 1);
    else if (si > 0) { setSi(si - 1); setPi(0); }
    else setProgress(0);
  }, [pi, si]);
  const autoNext = useCallback(() => { if (Date.now() - startedAt.current >= MIN_SLIDE_MS) next(); }, [next]);

  useEffect(() => { onSeen(status.key); }, [status.key, onSeen]);
  useEffect(() => { elapsed.current = 0; startedAt.current = Date.now(); setProgress(0); setReady(false); setFailed(false); setNeedsTap(false); }, [si, pi]);
  useEffect(() => { closeBtn.current?.focus(); const o = document.body.style.overflow; document.body.style.overflow = "hidden"; return () => { document.body.style.overflow = o; }; }, []);
  useEffect(() => {
    const key = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); else if (e.key === "ArrowRight") next(); else if (e.key === "ArrowLeft") prev(); };
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  }, [next, prev, onClose]);

  // Pictures run on a timer; reels run for as long as they are, and move on when they end.
  useEffect(() => {
    if (!timed) return;
    let last = performance.now(), raf = 0;
    const tick = (now: number) => {
      if (!stopped) elapsed.current += Math.min(Math.max(now - last, 0), 100); // kept in a ref so pausing and resuming carries on where it was; one odd frame can never skip a slide
      last = now;
      setProgress(Math.min(1, elapsed.current / IMAGE_MS));
      if (elapsed.current >= IMAGE_MS) next(); else raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [timed, slide, stopped, next]);
  useEffect(() => {
    const v = video.current;
    if (!v || timed) return;
    if (stopped) { v.pause(); return; }
    // Sound is allowed because the viewer opened from a tap. If a browser still refuses, try silently, then ask for a tap. Never skip the story.
    v.play().catch((e: unknown) => {
      if (e instanceof DOMException && e.name === "AbortError") return; // interrupted by a pause or a reload: not a failure
      if (!v.muted) { v.muted = true; setMuted(true); v.play().catch(() => setNeedsTap(true)); } else setNeedsTap(true);
    });
  }, [timed, slide, stopped]);

  const doShare = async () => {
    setPaused(true);
    const url = absolute(status.link), text = shareText(status.caption, status.title, url);
    const out = await shareStatus({ title: status.title, text, url, media: slide });
    if (out === "needs-sheet") setSheet(true);
    setPaused(false);
  };
  const copy = async () => {
    try { await navigator.clipboard.writeText(absolute(status.link)); setCopied(true); setTimeout(() => setCopied(false), 2000); } catch { /* clipboard blocked: the links above still work */ }
  };

  const down = (e: React.PointerEvent) => {
    const p = press.current;
    p.x = e.clientX; p.y = e.clientY; p.held = false;
    p.timer = setTimeout(() => { p.held = true; setPaused(true); }, HOLD_MS);
  };
  const up = (e: React.PointerEvent) => {
    const p = press.current;
    clearTimeout(p.timer);
    if (p.held) { setPaused(false); return; }
    if (e.clientY - p.y > 90 && Math.abs(e.clientX - p.x) < 60) { onClose(); return; }
    if (Math.abs(e.clientX - p.x) > 20 || Math.abs(e.clientY - p.y) > 20) return;
    const box = (e.currentTarget as HTMLElement).getBoundingClientRect();
    if (e.clientX - box.left < box.width * 0.33) prev(); else next();
  };

  return (
    <div role="dialog" aria-modal="true" aria-label={status.title} className="fixed inset-0 z-[100] flex items-center justify-center bg-black text-white">
      <div className="relative h-full w-full max-w-[480px] select-none overflow-hidden bg-black">
        {slide.kind === "video" && !failed && (
          <>
            {/* The picture sits behind the reel until it is playing, so there is never a black flash. */}
            {status.cover && !ready && <img src={status.cover} alt="" draggable={false} className="absolute inset-0 h-full w-full scale-110 object-cover opacity-40 blur-md" />}
            <video
              key={slide.url} ref={video} src={slide.url} playsInline muted={muted} preload="auto" disablePictureInPicture controlsList="nodownload noremoteplayback"
              onPlaying={() => { setReady(true); setNeedsTap(false); }}
              onError={() => setFailed(true)}
              onTimeUpdate={(e) => { const v = e.currentTarget; if (v.duration && Number.isFinite(v.duration)) setProgress(v.currentTime / v.duration); }}
              onEnded={(e) => { if (e.currentTarget.currentTime >= 0.3) autoNext(); }}
              className={`absolute inset-0 h-full w-full object-contain transition-opacity duration-200 ${ready ? "opacity-100" : "opacity-0"}`}
            />
          </>
        )}
        {(slide.kind === "image" || failed) && (status.cover || slide.kind === "image") && (
          <img key={slide.url} src={slide.kind === "image" ? slide.url : status.cover!} alt={status.title} draggable={false} className="absolute inset-0 h-full w-full object-contain" />
        )}
        {failed && <p className="absolute inset-x-0 top-1/2 px-6 text-center text-sm text-white/80">This reel could not be played.</p>}

        <div className="absolute inset-x-0 top-0 h-28 bg-gradient-to-b from-black/70 to-transparent" aria-hidden />
        <div className="absolute inset-x-0 bottom-0 h-40 bg-gradient-to-t from-black/80 to-transparent" aria-hidden />

        {/* Tap, hold and swipe surface. The buttons and link sit above it. */}
        <div className="absolute inset-0 touch-pan-x" onPointerDown={down} onPointerUp={up} onPointerCancel={() => { clearTimeout(press.current.timer); setPaused(false); }} />

        {needsTap && !failed && (
          <button type="button" aria-label="Play" onClick={() => { setNeedsTap(false); video.current?.play().catch(() => setFailed(true)); }} className="absolute left-1/2 top-1/2 z-20 grid h-20 w-20 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full bg-white/90 text-3xl text-black">▶</button>
        )}

        <div className="pointer-events-none absolute inset-x-0 top-0 px-3 pt-[max(0.75rem,env(safe-area-inset-top))]">
          <div className="flex gap-1" aria-hidden>
            {status.slides.map((_, n) => (
              <div key={n} className="h-[3px] flex-1 overflow-hidden rounded-full bg-white/35">
                <div className="h-full bg-white" style={{ width: `${n < pi ? 100 : n === pi ? Math.round(progress * 100) : 0}%` }} />
              </div>
            ))}
          </div>
          <div className="mt-3 flex items-center gap-3">
            {status.cover && <img src={status.cover} alt="" className="h-9 w-9 rounded-full border border-white/60 object-cover" />}
            <div className="min-w-0 flex-1 leading-tight">
              <p className="truncate text-sm font-bold">{status.category ? categoryLabel(lang, status.category) : "Brief"}</p>
              <p className="text-xs text-white/70">{sinceLabel(status.at)}</p>
            </div>
            {slide.kind === "video" && !failed && (
              <button type="button" onClick={() => { const m = !muted; setMuted(m); if (video.current) video.current.muted = m; }} aria-label={muted ? "Turn sound on" : "Turn sound off"} className="pointer-events-auto grid h-10 w-10 place-items-center rounded-full bg-black/40 text-lg">{muted ? "🔇" : "🔊"}</button>
            )}
            <button type="button" onClick={() => void doShare()} aria-label={t("home.share")} className="pointer-events-auto grid h-10 w-10 place-items-center rounded-full bg-black/40 text-lg">↗</button>
            <button ref={closeBtn} type="button" onClick={onClose} aria-label="Close" className="pointer-events-auto grid h-10 w-10 place-items-center rounded-full bg-black/40 text-xl">✕</button>
          </div>
        </div>

        <div className="pointer-events-none absolute inset-x-0 bottom-0 px-4 pb-[max(1.25rem,env(safe-area-inset-bottom))]">
          <p className="mb-3 line-clamp-2 text-base font-bold leading-snug drop-shadow">{status.title}</p>
          {status.link.startsWith("/brief") && <a href={status.link} className="pointer-events-auto inline-block bg-white px-4 py-2 text-sm font-bold text-black">{t("nav.brief")} →</a>}
        </div>

        {sheet && (
          <div className="absolute inset-x-0 bottom-0 z-30 border-t border-white/20 bg-neutral-900 p-4 pb-[max(1rem,env(safe-area-inset-bottom))]" role="group" aria-label={t("home.share")}>
            <div className="mb-3 flex items-center justify-between"><p className="text-sm font-bold">{t("home.share")}</p><button type="button" onClick={() => setSheet(false)} aria-label="Close" className="px-2 text-lg">✕</button></div>
            {(() => {
              const url = absolute(status.link), links = shareLinks(shareText(status.caption, status.title, url), url);
              const cls = "block border border-white/30 px-3 py-2 text-center text-sm font-semibold";
              return (
                <div className="grid grid-cols-2 gap-2">
                  <a className={cls} href={links.whatsapp} target="_blank" rel="noopener noreferrer">WhatsApp</a>
                  <a className={cls} href={links.facebook} target="_blank" rel="noopener noreferrer">Facebook</a>
                  <a className={cls} href={links.x} target="_blank" rel="noopener noreferrer">X</a>
                  <button type="button" className={cls} onClick={() => void copy()}>{copied ? "✓" : t("home.copyLink")}</button>
                </div>
              );
            })()}
          </div>
        )}
      </div>
    </div>
  );
}

/** What a portrait tile shows. Auto-made stories get a miniature of the reel's own card, built from the text, so it costs no download and
 *  can be read at a glance. Footage with an overlay shows one frame of the video instead. */
function Peek({ s, lang }: { s: Status; lang: string }) {
  const reel = s.slides[0]?.kind === "video" ? s.slides[0].url : null;
  if (s.style === "overlay" && reel) return <video src={`${reel}#t=1`} muted playsInline preload="metadata" aria-hidden className="h-full w-full object-cover" />;
  return (
    <span className="relative flex h-full w-full flex-col bg-[#111111] px-2 pb-2 pt-3 text-left text-[#f5f1e8]">
      <span className="absolute inset-x-0 top-0 flex h-[3px]" aria-hidden><i className="flex-1 bg-[#f5f1e8]" /><i className="flex-1 bg-[#c8102e]" /><i className="flex-1 bg-[#0a7a3b]" /></span>
      <span className="mt-auto" />
      {s.style === "quote" && <span className="-mb-1 text-2xl font-extrabold leading-none" style={{ fontFamily: SERIF }} aria-hidden>“</span>}
      {s.category && <span className="mb-1 truncate text-[9px] font-bold uppercase tracking-wider text-[#e0344f]">{categoryLabel(lang as never, s.category)}</span>}
      <span className="line-clamp-6 text-[12.5px] font-extrabold leading-[1.15]" style={{ fontFamily: SERIF }}>{s.title}</span>
      <span className="mt-2 text-[11px] font-extrabold" style={{ fontFamily: SERIF }}>Brief</span>
    </span>
  );
}

/** Top stories as a row of portrait tiles above the news, each a small peek at its reel. Shows nothing until something is published for this edition. */
export function StudioStrip({ edition }: { edition: string }) {
  const { t, lang } = useT();
  const q = useQuery({ queryKey: ["studio-public", edition], queryFn: () => listPublishedStudio(edition), staleTime: 3 * 60_000, retry: false });
  const [seen, setSeen] = useState<Set<string>>(() => new Set());
  const [open, setOpen] = useState<number | null>(null);
  useEffect(() => { setSeen(readSeen()); }, []);
  // The order is worked out when the row loads and when the viewer closes, so tiles do not jump around while someone is watching.
  const [order, setOrder] = useState(0);
  const statuses = useMemo(() => toStatuses(q.data ?? [], Date.now(), seen), [q.data, order]); // eslint-disable-line react-hooks/exhaustive-deps
  const markSeen = useCallback((key: string) => setSeen((s) => { if (s.has(key)) return s; const n = new Set(s).add(key); writeSeen(n); return n; }), []);
  const close = useCallback(() => { setOpen(null); setOrder((o) => o + 1); }, []);
  if (!statuses.length) return null;
  return (
    <section className="mb-6 border-b border-border pb-5" aria-labelledby="studio-strip-heading">
      <h2 id="studio-strip-heading" className="mb-3 text-sm font-bold uppercase tracking-widest text-muted-foreground">{t("home.studio")}</h2>
      <ul className="-mx-4 flex snap-x gap-3 overflow-x-auto px-4 pb-1 sm:mx-0 sm:px-0">
        {statuses.map((s, i) => {
          const live = s.fresh && !seen.has(s.key);
          const isReel = s.slides[0]?.kind === "video";
          return (
            <li key={s.key} className={`w-[108px] shrink-0 snap-start ${s.fresh ? "" : "opacity-60"}`}>
              <button type="button" onClick={() => setOpen(i)} className="group block w-full text-left" aria-label={`${s.title}${s.category ? `, ${categoryLabel(lang, s.category)}` : ""}`}>
                <span className={`block rounded-2xl p-[2.5px] ${live ? "bg-gradient-to-tr from-primary via-[#ffd400] to-secondary" : "bg-border"}`}>
                  <span className="relative block aspect-[9/16] w-full overflow-hidden rounded-[14px] border-2 border-background bg-[#111111]">
                    <Peek s={s} lang={lang} />
                    {isReel && <span className="absolute right-1.5 top-2.5 grid h-5 w-5 place-items-center rounded-full bg-black/60 text-[8px] text-white" aria-hidden>▶</span>}
                  </span>
                </span>
                <span className="mt-1 block text-[10px] text-muted-foreground">{sinceLabel(s.at)}</span>
              </button>
            </li>
          );
        })}
      </ul>
      {open !== null && <StatusViewer statuses={statuses} start={open} onClose={close} onSeen={markSeen} />}
    </section>
  );
}
