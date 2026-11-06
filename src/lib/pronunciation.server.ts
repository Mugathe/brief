import { publicClient } from "./public-client.server";

let cache: { at: number; dict: Record<string, string> } | null = null;
let version = 0;

/** The team's pronunciation entries (lower-cased word -> spoken form). Cached for five minutes. */
export async function loadDictionary(): Promise<Record<string, string>> {
  if (cache && Date.now() - cache.at < 5 * 60_000) return cache.dict;
  try {
    const { data, error } = await publicClient().from("pronunciations").select("word,spoken");
    if (error) throw new Error(error.message);
    cache = { at: Date.now(), dict: Object.fromEntries((data ?? []).map((r) => [r.word.toLowerCase(), r.spoken])) };
  } catch (e) {
    console.error("[pronunciation] could not load the dictionary:", e instanceof Error ? e.message : e);
    return cache?.dict ?? {};
  }
  return cache.dict;
}

/** Called after an edit, so the next bulletin uses the new pronunciation straight away. */
export function clearDictionary() { cache = null; version++; }
export const dictionaryVersion = () => version;
