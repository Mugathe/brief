import { createFileRoute } from "@tanstack/react-router";

/**
 * Studio renderer, step 1: what should be made now? Without ?edition= it returns just the settings (so the job can stop early when the
 * service is off); with it, the stories that still need a picture and reel. Protected by INGEST_KEY.
 */
async function handle(request: Request): Promise<Response> {
  const { refuseUnlessIngestKey } = await import("@/lib/ingest-auth.server");
  const refused = await refuseUnlessIngestKey(request);
  if (refused) return refused;
  const { planFor, readStudioConfig } = await import("@/lib/studio.server");
  const url = new URL(request.url);
  const edition = url.searchParams.get("edition");
  try {
    if (!edition) return Response.json({ config: await readStudioConfig() });
    const site = process.env["VITE_SITE_URL"] || url.origin;
    return Response.json(await planFor(edition, site.replace(/\/$/, "")));
  } catch (e) {
    return Response.json({ error: e instanceof Error ? e.message : "Could not plan" }, { status: 400 });
  }
}

export const Route = createFileRoute("/api/public/studio-plan")({ server: { handlers: { GET: ({ request }) => handle(request) } } });
