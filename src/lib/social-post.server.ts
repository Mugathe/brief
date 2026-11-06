/**
 * Posting Studio pictures and reels to Brief's own accounts.
 *   Facebook Page: a picture, or a Reel. Needs FACEBOOK_PAGE_ID and FACEBOOK_PAGE_TOKEN (a long-lived Page access token).
 *   YouTube: the reel as a Short. Needs YOUTUBE_CLIENT_ID, YOUTUBE_CLIENT_SECRET and YOUTUBE_REFRESH_TOKEN.
 * Facebook publishes at once. YouTube keeps uploads from an API project that Google has not audited private, whatever is asked for.
 * Our files are public, so both services are handed the file's address instead of the bytes wherever they allow it.
 */
export type SocialTarget = "facebook" | "youtube";
export type PostableMedia = { kind: "image" | "video"; media_url: string; title: string; caption: string };

const env = (k: string) => (process.env[k] ?? "").trim();
export const socialReady = () => ({
  facebook: !!(env("FACEBOOK_PAGE_ID") && env("FACEBOOK_PAGE_TOKEN")),
  youtube: !!(env("YOUTUBE_CLIENT_ID") && env("YOUTUBE_CLIENT_SECRET") && env("YOUTUBE_REFRESH_TOKEN")),
});

const graph = () => `https://graph.facebook.com/${env("FACEBOOK_GRAPH_VERSION") || "v26.0"}`;
const cleanUrl = (u: string) => u; // the ?v= part only busts caches; both services accept it

async function fbCall(url: string, init: RequestInit): Promise<Record<string, unknown>> {
  const res = await fetch(url, { ...init, signal: AbortSignal.timeout(60_000) });
  const body = (await res.json().catch(() => ({}))) as Record<string, unknown> & { error?: { message?: string } };
  if (!res.ok || body.error) throw new Error(`Facebook: ${body.error?.message ?? res.status}`.slice(0, 300));
  return body;
}
const form = (o: Record<string, string>) => new URLSearchParams(o);

async function facebookPhoto(m: PostableMedia): Promise<string> {
  const r = await fbCall(`${graph()}/${env("FACEBOOK_PAGE_ID")}/photos`, { method: "POST", body: form({ url: cleanUrl(m.media_url), caption: m.caption.slice(0, 2000), published: "true", access_token: env("FACEBOOK_PAGE_TOKEN") }) });
  return String(r["post_id"] ?? r["id"] ?? "");
}

async function facebookReel(m: PostableMedia): Promise<string> {
  const page = env("FACEBOOK_PAGE_ID"), token = env("FACEBOOK_PAGE_TOKEN");
  const start = await fbCall(`${graph()}/${page}/video_reels`, { method: "POST", body: form({ upload_phase: "start", access_token: token }) });
  const id = String(start["video_id"] ?? ""), uploadUrl = String(start["upload_url"] ?? "");
  if (!id || !uploadUrl) throw new Error("Facebook: no upload session was returned");
  const up = await fbCall(uploadUrl, { method: "POST", headers: { Authorization: `OAuth ${token}`, file_url: cleanUrl(m.media_url) } });
  if (up["success"] !== true) throw new Error("Facebook: the reel upload was not accepted");
  await fbCall(`${graph()}/${page}/video_reels`, { method: "POST", body: form({ upload_phase: "finish", video_id: id, video_state: "PUBLISHED", description: m.caption.slice(0, 2000), title: m.title.slice(0, 100), access_token: token }) });
  return id;
}

async function youtubeShort(m: PostableMedia): Promise<string> {
  const tok = await fetch("https://oauth2.googleapis.com/token", { method: "POST", body: form({ client_id: env("YOUTUBE_CLIENT_ID"), client_secret: env("YOUTUBE_CLIENT_SECRET"), refresh_token: env("YOUTUBE_REFRESH_TOKEN"), grant_type: "refresh_token" }), signal: AbortSignal.timeout(30_000) });
  const t = (await tok.json().catch(() => ({}))) as { access_token?: string; error_description?: string };
  if (!tok.ok || !t.access_token) throw new Error(`YouTube sign-in: ${t.error_description ?? tok.status}`.slice(0, 300));
  const file = await fetch(cleanUrl(m.media_url), { signal: AbortSignal.timeout(60_000) });
  if (!file.ok) throw new Error("YouTube: could not read the reel file");
  const bytes = new Uint8Array(await file.arrayBuffer());
  const title = `${m.title.slice(0, 88)} #Shorts`;
  const init = await fetch("https://www.googleapis.com/upload/youtube/v3/videos?uploadType=resumable&part=snippet,status", {
    method: "POST",
    headers: { Authorization: `Bearer ${t.access_token}`, "Content-Type": "application/json; charset=UTF-8", "X-Upload-Content-Length": String(bytes.length), "X-Upload-Content-Type": "video/mp4" },
    body: JSON.stringify({ snippet: { title, description: `${m.caption.slice(0, 4800)}\n\n#Shorts`, categoryId: "25" }, status: { privacyStatus: "public", selfDeclaredMadeForKids: false } }),
    signal: AbortSignal.timeout(30_000),
  });
  const where = init.headers.get("location");
  if (!init.ok || !where) throw new Error(`YouTube: upload refused (${init.status}) ${(await init.text()).slice(0, 160)}`);
  const put = await fetch(where, { method: "PUT", headers: { "Content-Type": "video/mp4" }, body: bytes as unknown as BodyInit, signal: AbortSignal.timeout(120_000) });
  const done = (await put.json().catch(() => ({}))) as { id?: string; error?: { message?: string } };
  if (!put.ok || !done.id) throw new Error(`YouTube: ${done.error?.message ?? put.status}`.slice(0, 300));
  return done.id;
}

/** Posts one picture or reel. Returns the id the service gave it. Throws a readable message if it cannot. */
export async function publishMedia(m: PostableMedia, target: SocialTarget): Promise<string> {
  const ready = socialReady();
  if (!ready[target]) throw new Error(`${target === "facebook" ? "Facebook" : "YouTube"} is not set up on the server yet`);
  if (target === "youtube" && m.kind !== "video") throw new Error("YouTube takes the reel, not the picture");
  return target === "facebook" ? (m.kind === "image" ? facebookPhoto(m) : facebookReel(m)) : youtubeShort(m);
}
