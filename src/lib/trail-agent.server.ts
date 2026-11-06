import { createClient } from "@supabase/supabase-js";
import { editionOf, researchKey, WORLD } from "./editions";
import type { Database } from "@/integrations/supabase/types";

/* ------------------------------------------------------------------ *
 * AI trail research. The model may only use pages it actually found with
 * the web-search tool, and every kept event must link to one of those pages.
 * ------------------------------------------------------------------ */

export type AgentItem = { date: string; precision: "day" | "month" | "year"; title: string; summary: string; url: string; publisher: string };
export type AgentResult = { items: AgentItem[]; dropped: string[]; searches: number; inputTokens: number; outputTokens: number };

const env = (k: string) => (process.env[k] ?? "").trim();
export const agentConfigured = () => !!(env("ANTHROPIC_API_KEY") && env("SUPABASE_URL") && env("SUPABASE_SERVICE_ROLE_KEY"));
export const agentModel = () => env("TRAIL_AGENT_MODEL") || "claude-haiku-4-5-20251001";
export const dailyLimit = () => Number(env("TRAIL_AGENT_DAILY_LIMIT")) || 25;
export const visitorDailyLimit = () => Number(env("TRAIL_AGENT_VISITOR_DAILY_LIMIT")) || 15;

/** The same topic typed in different ways maps to one key. */
export const normalizeQuery = (q: string) => q.toLowerCase().replace(/[“”"']/g, "").replace(/\s+/g, " ").trim().slice(0, 120);

const TRACKING = /^(utm_|fbclid|gclid|mc_|ref$|ref_)/i;
export function normalizeUrl(raw: string): string | null {
  try {
    const u = new URL(raw);
    if (u.protocol !== "http:" && u.protocol !== "https:") return null;
    const params = [...u.searchParams.entries()].filter(([k]) => !TRACKING.test(k)).sort(([a], [b]) => a.localeCompare(b));
    const path = u.pathname.length > 1 ? u.pathname.replace(/\/+$/, "") : "";
    return `${u.hostname.replace(/^www\./, "").toLowerCase()}${path}${params.length ? "?" + params.map(([k, v]) => `${k}=${v}`).join("&") : ""}`;
  } catch { return null; }
}

type Block = { type?: string; text?: string; name?: string; content?: unknown; citations?: { url?: string; title?: string }[] | null };
type ApiResponse = { content?: Block[]; stop_reason?: string; usage?: { input_tokens?: number; output_tokens?: number; server_tool_use?: { web_search_requests?: number } } };

/** Every page the search tool really returned (or the model cited), keyed by normalised URL. */
export function collectGrounding(blocks: Block[]): Map<string, { url: string; title: string }> {
  const out = new Map<string, { url: string; title: string }>();
  const add = (url?: string, title?: string) => {
    if (!url) return;
    const key = normalizeUrl(url);
    if (key && !out.has(key)) out.set(key, { url, title: title ?? "" });
  };
  for (const b of blocks) {
    if (b.type === "web_search_tool_result" && Array.isArray(b.content)) {
      for (const r of b.content as { url?: string; title?: string }[]) add(r?.url, r?.title);
    }
    if (b.type === "text") for (const c of b.citations ?? []) add(c?.url, c?.title);
  }
  return out;
}

const BLOCKED_HOSTS = /(^|\.)(facebook|fb|instagram|tiktok|twitter|x|t|whatsapp|youtube|youtu)\.(com|be|co|me)$/i;

export function parseEventDate(date: unknown, precision: unknown): { iso: string; precision: AgentItem["precision"] } | null {
  const s = String(date ?? "").trim();
  let m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
  let p: AgentItem["precision"] = "day";
  let y: number, mo: number, d: number;
  if (m) { y = +m[1]!; mo = +m[2]!; d = +m[3]!; }
  else if ((m = /^(\d{4})-(\d{2})$/.exec(s))) { y = +m[1]!; mo = +m[2]!; d = 1; p = "month"; }
  else if ((m = /^(\d{4})$/.exec(s))) { y = +m[1]!; mo = 1; d = 1; p = "year"; }
  else return null;
  const t = Date.UTC(y, mo - 1, d);
  const check = new Date(t);
  if (check.getUTCFullYear() !== y || check.getUTCMonth() !== mo - 1 || check.getUTCDate() !== d) return null;
  if (y < 1963 || t > Date.now()) return null;
  if (precision === "month" && p === "day") p = "month";
  return { iso: new Date(t).toISOString().slice(0, 10), precision: p };
}

/** Keeps only well-formed events whose link came from the search results. Returns what was dropped, and why. */
export function validateEvents(events: unknown, grounding: Map<string, { url: string; title: string }>): { items: AgentItem[]; dropped: string[] } {
  const items: AgentItem[] = [], dropped: string[] = [], seen = new Set<string>();
  if (!Array.isArray(events)) return { items, dropped: ["no events array"] };
  for (const e of events as Record<string, unknown>[]) {
    const title = String(e?.["title"] ?? "").trim().slice(0, 200);
    const key = normalizeUrl(String(e?.["url"] ?? ""));
    const g = key ? grounding.get(key) : undefined;
    const d = parseEventDate(e?.["date"], e?.["precision"]);
    if (title.length < 3) { dropped.push("missing title"); continue; }
    if (!key || !g) { dropped.push(`not from search results: ${title.slice(0, 50)}`); continue; }
    if (!d) { dropped.push(`bad date: ${title.slice(0, 50)}`); continue; }
    if (BLOCKED_HOSTS.test(new URL(g.url).hostname)) { dropped.push(`social media source: ${title.slice(0, 50)}`); continue; }
    if (seen.has(key)) continue;
    seen.add(key);
    let summary = String(e?.["summary"] ?? "").trim();
    if (summary.length > 320) summary = summary.slice(0, 317).trimEnd() + "…";
    const publisher = String(e?.["publisher"] ?? "").trim().slice(0, 120) || new URL(g.url).hostname.replace(/^www\./, "");
    items.push({ date: d.iso, precision: d.precision, title, summary, url: g.url, publisher });
    if (items.length >= 20) break;
  }
  return { items: items.sort((a, b) => a.date.localeCompare(b.date)), dropped };
}

export function parseAgentJson(blocks: Block[]): unknown {
  const text = blocks.filter((b) => b.type === "text").map((b) => b.text ?? "").join("\n");
  const start = text.indexOf("{"), end = text.lastIndexOf("}");
  if (start < 0 || end <= start) throw new Error("The research agent did not return structured results.");
  return JSON.parse(text.slice(start, end + 1)).events;
}

const systemFor = (place: string) => `You are a research assistant for Brief, a news site. Build a factual timeline of how a topic has developed ${place === "the world" ? "around the world" : `in ${place}`} over the years.

Rules:
- Use the web_search tool. Only include events you found in search results. Never rely on memory alone. Every event must carry ONE url taken from the search results.
- Prefer reputable ${place === "the world" ? "international" : "local"} outlets, wire services and official sources (governments, courts, electoral commissions, national weather and statistics agencies, UN agencies).
- Be neutral and factual. Say what happened or was reported, in your own words, at most 280 characters. Never copy sentences from articles. No opinion, speculation or insults.
- Do not include allegations of crime or misconduct about private individuals, anything about minors, or unverified rumours. For public officials include only officially recorded matters (court decisions, official statements, formal findings) and say who stated them.
- Cover different years where possible: 8 to 15 events from oldest to newest, including turning points and outcomes, not only recent news.
- Dates: "YYYY-MM-DD" when known, otherwise "YYYY-MM" or "YYYY", with matching "precision" of "day", "month" or "year".

Reply with ONLY JSON, no other text:
{"events":[{"date":"2023-11-20","precision":"day","title":"short headline","summary":"one or two neutral sentences","url":"https://...","publisher":"outlet name"}]}
If you cannot find reliable sources, reply {"events":[]}.`;

async function callApi(body: unknown): Promise<ApiResponse> {
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "x-api-key": env("ANTHROPIC_API_KEY"), "anthropic-version": "2023-06-01", "content-type": "application/json" },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(120_000),
  });
  if (!res.ok) {
    const text = (await res.text()).slice(0, 300);
    throw new Error(/web.?search/i.test(text) && /not (enabled|allowed)|permission/i.test(text)
      ? "Web search is not enabled for this Anthropic account. An organisation admin can switch it on in the Claude Console settings."
      : `Anthropic API ${res.status}: ${text}`);
  }
  return (await res.json()) as ApiResponse;
}

