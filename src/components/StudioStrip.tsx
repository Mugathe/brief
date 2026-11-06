import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { listPublishedStudio } from "@/lib/studio-db";
import { IMAGE_MS, readSeen, sinceLabel, toStatuses, writeSeen, type Status } from "@/lib/studio-status";
import { categoryLabel } from "@/lib/i18n";
import { shareLinks, shareStatus, shareText } from "@/lib/studio-share";
import { useT } from "@/lib/use-edition";

const HOLD_MS = 220;
const absolute = (link: string) => `${window.location.origin}${link.startsWith("/brief") ? link : "/brief"}`; // only our own Read the Brief page, whatever is stored

/** A full-screen viewer in the style of WhatsApp Status: bars along the top, tap to move, hold to pause, swipe down or Esc to close. No player controls. */
function StatusViewer({ statuses, start, onClose, onSeen }: { statuses: Status[]; start: number; onClose: () => void; onSeen: (key: string) => void }) {
  const { t, lang } = useT();
  const [si, setSi] = useState(start);
  const [pi, setPi] = useState(0);
  const [progress, setProgress] = useState(0);
  const [paused, setPaused] = useState(false);
  const [muted, setMuted] = useState(false);
  const [sheet, setSheet] = useState(false);
  const [copied, setCopied] = useState(false);
  const stopped = paused || sheet; // held by a finger, or the share sheet is open
  const elapsed = useRef(0);
  const video = useRef<HTMLVideoElement>(null);
  const closeBtn = useRef<HTMLButtonElement>(null);
  const press = useRef<{ x: number; y: number; at: number; held: boolean; timer: ReturnType<typeof setTimeout> | undefined }>({ x: 0, y: 0, at: 0, held: false, timer: undefined });
  const status = statuses[si]!;
  const slide = status.slides[pi]!;

  const next = useCallback(() => {
    if (pi < status.slides.length - 1) { setPi(pi + 1); }
    else if (si < statuses.length - 1) { setSi(si + 1); setPi(0); }
    else onClose();
  }, [pi, si, status.slides.length, statuses.length, onClose]);
  const prev = useCallback(() => {
    if (pi > 0) setPi(pi - 1);
    else if (si > 0) { setSi(si - 1); setPi(0); }
    else setProgress(0);
  }, [pi, si]);

  useEffect(() => { onSeen(status.key); }, [status.key, onSeen]);
  useEffect(() => { elapsed.current = 0; setProgress(0); }, [si, pi]);
  useEffect(() => {
    // The phone's back button should close the viewer, not leave the page.
    window.history.pushState({ briefStatus: true }, "");
    const back = () => onClose();
    window.addEventListener("popstate", back);
    return () => {
      window.removeEventListener("popstate", back);
      if ((window.history.state as { briefStatus?: boolean } | null)?.briefStatus) window.history.back();
    };
  }, [onClose]);
  useEffect(() => { closeBtn.current?.focus(); const o = document.body.style.overflow; document.body.style.overflow = "hidden"; return () => { document.body.style.overflow = o; }; }, []);
  useEffect(() => {
    const key = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); else if (e.key === "ArrowRight") next(); else if (e.key === "ArrowLeft") prev(); };
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  }, [next, prev, onClose]);

  // Pictures run on a timer; reels run for as long as they are, and move on when they end.
  useEffect(() => {
    if (slide.kind !== "image") return;
    let last = performance.now(), raf = 0;
    const tick = (now: number) => {
      if (!stopped) elapsed.current += now - last; // kept in a ref so pausing and resuming carries on where it was
      last = now;
      setProgress(Math.min(1, elapsed.current / IMAGE_MS));
      if (elapsed.current >= IMAGE_MS) next(); else raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [slide, stopped, next]);
  useEffect(() => {
    const v = video.current;
    if (!v || slide.kind !== "video") return;
    if (stopped) { v.pause(); return; }
    // Sound is allowed because the viewer opened from a tap; if a browser still refuses, play silently.
    v.play().catch(() => { v.muted = true; setMuted(true); v.play().catch(() => next()); });
  }, [slide, stopped, next]);

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
    p.x = e.clientX; p.y = e.clientY; p.at = Date.now(); p.held = false;
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
        {slide.kind === "image"
          ? <img key={slide.url} src={slide.url} alt={status.title} draggable={false} className="absolute inset-0 h-full w-full object-contain" />
          : <video key={slide.url} ref={video} src={slide.url} playsInline muted={muted} preload="auto" disablePictureInPicture controlsList="nodownload noremoteplayback" onTimeUpdate={(e) => { const v = e.currentTarget; if (v.duration) setProgress(v.currentTime / v.duration); }} onEnded={next} className="absolute inset-0 h-full w-full object-contain" />}

        <div className="absolute inset-x-0 top-0 h-28 bg-gradient-to-b from-black/70 to-transparent" aria-hidden />
        <div className="absolute inset-x-0 bottom-0 h-40 bg-gradient-to-t from-black/80 to-transparent" aria-hidden />

        {/* Tap, hold and swipe surface. The buttons and link sit above it. */}
        <div className="absolute inset-0 touch-pan-x" onPointerDown={down} onPointerUp={up} onPointerCancel={() => { clearTimeout(press.current.timer); setPaused(false); }} />

        <div className="pointer-events-none absolute inset-x-0 top-0 px-3 pt-[max(0.75rem,env(safe-area-inset-top))]">
          <div className="flex gap-1" aria-hidden>
            {statuses[si]!.slides.map((_, n) => (
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
            {slide.kind === "video" && (
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

/** Top stories as a row of round "status" circles above the news. Shows nothing until something is published for this edition. */
export function StudioStrip({ edition }: { edition: string }) {
  const { t, lang } = useT();
  const q = useQuery({ queryKey: ["studio-public", edition], queryFn: () => listPublishedStudio(edition), staleTime: 3 * 60_000, retry: false });
  const [seen, setSeen] = useState<Set<string>>(() => new Set());
  const [open, setOpen] = useState<number | null>(null);
  useEffect(() => { setSeen(readSeen()); }, []);
  // The order is worked out when the row loads and when the viewer closes, so circles do not jump around while someone is watching.
  const [order, setOrder] = useState(0);
  const statuses = useMemo(() => toStatuses(q.data ?? [], Date.now(), seen), [q.data, order]); // eslint-disable-line react-hooks/exhaustive-deps
  const markSeen = useCallback((key: string) => setSeen((s) => { if (s.has(key)) return s; const n = new Set(s).add(key); writeSeen(n); return n; }), []);
  const close = useCallback(() => { setOpen(null); setOrder((o) => o + 1); }, []);
  if (!statuses.length) return null;
  return (
    <section className="mb-6 border-b border-border pb-5" aria-labelledby="studio-strip-heading">
      <h2 id="studio-strip-heading" className="mb-3 text-sm font-bold uppercase tracking-widest text-muted-foreground">{t("home.studio")}</h2>
      <ul className="-mx-4 flex gap-4 overflow-x-auto px-4 pb-1 sm:mx-0 sm:px-0">
        {statuses.map((s, i) => {
          const live = s.fresh && !seen.has(s.key);
          return (
            <li key={s.key} className={`w-[76px] shrink-0 text-center ${s.fresh ? "" : "opacity-60"}`}>
              <button type="button" onClick={() => setOpen(i)} className="group block w-full" aria-label={`${s.title}${s.category ? `, ${categoryLabel(lang, s.category)}` : ""}`}>
                <span className={`mx-auto block h-[72px] w-[72px] rounded-full p-[3px] ${live ? "bg-gradient-to-tr from-primary via-[#ffd400] to-secondary" : "bg-border"}`}>
                  <span className="block h-full w-full overflow-hidden rounded-full border-2 border-background bg-muted">
                    {s.cover ? <img src={s.cover} alt="" loading="lazy" className="h-full w-full object-cover" /> : <span className="grid h-full w-full place-items-center bg-foreground text-lg font-bold text-background">B</span>}
                  </span>
                </span>
                <span className="mt-1 line-clamp-2 block text-[11px] leading-tight group-hover:underline">{s.title}</span>
              </button>
            </li>
          );
        })}
      </ul>
      {open !== null && <StatusViewer statuses={statuses} start={open} onClose={close} onSeen={markSeen} />}
    </section>
  );
}
