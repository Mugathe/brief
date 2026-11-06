import { createFileRoute } from "@tanstack/react-router";

/** Studio renderer: a voice-over for one headline, as MP3. Protected by INGEST_KEY. */
async function handle(request: Request): Promise<Response> {
  const { refuseUnlessIngestKey } = await import("@/lib/ingest-auth.server");
  const refused = await refuseUnlessIngestKey(request);
  if (refused) return refused;
  try {
    const { z } = await import("zod");
    const b = z.object({ edition: z.string().max(8), text: z.string().trim().min(2).max(400), voice: z.enum(["amani", "baraka"]) }).parse(await request.json());
    const { studioVoice } = await import("@/lib/studio.server");
    const bytes = await studioVoice(b.edition, b.text, b.voice);
    return new Response(bytes as unknown as BodyInit, { headers: { "Content-Type": "audio/mpeg", "Cache-Control": "no-store" } });
  } catch (e) {
    return Response.json({ error: e instanceof Error ? e.message.slice(0, 300) : "No voice" }, { status: 400 });
  }
}

export const Route = createFileRoute("/api/public/studio-voice")({ server: { handlers: { POST: ({ request }) => handle(request) } } });
