import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { isEdition } from "./editions";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { clearTrendCache } from "./trend-cache.server";

type Ctx = { supabase: any; userId: string };
const c = (x: unknown) => x as Ctx;

async function roles(ctx: Ctx): Promise<string[]> {
  const { data } = await ctx.supabase.from("user_roles").select("role").eq("user_id", ctx.userId);
  return (data ?? []).map((r: { role: string }) => r.role);
}
async function need(ctx: Ctx, allowed: string[], msg: string) {
  if (!(await roles(ctx)).some((r) => allowed.includes(r))) throw new Error(msg);
}
const EDITORS = ["admin", "editor"];
const STAFF = ["admin", "editor", "moderator"];
async function audit(ctx: Ctx, type: string, detail: string) {
  await ctx.supabase.from("security_events").insert({ severity: "info", type, detail: detail.slice(0, 250), actor: ctx.userId });
}

/* ---------------- Archive status ---------------- */
type KeyKind = "service_role" | "secret" | "same-as-public" | "publishable" | "wrong-role" | "unknown";
function describeKey(key: string, publicKey: string): KeyKind | null {
  if (!key) return null;
  if (key === publicKey) return "same-as-public";
  if (key.startsWith("sb_secret_")) return "secret";
  if (key.startsWith("sb_publishable_")) return "publishable";
  if (key.startsWith("eyJ")) {
    try { const role = JSON.parse(Buffer.from(key.split(".")[1] ?? "", "base64url").toString()).role; return role === "service_role" ? "service_role" : "wrong-role"; } catch { return "unknown"; }
  }
  return "unknown";
}

export const getArchiveStatus = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await need(c(context), STAFF, "Staff only");
    const { archiveConfigured, lastArchiveRun } = await import("./archive.server");
    const sb = c(context).supabase;
    const [first, last, total] = await Promise.all([
      sb.from("news_archive").select("published_at").order("published_at", { ascending: true }).limit(1),
      sb.from("news_archive").select("published_at").order("published_at", { ascending: false }).limit(1),
      sb.from("news_archive").select("id", { count: "planned", head: true }),
    ]);
    const url = (process.env["SUPABASE_URL"] ?? "").trim().replace(/\/$/, "");
    const sr = (process.env["SUPABASE_SERVICE_ROLE_KEY"] ?? "").trim();
    const kind = describeKey(sr, (process.env["SUPABASE_PUBLISHABLE_KEY"] ?? "").trim());
    let keyTest: { ok: boolean; status: number | null; message: string } | null = null;
    if (sr && url) {
      try {
        const r = await fetch(`${url}/rest/v1/news_archive?select=id&limit=1`, { headers: { apikey: sr, ...(sr.startsWith("eyJ") ? { Authorization: `Bearer ${sr}` } : {}) }, signal: AbortSignal.timeout(8000) });
        const body = (await r.json().catch(() => null)) as { message?: string } | null;
        keyTest = { ok: r.ok, status: r.status, message: r.ok ? "Accepted" : (body?.message ?? `HTTP ${r.status}`) };
      } catch (e) { keyTest = { ok: false, status: null, message: e instanceof Error ? e.message : "Could not reach the database" }; }
    }
    return {
      env: { urlSet: !!url, projectRef: url ? new URL(url).hostname.split(".")[0] ?? "" : "", keySet: !!sr, keyKind: kind, keyTest },
      writerConfigured: archiveConfigured(),
      schedulerKeySet: !!process.env["INGEST_KEY"],
      tablesReady: !first.error,
      total: (total.count as number | null) ?? null,
      since: (first.data?.[0]?.published_at as string | undefined) ?? null,
      latest: (last.data?.[0]?.published_at as string | undefined) ?? null,
      lastRun: lastArchiveRun(),
    };
  });

/** Fetches the news feeds right now and saves them to the archive, so history can start building at once. */
export const archiveNow = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await need(c(context), EDITORS, "Only admins and editors can do this");
    const { refreshAndArchive } = await import("./news.server");
    const { archiveConfigured, lastArchiveRun } = await import("./archive.server");
    if (!archiveConfigured()) throw new Error("The server cannot see SUPABASE_SERVICE_ROLE_KEY, so nothing can be saved. See the notes above.");
    const fetched = await refreshAndArchive();
    return { fetched, lastRun: lastArchiveRun() };
  });

