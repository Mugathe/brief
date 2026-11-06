import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { VOICE_LOCALES } from "@/lib/voice-locale";

const requestSchema = z.object({
  text: z.string().trim().min(20).max(2_500),
  sig: z.string().min(16).max(64),
  voice: z.enum(["amani", "baraka"]),
  // Which accent reads it. Optional so older pages keep working (Kenyan English, as before).
  locale: z.enum(VOICE_LOCALES).default("en-KE"),
});

// Recordings are kept for two hours, so each line is paid for once however many people listen.
const store = new Map<string, { at: number; bytes: Uint8Array }>();
const TTL = 2 * 3600_000;
const hits = new Map<string, number[]>();
function allowed(ip: string): boolean {
  const now = Date.now();
  const recent = (hits.get(ip) ?? []).filter((t) => now - t < 3600_000);
  if (recent.length >= 60) return false;
  hits.set(ip, [...recent, now]);
  if (hits.size > 5000) hits.clear();
  return true;
}

export const Route = createFileRoute("/api/public/bulletin-audio")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const origin = request.headers.get("origin");
        const requestUrl = new URL(request.url);
        if (!origin || new URL(origin).host !== requestUrl.host) {
          return Response.json({ error: "This audio request is not allowed." }, { status: 403 });
        }

        let input: z.infer<typeof requestSchema>;
        try {
          input = requestSchema.parse(await request.json());
        } catch {
          return Response.json({ error: "The bulletin text or voice is invalid." }, { status: 400 });
        }

        const { verifyText } = await import("@/lib/audio-sign.server");
        if (!verifyText(input.text, input.sig)) {
          return Response.json({ error: "This audio request is not allowed." }, { status: 403 });
        }
        const ip = (request.headers.get("cf-connecting-ip") ?? request.headers.get("x-forwarded-for") ?? "unknown").split(",")[0]!.trim();
        if (!allowed(ip)) return Response.json({ error: "Too many audio requests. Please try again later." }, { status: 429 });

        const { createHash } = await import("node:crypto");
        const { ttsProvider: activeProvider } = await import("@/lib/tts.server");
        const cacheKey = `${activeProvider() ?? "none"}:${input.locale}:${input.voice}:${createHash("sha256").update(input.text).digest("hex")}`;
        const hit = store.get(cacheKey);
        if (hit && Date.now() - hit.at < TTL) {
          return new Response(hit.bytes as unknown as BodyInit, { headers: { "Content-Type": "audio/mpeg", "Cache-Control": "private, max-age=900" } });
        }

        const { synthesize, ttsProvider } = await import("@/lib/tts.server");
        if (!ttsProvider()) return Response.json({ error: "Audio is temporarily unavailable." }, { status: 503 });
        let bytes: Uint8Array;
        try {
          bytes = (await synthesize(input.text, input.voice, input.locale)).bytes;
        } catch (e) {
          console.error("[bulletin-audio] could not record:", e instanceof Error ? e.message : e);
          return Response.json({ error: "The presenter could not record this bulletin. Please try again." }, { status: 502 });
        }
        if (store.size >= 120) store.clear();
        store.set(cacheKey, { at: Date.now(), bytes });
        return new Response(bytes as unknown as BodyInit, {
          headers: {
            "Content-Type": "audio/mpeg",
            "Cache-Control": "private, max-age=900",
          },
        });
      },
    },
  },
});