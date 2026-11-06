import { supabase } from "@/integrations/supabase/client";

const BUCKET = "studio-media";
// The generated database types do not list this table yet, so it is used untyped.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const table = () => (supabase as unknown as { from: (t: string) => any }).from("studio_posts");

export type StudioPost = {
  id: number; edition: string; story_key: string; kind: "image" | "video"; style: "headline" | "quote" | "overlay";
  title: string; category: string; caption: string; link: string; media_url: string; media_path: string; mime: string;
  status: "draft" | "published"; created_at: string; published_at: string | null;
  /** Where this has been posted: { facebook: { id, at }, youtube: { id, at } }. */
  shared: Record<string, { id: string; at: string }>;
};
export type StudioGroup = { key: string; at: number; title: string; category: string; caption: string; link: string; status: StudioPost["status"]; image?: StudioPost; video?: StudioPost; posts: StudioPost[] };

const COLUMNS = "id, edition, story_key, kind, style, title, category, caption, link, media_url, media_path, mime, status, created_at, published_at, shared";

export type SaveInput = {
  edition: string; day: string; storyKey: string; kind: "image" | "video"; style: StudioPost["style"];
  title: string; category: string; caption: string; link: string; blob: Blob; links?: string[];
};

/** Stores the file and records it as a draft. Saving the same story again replaces it and sends it back to draft for another look. */
export async function saveStudioPost(i: SaveInput): Promise<void> {
  const mime = (i.blob.type || (i.kind === "image" ? "image/png" : "video/webm")).split(";")[0]!;
  const ext = i.kind === "image" ? "png" : mime.includes("mp4") ? "mp4" : "webm";
  const path = `${i.edition}/${i.day}/${i.storyKey}-${i.kind}.${ext}`;
  const up = await supabase.storage.from(BUCKET).upload(path, i.blob, { contentType: mime, upsert: true });
  if (up.error) throw new Error(up.error.message);
  const url = `${supabase.storage.from(BUCKET).getPublicUrl(path).data.publicUrl}?v=${Date.now()}`;
  const { error } = await table().upsert(
    { edition: i.edition, story_key: i.storyKey, kind: i.kind, style: i.style, title: i.title.slice(0, 300), category: i.category.slice(0, 40), caption: i.caption.slice(0, 2000), link: i.link, media_path: path, media_url: url, mime, status: "draft", published_at: null, source_links: i.links ?? [] },
    { onConflict: "edition,story_key,kind" },
  );
  if (error) throw new Error(error.message);
}

/** Pairs each story's picture with its reel. */
export function groupPosts(posts: StudioPost[]): StudioGroup[] {
  const map = new Map<string, StudioGroup>();
  for (const p of posts) {
    const g = map.get(p.story_key) ?? { key: p.story_key, at: 0, title: p.title, category: p.category, caption: p.caption, link: p.link, status: p.status, posts: [] };
    g.posts.push(p);
    g.at = Math.max(g.at, new Date(p.published_at ?? p.created_at).getTime());
    if (p.kind === "image") g.image = p; else g.video = p;
    if (p.status === "draft") g.status = "draft"; // a group counts as published only when all of it is
    map.set(p.story_key, g);
  }
  return [...map.values()];
}

/** Everything for one edition, drafts included (staff only: the database hides drafts from everyone else). */
export async function listStudioPosts(edition: string): Promise<StudioPost[]> {
  const { data, error } = await table().select(COLUMNS).eq("edition", edition).order("created_at", { ascending: false }).limit(120);
  if (error) throw new Error(error.message);
  return (data ?? []) as StudioPost[];
}

export async function setStudioStatus(ids: number[], status: StudioPost["status"]): Promise<void> {
  const { error } = await table().update({ status, published_at: status === "published" ? new Date().toISOString() : null }).in("id", ids);
  if (error) throw new Error(error.message);
}

export async function deleteStudioPosts(posts: StudioPost[]): Promise<void> {
  await supabase.storage.from(BUCKET).remove(posts.map((p) => p.media_path));
  const { error } = await table().delete().in("id", posts.map((p) => p.id));
  if (error) throw new Error(error.message);
}

/** What visitors see on the home page: published pictures and reels for this edition, newest first. */
export async function listPublishedStudio(edition: string, limit = 12, sinceMs = 7 * 86_400_000): Promise<StudioGroup[]> {
  const since = new Date(Date.now() - sinceMs).toISOString();
  const { data, error } = await table().select(COLUMNS).eq("edition", edition).eq("status", "published").gte("published_at", since).order("published_at", { ascending: false }).limit(limit * 3);
  if (error) throw new Error(error.message);
  return groupPosts((data ?? []) as StudioPost[]).slice(0, limit);
}
