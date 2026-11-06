import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

type Ctx = { supabase: any; userId: string };
const c = (x: unknown) => x as Ctx;
async function roles(ctx: Ctx): Promise<string[]> {
  const { data } = await ctx.supabase.from("user_roles").select("role").eq("user_id", ctx.userId);
  return (data ?? []).map((r: { role: string }) => r.role);
}
async function need(ctx: Ctx, allowed: string[], msg: string) { if (!(await roles(ctx)).some((r) => allowed.includes(r))) throw new Error(msg); }

export type PronEntry = { word: string; spoken: string; note: string };

export const getVoiceAdmin = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await need(c(context), ["admin", "editor", "moderator"], "Staff only");
    const { ttsProvider, voiceConfig } = await import("./tts.server");
    const { DEFAULT_DICTIONARY, SPELL_OUT } = await import("./pronounce");
    const { data, error } = await c(context).supabase.from("pronunciations").select("word,spoken,note").order("word");
    const cfg = voiceConfig();
    return {
      provider: ttsProvider(),
      azure: { ready: cfg.azure.ready, region: cfg.azure.region, amani: cfg.azure.amani, baraka: cfg.azure.baraka },
      elevenlabs: { ready: cfg.elevenlabs.ready, model: cfg.elevenlabs.model },
      entries: (error ? [] : data) as PronEntry[],
      tableReady: !error,
      builtIn: { respellings: Object.entries(DEFAULT_DICTIONARY).map(([word, spoken]) => ({ word, spoken })), acronyms: [...new Set(SPELL_OUT)] },
    };
  });

export const savePronunciation = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ word: z.string().trim().min(2).max(60), spoken: z.string().trim().min(1).max(120), note: z.string().trim().max(160) }).parse(d))
  .handler(async ({ context, data }) => {
    await need(c(context), ["admin", "editor"], "Only admins and editors can change pronunciations");
    const { error } = await c(context).supabase.from("pronunciations").upsert(data, { onConflict: "word" });
    if (error) throw new Error(error.message);
    (await import("./pronunciation.server")).clearDictionary();
    await c(context).supabase.from("security_events").insert({ severity: "info", type: "pronunciation_saved", detail: `${data.word} -> ${data.spoken}`.slice(0, 250), actor: c(context).userId });
    return { ok: true };
  });

export const deletePronunciation = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ word: z.string().max(60) }).parse(d))
  .handler(async ({ context, data }) => {
    await need(c(context), ["admin", "editor"], "Only admins and editors can change pronunciations");
    const { error } = await c(context).supabase.from("pronunciations").delete().eq("word", data.word);
    if (error) throw new Error(error.message);
    (await import("./pronunciation.server")).clearDictionary();
    return { ok: true };
  });

const used = new Map<string, number[]>();

/** Shows exactly what will be said for a sentence, and records it if a studio voice is set up. */
export const previewVoice = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ text: z.string().trim().min(2).max(300), voice: z.enum(["amani", "baraka"]), withAudio: z.boolean() }).parse(d))
  .handler(async ({ context, data }) => {
    await need(c(context), ["admin", "editor", "moderator"], "Staff only");
    const { prepareSpeech } = await import("./pronounce");
    const { loadDictionary, clearDictionary } = await import("./pronunciation.server");
    clearDictionary(); // always preview with the latest entries
    const spoken = prepareSpeech(data.text, await loadDictionary());
    if (!data.withAudio) return { spoken, audio: null as string | null, provider: null as string | null, message: "" };

    const { ttsProvider, synthesize } = await import("./tts.server");
    if (!ttsProvider()) return { spoken, audio: null, provider: null, message: "No studio voice is set up, so listeners will hear their device's voice. Use “Hear on this device” to check that." };
    const now = Date.now();
    const recent = (used.get(c(context).userId) ?? []).filter((t) => now - t < 3600_000);
    if (recent.length >= 40) throw new Error("That's 40 previews this hour. Please wait a little.");
    used.set(c(context).userId, [...recent, now]);
    try {
      const r = await synthesize(spoken, data.voice);
      return { spoken, audio: Buffer.from(r.bytes).toString("base64"), provider: r.provider as string | null, message: "" };
    } catch (e) {
      return { spoken, audio: null, provider: null, message: e instanceof Error ? e.message : "The voice service refused the request." };
    }
  });
