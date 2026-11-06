import { parseStudio } from "./studio-config";
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { AD_PLACEMENTS } from "./ads";
import { isEdition } from "./editions";
import { OFFICES } from "./offices";
import { PILLAR_LABELS, PILLAR_LEVELS } from "./manifestos";
import { THEMES, parseAdsense, parseBanner, parseContent, parseRotation } from "./site-types";

type Ctx = { supabase: any; userId: string };
const c = (x: unknown) => x as Ctx;

async function roles(ctx: Ctx): Promise<string[]> {
  const { data } = await ctx.supabase.from("user_roles").select("role").eq("user_id", ctx.userId);
  return (data ?? []).map((r: { role: string }) => r.role);
}
async function need(ctx: Ctx, allowed: string[], msg: string) {
  const mine = await roles(ctx);
  if (!mine.some((r) => allowed.includes(r))) throw new Error(msg);
  return mine;
}
async function audit(ctx: Ctx, type: string, detail: string) {
  try {
    const { error } = await ctx.supabase.from("security_events").insert({ severity: "info", type, detail: detail.slice(0, 250), actor: ctx.userId });
    if (error) console.error("audit failed:", error.message);
  } catch (e) { console.error("audit failed", e); }
}

/** Row-level security says no when staff reach outside their regions; say that in plain words. */
const refused = (e: { message: string }) => new Error(/row-level security|permission denied/i.test(e.message) ? "You can only change things for the regions you manage. Ask an admin to add this region to your access." : e.message);
const editionCode = z.string().max(8).refine(isEdition, "Unknown edition");

const httpUrl = z.string().trim().max(1000).refine((v) => v === "" || /^https?:\/\//i.test(v), "Must start with http:// or https://");
const nullableDate = z.string().trim().max(40).nullable().refine((v) => v === null || v === "" || !Number.isNaN(Date.parse(v)), "Invalid date");

/* ---------------- Ads ---------------- */
export const listAds = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await need(c(context), ["admin", "editor", "moderator"], "Staff only");
    const { data, error } = await c(context).supabase.from("ads").select("*").order("priority", { ascending: false }).order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return data as Array<{
      id: string; title: string; kind: string; image_url: string | null; link_url: string | null; adsense_slot: string | null;
      placement: string; active: boolean; starts_at: string | null; ends_at: string | null; priority: number; created_at: string;
      sponsor: string | null; alt_text: string | null; editions: string[];
    }>;
  });

const adInput = z.object({
  id: z.string().uuid().optional(),
  title: z.string().trim().min(1).max(120),
  kind: z.enum(["banner", "adsense"]),
  image_url: httpUrl,
  link_url: httpUrl,
  adsense_slot: z.string().trim().max(30).regex(/^\d*$/, "AdSense slot IDs are numbers"),
  placement: z.enum(AD_PLACEMENTS.map((p) => p.id) as [string, ...string[]]),
  active: z.boolean(),
  starts_at: nullableDate,
  ends_at: nullableDate,
  priority: z.number().int().min(-100).max(100),
  sponsor: z.string().trim().max(120),
  alt_text: z.string().trim().max(200),
  /** Editions this ad is shown in. Empty means everywhere. */
  editions: z.array(editionCode).max(20).default([]),
});

export const saveAd = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => adInput.parse(d))
  .handler(async ({ context, data }) => {
    await need(c(context), ["admin", "editor"], "Only admins and editors can manage ads");
    if (data.kind === "banner" && (!data.image_url || !data.link_url)) throw new Error("Banner ads need an image and a link.");
    if (data.kind === "adsense" && !data.adsense_slot) throw new Error("AdSense ads need a slot ID.");
    const { id, ...rest } = data;
    const row = {
      ...rest,
      image_url: rest.image_url || null,
      link_url: rest.link_url || null,
      adsense_slot: rest.adsense_slot || null,
      starts_at: rest.starts_at ? new Date(rest.starts_at).toISOString() : null,
      ends_at: rest.ends_at ? new Date(rest.ends_at).toISOString() : null,
      sponsor: rest.sponsor || null,
      alt_text: rest.alt_text || null,
    };
    const q = id ? c(context).supabase.from("ads").update(row).eq("id", id).select("id") : c(context).supabase.from("ads").insert(row).select("id");
    const { data: saved, error } = await q;
    if (error) throw refused(error);
    if (!saved?.length) throw refused({ message: "row-level security" }); // the update matched nothing the person may change
    await audit(c(context), id ? "ad_updated" : "ad_created", data.title);
    return { ok: true };
  });

