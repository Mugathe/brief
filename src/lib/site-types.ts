export type ContentSettings = { hiddenLinks: string[]; blockedSources: string[]; blockedWords: string[]; pinnedLinks: string[] };
export type BannerSettings = { active: boolean; text: string; level: "info" | "celebration" | "alert"; link: string };
export type AdsenseSettings = { client: string; enabled: boolean };
export type PublicAd = {
  id: string; title: string; kind: string; image_url: string | null; link_url: string | null;
  adsense_slot: string | null; placement: string; priority: number; sponsor: string | null; alt_text: string | null;
  /** Editions (countries) this ad is shown in. Empty means everywhere. */
  editions: string[];
};
export type PublicSite = {
  theme: string; adsense: AdsenseSettings; banner: BannerSettings; ads: PublicAd[]; rotationSeconds: number;
  /** Banners set for one edition, by edition code. An edition without one shows the site-wide banner. */
  regionalBanners: Record<string, BannerSettings>;
};

export const EMPTY_CONTENT: ContentSettings = { hiddenLinks: [], blockedSources: [], blockedWords: [], pinnedLinks: [] };
export const EMPTY_BANNER: BannerSettings = { active: false, text: "", level: "info", link: "" };

export const THEMES = [
  { id: "default", label: "Brief (default)", note: "Standard newsroom look" },
  { id: "madaraka", label: "Madaraka Day", note: "1 June — flag red, black and green" },
  { id: "mashujaa", label: "Mashujaa Day", note: "20 October — heroes' gold and green" },
  { id: "jamhuri", label: "Jamhuri Day", note: "12 December — independence celebration" },
  { id: "festive", label: "Festive season", note: "Christmas and New Year warmth" },
  { id: "mourning", label: "National mourning", note: "Subdued, monochrome tone" },
] as const;
export type ThemeId = (typeof THEMES)[number]["id"];

const str = (v: unknown, d = "") => (typeof v === "string" ? v : d);
const strs = (v: unknown) => (Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : []);

export function parseContent(v: unknown): ContentSettings {
  const o = (v ?? {}) as Record<string, unknown>;
  return { hiddenLinks: strs(o["hiddenLinks"]), blockedSources: strs(o["blockedSources"]), blockedWords: strs(o["blockedWords"]), pinnedLinks: strs(o["pinnedLinks"]) };
}
/** Site-wide rules plus an edition's own: every list is combined. */
export function mergeContent(a: ContentSettings, b: ContentSettings): ContentSettings {
  const join = (x: string[], y: string[]) => [...new Set([...x, ...y])];
  return { hiddenLinks: join(a.hiddenLinks, b.hiddenLinks), blockedSources: join(a.blockedSources, b.blockedSources), blockedWords: join(a.blockedWords, b.blockedWords), pinnedLinks: join(a.pinnedLinks, b.pinnedLinks) };
}
export function parseBanner(v: unknown): BannerSettings {
  const o = (v ?? {}) as Record<string, unknown>;
  const level = o["level"] === "celebration" || o["level"] === "alert" ? o["level"] : "info";
  return { active: o["active"] === true, text: str(o["text"]), level, link: str(o["link"]) };
}
export function parseRotation(v: unknown): number {
  const n = Math.round(Number((v as { seconds?: unknown } | null | undefined)?.seconds));
  return Number.isFinite(n) ? Math.min(30, Math.max(3, n)) : 6;
}
export function parseAdsense(v: unknown): AdsenseSettings {
  const o = (v ?? {}) as Record<string, unknown>;
  return { client: str(o["client"]), enabled: o["enabled"] !== false };
}