export async function researchTopic(query: string, scope = "KE"): Promise<AgentResult> {
  const edition = editionOf(scope);
  const place = scope === WORLD ? "the world" : (edition.place ?? scope);
  const messages: { role: "user" | "assistant"; content: unknown }[] = [
    { role: "user", content: `Topic (alternatives are separated by OR; quoted words are exact phrases): ${query}\n\nBuild the timeline for ${place}. Write the timeline in English.` },
  ];
  const tools = [{ type: "web_search_20250305", name: "web_search", max_uses: 6, ...(scope === WORLD ? {} : { user_location: { type: "approximate", country: edition.iso ?? scope, timezone: edition.tz } }) }];
  const blocks: Block[] = [];
  let inputTokens = 0, outputTokens = 0, searches = 0;

  for (let turn = 0; turn < 4; turn++) {
    const r = await callApi({ model: agentModel(), max_tokens: 4000, system: systemFor(place), messages, tools });
    blocks.push(...(r.content ?? []));
    inputTokens += r.usage?.input_tokens ?? 0;
    outputTokens += r.usage?.output_tokens ?? 0;
    searches += r.usage?.server_tool_use?.web_search_requests ?? 0;
    if (r.stop_reason !== "pause_turn") break; // pause_turn: the search is still going, so continue it
    messages.push({ role: "assistant", content: r.content ?? [] });
  }
  const grounding = collectGrounding(blocks);
  const { items, dropped } = validateEvents(parseAgentJson(blocks), grounding);
  return { items, dropped, searches, inputTokens, outputTokens };
}