export const deleteAd = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ context, data }) => {
    await need(c(context), ["admin", "editor"], "Only admins and editors can manage ads");
    const { data: gone, error } = await c(context).supabase.from("ads").delete().eq("id", data.id).select("id");
    if (error) throw refused(error);
    if (!gone?.length) throw refused({ message: "row-level security" });
    await audit(c(context), "ad_deleted", data.id);
    return { ok: true };
  });

/* ---------------- Site settings ---------------- */
export const getSiteSettings = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ region: editionCode.optional() }).parse(d ?? {}))
  .handler(async ({ context, data: input }) => {
    await need(c(context), ["admin", "editor", "moderator"], "Staff only");
    const { data } = await c(context).supabase.from("site_settings").select("key,value");
    const get = (k: string) => (data ?? []).find((r: { key: string }) => r.key === k)?.value;
    return {
      theme: ((get("theme") as { name?: string } | undefined)?.name ?? "default") as string,
      adsense: parseAdsense(get("adsense")),
      // For one region, its own banner and content rules; otherwise the site-wide ones.
      banner: parseBanner(get(input.region ? `banner@${input.region}` : "banner")),
      content: parseContent(get(input.region ? `content@${input.region}` : "content")),
      region: input.region ?? null,
      rotationSeconds: parseRotation(get("ad_rotation")),
      studio: parseStudio(get("studio")),
    };
  });

const list = (max: number, len: number) => z.array(z.string().trim().min(1).max(len)).max(max);
const settingInput = z.discriminatedUnion("key", [
  z.object({ key: z.literal("theme"), value: z.object({ name: z.enum(THEMES.map((t) => t.id) as [string, ...string[]]) }) }),
  z.object({ key: z.literal("adsense"), value: z.object({ client: z.string().trim().max(60).regex(/^(ca-pub-\d+)?$/, "Use the form ca-pub-1234567890"), enabled: z.boolean() }) }),
  z.object({ key: z.literal("banner"), value: z.object({ active: z.boolean(), text: z.string().trim().max(240), level: z.enum(["info", "celebration", "alert"]), link: httpUrl }) }),
  z.object({ key: z.literal("ad_rotation"), value: z.object({ seconds: z.number().int().min(3).max(30) }) }),
  z.object({ key: z.literal("studio"), value: z.object({ enabled: z.boolean(), autoPublish: z.boolean(), editions: z.array(editionCode).min(1).max(12), perRun: z.number().int().min(1).max(5), perDay: z.number().int().min(1).max(30), voice: z.enum(["off", "amani", "baraka"]), facebook: z.boolean(), youtube: z.boolean() }) }),
  z.object({ key: z.literal("ai_trails"), value: z.object({ enabled: z.boolean(), showUnreviewed: z.boolean() }) }),
  z.object({ key: z.literal("content"), value: z.object({ hiddenLinks: list(500, 600), blockedSources: list(200, 100), blockedWords: list(300, 60), pinnedLinks: list(10, 600) }) }),
]);

export const saveSetting = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ region: editionCode.optional() }).and(settingInput).parse(d))
  .handler(async ({ context, data }) => {
    if (data.key === "content") await need(c(context), ["admin", "editor", "moderator"], "Staff only");
    else await need(c(context), ["admin", "editor"], "Only admins and editors can change site settings");
    if (data.region && data.key !== "content" && data.key !== "banner") throw new Error("That setting applies to the whole site, not to one region.");
    const key = data.region ? `${data.key}@${data.region}` : data.key;
    const { error } = await c(context).supabase.from("site_settings").upsert({ key, value: data.value }, { onConflict: "key" });
    if (error) throw refused(error);
    if (data.key === "content") {
      const { clearContentSettingsCache } = await import("./settings.server");
      clearContentSettingsCache();
    }
    await audit(c(context), `setting_${key}`, JSON.stringify(data.value).slice(0, 250));
    return { ok: true };
  });

