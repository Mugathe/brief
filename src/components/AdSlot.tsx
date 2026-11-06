import { useLoaderData } from "@tanstack/react-router";
import { useCallback, useEffect, useRef, useState } from "react";
import type { PublicAd } from "@/lib/site-types";
import { orderBanners, pickAdsense } from "@/lib/ad-rotation";
import { recordEvent } from "@/lib/tracker";
import { BannerCarousel } from "@/components/BannerCarousel";
import { runsIn } from "@/lib/ads";
import { useEdition } from "@/lib/use-edition";

declare global { interface Window { adsbygoogle?: unknown[] } }

/** A single AdSense unit. Google's rules say these must never be rotated or refreshed, so it stays put. */
function AdsenseUnit({ ad, client, className, inline }: { ad: PublicAd; client: string; className: string; inline: boolean }) {
  const box = useRef<HTMLElement | null>(null);
  useEffect(() => {
    try { (window.adsbygoogle = window.adsbygoogle || []).push({}); } catch { /* blocked or not ready */ }
    const el = box.current;
    if (!el || typeof IntersectionObserver === "undefined") return;
    const obs = new IntersectionObserver((entries) => { if (entries.some((e) => e.isIntersecting)) { recordEvent("ad_view", ad.id); obs.disconnect(); } }, { threshold: 0.5 });
    obs.observe(el);
    return () => obs.disconnect();
  }, [ad.id]);
  return (
    <aside ref={box} className={`${inline ? "w-full" : "mx-auto w-full max-w-6xl px-4"} ${className}`} aria-label="Advertisement">
      <p className="mb-1 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">{ad.sponsor ? `Sponsored · ${ad.sponsor}` : "Advertisement"}</p>
      <ins className="adsbygoogle" style={{ display: "block" }} data-ad-client={client} data-ad-slot={ad.adsense_slot ?? ""} data-ad-format="auto" data-full-width-responsive="true" />
    </aside>
  );
}

/**
 * The ads for one spot on a page. Sponsor banners take turns in a carousel; an AdSense unit, if there is one, sits still.
 * Banners are ordered by priority, and banners of equal priority are shuffled so each gets the front spot in turn.
 */
export function AdSlot({ placement, className = "", inline = false }: { placement: string; className?: string; inline?: boolean }) {
  const site = useLoaderData({ from: "__root__" });
  const edition = useEdition().code;
  const [banners, setBanners] = useState<PublicAd[]>([]);
  const [adsense, setAdsense] = useState<PublicAd | null>(null);
  const mine = (a: PublicAd) => a.placement === placement && runsIn(a, edition);
  const key = site.ads.filter(mine).map((a) => `${a.id}:${a.priority}`).join(",");

  useEffect(() => {
    const here = site.adsense.enabled ? site.ads.filter(mine) : [];
    setBanners(orderBanners(here));
    setAdsense(site.adsense.client ? pickAdsense(here) : null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, site.adsense.enabled, site.adsense.client, placement, edition]);

  const seen = useCallback((ad: PublicAd) => recordEvent("ad_view", ad.id), []);
  if (!banners.length && !adsense) return null;

  return (
    <>
      {banners.length > 0 && <BannerCarousel ads={banners} seconds={site.rotationSeconds} onShow={seen} className={className} />}
      {adsense && <AdsenseUnit ad={adsense} client={site.adsense.client} className={className} inline={inline} />}
    </>
  );
}
