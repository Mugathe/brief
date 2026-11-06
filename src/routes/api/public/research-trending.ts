import { createFileRoute } from "@tanstack/react-router";

/**
 * Scheduler hook (INGEST_KEY): once a day, researches the history behind the topics rising fastest right now,
 * so their trails are ready before anyone asks. Results stay unreviewed until an editor approves them.
 *   curl -H "Authorization: Bearer $INGEST_KEY" "https://your-site/api/public/research-trending?limit=2"
 * It takes turns between countries and the world; add &edition=NG to research one country only.
 */
async function handle(request: Request): Promise<Response> {
  const { refuseUnlessIngestKey } = await import("@/lib/ingest-auth.server");
  const refused = await refuseUnlessIngestKey(request);
  if (refused) return refused;
  const { agentConfigured, normalizeQuery, serviceClient, startResearch } = await import("@/lib/trail-agent.server");
  if (!agentConfigured()) return Response.json({ error: "Set ANTHROPIC_API_KEY and SUPABASE_SERVICE_ROLE_KEY first." }, { status: 503 });

  const url = new URL(request.url);
  const limit = Math.min(5, Math.max(1, Number(url.searchParams.get("limit")) || 2));
  const { EDITIONS, researchKey, researchScope } = await import("@/lib/editions");
  // One scope per country (and the world). "?edition=NG" researches just that one; otherwise they take turns.
  const only = url.searchParams.get("edition");
  const scopes = [...new Set(EDITIONS.map((e) => researchScope(e)))].filter((sc) => !only || sc.toLowerCase() === only.toLowerCase());
  const sb = serviceClient();
  const monthAgo = new Date(Date.now() - 30 * 86400_000).toISOString();
  type Cand = { scope: string; term: string };
  const queues: Cand[][] = [];
  for (const scope of scopes) {
    // A country's own edition (or the world) tells us what is rising there, whatever language it is read in.
    const edition = EDITIONS.find((e) => e.code === scope) ?? EDITIONS.find((e) => e.iso === scope && !e.code.includes("-"));
    if (!edition) continue;
    const { data: terms } = await sb.rpc("trending_terms", { _days: 7, _limit: 40, _edition: edition.code });
    queues.push((terms ?? []).filter((t) => t.stories >= 5).sort((a, b) => (b.stories - b.prev_stories) - (a.stories - a.prev_stories)).map((t) => ({ scope, term: t.term })));
  }
  const started: string[] = [], skipped: string[] = [];
  // Take turns between countries so one busy edition cannot use up the whole day's allowance.
  for (let round = 0; started.length < limit && queues.some((q) => q.length > round); round++) {
    for (const q of queues) {
      const c = q[round];
      if (!c || started.length >= limit) continue;
      const key = researchKey(normalizeQuery(c.term), c.scope);
      const { count } = await sb.from("trail_research").select("id", { count: "exact", head: true }).eq("query_key", key).gte("created_at", monthAgo);
      if (count) { skipped.push(`${c.term} [${c.scope}]`); continue; }
      const r = await startResearch(c.term, "scheduled", c.scope);
      if (r.started) started.push(`${c.term} [${c.scope}]`); else { skipped.push(`${c.term} [${c.scope}] (${r.reason})`); if (r.reason === "limit") return Response.json({ started, skipped }); }
    }
  }
  return Response.json({ started, skipped });
}

export const Route = createFileRoute("/api/public/research-trending")({
  server: { handlers: { GET: ({ request }) => handle(request), POST: ({ request }) => handle(request) } },
});
