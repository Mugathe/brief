#!/usr/bin/env node
// Fills the archive with past years of headlines, so Trails can go back in time.
//
//   npm run backfill -- --trails --from 2015-01            every published trail, back to 2015
//   npm run backfill -- --query "drought OR famine" --from 2016-01
//   Options: --to YYYY-MM-DD   --sites nation.africa,the-star.co.ke   --delay 3000   --dry-run   --fresh   --no-kenya
//
// Needs SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env. Safe to stop and run again: it resumes.
import fs from "node:fs";
import { loadEnv } from "./env.mjs";
import { parseArgs, runBackfill } from "./backfill-lib.mjs";

const get = loadEnv();
const args = parseArgs(process.argv.slice(2));
const url = get("SUPABASE_URL").replace(/\/$/, ""), key = get("SUPABASE_SERVICE_ROLE_KEY");
const dry = !!args["dry-run"];
if (!dry && (!url || !key)) { console.error("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set in .env (run npm run doctor)."); process.exit(1); }

const headers = { apikey: key, ...(key.startsWith("eyJ") ? { Authorization: `Bearer ${key}` } : {}) };
const STATE = ".backfill-state.json";
const allState = !args["fresh"] && fs.existsSync(STATE) ? JSON.parse(fs.readFileSync(STATE, "utf8")) : {};

const feedBase = typeof args["feed-base"] === "string" ? args["feed-base"] : "https://news.google.com"; // (override is for testing)
async function fetchText(u, tries = 4) {
  u = u.replace("https://news.google.com", feedBase);
  for (let n = 0; n < tries; n++) {
    const res = await fetch(u, { headers: { "User-Agent": "Mozilla/5.0 (KenyaPulse archive backfill)" }, signal: AbortSignal.timeout(20_000) }).catch(() => null);
    if (res?.ok) return res.text();
    const wait = Math.min(60_000, 5000 * 2 ** n);
    console.log(`  Google said ${res?.status ?? "no answer"}, waiting ${wait / 1000}s before trying again…`);
    await new Promise((r) => setTimeout(r, wait));
  }
  throw new Error("Google News kept refusing. Stop for a while and run the same command again later: it will resume.");
}

async function write(rows) {
  if (dry) return;
  for (let i = 0; i < rows.length; i += 200) {
    const res = await fetch(`${url}/rest/v1/news_archive?on_conflict=link`, {
      method: "POST", headers: { ...headers, "Content-Type": "application/json", Prefer: "resolution=ignore-duplicates,return=minimal" }, body: JSON.stringify(rows.slice(i, i + 200)),
    });
    if (!res.ok) throw new Error(`Database refused the rows (${res.status}): ${(await res.text()).slice(0, 200)}. Run npm run doctor.`);
  }
}

let jobs = [];
if (args["trails"]) {
  const res = await fetch(`${url}/rest/v1/trails?select=slug,title,query,since&published=eq.true`, { headers });
  if (!res.ok) { console.error(`Could not read trails (${res.status}). Have you run the database setup SQL?`); process.exit(1); }
  jobs = (await res.json()).map((t) => ({ label: t.title, query: t.query, from: args["from"] || t.since || "2015-01" }));
  if (!jobs.length) { console.error("No published trails to fill. Create one in the admin page, or use --query."); process.exit(1); }
} else if (typeof args["query"] === "string") {
  jobs = [{ label: args["query"], query: args["query"], from: args["from"] || "2015-01" }];
} else {
  console.error('Tell me what to fill:  --trails   or   --query "your topic"   (see the top of scripts/backfill.mjs)'); process.exit(1);
}

const sites = typeof args["sites"] === "string" ? args["sites"].split(",").map((s) => s.trim()).filter(Boolean) : [];
const to = typeof args["to"] === "string" ? args["to"] : new Date().toISOString().slice(0, 10);
const delayMs = Number(args["delay"]) || 3000;
let total = 0;

try {
for (const job of jobs) {
  console.log(`\n${job.label}\n  searching ${job.from} to ${to}${sites.length ? ` on ${sites.join(", ")}` : " across Kenyan news"}${dry ? "  (dry run: nothing is saved)" : ""}`);
  const id = `${job.query}|${sites.join(",")}`;
  const state = allState[id] ?? { done: [] };
  const stats = await runBackfill({
    query: job.query, sites, from: job.from, to, delayMs, state, fetchText, write, addKenya: !args["no-kenya"], log: (s) => console.log(s),
    saveState: (s) => { allState[id] = s; if (!dry) fs.writeFileSync(STATE, JSON.stringify(allState, null, 1)); },
  });
  total += stats.rows;
  console.log(`  done: ${stats.rows} headlines from ${stats.windows} periods (${stats.skipped} already done)${stats.capped ? `, ${stats.capped} busy days may be incomplete` : ""}`);
}
console.log(`\nFinished. ${total} headlines ${dry ? "found" : "saved"}. Open the Trails page to see the earlier years.`);
} catch (e) {
  console.error(`\nStopped: ${e.message}`);
  console.error("Nothing is lost. Fix the problem above and run the same command again; it picks up where it left off.");
  process.exit(1);
}
