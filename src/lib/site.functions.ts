import { createServerFn } from "@tanstack/react-start";
import { parseAdsense, parseBanner, parseRotation, type BannerSettings, type PublicSite } from "./site-types";

export type { ContentSettings, PublicAd, PublicSite } from "./site-types";

export const getPublicSite = createServerFn({ method: "GET" }).handler(async (): Promise<PublicSite> => {
  try {
    const { publicClient } = await import("./public-client.server");
    const sb = publicClient();
    const full = await sb.from("ads").select("id,title,kind,image_url,link_url,adsense_slot,placement,priority,sponsor,alt_text,editions").order("priority", { ascending: false });
    // Older database (setup SQL not run yet): fall back to the original columns so ads still show, everywhere.
    const adsRes = full.error
      ? await sb.from("ads").select("id,title,kind,image_url,link_url,adsense_slot,placement,priority").order("priority", { ascending: false })
      : full;
    if (adsRes.error) console.error("[ads] could not load ads:", adsRes.error.message);
    const ads = (adsRes.data ?? []).map((a) => ({ sponsor: null, alt_text: null, editions: [] as string[], ...a }));
    const { data: settings } = await sb.from("site_settings").select("key,value").or("key.in.(theme,adsense,banner,ad_rotation),key.like.banner@%");
    const get = (k: string) => settings?.find((s) => s.key === k)?.value;
    const themeVal = get("theme") as { name?: string } | undefined;
    const regionalBanners: Record<string, BannerSettings> = {};
    for (const r of settings ?? []) if (r.key.startsWith("banner@")) regionalBanners[r.key.slice(7)] = parseBanner(r.value);
    return { theme: themeVal?.name ?? "default", adsense: parseAdsense(get("adsense")), banner: parseBanner(get("banner")), ads, rotationSeconds: parseRotation(get("ad_rotation")), regionalBanners };
  } catch (e) {
    console.error("site settings failed", e);
    return { theme: "default", adsense: { client: "", enabled: true }, banner: { active: false, text: "", level: "info", link: "" }, ads: [], rotationSeconds: 6, regionalBanners: {} };
  }
});
