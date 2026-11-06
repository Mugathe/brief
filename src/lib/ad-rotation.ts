import type { PublicAd } from "./site-types";

export const DEFAULT_ROTATION_SECONDS = 6;
export const ROTATION_CHOICES = [4, 6, 8, 10, 15, 20] as const;
export const clampSeconds = (n: unknown) => { const v = Math.round(Number(n)); return Number.isFinite(v) ? Math.min(30, Math.max(3, v)) : DEFAULT_ROTATION_SECONDS; };

/** Sponsor banners that can actually be shown (they need an image and a link). */
export const usableBanners = (ads: PublicAd[]) => ads.filter((a) => a.kind !== "adsense" && !!a.image_url && !!a.link_url);

/**
 * Orders banners for the carousel: highest priority first, and banners with the same priority are
 * shuffled so each gets a fair turn at the front across visits.
 */
export function orderBanners(ads: PublicAd[], random: () => number = Math.random): PublicAd[] {
  const byPriority = new Map<number, PublicAd[]>();
  for (const a of usableBanners(ads)) byPriority.set(a.priority, [...(byPriority.get(a.priority) ?? []), a]);
  return [...byPriority.keys()].sort((a, b) => b - a).flatMap((p) => {
    const group = [...byPriority.get(p)!];
    for (let i = group.length - 1; i > 0; i--) { const j = Math.floor(random() * (i + 1)); [group[i], group[j]] = [group[j]!, group[i]!]; }
    return group;
  });
}

/** AdSense units never rotate (Google's rules), so only the single highest-priority one is used. */
export function pickAdsense(ads: PublicAd[]): PublicAd | null {
  return ads.filter((a) => a.kind === "adsense").sort((a, b) => b.priority - a.priority)[0] ?? null;
}

export const stepIndex = (i: number, count: number, dir: 1 | -1) => (count <= 0 ? 0 : (i + dir + count) % count);
