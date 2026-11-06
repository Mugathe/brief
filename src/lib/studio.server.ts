import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { publicClient } from "./public-client.server";
import { EDITIONS } from "./editions";
import { parseStudio, type StudioConfig } from "./studio-config";
import { captionFor, dayKey, planStories, voiceScript } from "./studio-feed";
import { publishMedia, socialReady, type SocialTarget } from "./social-post.server";
import { editionOf } from "./editions";
import { voiceLocale } from "./voice-locale";

// The generated database types do not list the Studio tables, so they are used untyped.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = () => supabaseAdmin as unknown as { from: (t: string) => any; storage: typeof supabaseAdmin.storage };
const BUCKET = "studio-media";

export async function readStudioConfig(): Promise<StudioConfig> {
  const { data } = await publicClient().from("site_settings").select("value").eq("key", "studio").maybeSingle();
  return parseStudio(data?.value);
}

/** The stories this edition still needs a picture and reel for today. Idempotent: asking twice returns nothing new the second time. */
export async function planFor(edition: string, site: string) {
  const config = await readStudioConfig();
  if (!EDITIONS.some((e) => e.code === edition)) throw new Error("Unknown edition");
  const day = dayKey();
  const { getBrief } = await import("./brief.functions");
  const brief = await getBrief({ data: { edition } });
  const plans = planStories(brief.segments, edition, day, 8);
  const { data, error } = await db().from("studio_posts").select("story_key,kind,source_links").eq("edition", edition).like("story_key", `${day}-%`);
  if (error) throw new Error(error.message);
  const finished = (data ?? []).filter((r: { kind: string }) => r.kind === "video"); // a story counts as done once its reel exists
  const doneKeys = new Set<string>(finished.map((r: { story_key: string }) => r.story_key));
  const doneLinks = new Set<string>(finished.flatMap((r: { source_links: string[] }) => r.source_links ?? []));
  const room = Math.max(0, config.perDay - doneKeys.size);
  const stories = plans
    .filter((p) => !doneKeys.has(p.key) && !p.links.some((l) => doneLinks.has(l)))
    .slice(0, Math.min(config.perRun, room))
    .map((p) => ({ ...p, caption: captionFor(p, site, p.path), voiceText: voiceScript(p) }));
  return { config, edition, day, stories, madeToday: doneKeys.size, note: brief.error ?? "" };
}

const upload = z.object({
  edition: z.string().max(8).refine((c) => EDITIONS.some((e) => e.code === c), "Unknown edition"),
  key: z.string().regex(/^\d{8}-[0-9a-z]{1,12}$/),
  kind: z.enum(["image", "video"]),
  title: z.string().trim().min(3).max(300),
  category: z.string().trim().max(40),
  caption: z.string().max(2000),
  link: z.string().max(300).regex(/^\/brief/),
  links: z.array(z.string().max(500)).max(8),
});
export type UploadMeta = z.infer<typeof upload>;

/** Saves one picture or reel from the renderer and records it, published at once or as a draft depending on the setting. */
export async function storeMedia(meta: unknown, bytes: Uint8Array, mime: string): Promise<{ url: string; status: string; social: Record<string, string> }> {
  const m = upload.parse(meta);
  if (m.kind === "image" ? mime !== "image/png" || bytes.length > 5_000_000 : mime !== "video/mp4" || bytes.length > 40_000_000) throw new Error("That file is not an accepted picture or reel");
  const config = await readStudioConfig();
  const status = config.autoPublish ? "published" : "draft";
  const path = `${m.edition}/${m.key.slice(0, 8)}/${m.key}-${m.kind}.${m.kind === "image" ? "png" : "mp4"}`;
  const up = await db().storage.from(BUCKET).upload(path, bytes, { contentType: mime, upsert: true });
  if (up.error) throw new Error(up.error.message);
  const url = `${db().storage.from(BUCKET).getPublicUrl(path).data.publicUrl}?v=${Date.now()}`;
  const { data: saved, error } = await db().from("studio_posts").upsert(
    { edition: m.edition, story_key: m.key, kind: m.kind, style: "headline", title: m.title, category: m.category, caption: m.caption, link: m.link, media_path: path, media_url: url, mime, status, published_at: status === "published" ? new Date().toISOString() : null, source_links: m.links, created_by: null },
    { onConflict: "edition,story_key,kind" },
  ).select("id").single();
  if (error) throw new Error(error.message);
  // A new, published reel also goes to the accounts the editors switched on. A failure here never loses the reel.
  const targets: SocialTarget[] = m.kind === "video" && status === "published" ? [...(config.facebook ? ["facebook" as const] : []), ...(config.youtube ? ["youtube" as const] : [])] : [];
  const social = targets.length ? await shareOut(saved.id as number, targets).catch((e) => ({ error: e instanceof Error ? e.message : "could not post" })) : {};
  return { url, status, social };
}

