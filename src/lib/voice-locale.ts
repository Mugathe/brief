import type { Edition, Lang } from "./editions";

/** The voice locales Brief can read a bulletin in. */
export const VOICE_LOCALES = [
  "en-KE", "en-TZ", "en-NG", "en-ZA", "en-GB", "en-US", "en-IN", "en-AU", "en-CA",
  "sw-KE", "sw-TZ", "fr-FR", "es-ES", "es-MX", "pt-BR", "ar-EG", "ar-SA", "hi-IN",
] as const;
export type VoiceLocale = (typeof VOICE_LOCALES)[number];

const EN_BY_COUNTRY: Record<string, VoiceLocale> = { KE: "en-KE", UG: "en-KE", TZ: "en-TZ", NG: "en-NG", GH: "en-NG", ZA: "en-ZA", GB: "en-GB", US: "en-US", IN: "en-IN", AU: "en-AU", CA: "en-CA" };

/**
 * Which accent reads a bulletin: the language the bulletin is written in, with the edition's country where the voice
 * exists (Kenyan English for Kenya, Swahili from Tanzania for Tanzania). Countries without a voice of their own use the nearest.
 */
export function voiceLocale(edition: Edition, lang: Lang): VoiceLocale {
  const iso = edition.iso;
  switch (lang) {
    case "sw": return iso === "TZ" ? "sw-TZ" : "sw-KE";
    case "fr": return "fr-FR";
    case "es": return iso === "ES" ? "es-ES" : "es-MX";
    case "pt": return "pt-BR";
    case "ar": return iso === "SA" ? "ar-SA" : "ar-EG";
    case "hi": return "hi-IN";
    default: return (iso && EN_BY_COUNTRY[iso]) || "en-GB";
  }
}

export const isVoiceLocale = (v: unknown): v is VoiceLocale => typeof v === "string" && (VOICE_LOCALES as readonly string[]).includes(v);