/* ---------------- Trails ---------------- */
/** Row-level security says no when staff reach outside their regions; say that in plain words. */
const denied = (message: string) => (/row-level security|permission denied/i.test(message) ? "You can only change trails for the regions you manage. Ask an admin to add this region to your access." : message);

export type AdminTrail = { id: string; slug: string; title: string; description: string; query: string; since: string | null; published: boolean; /** The edition this trail is for; null means every edition. */ edition: string | null; events: AdminEvent[] };
export type AdminEvent = { id: string; trail_id: string; event_date: string; title: string; summary: string; url: string | null; publisher: string };

export const listTrailsAdmin = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await need(c(context), STAFF, "Staff only");
    const sb = c(context).supabase;
    const [full, e] = await Promise.all([
      sb.from("trails").select("id,slug,title,description,query,since,published,edition").order("title"),
      sb.from("trail_events").select("*").order("event_date", { ascending: false }),
    ]);
    // A database without the regions update has no edition column yet: list the trails anyway, as site-wide.
    const t = full.error ? await sb.from("trails").select("id,slug,title,description,query,since,published").order("title") : full;
    if (t.error) throw new Error(t.error.message);
    return (t.data as unknown as Array<Omit<AdminTrail, "events" | "edition"> & { edition?: string | null }>).map((tr) => ({ ...tr, edition: tr.edition ?? null, events: ((e.data ?? []) as AdminEvent[]).filter((x) => x.trail_id === tr.id) }));
  });

const trailInput = z.object({
  id: z.string().uuid().optional(),
  slug: z.string().trim().toLowerCase().regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, "Address: lowercase letters, numbers and dashes").min(3).max(60).refine((v) => v !== "search", "That address is reserved."),
  title: z.string().trim().min(3).max(120),
  description: z.string().trim().max(1500),
  query: z.string().trim().min(2).max(200),
  since: z.string().trim().regex(/^\d{4}-\d{2}-\d{2}$/, "Use a date like 2023-01-01").nullable(),
  published: z.boolean(),
  /** The edition this trail is for; null shows it in every edition. */
  edition: z.string().max(8).refine(isEdition, "Unknown region").nullable().default(null),
});

export const saveTrail = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => trailInput.parse(d))
  .handler(async ({ context, data }) => {
    await need(c(context), EDITORS, "Only admins and editors can manage trails");
    const { id, ...row } = data;
    const q = id ? c(context).supabase.from("trails").update(row).eq("id", id).select("id") : c(context).supabase.from("trails").insert(row).select("id");
    const { data: saved, error } = await q;
    if (error) throw new Error(error.code === "23505" ? "That address is already used by another trail." : denied(error.message));
    if (!saved?.length) throw new Error(denied("row-level security")); // the update matched nothing this person may change
    clearTrendCache();
    await audit(c(context), id ? "trail_updated" : "trail_created", data.title);
    return { ok: true };
  });

export const deleteTrail = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ context, data }) => {
    await need(c(context), EDITORS, "Only admins and editors can manage trails");
    const { data: gone, error } = await c(context).supabase.from("trails").delete().eq("id", data.id).select("id");
    if (error) throw new Error(denied(error.message));
    if (!gone?.length) throw new Error(denied("row-level security"));
    clearTrendCache();
    await audit(c(context), "trail_deleted", data.id);
    return { ok: true };
  });

/** How many archived stories a search would match, plus a few examples, before saving it. */
export const previewQuery = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ query: z.string().trim().min(2).max(200), since: z.string().nullable() }).parse(d))
  .handler(async ({ context, data }) => {
    await need(c(context), STAFF, "Staff only");
    const sb = c(context).supabase;
    const [vol, st] = await Promise.all([
      sb.rpc("trail_volume", { _query: data.query, _since: data.since || null }),
      sb.rpc("trail_stories", { _query: data.query, _since: data.since || null, _per_month: 1, _max: 5 }),
    ]);
    if (vol.error) throw new Error(vol.error.message);
    return { total: (vol.data as { stories: number }[]).reduce((n, r) => n + r.stories, 0), sample: (st.data ?? []) as { title: string; source: string }[] };
  });

