#!/usr/bin/env node
// Asks the site to fetch the news and save it to the archive.   Run:  npm run ingest
// Usage: node scripts/ingest.mjs [site address]     (default: http://localhost:8080)
import { loadEnv } from "./env.mjs";

const get = loadEnv();
const base = (process.argv[2] || get("VITE_SITE_URL") || "http://localhost:8080").replace(/\/$/, "");
const key = get("INGEST_KEY");
if (!key) { console.error("INGEST_KEY is not set. Add a line INGEST_KEY=\"some-long-random-text\" to .env and restart the site."); process.exit(1); }

try {
  const res = await fetch(`${base}/api/public/ingest`, { headers: { Authorization: `Bearer ${key}` }, signal: AbortSignal.timeout(120_000) });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) { console.error(`Failed (${res.status}): ${body.error ?? "unknown error"}`); process.exit(1); }
  console.log(`${new Date().toLocaleString()}  fetched ${body.fetched} headlines${body.archiving ? `, saved ${body.lastRun?.sent ?? 0}` : " (NOT saving: the server has no SUPABASE_SERVICE_ROLE_KEY)"}`);
  if (body.lastRun?.error) { console.error(`Save error: ${body.lastRun.error}`); process.exit(1); }
} catch (e) {
  console.error(`Could not reach ${base}. Is the site running? (${e.message})`);
  process.exit(1);
}
