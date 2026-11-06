import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { PLATFORMS, type SocialItem } from "./social";
import type { SearchTrend } from "./google-trends.server";
import type { XTrend, YouTubeVideo } from "./social-feeds";
import { editionOf, isEdition, parseEdition } from "./editions";

export type { SearchTrend, XTrend, YouTubeVideo };

/** Public: the editors' social board, and what people in the edition's country are searching on Google (nothing for the world edition: Google has no worldwide list). */
export const getSocialPulse = createServerFn({ method: "GET" })
  .inputValidator((d) => z.object({ edition: z.string().max(8).optional() }).parse(d ?? {}))
  .handler(async ({ data }): Promise<{ board: SocialItem[]; searching: SearchTrend[]; youtube: YouTubeVideo[]; x: XTrend[] }> => {
  const ed = editionOf(parseEdition(data.edition));
  const geo = ed.trendsGeo;
  const { publicClient } = await import("./public-client.server");
  const { loadSearchTrends } = await import("./google-trends.server");
  const { loadYouTube, loadXTrends } = await import("./social-feeds.server");
  const [board, searching, youtube, x] = await Promise.all([
    (async () => {
      try {
        const code = parseEdition(data.edition);
        const base = () => publicClient().from("social_trends").select("id,platform,topic,note,url,created_at,expires_at").gt("expires_at", new Date().toISOString()).order("created_at", { ascending: false }).limit(30);
        // Items for everyone ('*') plus this edition's own. An older database without the column shows them all.
        const scoped = await base().in("edition", ["*", code]);
        const res = scoped.error ? await base() : scoped;
        if (res.error) { console.error("[social] board failed:", res.error.message); return []; }
        return (res.data ?? []) as SocialItem[];
      } catch { return []; }
    })(),
    geo ? loadSearchTrends(geo) : Promise.resolve([] as SearchTrend[]),
    ed.ytRegion ? loadYouTube(ed.ytRegion) : Promise.resolve([] as YouTubeVideo[]),
    ed.woeid ? loadXTrends(ed.woeid) : Promise.resolve([] as XTrend[]),
  ]);
  return { board, searching, youtube, x };
});

type Ctx = { supabase: any; userId: string };
const c = (x: unknown) => x as Ctx;
async function editor(ctx: Ctx) {
  const { data } = await ctx.supabase.from("user_roles").select("role").eq("user_id", ctx.userId);
  if (!(data ?? []).some((r: { role: string }) => r.role === "admin" || r.role === "editor")) throw new Error("Only admins and editors can manage the social board");
}

export const listSocial = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await c(context).supabase.from("social_trends").select("*").order("created_at", { ascending: false }).limit(100);
    if (error) throw new Error(error.message);
    return data as Array<SocialItem & { edition?: string }>;
  });

export const saveSocial = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({
    platform: z.enum(PLATFORMS.map((p) => p.id) as [string, ...string[]]),
    /** Edition this item is for; "*" shows it in every edition. */
    edition: z.string().max(8).refine((v) => v === "*" || isEdition(v), "Unknown region").default("*"),
    topic: z.string().trim().min(2).max(80),
    note: z.string().trim().max(240),
    url: z.string().trim().max(1000).refine((v) => v === "" || /^https?:\/\//i.test(v), "Link must start with http:// or https://"),
    days: z.number().int().min(1).max(14),
  }).parse(d))
  .handler(async ({ context, data }) => {
    await editor(c(context));
    const { days, ...rest } = data;
    const { error } = await c(context).supabase.from("social_trends").insert({ ...rest, url: rest.url || null, expires_at: new Date(Date.now() + days * 86400_000).toISOString(), created_by: c(context).userId });
    if (error) throw new Error(/row-level security/i.test(error.message) ? "You can only add to the board for the regions you manage." : error.message);
    return { ok: true };
  });

export const deleteSocial = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ context, data }) => {
    await editor(c(context));
    const { data: gone, error } = await c(context).supabase.from("social_trends").delete().eq("id", data.id).select("id");
    if (error) throw new Error(error.message);
    if (!gone?.length) throw new Error("You can only remove items for the regions you manage.");
    return { ok: true };
  });