/* ---------------- orchestration (database) ---------------- */
function writer() {
  return createClient<Database>(env("SUPABASE_URL"), env("SUPABASE_SERVICE_ROLE_KEY"), { auth: { persistSession: false, autoRefreshToken: false } });
}
export const serviceClient = writer;

export type StartResult = { started: boolean; reason?: "running" | "limit" | "unavailable"; researchId?: string };

/** Starts a research run in the background and returns at once. Poll the status to see when it finishes. */
export async function startResearch(query: string, origin: "visitor" | "staff" | "scheduled", scope = "KE"): Promise<StartResult> {
  if (!agentConfigured()) return { started: false, reason: "unavailable" };
  const sb = writer();
  const key = researchKey(normalizeQuery(query), scope);
  const since = new Date(Date.now() - 24 * 3600_000).toISOString();

  // A crashed server could leave a run stuck as "running"; free it after 10 minutes.
  await sb.from("trail_research").update({ status: "failed", error: "Timed out", finished_at: new Date().toISOString() })
    .eq("status", "running").lt("created_at", new Date(Date.now() - 10 * 60_000).toISOString());

  const [{ count: today }, { count: byVisitors }] = await Promise.all([
    sb.from("trail_research").select("id", { count: "exact", head: true }).gte("created_at", since),
    sb.from("trail_research").select("id", { count: "exact", head: true }).gte("created_at", since).eq("origin", "visitor"),
  ]);
  if ((today ?? 0) >= dailyLimit() || (origin === "visitor" && (byVisitors ?? 0) >= visitorDailyLimit())) return { started: false, reason: "limit" };

  const { data: row, error } = await sb.from("trail_research").insert({ query_key: key, query: query.slice(0, 200), origin }).select("id").single();
  if (error || !row) return { started: false, reason: "running" }; // unique index: this topic is already being researched

  void (async () => {
    try {
      const r = await researchTopic(query, scope);
      if (r.items.length) {
        await sb.from("ai_trail_items").upsert(
          r.items.map((i) => ({ research_id: row.id, query_key: key, event_date: i.date, date_precision: i.precision, title: i.title, summary: i.summary, url: i.url, publisher: i.publisher })),
          { onConflict: "query_key,url", ignoreDuplicates: true },
        );
      }
      await sb.from("trail_research").update({ status: "done", items_found: r.items.length, searches: r.searches, input_tokens: r.inputTokens, output_tokens: r.outputTokens, finished_at: new Date().toISOString() }).eq("id", row.id);
      if (r.dropped.length) console.warn(`[agent] "${key}": dropped ${r.dropped.length} event(s): ${r.dropped.slice(0, 3).join("; ")}`);
    } catch (e) {
      const msg = (e instanceof Error ? e.message : String(e)).slice(0, 380);
      console.error(`[agent] research failed for "${key}":`, msg);
      await sb.from("trail_research").update({ status: "failed", error: msg, finished_at: new Date().toISOString() }).eq("id", row.id);
    }
  })();
  return { started: true, researchId: row.id };
}

/* ---------------- visitor throttle (per server instance) ---------------- */
const hits = new Map<string, number[]>();
export function visitorAllowed(ip: string, perHour = 3): boolean {
  const now = Date.now();
  const recent = (hits.get(ip) ?? []).filter((t) => now - t < 3600_000);
  if (recent.length >= perHour) return false;
  hits.set(ip, [...recent, now]);
  if (hits.size > 5000) hits.clear();
  return true;
}
export const _resetThrottle = () => hits.clear();
