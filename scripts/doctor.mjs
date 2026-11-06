#!/usr/bin/env node
// Checks your setup and tells you exactly what is missing.   Run:  npm run doctor
import fs from "node:fs";
import path from "node:path";

const out = [];
const log = (tag, msg, hint) => { out.push(tag); console.log(`  [${tag}] ${msg}`); if (hint) console.log(`        -> ${hint}`); };
const ok = (m) => log("ok", m), fix = (m, h) => log("fix", m, h), info = (m, h) => log("info", m, h);

// ---- read .env (and real environment variables, which win) ----
const env = {};
const file = path.join(process.cwd(), ".env");
if (fs.existsSync(file)) {
  for (const line of fs.readFileSync(file, "utf8").split(/\r?\n/)) {
    const m = /^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/.exec(line);
    if (m) env[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
}
const get = (k) => (process.env[k] ?? env[k] ?? "").trim();

console.log("\nBrief setup check\n");
console.log("1. Settings file");
if (!fs.existsSync(file)) fix("No .env file found in this folder.", "Create it: copy .env.example .env   (then fill in your Supabase values)");
else ok(".env found");

const url = get("SUPABASE_URL").replace(/\/$/, "");
const anon = get("SUPABASE_PUBLISHABLE_KEY");
for (const k of ["SUPABASE_URL", "SUPABASE_PUBLISHABLE_KEY", "VITE_SUPABASE_URL", "VITE_SUPABASE_PUBLISHABLE_KEY"]) {
  if (!get(k)) fix(`${k} is empty.`, "Copy it from Supabase: Project Settings -> API.");
}
if (get("VITE_SUPABASE_URL") && url && get("VITE_SUPABASE_URL").replace(/\/$/, "") !== url) fix("SUPABASE_URL and VITE_SUPABASE_URL are different.", "They must be the same address.");

const headers = (key) => ({ apikey: key, ...(key.startsWith("eyJ") ? { Authorization: `Bearer ${key}` } : {}) });
async function call(method, p, key, body) {
  try {
    const res = await fetch(url + p, { method, headers: { ...headers(key), ...(body ? { "Content-Type": "application/json" } : {}) }, body: body ? JSON.stringify(body) : undefined, signal: AbortSignal.timeout(10000) });
    let json = null; try { json = await res.json(); } catch { /* not json */ }
    return { status: res.status, json };
  } catch (e) { return { status: 0, json: { message: e.message } }; }
}

if (url && anon) {
  console.log("\n2. Database connection");
  const settings = await call("GET", "/auth/v1/settings", anon);
  if (settings.status === 0) fix(`Cannot reach ${url}.`, "Check your internet connection and that the address is exactly your project URL.");
  else if (settings.status === 401 || settings.status === 403) fix("The database rejected the public key.", "SUPABASE_PUBLISHABLE_KEY must be the anon/public key of this same project.");
  else {
    ok("Database reachable");
    if (url.includes("bqisgdtqmhhkqykostmc")) info("SUPABASE_URL still points at the original Lovable Cloud project.", "If you created your own Supabase project, put its URL and keys in .env.");

    console.log("\n3. Database setup (tables and functions)");
    const missingSteps = new Set();
    const tableCheck = async (table, step, col = "*") => {
      const r = await call("GET", `/rest/v1/${table}?select=${col}&limit=1`, anon);
      const code = r.json?.code ?? "";
      const missing = r.status === 404 || code === "PGRST205" || code === "42P01" || (r.status === 400 && code === "42703");
      if (missing) { missingSteps.add(step); fix(`Missing: ${table}${col !== "*" ? "." + col : ""}`); } else ok(`${table}${col !== "*" ? "." + col : ""}`);
    };
    await tableCheck("site_settings", "0000"); await tableCheck("ads", "0000"); await tableCheck("aspirant_entries", "0000");
    await tableCheck("page_views", "0000"); await tableCheck("security_events", "0000");
    await tableCheck("ads", "0001", "sponsor"); await tableCheck("aspirant_entries", "0001", "pillars");
    await tableCheck("aspirant_submissions", "0002"); await tableCheck("aspirant_entries", "0002", "candidate_statement");
    await tableCheck("social_trends", "0007"); await tableCheck("pronunciations", "0008"); await tableCheck("ai_trail_items", "0005"); await tableCheck("trail_research", "0005");
    await tableCheck("news_archive", "0003"); await tableCheck("trails", "0003"); await tableCheck("trail_events", "0003"); await tableCheck("trend_stopwords", "0003");
    const rpc = async (fn, step, args) => {
      const r = await call("POST", `/rest/v1/rpc/${fn}`, anon, args);
      if (r.status === 404 || r.json?.code === "PGRST202") { missingSteps.add(step); fix(`Missing function: ${fn}`); } else ok(`function ${fn}`);
    };
    await rpc("trending_terms", "0003", { _days: 1, _limit: 1 });
    await rpc("is_aal2", "0004", {});
    await rpc("purge_old_records", "0006", {});
    if (missingSteps.size) {
      const only0 = missingSteps.size === 1 && missingSteps.has("0000");
      console.log(`\n     The database is missing setup steps: ${[...missingSteps].sort().join(", ")}`);
      console.log(`        -> ${[...missingSteps].includes("0000") ? "New/empty project: run supabase-fresh-setup.sql" : "Existing project: run supabase-setup.sql"}`);
      console.log("           in Supabase -> SQL Editor -> New query -> paste the whole file -> Run. It is safe to run twice.");
      void only0;
    } else ok("All setup steps are present");

    console.log("\n4. Sign-in");
    const ext = settings.json?.external ?? {};
    if (ext.google) ok("Google sign-in is switched on (check the Client ID and secret are filled in)");
    else fix("Google sign-in is switched off.", "Supabase -> Authentication -> Sign In / Providers -> Google: turn on and paste the Client ID and secret from Google Cloud.");
    if (settings.json?.mailer_autoconfirm) info("Emails are auto-confirmed (anyone can sign up without verifying their email).", "Fine while setting up; consider turning it off for production.");
    else info("Sign-up emails need confirming.", "Supabase's built-in sender is very limited. Set your own SMTP under Authentication -> Emails for reliable delivery.");
    if (settings.json?.disable_signup) info("New sign-ups are disabled on the database (the first admin account must already exist).");
  }
}

console.log("\n5. Server secrets (history and alerts)");
const sr = get("SUPABASE_SERVICE_ROLE_KEY");
if (!sr) fix("SUPABASE_SERVICE_ROLE_KEY is not set, so no news history is saved (Trending and Trails stay empty).", "Supabase -> Project Settings -> API -> service_role key. Keep it secret.");
else if (sr === anon) fix("SUPABASE_SERVICE_ROLE_KEY is the same as the public key.", "Use the service_role (secret) key, not the anon key.");
else {
  let role = "";
  if (sr.startsWith("eyJ")) { try { role = JSON.parse(Buffer.from(sr.split(".")[1], "base64url").toString()).role; } catch { /* ignore */ } }
  if (sr.startsWith("eyJ") && role !== "service_role") fix(`That key's role is "${role || "unknown"}", not service_role.`, "Copy the service_role key.");
  else if (url) {
    const r = await call("GET", "/rest/v1/news_archive?select=id&limit=1", sr);
    if (r.status === 200) ok("Service key works: history can be saved");
    else if (r.status === 404) fix("Service key is fine, but the history tables are missing (see step 3).");
    else fix(`Service key was rejected (HTTP ${r.status}).`, r.json?.message ?? "Check you copied the whole key.");
  }
}
const ik = get("INGEST_KEY");
if (!ik) info("INGEST_KEY is not set.", "Optional: set it and have a free cron service call /api/public/ingest every 20 minutes so history grows with no visitors.");
else if (ik.length < 16) fix("INGEST_KEY is too short.", "Use at least 16 random characters.");
else ok("INGEST_KEY set");

const ch = [];
if (get("RESEND_API_KEY") && get("ALERT_EMAILS")) ch.push("email");
if (get("AT_API_KEY") && get("AT_USERNAME") && get("ALERT_SMS")) ch.push("SMS");
if (get("TELEGRAM_BOT_TOKEN") && get("TELEGRAM_CHAT_ID")) ch.push("Telegram");
if (ch.length) ok(`Security alerts will go by: ${ch.join(", ")}`);
else info("No security alert channel is set up.", "See SETUP.md section 6 (email, SMS and Telegram).");

console.log("\n6. Legal pages (Terms, Privacy, Editorial)");
const legal = [["VITE_LEGAL_NAME", "your registered business name"], ["VITE_LEGAL_ADDRESS", "your registered address"], ["VITE_CONTACT_EMAIL", "a monitored contact email"]];
const unset = legal.filter(([k]) => !get(k));
if (unset.length) fix(`Not set: ${unset.map(([k]) => k).join(", ")}. The legal pages show [bracketed] placeholders until you add ${unset.map(([, d]) => d).join(", ")}.`, "Add them to .env, restart, and have a Kenyan advocate review the pages before launch.");
else ok("Legal details filled in (still have a Kenyan advocate review the pages)");

console.log("\n7. AI research agent");
if (get("ANTHROPIC_API_KEY") && sr) ok("Agent can run (web search must also be enabled for your Anthropic organisation)");
else info("Agent is off. It needs ANTHROPIC_API_KEY and SUPABASE_SERVICE_ROLE_KEY.", "Optional: lets visitors request earlier history for a topic. Existing results still show.");

console.log("\n8. Optional");
if (get("AZURE_SPEECH_KEY") && get("AZURE_SPEECH_REGION")) ok("Bulletin voice: Microsoft Azure, Kenyan English (Asilia and Chilemba)");
else if (get("ELEVENLABS_API_KEY")) info("Bulletin voice: ElevenLabs. For a Kenyan accent, set ELEVENLABS_VOICE_AMANI / _BARAKA to Kenyan voices, or add AZURE_SPEECH_KEY and AZURE_SPEECH_REGION.");
else info("No studio voice: the bulletin uses the browser's built-in voice (Microsoft Edge has Kenyan English voices).", "For a Kenyan accent for everyone, add AZURE_SPEECH_KEY and AZURE_SPEECH_REGION (see SETUP.md).");
get("ANTHROPIC_API_KEY") ? ok("AI writer for the daily brief is on") : info("No ANTHROPIC_API_KEY: the daily brief shows headlines grouped by topic.");
get("VITE_SITE_URL") ? ok(`Share links use ${get("VITE_SITE_URL")}`) : info("VITE_SITE_URL not set: share links use whatever address the visitor is on.");
if (get("VITE_REQUIRE_MFA") === "false") info("Two-factor is NOT being enforced (VITE_REQUIRE_MFA=false).", "Remove that line once your authenticator is set up.");

console.log("\n9. Languages, social lists and running on your own server");
get("YOUTUBE_API_KEY") ? ok("YouTube trending list is on") : info("No YOUTUBE_API_KEY: the Trending page leaves out the YouTube list.", "Free key: Google Cloud console, YouTube Data API v3.");
get("X_BEARER_TOKEN") ? ok("X trending list is on (X charges per request; results are reused for " + (get("X_TRENDS_TTL_MINUTES") || "60") + " minutes)") : info("No X_BEARER_TOKEN: the Trending page leaves out the X list.");
const major = Number(process.versions.node.split(".")[0]);
major >= 20 ? ok(`Node ${process.versions.node}`) : fix(`Node ${process.versions.node} is too old.`, "Install Node 20 or newer (Node 22 recommended).");
fs.existsSync(path.join(process.cwd(), ".output", "server", "index.mjs")) ? ok("A Node build exists (.output). npm start runs it.") : info("No Node build yet.", "On your server: npm install, then npm run build:node, then npm start. See deploy/DEPLOY.md.");
if (get("VITE_SITE_URL") && !/^https:/.test(get("VITE_SITE_URL")) && !/localhost|127\.0\.0\.1/.test(get("VITE_SITE_URL"))) fix("VITE_SITE_URL is not https.", "Use your real https address so share links and the sitemap are correct.");
const every = get("INGEST_EVERY_MINUTES");
get("INGEST_KEY") && every !== "0" ? ok(`npm start will refresh every edition every ${every || 20} minutes`) : info("npm start will not refresh the archive by itself.", "Set INGEST_KEY, or call /api/public/ingest from your own scheduler.");

const fixes = out.filter((t) => t === "fix").length;
console.log(fixes ? `\n${fixes} thing${fixes === 1 ? "" : "s"} to fix. Work through the [fix] lines above, then run this again.\n` : "\nAll good.\n");
process.exit(fixes ? 1 : 0);
