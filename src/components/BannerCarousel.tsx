import { useCallback, useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, Pause, Play } from "lucide-react";
import type { PublicAd } from "@/lib/site-types";
import { stepIndex } from "@/lib/ad-rotation";

/**
 * Sponsor banners that take turns, like a carousel.
 * - rotates only while it is on screen, the tab is open, and nobody is hovering or focusing it
 * - has a pause button, arrows, dots, swipe and arrow keys
 * - does not rotate on its own for people who ask their device to reduce motion
 * - reports each banner as "seen" once, and only when it was actually visible
 */
export function BannerCarousel({ ads, seconds, onShow, className = "" }: { ads: PublicAd[]; seconds: number; onShow: (ad: PublicAd) => void; className?: string }) {
  const [index, setIndex] = useState(0);
  const [userPaused, setUserPaused] = useState(false);
  const [hold, setHold] = useState(false);           // hovering or keyboard focus inside
  const [onScreen, setOnScreen] = useState(false);
  const [tabOpen, setTabOpen] = useState(true);
  const [reduced, setReduced] = useState(false);
  const box = useRef<HTMLElement | null>(null);
  const counted = useRef(new Set<string>());
  const touchX = useRef<number | null>(null);
  const many = ads.length > 1;
  const active = ads[Math.min(index, ads.length - 1)];

  useEffect(() => {
    const mq = typeof window.matchMedia === "function" ? window.matchMedia("(prefers-reduced-motion: reduce)") : null;
    setReduced(!!mq?.matches);
    const onChange = (e: MediaQueryListEvent) => setReduced(e.matches);
    mq?.addEventListener?.("change", onChange);
    const onVis = () => setTabOpen(document.visibilityState !== "hidden");
    onVis();
    document.addEventListener("visibilitychange", onVis);
    return () => { mq?.removeEventListener?.("change", onChange); document.removeEventListener("visibilitychange", onVis); };
  }, []);

  useEffect(() => {
    const el = box.current;
    if (!el) return;
    if (typeof IntersectionObserver === "undefined") { setOnScreen(true); return; }
    const io = new IntersectionObserver((entries) => setOnScreen(entries.some((e) => e.isIntersecting)), { threshold: 0.5 });
    io.observe(el);
    return () => io.disconnect();
  }, []);

  // Count a banner as seen the first time it is showing while the carousel is on screen and the tab is open.
  useEffect(() => {
    if (!active || !onScreen || !tabOpen || counted.current.has(active.id)) return;
    counted.current.add(active.id);
    onShow(active);
  }, [active, onScreen, tabOpen, onShow]);

  const rotating = many && !userPaused && !hold && onScreen && tabOpen && !reduced;
  useEffect(() => {
    if (!rotating) return;
    const t = setTimeout(() => setIndex((i) => stepIndex(i, ads.length, 1)), seconds * 1000);
    return () => clearTimeout(t);
  }, [rotating, index, seconds, ads.length]);

  const go = useCallback((dir: 1 | -1) => setIndex((i) => stepIndex(i, ads.length, dir)), [ads.length]);
  if (!active) return null;

  return (
    <section
      ref={box}
      role="region"
      aria-roledescription="carousel"
      aria-label="Sponsored banners"
      className={`mx-auto w-full max-w-6xl px-4 ${className}`}
      onMouseEnter={() => setHold(true)}
      onMouseLeave={() => setHold(false)}
      onFocus={() => setHold(true)}
      onBlur={(e) => { if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setHold(false); }}
      onKeyDown={(e) => { if (!many) return; if (e.key === "ArrowRight") { e.preventDefault(); go(1); } else if (e.key === "ArrowLeft") { e.preventDefault(); go(-1); } }}
      onTouchStart={(e) => { touchX.current = e.touches[0]?.clientX ?? null; }}
      onTouchEnd={(e) => {
        const start = touchX.current; touchX.current = null;
        const end = e.changedTouches[0]?.clientX;
        if (many && start !== null && end !== undefined && Math.abs(end - start) > 40) go(end < start ? 1 : -1);
      }}
    >
      <div className="mb-1 flex items-center justify-between gap-3">
        <p className="min-w-0 truncate text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">{active.sponsor ? `Sponsored · ${active.sponsor}` : "Advertisement"}</p>
        {many && (
          <div className="flex shrink-0 items-center gap-1">
            <button type="button" aria-label="Previous banner" onClick={() => go(-1)} className="p-1 text-muted-foreground hover:text-foreground"><ChevronLeft className="h-4 w-4" /></button>
            <div className="flex items-center gap-1.5" role="group" aria-label="Choose a banner">
              {ads.map((a, n) => (
                <button key={a.id} type="button" aria-label={`Show banner ${n + 1} of ${ads.length}`} aria-current={n === index ? "true" : undefined} onClick={() => setIndex(n)} className={`h-1.5 rounded-full transition-all ${n === index ? "w-5 bg-foreground" : "w-1.5 bg-muted-foreground/40 hover:bg-muted-foreground"}`} />
              ))}
            </div>
            <button type="button" aria-label="Next banner" onClick={() => go(1)} className="p-1 text-muted-foreground hover:text-foreground"><ChevronRight className="h-4 w-4" /></button>
            <button type="button" aria-label={userPaused ? "Resume rotation" : "Pause rotation"} aria-pressed={userPaused} onClick={() => setUserPaused((p) => !p)} className="ms-1 p-1 text-muted-foreground hover:text-foreground">{userPaused ? <Play className="h-3.5 w-3.5" /> : <Pause className="h-3.5 w-3.5" />}</button>
          </div>
        )}
      </div>

      {/* Slides share one grid cell, so the box is as tall as the tallest banner and nothing jumps. */}
      <div className="grid border border-border" aria-live={rotating ? "off" : "polite"}>
        {ads.map((a, n) => {
          const current = n === index;
          return (
            <div key={a.id} role="group" aria-roledescription="slide" aria-label={`${n + 1} of ${ads.length}`} aria-hidden={!current} className={`col-start-1 row-start-1 ${reduced ? "" : "transition-opacity duration-500"} ${current ? "opacity-100" : "pointer-events-none opacity-0"}`}>
              <a href={a.link_url ?? "#"} tabIndex={current ? 0 : -1} target="_blank" rel="sponsored noopener noreferrer" data-track="ad_click" data-track-target={a.id} className="block">
                <img src={a.image_url ?? ""} alt={a.alt_text || a.title} loading={n === 0 ? "eager" : "lazy"} className="mx-auto max-h-48 w-full object-contain" />
              </a>
            </div>
          );
        })}
      </div>
      {rotating && <div className="h-0.5 overflow-hidden bg-muted"><div key={`${index}-${seconds}`} className="h-0.5 origin-left bg-primary/70" style={{ animation: `kp-progress ${seconds}s linear forwards` }} /></div>}
    </section>
  );
}
