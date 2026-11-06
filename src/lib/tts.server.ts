/**
 * Text-to-speech for the bulletin. Providers, in order of preference:
 *   1. Microsoft Azure Speech: has genuine Kenyan-English voices (Asilia, Chilemba), Swahili, French, Spanish and Portuguese ones
 *   2. ElevenLabs: voice IDs and model are configurable
 * With neither configured, the browser's own voice is used instead.
 */
import type { VoiceLocale } from "./voice-locale";

export type TtsVoice = "amani" | "baraka";
export type TtsProvider = "azure" | "elevenlabs";

const env = (k: string) => (process.env[k] ?? "").trim();

export function ttsProvider(): TtsProvider | null {
  const forced = env("TTS_PROVIDER");
  const azure = !!(env("AZURE_SPEECH_KEY") && env("AZURE_SPEECH_REGION"));
  const eleven = !!env("ELEVENLABS_API_KEY");
  if (forced === "elevenlabs" && eleven) return "elevenlabs";
  if (forced === "azure" && azure) return "azure";
  return azure ? "azure" : eleven ? "elevenlabs" : null;
}

/** Azure Neural voices for each locale: [amani (woman), baraka (man)]. */
export const AZURE_VOICES: Record<VoiceLocale, [string, string]> = {
  "en-KE": ["en-KE-AsiliaNeural", "en-KE-ChilembaNeural"], "en-TZ": ["en-TZ-ImaniNeural", "en-TZ-ElimuNeural"], "en-NG": ["en-NG-EzinneNeural", "en-NG-AbeoNeural"],
  "en-ZA": ["en-ZA-LeahNeural", "en-ZA-LukeNeural"], "en-GB": ["en-GB-SoniaNeural", "en-GB-RyanNeural"], "en-US": ["en-US-JennyNeural", "en-US-GuyNeural"],
  "en-IN": ["en-IN-NeerjaNeural", "en-IN-PrabhatNeural"], "en-AU": ["en-AU-NatashaNeural", "en-AU-WilliamNeural"], "en-CA": ["en-CA-ClaraNeural", "en-CA-LiamNeural"],
  "sw-KE": ["sw-KE-ZuriNeural", "sw-KE-RafikiNeural"], "sw-TZ": ["sw-TZ-RehemaNeural", "sw-TZ-DaudiNeural"],
  "fr-FR": ["fr-FR-DeniseNeural", "fr-FR-HenriNeural"], "es-ES": ["es-ES-ElviraNeural", "es-ES-AlvaroNeural"], "es-MX": ["es-MX-DaliaNeural", "es-MX-JorgeNeural"],
  "pt-BR": ["pt-BR-FranciscaNeural", "pt-BR-AntonioNeural"],
  "ar-EG": ["ar-EG-SalmaNeural", "ar-EG-ShakirNeural"], "ar-SA": ["ar-SA-ZariyahNeural", "ar-SA-HamedNeural"], "hi-IN": ["hi-IN-SwaraNeural", "hi-IN-MadhurNeural"],
};

/**
 * The Azure voice for a locale and presenter. Override one with AZURE_VOICE_<LOCALE>_<AMANI|BARAKA>, for example
 * AZURE_VOICE_SW_KE_AMANI. The old AZURE_VOICE_AMANI and AZURE_VOICE_BARAKA still set the Kenyan English voices.
 */
export function azureVoice(locale: VoiceLocale, voice: TtsVoice): string {
  const key = `AZURE_VOICE_${locale.replace("-", "_").toUpperCase()}_${voice.toUpperCase()}`;
  const legacy = locale === "en-KE" ? env(`AZURE_VOICE_${voice.toUpperCase()}`) : "";
  return env(key) || legacy || AZURE_VOICES[locale][voice === "amani" ? 0 : 1];
}

export function voiceConfig() {
  return {
    azure: {
      ready: !!(env("AZURE_SPEECH_KEY") && env("AZURE_SPEECH_REGION")), region: env("AZURE_SPEECH_REGION"),
      amani: env("AZURE_VOICE_AMANI") || "en-KE-AsiliaNeural", baraka: env("AZURE_VOICE_BARAKA") || "en-KE-ChilembaNeural",
    },
    elevenlabs: {
      ready: !!env("ELEVENLABS_API_KEY"), model: env("ELEVENLABS_MODEL") || "eleven_multilingual_v2",
      amani: env("ELEVENLABS_VOICE_AMANI") || "EXAVITQu4vr4xnSDxMaL", baraka: env("ELEVENLABS_VOICE_BARAKA") || "JBFqnCBsd6RMkjVDRZzb",
    },
  };
}

const xml = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&apos;");

/** SSML for Azure: a short pause after each sentence gives a newsreader's pace. */
export function buildSsml(text: string, voiceName: string, rate = "0%"): string {
  const lang = voiceName.split("-").slice(0, 2).join("-");
  const body = xml(text).replace(/([.!?])\s+/g, '$1<break time="280ms"/> ');
  return `<speak version="1.0" xml:lang="${lang}" xmlns="http://www.w3.org/2001/10/synthesis"><voice name="${voiceName}"><prosody rate="${rate}">${body}</prosody></voice></speak>`;
}

async function viaAzure(text: string, voice: TtsVoice, locale: VoiceLocale): Promise<Uint8Array> {
  const c = voiceConfig().azure;
  const res = await fetch(`https://${c.region}.tts.speech.microsoft.com/cognitiveservices/v1`, {
    method: "POST",
    headers: {
      "Ocp-Apim-Subscription-Key": env("AZURE_SPEECH_KEY"), "Content-Type": "application/ssml+xml",
      "X-Microsoft-OutputFormat": "audio-24khz-48kbitrate-mono-mp3", "User-Agent": "Brief",
    },
    body: buildSsml(text, azureVoice(locale, voice), voice === "baraka" ? "-2%" : "0%"),
    signal: AbortSignal.timeout(30_000),
  });
  if (!res.ok) throw new Error(`Azure Speech ${res.status}: ${(await res.text()).slice(0, 200)}`);
  return new Uint8Array(await res.arrayBuffer());
}

async function viaElevenLabs(text: string, voice: TtsVoice): Promise<Uint8Array> {
  const c = voiceConfig().elevenlabs;
  const res = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${c[voice]}?output_format=mp3_44100_128`, {
    method: "POST",
    headers: { "xi-api-key": env("ELEVENLABS_API_KEY"), "Content-Type": "application/json" },
    body: JSON.stringify({ text, model_id: c.model, voice_settings: { stability: 0.52, similarity_boost: 0.75, style: 0.38, use_speaker_boost: true, speed: 1.04 } }),
    signal: AbortSignal.timeout(30_000),
  });
  if (!res.ok) throw new Error(`ElevenLabs ${res.status}: ${(await res.text()).slice(0, 200)}`);
  return new Uint8Array(await res.arrayBuffer());
}

/** Turns text into an MP3 with the configured provider. Throws if none is set up or the service refuses. */
export async function synthesize(text: string, voice: TtsVoice, locale: VoiceLocale = "en-KE"): Promise<{ bytes: Uint8Array; provider: TtsProvider }> {
  const provider = ttsProvider();
  if (!provider) throw new Error("No studio voice is configured.");
  return { bytes: provider === "azure" ? await viaAzure(text, voice, locale) : await viaElevenLabs(text, voice), provider };
}
