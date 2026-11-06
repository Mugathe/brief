import { createServerFn } from "@tanstack/react-start";
import { getRequestHeader } from "@tanstack/react-start/server";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { editionOf, parseEdition, researchKey, researchScope } from "./editions";

/** Which country or world a timeline is about, from the edition the reader is in. */
const scopeOf = (edition?: string) => researchScope(editionOf(parseEdition(edition)));
const editionField = z.string().max(8).optional();

export type AiItem = { id: string; date: string; precision: "day" | "month" | "year"; title: string; summary: string; url: string; publisher: string; reviewed: boolean };
export type ResearchState = {
  enabled: boolean; available: boolean; status: "none" | "running" | "done" | "failed"; items: AiItem[]; canRequest: boolean; finishedAt: string | null;
};
export type AiSettings = { enabled: boolean; showUnreviewed: boolean };
const DEFAULTS: AiSettings = { enabled: true, showUnreviewed: true };

export function parseAiSettings(v: unknown): AiSettings {
  const o = (v ?? {}) as Record<string, unknown>;
  return { enabled: o["enabled"] !== false, showUnreviewed: o["showUnreviewed"] !== false };
}

const topic = z.string().trim().min(3).max(80).refine((v) => /[a-z]/i.test(v), "Type a topic with some letters in it.");

async function settings(): Promise<AiSettings> {
  try {
    const { publicClient } = await import("./public-client.server");
    const { data } = await publicClient().from("site_settings").select("value").eq("key", "ai_trails").maybeSingle();
    return data ? parseAiSettings(data.value) : DEFAULTS;
  } catch { return DEFAULTS; }
}

/* ---------------- Visitors ---------------- */
export const getResearch = createServerFn({ method: "GET" })
  .inputValidator((d) => z.object({ q: z.string().trim().min(2).max(200), edition: editionField }).parse(d))
  .handler(async ({ data }): Promise<ResearchState> => {
    const { normalizeQuery, agentConfigured, serviceClient } = await import("./trail-agent.server");
    const { publicClient } = await import("./public-client.server");
    const key = researchKey(normalizeQuery(data.q), scopeOf(data.edition));
    const s = await settings();
    const none: ResearchState = { enabled: s.enabled, available: false, status: "none", items: [], canRequest: false, finishedAt: null };
    if (!s.enabled) return none;

    const { data: rows } = await publicClient().from("ai_trail_items").select("id,event_date,date_precision,title,summary,url,publisher,status").eq("query_key", key).neq("status", "rejected").order("event_date", { ascending: true });
    const items: AiItem[] = (rows ?? [])
      .filter((r) => s.showUnreviewed || r.status === "approved")
      .map((r) => ({ id: r.id, date: r.event_date, precision: r.date_precision as AiItem["precision"], title: r.title, summary: r.summary, url: r.url, publisher: r.publisher, reviewed: r.status === "approved" }));

    const available = agentConfigured();
    let status: ResearchState["status"] = items.length ? "done" : "none";
    let finishedAt: string | null = null, canRequest = false;
    if (available) {
      const { data: run } = await serviceClient().from("trail_research").select("status,created_at,finished_at").eq("query_key", key).order("created_at", { ascending: false }).limit(1).maybeSingle();
      if (run) {
        status = run.status as ResearchState["status"];
        finishedAt = run.finished_at;
        const age = Date.now() - Date.parse(run.finished_at ?? run.created_at);
        canRequest = run.status === "failed" ? age > 10 * 60_000 : run.status === "done" ? age > 30 * 86400_000 : false;
      } else canRequest = true;
    }
    return { enabled: true, available, status, items, canRequest: canRequest && key.length >= 3, finishedAt };
  });

export const requestResearch = createServerFn({ method: "POST" })
  .inputValidator((d) => z.object({ q: topic, edition: editionField }).parse(d))
  .handler(async ({ data }): Promise<{ started: boolean; message: string }> => {
    const s = await settings();
    if (!s.enabled) return { started: false, message: "AI research is switched off right now." };
    const { agentConfigured, startResearch, visitorAllowed } = await import("./trail-agent.server");
    if (!agentConfigured()) return { started: false, message: "AI research isn't available on this site yet." };
    const ip = (getRequestHeader("cf-connecting-ip") ?? getRequestHeader("x-forwarded-for") ?? "unknown").split(",")[0]!.trim();
    if (!visitorAllowed(ip)) return { started: false, message: "You've asked for several topics in the last hour. Please try again later." };
    const r = await startResearch(data.q, "visitor", scopeOf(data.edition));
    if (r.started) return { started: true, message: "Researching. This takes up to a minute." };
    if (r.reason === "running") return { started: true, message: "This topic is already being researched." };
    if (r.reason === "limit") return { started: false, message: "We've reached today's research limit. Please try again tomorrow." };
    return { started: false, message: "AI research isn't available right now." };
  });

