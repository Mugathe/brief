import { DEFAULT_EDITION, EDITIONS } from "./editions";

/** How the automatic Studio service behaves. Saved as the "studio" site setting and read by the renderer every run. */
/** `voice`: who reads the headline over the reel ("off" for none). `facebook` and `youtube`: also post each new reel there. */
export type StudioVoice = "off" | "amani" | "baraka";
export type StudioConfig = { enabled: boolean; autoPublish: boolean; editions: string[]; perRun: number; perDay: number; voice: StudioVoice; facebook: boolean; youtube: boolean };

export const DEFAULT_STUDIO: StudioConfig = { enabled: false, autoPublish: true, editions: [DEFAULT_EDITION], perRun: 3, perDay: 8, voice: "off", facebook: false, youtube: false };

const int = (v: unknown, lo: number, hi: number, d: number) => (typeof v === "number" && Number.isFinite(v) ? Math.max(lo, Math.min(hi, Math.round(v))) : d);

/** Reads whatever is stored and returns safe settings; anything missing or odd falls back to the defaults (service off). */
export function parseStudio(v: unknown): StudioConfig {
  const o = (v && typeof v === "object" ? v : {}) as Record<string, unknown>;
  const editions = Array.isArray(o["editions"]) ? [...new Set(o["editions"].filter((c): c is string => typeof c === "string" && EDITIONS.some((e) => e.code === c)))].slice(0, 12) : [];
  return {
    enabled: o["enabled"] === true,
    autoPublish: o["autoPublish"] !== false,
    editions: editions.length ? editions : DEFAULT_STUDIO.editions,
    perRun: int(o["perRun"], 1, 5, DEFAULT_STUDIO.perRun),
    perDay: int(o["perDay"], 1, 30, DEFAULT_STUDIO.perDay),
    voice: o["voice"] === "amani" || o["voice"] === "baraka" ? o["voice"] : "off",
    facebook: o["facebook"] === true,
    youtube: o["youtube"] === true,
  };
}
