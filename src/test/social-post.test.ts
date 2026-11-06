import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { publishMedia, socialReady } from "@/lib/social-post.server";

type Call = { url: string; method: string; headers: Record<string, string>; body: string };
let calls: Call[] = [];
const reply = (o: unknown, init: ResponseInit = {}) => new Response(JSON.stringify(o), { status: 200, headers: { "Content-Type": "application/json" }, ...init });

beforeEach(() => {
  calls = [];
  process.env["FACEBOOK_PAGE_ID"] = "123"; process.env["FACEBOOK_PAGE_TOKEN"] = "tok";
  delete process.env["YOUTUBE_CLIENT_ID"];
  vi.stubGlobal("fetch", async (url: string, init: RequestInit = {}) => {
    calls.push({ url: String(url), method: init.method ?? "GET", headers: (init.headers ?? {}) as Record<string, string>, body: String(init.body ?? "") });
    if (String(url).includes("/video_reels") && String(init.body).includes("upload_phase=start")) return reply({ video_id: "V1", upload_url: "https://rupload.facebook.com/up/V1" });
    if (String(url).startsWith("https://rupload")) return reply({ success: true });
    return reply({ success: true, id: "P1", post_id: "123_P1" });
  });
});
afterEach(() => { vi.unstubAllGlobals(); });

const reel = { kind: "video" as const, media_url: "https://m.co/r.mp4?v=1", title: "A headline", caption: "A headline\n\nRead the Brief: https://s.co/brief" };

describe("posting to Facebook", () => {
  it("publishes a reel in three steps, handing Facebook the file's address", async () => {
    expect(await publishMedia(reel, "facebook")).toBe("V1");
    expect(calls).toHaveLength(3);
    expect(calls[0]!.url).toMatch(/graph\.facebook\.com\/v[\d.]+\/123\/video_reels$/);
    expect(calls[1]!.url).toBe("https://rupload.facebook.com/up/V1");
    expect(calls[1]!.headers).toMatchObject({ Authorization: "OAuth tok", file_url: "https://m.co/r.mp4?v=1" });
    expect(calls[2]!.body).toContain("upload_phase=finish");
    expect(calls[2]!.body).toContain("video_state=PUBLISHED");
    expect(new URLSearchParams(calls[2]!.body).get("description")).toContain("Read the Brief: https://s.co/brief");
  });
  it("posts a picture with its caption", async () => {
    expect(await publishMedia({ ...reel, kind: "image", media_url: "https://m.co/p.png" }, "facebook")).toBe("123_P1");
    expect(calls[0]!.url).toMatch(/\/123\/photos$/);
    expect(calls[0]!.body).toContain("published=true");
  });
  it("turns a Facebook error into a readable message", async () => {
    vi.stubGlobal("fetch", async () => reply({ error: { message: "Invalid OAuth access token" } }, { status: 400 }));
    await expect(publishMedia(reel, "facebook")).rejects.toThrow("Facebook: Invalid OAuth access token");
  });
});

describe("what is set up", () => {
  it("reports which accounts have their keys, and refuses the rest in plain words", async () => {
    expect(socialReady()).toEqual({ facebook: true, youtube: false });
    await expect(publishMedia(reel, "youtube")).rejects.toThrow("YouTube is not set up");
    process.env["YOUTUBE_CLIENT_ID"] = "a"; process.env["YOUTUBE_CLIENT_SECRET"] = "b"; process.env["YOUTUBE_REFRESH_TOKEN"] = "c";
    await expect(publishMedia({ ...reel, kind: "image" }, "youtube")).rejects.toThrow("YouTube takes the reel");
    delete process.env["YOUTUBE_CLIENT_ID"]; delete process.env["YOUTUBE_CLIENT_SECRET"]; delete process.env["YOUTUBE_REFRESH_TOKEN"];
  });
});