const eventInput = z.object({
  id: z.string().uuid().optional(),
  trail_id: z.string().uuid(),
  event_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use a date like 2023-11-20"),
  title: z.string().trim().min(3).max(200),
  summary: z.string().trim().max(800),
  url: z.string().trim().max(1000).refine((v) => v === "" || /^https?:\/\//i.test(v), "Link must start with http:// or https://"),
  publisher: z.string().trim().max(120),
});

export const saveTrailEvent = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => eventInput.parse(d))
  .handler(async ({ context, data }) => {
    await need(c(context), EDITORS, "Only admins and editors can manage milestones");
    const { id, ...rest } = data;
    const row = { ...rest, url: rest.url || null };
    const q = id ? c(context).supabase.from("trail_events").update(row).eq("id", id) : c(context).supabase.from("trail_events").insert(row);
    const { error } = await q;
    if (error) throw new Error(error.message);
    clearTrendCache();
    await audit(c(context), id ? "trail_event_updated" : "trail_event_created", data.title);
    return { ok: true };
  });

export const deleteTrailEvent = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ context, data }) => {
    await need(c(context), EDITORS, "Only admins and editors can manage milestones");
    const { error } = await c(context).supabase.from("trail_events").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    clearTrendCache();
    await audit(c(context), "trail_event_deleted", data.id);
    return { ok: true };
  });

/** Bulk add milestones. One per line:  2023-11-20 | Title | Publisher | https://link | optional summary */
export const importTrailEvents = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ trailId: z.string().uuid(), text: z.string().max(60_000) }).parse(d))
  .handler(async ({ context, data }) => {
    await need(c(context), EDITORS, "Only admins and editors can manage milestones");
    const rows: z.infer<typeof eventInput>[] = [];
    const errors: string[] = [];
    data.text.split("\n").map((l) => l.trim()).filter(Boolean).forEach((line, n) => {
      const [date = "", title = "", publisher = "", url = "", ...rest] = line.split("|").map((x) => x.trim());
      const parsed = eventInput.safeParse({ trail_id: data.trailId, event_date: date, title, publisher, url, summary: rest.join(" | ") });
      if (parsed.success) rows.push(parsed.data); else errors.push(`Line ${n + 1}: ${parsed.error.issues[0]?.message ?? "invalid"}`);
    });
    if (rows.length > 300) throw new Error("Import at most 300 lines at a time.");
    if (rows.length) {
      const { error } = await c(context).supabase.from("trail_events").insert(rows.map((r) => ({ ...r, url: r.url || null })));
      if (error) throw new Error(error.message);
      clearTrendCache();
      await audit(c(context), "trail_events_imported", `${rows.length} milestones`);
    }
    return { added: rows.length, errors: errors.slice(0, 10) };
  });

/* ---------------- Ignored words ---------------- */
export const listStopwords = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await need(c(context), STAFF, "Staff only");
    const { data, error } = await c(context).supabase.from("trend_stopwords").select("word").order("word");
    if (error) throw new Error(error.message);
    return (data as { word: string }[]).map((r) => r.word);
  });

export const addStopwords = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ words: z.array(z.string().trim().toLowerCase().min(2).max(40)).min(1).max(100) }).parse(d))
  .handler(async ({ context, data }) => {
    await need(c(context), STAFF, "Staff only");
    const { error } = await c(context).supabase.from("trend_stopwords").upsert(data.words.map((word) => ({ word })), { onConflict: "word", ignoreDuplicates: true });
    if (error) throw new Error(error.message);
    clearTrendCache();
    await audit(c(context), "stopwords_added", data.words.join(", "));
    return { ok: true };
  });

export const removeStopword = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ word: z.string().max(40) }).parse(d))
  .handler(async ({ context, data }) => {
    await need(c(context), STAFF, "Staff only");
    const { error } = await c(context).supabase.from("trend_stopwords").delete().eq("word", data.word);
    if (error) throw new Error(error.message);
    clearTrendCache();
    return { ok: true };
  });
