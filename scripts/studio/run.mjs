// Makes a picture and a reel for each new top story, uploads them to the site, and reports progress.
// Needs SITE_URL (no trailing slash) and INGEST_KEY, the same two secrets the news-saving job uses.
// Whether it does anything, for which editions, and whether results are published at once, is set in the admin under Studio.
import { cardPng, cardReel } from "./render-lib.mjs";

const SITE = (process.env.SITE_URL ?? "").replace(/\/$/, "");
const KEY = process.env.INGEST_KEY ?? "";
if (!SITE || !KEY) { console.error("SITE_URL and INGEST_KEY must both be set."); process.exit(1); }

async function api(path, init = {}) {
  const res = await fetch(SITE + path, { ...init, headers: { Authorization: `Bearer ${KEY}`, ...(init.headers ?? {}) }, signal: AbortSignal.timeout(180_000) });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`${path}: ${res.status} ${body.error ?? ""}`.trim());
  return body;
}
async function voiceFor(edition, text, voice) {
  const res = await fetch(`${SITE}/api/public/studio-voice`, { method: "POST", headers: { Authorization: `Bearer ${KEY}`, "Content-Type": "application/json" }, body: JSON.stringify({ edition, text, voice }), signal: AbortSignal.timeout(90_000) });
  if (!res.ok) throw new Error(`voice: ${res.status} ${((await res.json().catch(() => ({}))).error ?? "")}`.trim());
  return Buffer.from(await res.arrayBuffer());
}
const report = (json) => api("/api/public/studio-run", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(json) });

function upload(edition, s, kind, bytes) {
  const f = new FormData();
  for (const [k, v] of Object.entries({ edition, key: s.key, kind, title: s.title, category: s.category, caption: s.caption, link: s.path, links: JSON.stringify(s.links) })) f.append(k, v);
  f.append("file", new Blob([bytes], { type: kind === "image" ? "image/png" : "video/mp4" }), `${s.key}-${kind}.${kind === "image" ? "png" : "mp4"}`);
  return api("/api/public/studio-upload", { method: "POST", body: f });
}

const { config } = await api("/api/public/studio-plan");
if (!config.enabled && !process.env.FORCE) { console.log("The Studio service is switched off in the admin. Nothing to do."); process.exit(0); }

const address = `${SITE.replace(/^https?:\/\//, "")}/brief`;
let made = 0, failed = 0;
for (const edition of config.editions) {
  let plan;
  try { plan = await api(`/api/public/studio-plan?edition=${encodeURIComponent(edition)}`); } catch (e) { console.error(`${edition}: could not get the plan: ${e.message}`); failed++; continue; }
  if (!plan.stories.length) { console.log(`${edition}: nothing new to make (${plan.madeToday} made today).`); continue; }
  const { runId } = await report({ action: "start", edition, planned: plan.stories.length });
  for (const s of plan.stories) {
    try {
      const card = { kind: "headline", quote: s.title, speaker: s.sources.length ? `Reported by ${s.sources.join(", ")}` : "", role: "", category: s.category, url: address };
      await upload(edition, s, "image", cardPng(card, 1080, 1080));
      let voice = null, note = "";
      if (config.voice && config.voice !== "off") {
        try { voice = await voiceFor(edition, s.voiceText, config.voice); } catch (e) { note = `no voice-over (${String(e.message).slice(0, 120)})`; } // the reel is still made, just without it
      }
      const sent = await upload(edition, s, "video", await cardReel(card, { seconds: 9, music: "news", voice }));
      const social = Object.entries(sent.social ?? {}).map(([k, v]) => `${k}: ${v}`).join("; ");
      await report({ action: "progress", runId, title: s.title, state: "done", note: [note, social].filter(Boolean).join(" · ").slice(0, 280) });
      made++; console.log(`${edition}: made "${s.title}"`);
    } catch (e) {
      failed++; console.error(`${edition}: failed "${s.title}": ${e.message}`);
      await report({ action: "progress", runId, title: s.title, state: "failed", note: String(e.message).slice(0, 280) }).catch(() => undefined);
    }
  }
  await report({ action: "finish", runId }).catch((e) => console.error("could not close the run:", e.message));
}
console.log(`Done: ${made} made, ${failed} failed.`);
if (failed && !made) process.exit(1);
