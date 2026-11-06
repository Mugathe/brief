export const AD_PLACEMENTS = [
  { id: "home_top", label: "Home — top banner" },
  { id: "home_inline", label: "Home — between stories" },
  { id: "home_bottom", label: "Home — above footer" },
  { id: "brief_top", label: "Daily brief — top" },
  { id: "brief_bottom", label: "Daily brief — bottom" },
  { id: "buzz_top", label: "KOT Buzz — top" },
  { id: "manifestos_top", label: "Manifesto Watch — top" },
  { id: "manifestos_bottom", label: "Manifesto Watch — bottom" },
  { id: "trending_top", label: "Trending — top" },
  { id: "trails_top", label: "Trails — top" },
] as const;
export type AdPlacement = (typeof AD_PLACEMENTS)[number]["id"];
export const placementLabel = (id: string) => AD_PLACEMENTS.find((p) => p.id === id)?.label ?? id;

/** Is this ad meant for this edition? An ad with no editions listed runs everywhere. */
export const runsIn = (ad: { editions?: readonly string[] | null }, edition: string): boolean => !ad.editions?.length || ad.editions.includes(edition);

/** The banner to show for an edition: its own if it has an active one, otherwise the site-wide banner. */
export function bannerFor<B extends { active: boolean }>(site: B, regional: Record<string, B> | undefined, edition: string): B {
  const own = regional?.[edition];
  return own?.active ? own : site;
}

/** A valid AdSense publisher ID ("ca-pub-1234567890123456"), or null. It goes into script addresses, so nothing else is accepted. */
export const adsenseClientId = (v: string | null | undefined): string | null => (v && /^ca-pub-\d{10,20}$/.test(v.trim()) ? v.trim() : null);

/** Tells Google's consent script that this page has its message frame, as Google's documentation asks. */
export const GOOGLE_FC_SIGNAL = `(function(){function s(){if(!window.frames['googlefcPresent']){if(document.body){var i=document.createElement('iframe');i.style='width:0;height:0;border:none;z-index:-1000;left:-1000px;top:-1000px;';i.style.display='none';i.name='googlefcPresent';document.body.appendChild(i);}else{setTimeout(s,0);}}}s();})();`;