/** Unfiltered recent stories so editors can hide or pin them. */
export const getStoryPicker = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ edition: z.string().max(8).optional() }).parse(d ?? {}))
  .handler(async ({ context, data }) => {
    await need(c(context), ["admin", "editor", "moderator"], "Staff only");
    const { loadUnfilteredNews } = await import("./news.server");
    const { parseEdition } = await import("./editions");
    const items = await loadUnfilteredNews(parseEdition(data.edition));
    return items.slice(0, 200).map((i) => ({ link: i.link, title: i.title, source: i.source, published: i.published }));
  });

/* ---------------- Manifesto entries (every office) ---------------- */
const source = z.object({
  title: z.string().trim().min(1).max(200), publisher: z.string().trim().max(120), date: z.string().trim().max(40),
  url: z.string().trim().max(1000).regex(/^https?:\/\//i, "Source links must start with http:// or https://"),
  kind: z.enum(["Candidate or party", "Independent reporting"]),
});
const entryInput = z.object({
  id: z.string().uuid().optional(),
  slug: z.string().trim().toLowerCase().regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, "Slug: lowercase letters, numbers and dashes").min(3).max(80).refine((v) => v !== "submit", "That address is reserved."),
  name: z.string().trim().min(2).max(120),
  office: z.enum(OFFICES),
  region: z.string().trim().max(80),
  affiliation: z.string().trim().max(120),
  status: z.enum(["Declared intent", "Prospective"]),
  status_note: z.string().trim().max(600),
  evidence_state: z.enum(["Partial evidence", "Not yet assessed"]),
  overview: z.string().trim().max(2000),
  priorities: z.array(z.string().trim().min(1).max(100)).max(12),
  gaps: z.array(z.string().trim().min(1).max(200)).max(12),
  sources: z.array(source).max(20),
  pillars: z.array(z.object({ label: z.enum(PILLAR_LABELS), level: z.enum(PILLAR_LEVELS as [string, ...string[]]), note: z.string().trim().max(500) })).max(5),
  published: z.boolean(),
  reviewed_at: z.string().trim().max(20).nullable(),
});

export const listEntries = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await need(c(context), ["admin", "editor", "moderator"], "Staff only");
    const { data, error } = await c(context).supabase.from("aspirant_entries").select("*").order("office").order("name");
    if (error) throw new Error(error.message);
    return data as Array<z.infer<typeof entryInput> & { id: string; updated_at: string }>;
  });

export const saveEntry = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => entryInput.parse(d))
  .handler(async ({ context, data }) => {
    const mine = await need(c(context), ["admin", "editor", "moderator"], "Staff only");
    const canPublish = mine.includes("admin") || mine.includes("editor");
    if (data.published && !canPublish) throw new Error("Moderators can save drafts; an editor or admin must publish.");
    if (data.published && data.sources.length === 0) throw new Error("Add at least one source before publishing. Every public profile must be traceable.");
    if (data.published && !data.overview) throw new Error("Add an overview before publishing.");
    const { id, ...rest } = data;
    const row = { ...rest, region: rest.region || null, affiliation: rest.affiliation || null, reviewed_at: rest.reviewed_at || null };
    const q = id ? c(context).supabase.from("aspirant_entries").update(row).eq("id", id) : c(context).supabase.from("aspirant_entries").insert(row);
    const { error } = await q;
    if (error) throw new Error(error.code === "23505" ? "That slug is already used by another profile." : error.message);
    await audit(c(context), id ? "entry_updated" : "entry_created", `${data.office}: ${data.name}${data.published ? " (published)" : ""}`);
    return { ok: true };
  });

export const deleteEntry = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ context, data }) => {
    await need(c(context), ["admin", "editor"], "Only admins and editors can delete profiles");
    const { error } = await c(context).supabase.from("aspirant_entries").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    await audit(c(context), "entry_deleted", data.id);
    return { ok: true };
  });

/* ---------------- Security log ---------------- */
export const listSecurityEvents = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await need(c(context), ["admin"], "Admins only");
    const { data, error } = await c(context).supabase.from("security_events").select("id,severity,type,detail,actor,created_at").order("created_at", { ascending: false }).limit(300);
    if (error) throw new Error(error.message);
    return data as Array<{ id: number; severity: string; type: string; detail: string | null; actor: string | null; created_at: string }>;
  });
