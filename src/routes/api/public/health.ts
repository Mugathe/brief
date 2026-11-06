import { createFileRoute } from "@tanstack/react-router";

/**
 * For uptime monitors and the load balancer: answers quickly, never touches the database, and reveals nothing private.
 *   curl https://your-site/api/public/health
 */
async function handle(): Promise<Response> {
  const { archiveConfigured, lastArchiveRun } = await import("@/lib/archive.server");
  const { feedReports } = await import("@/lib/news.server");
  const reports = feedReports();
  const last = lastArchiveRun();
  return Response.json(
    {
      ok: true,
      uptimeSeconds: Math.round(process.uptime()),
      archiving: archiveConfigured(),
      lastArchive: last ? { at: last.at ?? null, sent: last.sent ?? 0, error: last.error ? "see server log" : null } : null,
      editionsLoaded: reports.length,
      newestRefreshAgoSeconds: reports.length ? Math.round((Date.now() - Math.max(...reports.map((r) => r.at))) / 1000) : null,
    },
    { headers: { "cache-control": "no-store" } },
  );
}

export const Route = createFileRoute("/api/public/health")({ server: { handlers: { GET: () => handle(), HEAD: () => handle() } } });