/* ---------------- Staff ---------------- */
type Ctx = { supabase: any; userId: string };
const c = (x: unknown) => x as Ctx;
async function roles(ctx: Ctx): Promise<string[]> {
  const { data } = await ctx.supabase.from("user_roles").select("role").eq("user_id", ctx.userId);
  return (data ?? []).map((r: { role: string }) => r.role);
}
async function need(ctx: Ctx, allowed: string[], msg: string) { if (!(await roles(ctx)).some((r) => allowed.includes(r))) throw new Error(msg); }
async function audit(ctx: Ctx, type: string, detail: string) { await ctx.supabase.from("security_events").insert({ severity: "info", type, detail: detail.slice(0, 250), actor: ctx.userId }); }

export type AdminRun = {
  id: string; query: string; status: string; origin: string; items_found: number; searches: number; error: string | null; created_at: string;
  items: { id: string; event_date: string; title: string; summary: string; url: string; publisher: string; status: "unreviewed" | "approved" | "rejected" }[];
};

export const getResearchAdmin = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await need(c(context), ["admin", "editor", "moderator"], "Staff only");
    const { agentConfigured, agentModel, dailyLimit, visitorDailyLimit } = await import("./trail-agent.server");
    const sb = c(context).supabase;
    const since = new Date(Date.now() - 24 * 3600_000).toISOString();
    const [runs, items, today, set] = await Promise.all([
      sb.from("trail_research").select("*").order("created_at", { ascending: false }).limit(40),
      sb.from("ai_trail_items").select("id,research_id,event_date,title,summary,url,publisher,status").order("event_date", { ascending: true }).limit(1500),
      sb.from("trail_research").select("id", { count: "exact", head: true }).gte("created_at", since),
      sb.from("site_settings").select("value").eq("key", "ai_trails").maybeSingle(),
    ]);
    if (runs.error) throw new Error(runs.error.message);
    return {
      settings: parseAiSettings(set.data?.value),
      config: { ready: agentConfigured(), model: agentModel(), dailyLimit: dailyLimit(), visitorLimit: visitorDailyLimit(), usedToday: (today.count as number | null) ?? 0 },
      runs: (runs.data as Omit<AdminRun, "items">[]).map((r) => ({ ...r, items: ((items.data ?? []) as (AdminRun["items"][number] & { research_id: string })[]).filter((i) => i.research_id === r.id) })) as AdminRun[],
    };
  });

export const reviewAiItem = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ id: z.string().uuid(), status: z.enum(["approved", "rejected", "unreviewed"]) }).parse(d))
  .handler(async ({ context, data }) => {
    await need(c(context), ["admin", "editor"], "Only admins and editors can review AI research");
    const { error } = await c(context).supabase.from("ai_trail_items").update({ status: data.status, reviewed_by: c(context).userId, reviewed_at: new Date().toISOString() }).eq("id", data.id);
    if (error) throw new Error(error.message);
    await audit(c(context), `ai_item_${data.status}`, data.id);
    return { ok: true };
  });

export const runResearchNow = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ q: topic, edition: editionField }).parse(d))
  .handler(async ({ context, data }) => {
    await need(c(context), ["admin", "editor"], "Only admins and editors can run research");
    const { agentConfigured, startResearch } = await import("./trail-agent.server");
    if (!agentConfigured()) throw new Error("Set ANTHROPIC_API_KEY and SUPABASE_SERVICE_ROLE_KEY on the server first.");
    const r = await startResearch(data.q, "staff", scopeOf(data.edition));
    if (!r.started) throw new Error(r.reason === "running" ? "That topic is already being researched." : r.reason === "limit" ? "Today's research limit has been reached." : "Research is unavailable.");
    await audit(c(context), "ai_research_started", data.q);
    return { ok: true };
  });

export const deleteResearch = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ context, data }) => {
    await need(c(context), ["admin", "editor"], "Only admins and editors can delete research");
    const { error } = await c(context).supabase.from("trail_research").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    await audit(c(context), "ai_research_deleted", data.id);
    return { ok: true };
  });
