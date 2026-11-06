import { createFileRoute } from "@tanstack/react-router";

/**
 * Scheduler hook: call this every 15-30 minutes from any cron service so history keeps building
 * even when nobody visits the site. It refreshes every edition (world and each country). Protected by INGEST_KEY.
 *   curl -H "Authorization: Bearer $INGEST_KEY" https://your-site/api/public/ingest
 */
async function handle(request: Request): Promise<Response> {
  const { refuseUnlessIngestKey } = await import("@/lib/ingest-auth.server");
  const refused = await refuseUnlessIngestKey(request);
  if (refused) return refused;
  const { refreshAndArchive, feedReports } = await import("@/lib/news.server");
  const { archiveConfigured, lastArchiveRun, purgeOldRecords } = await import("@/lib/archive.server");
  const fetched = await refreshAndArchive();
  const purged = await purgeOldRecords();
  // One line per edition, naming any feed that returned nothing (down, or a wrong address). Add ?verbose=1 for every feed's count.
  const verbose = new URL(request.url).searchParams.get("verbose") === "1";
  const editions = feedReports().map((r) => ({
    edition: r.edition, stories: r.stories,
    emptyFeeds: r.feeds.filter((f) => f.stories === 0).map((f) => f.name),
    ...(verbose ? { feeds: r.feeds } : {}),
  }));
  return Response.json({ fetched, archiving: archiveConfigured(), lastRun: lastArchiveRun(), purged, editions });
}

export const Route = createFileRoute("/api/public/ingest")({
  server: { handlers: { GET: ({ request }) => handle(request), POST: ({ request }) => handle(request) } },
});
