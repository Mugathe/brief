#!/usr/bin/env node
// Runs the built Node server (after npm run build:node), with the settings from .env, and keeps the news archive growing.
//   PORT / HOST              where to listen (default 3000 on 127.0.0.1: put Caddy or Nginx in front)
//   INGEST_EVERY_MINUTES     refresh every edition and save the headlines this often (default 20; 0 turns it off,
//                            for when you call /api/public/ingest from your own scheduler). Needs INGEST_KEY.
// Run one copy only (pm2 "fork" mode): two copies would each run the schedule.
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { applyEnvFile } from "./env.mjs";

const root = process.cwd();
const entry = path.join(root, ".output", "server", "index.mjs");
if (!fs.existsSync(entry)) {
  console.error("There is no build yet. Run:  npm run build:node   and then  npm start");
  process.exit(1);
}

applyEnvFile(root);
process.env.NODE_ENV ??= "production";
process.env.PORT ??= "3000";
process.env.HOST ??= "127.0.0.1";

await import(pathToFileURL(entry).href);

const minutes = Number(process.env.INGEST_EVERY_MINUTES ?? 20);
const key = process.env.INGEST_KEY;
if (minutes > 0 && key) {
  const url = `http://127.0.0.1:${process.env.PORT}/api/public/ingest`;
  let running = false;
  const run = async () => {
    if (running) return; // never overlap two refreshes
    running = true;
    try {
      const res = await fetch(url, { headers: { Authorization: `Bearer ${key}` }, signal: AbortSignal.timeout(180_000) });
      const body = await res.json().catch(() => ({}));
      const empty = (body.editions ?? []).reduce((n, e) => n + (e.emptyFeeds?.length ?? 0), 0);
      console.log(`[ingest] ${new Date().toISOString()} ${res.status} fetched ${body.fetched ?? "?"} stories, ${empty} empty feeds`);
    } catch (e) {
      console.error(`[ingest] failed: ${e instanceof Error ? e.message : e}`);
    } finally {
      running = false;
    }
  };
  setTimeout(run, 20_000); // first run shortly after the server is up
  setInterval(run, Math.max(5, minutes) * 60_000).unref?.();
  console.log(`[ingest] refreshing every ${Math.max(5, minutes)} minutes`);
} else if (minutes > 0) {
  console.log("[ingest] not scheduled: set INGEST_KEY in .env to keep the archive growing automatically.");
}
