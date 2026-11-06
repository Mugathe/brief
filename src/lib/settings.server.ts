import { publicClient } from "./public-client.server";
import { EMPTY_CONTENT, mergeContent, parseContent, type ContentSettings } from "./site-types";

const cache = new Map<string, { at: number; value: ContentSettings }>();

/**
 * The content rules that apply to one edition: the site-wide rules plus that edition's own (stored as "content@NG").
 * Pass no edition for the site-wide rules alone.
 */
export async function getContentSettings(edition?: string): Promise<ContentSettings> {
  const id = edition ?? "";
  const hit = cache.get(id);
  if (hit && Date.now() - hit.at < 60_000) return hit.value;
  try {
    const keys = edition ? ["content", `content@${edition}`] : ["content"];
    const { data } = await publicClient().from("site_settings").select("key,value").in("key", keys);
    const get = (k: string) => data?.find((r) => r.key === k)?.value;
    const value = edition ? mergeContent(parseContent(get("content")), parseContent(get(`content@${edition}`))) : parseContent(get("content"));
    cache.set(id, { at: Date.now(), value });
    return value;
  } catch (e) {
    console.error("content settings failed", e);
    return hit?.value ?? EMPTY_CONTENT;
  }
}

export function clearContentSettingsCache() { cache.clear(); }