/** Today's text for a voice-over: the voice reads in the edition's language and accent, with the pronunciation dictionary applied. */
export async function studioVoice(edition: string, text: string, voice: "amani" | "baraka"): Promise<Uint8Array> {
  const ed = editionOf(edition);
  const { prepareSpeech } = await import("./pronounce");
  const { loadDictionary } = await import("./pronunciation.server");
  const { synthesize, ttsProvider } = await import("./tts.server");
  if (!ttsProvider()) throw new Error("No studio voice is set up on the server");
  const spoken = prepareSpeech(text.slice(0, 400), await loadDictionary(), ed.lang);
  return (await synthesize(spoken, voice, voiceLocale(ed, ed.lang))).bytes;
}

/** Posts a saved picture or reel to the chosen accounts, once each: a target already recorded is skipped unless `again` is set. Returns what happened per target. */
export async function shareOut(id: number, targets: SocialTarget[], again = false): Promise<Record<string, string>> {
  const { data: row, error } = await db().from("studio_posts").select("id,kind,media_url,title,caption,shared").eq("id", id).single();
  if (error) throw new Error(error.message);
  const shared = { ...((row.shared ?? {}) as Record<string, { id: string; at: string }>) };
  const result: Record<string, string> = {};
  for (const t of targets) {
    if (shared[t] && !again) { result[t] = "already posted"; continue; }
    try {
      const remoteId = await publishMedia(row, t);
      shared[t] = { id: remoteId, at: new Date().toISOString() };
      result[t] = "posted";
    } catch (e) { result[t] = e instanceof Error ? e.message : "failed"; }
  }
  await db().from("studio_posts").update({ shared }).eq("id", id);
  return result;
}

/** Which edition a saved picture or reel belongs to. */
export async function postEdition(id: number): Promise<string> {
  const { data, error } = await db().from("studio_posts").select("edition").eq("id", id).single();
  if (error) throw new Error("That item no longer exists");
  return data.edition as string;
}

export { socialReady };

const run = z.discriminatedUnion("action", [
  z.object({ action: z.literal("start"), edition: z.string().max(8).refine((c) => EDITIONS.some((e) => e.code === c)), planned: z.number().int().min(0).max(50) }),
  z.object({ action: z.literal("progress"), runId: z.number().int().positive(), title: z.string().max(300), state: z.enum(["done", "failed"]), note: z.string().max(300).optional() }),
  z.object({ action: z.literal("finish"), runId: z.number().int().positive(), note: z.string().max(400).optional() }),
]);

/** The renderer reports in as it goes, so the admin can watch progress and an alert goes out at the end. */
export async function recordRun(input: unknown): Promise<{ runId?: number }> {
  const a = run.parse(input);
  if (a.action === "start") {
    const { data, error } = await db().from("studio_runs").insert({ edition: a.edition, planned: a.planned }).select("id").single();
    if (error) throw new Error(error.message);
    return { runId: data.id as number };
  }
  const { data: row, error: readErr } = await db().from("studio_runs").select("*").eq("id", a.runId).single();
  if (readErr) throw new Error(readErr.message);
  if (a.action === "progress") {
    const items = [...(row.items ?? []), { title: a.title, state: a.state, note: a.note ?? "" }].slice(-30);
    const { error } = await db().from("studio_runs").update({ items, made: row.made + (a.state === "done" ? 1 : 0), failed: row.failed + (a.state === "failed" ? 1 : 0) }).eq("id", a.runId);
    if (error) throw new Error(error.message);
    return {};
  }
  const status = row.made === 0 && row.failed > 0 ? "failed" : "done";
  await db().from("studio_runs").update({ status, finished_at: new Date().toISOString(), note: a.note ?? "" }).eq("id", a.runId);
  if (row.made > 0 || row.failed > 0) {
    const config = await readStudioConfig();
    const { sendAlert } = await import("./alerts.server");
    const names = (row.items as { title: string; state: string }[]).filter((i) => i.state === "done").slice(0, 5).map((i) => `• ${i.title}`).join("\n");
    const bad = (row.items as { title: string; state: string; note: string }[]).filter((i) => i.state === "failed").slice(0, 3).map((i) => `✗ ${i.title}: ${i.note}`).join("\n");
    await sendAlert({
      severity: row.failed > 0 ? "warning" : "info", force: true, dedupeKey: `studio-${a.runId}`,
      title: `${row.edition}: ${row.made} new reel${row.made === 1 ? "" : "s"} ${config.autoPublish ? "published" : "ready for review"}${row.failed ? `, ${row.failed} failed` : ""}`,
      detail: [names, bad].filter(Boolean).join("\n"),
    });
  }
  return {};
}
