import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

// Same pattern as the other admin functions: the user's own database session decides what they may touch.
type Ctx = { supabase: any; userId: string }; // eslint-disable-line @typescript-eslint/no-explicit-any
const c = (x: unknown) => x as Ctx;
async function needStaff(ctx: Ctx, allowed = ["admin", "editor"]) {
  const { data } = await ctx.supabase.from("user_roles").select("role").eq("user_id", ctx.userId);
  if (!(data ?? []).some((r: { role: string }) => allowed.includes(r.role))) throw new Error("Only admins and editors can use the Studio");
}

const used = new Map<string, number[]>();

/** A voice-over for the admin's browser to mix into a reel it is recording. Returns MP3 as base64. */
export const getStudioVoice = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ edition: z.string().max(8), text: z.string().trim().min(2).max(400), voice: z.enum(["amani", "baraka"]) }).parse(d))
  .handler(async ({ context, data }) => {
    await needStaff(c(context));
    const now = Date.now();
    const recent = (used.get(c(context).userId) ?? []).filter((t) => now - t < 3_600_000);
    if (recent.length >= 80) throw new Error("That is 80 voice-overs this hour. Please wait a little.");
    used.set(c(context).userId, [...recent, now]);
    const { studioVoice } = await import("./studio.server");
    return { audio: Buffer.from(await studioVoice(data.edition, data.text, data.voice)).toString("base64") };
  });

/** Which accounts the server can post to (never the keys themselves). */
export const getSocialStatus = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await needStaff(c(context), ["admin", "editor", "moderator"]);
    const { socialReady } = await import("./social-post.server");
    return socialReady();
  });

/** Posts one saved picture or reel now. The database refuses it unless this person manages that edition. */
export const postStudioSocial = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ id: z.number().int().positive(), target: z.enum(["facebook", "youtube"]), again: z.boolean().default(false) }).parse(d))
  .handler(async ({ context, data }) => {
    await needStaff(c(context));
    const { postEdition } = await import("./studio.server");
    const edition = await postEdition(data.id);
    // The same rule the database applies to editors: admins, or staff assigned to this edition.
    const { data: ok } = await c(context).supabase.rpc("can_manage", { _user: c(context).userId, _editions: [edition] });
    if (ok !== true) throw new Error("You can only post things for the regions you manage.");
    const { shareOut } = await import("./studio.server");
    const out = await shareOut(data.id, [data.target], data.again);
    const message = out[data.target] ?? "";
    if (message !== "posted" && message !== "already posted") throw new Error(message || "Could not post");
    return { result: message };
  });
