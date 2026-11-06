import { createFileRoute } from "@tanstack/react-router";

/** Studio renderer, progress reports: start, progress (one story done or failed) and finish (which sends the alert). Protected by INGEST_KEY. */
async function handle(request: Request): Promise<Response> {
  const { refuseUnlessIngestKey } = await import("@/lib/ingest-auth.server");
  const refused = await refuseUnlessIngestKey(request);
  if (refused) return refused;
  try {
    const { recordRun } = await import("@/lib/studio.server");
    return Response.json({ ok: true, ...(await recordRun(await request.json())) });
  } catch (e) {
    return Response.json({ error: e instanceof Error ? e.message.slice(0, 300) : "Could not record" }, { status: 400 });
  }
}

export const Route = createFileRoute("/api/public/studio-run")({ server: { handlers: { POST: ({ request }) => handle(request) } } });
