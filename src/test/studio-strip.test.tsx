import { StrictMode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { StudioGroup, StudioPost } from "@/lib/studio-db";

const NOW = Date.now();
const post = (kind: "image" | "video", key: string): StudioPost => ({ id: 1, edition: "KE", story_key: key, kind, style: "headline", title: key, category: "Politics", caption: `Caption ${key}`, link: "/brief?e=KE#story-1", media_url: `https://m/${key}.${kind === "video" ? "mp4" : "png"}`, media_path: "", mime: "", status: "published", created_at: "", published_at: null, shared: {} });
const group = (key: string, ageMs: number, kinds: ("image" | "video")[]): StudioGroup => {
  const posts = kinds.map((k) => post(k, key));
  const image = posts.find((p) => p.kind === "image"), video = posts.find((p) => p.kind === "video");
  return { key, at: NOW - ageMs, style: "headline" as const, title: `Title ${key}`, category: "Politics", caption: `Caption ${key}`, link: "/brief?e=KE#story-1", status: "published", posts, ...(image ? { image } : {}), ...(video ? { video } : {}) };
};

vi.mock("@/lib/studio-db", () => ({
  listPublishedStudio: async () => [group("fresh", 60_000, ["image", "video"]), group("pic", 3_600_000, ["image"]), group("old", 30 * 3_600_000, ["image"])],
}));
vi.mock("@/lib/use-edition", () => ({ useT: () => ({ lang: "en", t: (k: string) => k }) }));

import { StudioStrip } from "@/components/StudioStrip";

const mount = () => render(<QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}><StudioStrip edition="KE" /></QueryClientProvider>);

beforeEach(() => {
  localStorage.clear();
  window.HTMLMediaElement.prototype.play = () => Promise.resolve();
  window.HTMLMediaElement.prototype.pause = () => undefined;
});
afterEach(() => { cleanup(); vi.useRealTimers(); vi.unstubAllGlobals(); });

describe("status row", () => {
  it("shows a circle per story, newest first, with the expired one last and dimmed", async () => {
    mount();
    const buttons = await screen.findAllByRole("button", { name: /Title/ });
    expect(buttons.map((b) => b.getAttribute("aria-label"))).toEqual(["Title fresh, Politics", "Title pic, Politics", "Title old, Politics"]);
    expect(buttons[2]!.closest("li")).toHaveClass("opacity-60");
    expect(buttons[0]!.closest("li")).not.toHaveClass("opacity-60");
  });

  it("shows portrait tiles that let you peek at the story without opening it", async () => {
    mount();
    const tile = await screen.findByRole("button", { name: /Title fresh/ });
    expect(within(tile).getByText("Title fresh")).toBeTruthy(); // the headline is readable on the tile
    expect(within(tile).getByText("Politics")).toBeTruthy();
    expect(within(tile).getByText("▶")).toBeTruthy(); // it is a reel
    expect(tile.querySelector(".aspect-\\[9\\/16\\]")).toBeTruthy(); // portrait
    expect(tile.querySelector("img, video")).toBeNull(); // and it costs no download
    const pic = screen.getByRole("button", { name: /Title pic/ });
    expect(within(pic).queryByText("▶")).toBeNull();
  });

  it("never touches the browser history, because the router reacts to that by reloading the page under the viewer (it used to flash and vanish)", async () => {
    const push = vi.spyOn(window.history, "pushState"), replace = vi.spyOn(window.history, "replaceState"), back = vi.spyOn(window.history, "back");
    mount();
    fireEvent.click(await screen.findByRole("button", { name: /Title fresh/ }));
    await screen.findByRole("dialog");
    fireEvent.keyDown(window, { key: "Escape" });
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(push).not.toHaveBeenCalled();
    expect(replace).not.toHaveBeenCalled();
    expect(back).not.toHaveBeenCalled();
  });

  it("stays open in React's development mode, which sets effects up twice", async () => {
    render(<StrictMode><QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}><StudioStrip edition="KE" /></QueryClientProvider></StrictMode>);
    fireEvent.click(await screen.findByRole("button", { name: /Title fresh/ }));
    await screen.findByRole("dialog");
    await act(async () => { await new Promise((r) => setTimeout(r, 300)); });
    expect(screen.getByRole("dialog")).toHaveAttribute("aria-label", "Title fresh");
  });

  it("opens a clean viewer: the reel plays with no native controls, one progress bar, and a link to the story", async () => {
    mount();
    fireEvent.click(await screen.findByRole("button", { name: /Title fresh/ }));
    const dialog = await screen.findByRole("dialog");
    const video = dialog.querySelector("video")!;
    expect(video).toBeTruthy();
    expect(video.hasAttribute("controls")).toBe(false);
    expect(video.getAttribute("src")).toBe("https://m/fresh.mp4");
    expect(dialog.querySelector("img.object-contain")).toBeNull(); // one slide: the reel, not the picture as well (the small round picture in the header is just the thumbnail)
    expect(dialog.querySelectorAll("[aria-hidden] > div")).toHaveLength(1);
    expect(screen.getByRole("link", { name: /nav.brief/ })).toHaveAttribute("href", "/brief?e=KE#story-1");
  });

  it("marks a story as seen when opened, and greys its ring once the viewer is closed", async () => {
    mount();
    const btn = await screen.findByRole("button", { name: /Title fresh/ });
    expect(btn.querySelector("span")!.className).toContain("bg-gradient-to-tr");
    fireEvent.click(btn);
    await screen.findByRole("dialog");
    expect(JSON.parse(localStorage.getItem("brief-status-seen")!)).toContain("fresh");
    fireEvent.keyDown(window, { key: "Escape" });
    expect(screen.queryByRole("dialog")).toBeNull();
    const after = (await screen.findAllByRole("button", { name: /Title/ })).find((b) => /Title fresh/.test(b.getAttribute("aria-label")!))!;
    expect(after.querySelector("span")!.className).toContain("bg-border");
    // seen stories drop behind unseen ones
    expect((await screen.findAllByRole("button", { name: /Title/ })).map((b) => b.getAttribute("aria-label")!.split(",")[0])).toEqual(["Title pic", "Title fresh", "Title old"]);
  });

  it("moves a picture on by itself after a few seconds, and on to the next story, then closes at the end", async () => {
    mount();
    fireEvent.click(await screen.findByRole("button", { name: /Title pic/ }));
    expect(screen.getByRole("dialog")).toHaveAttribute("aria-label", "Title pic");
    // A picture shows for 4.5 seconds (the simulated browser's animation clock runs a little slow, so allow for that).
    await waitFor(() => expect(screen.getByRole("dialog")).toHaveAttribute("aria-label", "Title old"), { timeout: 9_000 }); // the next story in the row
    expect(screen.getByRole("dialog").querySelector("img.object-contain")).toBeTruthy();
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull(), { timeout: 9_000 }); // that was the last one, so it closes
  }, 25_000);

  it("does not rush on when a reel will not play: it shows the picture and says so", async () => {
    mount();
    fireEvent.click(await screen.findByRole("button", { name: /Title fresh/ }));
    const dialog = await screen.findByRole("dialog");
    fireEvent.error(dialog.querySelector("video")!);
    expect(await screen.findByText("This reel could not be played.")).toBeTruthy();
    expect(screen.getByRole("dialog")).toHaveAttribute("aria-label", "Title fresh"); // still here, not skipped
    expect(screen.getByRole("dialog").querySelector("img.object-contain")).toBeTruthy(); // its picture is shown instead
  });

  it("ignores a reel that claims to have ended the instant it started", async () => {
    mount();
    fireEvent.click(await screen.findByRole("button", { name: /Title fresh/ }));
    const video = (await screen.findByRole("dialog")).querySelector("video")!;
    fireEvent.ended(video);
    expect(screen.getByRole("dialog")).toHaveAttribute("aria-label", "Title fresh");
  });

  it("asks for a tap, instead of skipping, when the browser will not start the reel", async () => {
    window.HTMLMediaElement.prototype.play = () => Promise.reject(new DOMException("blocked", "NotAllowedError"));
    mount();
    fireEvent.click(await screen.findByRole("button", { name: /Title fresh/ }));
    expect(await screen.findByRole("button", { name: "Play" })).toBeTruthy();
    expect(screen.getByRole("dialog")).toHaveAttribute("aria-label", "Title fresh");
  });

  it("shares the file that is showing, with the link to the story in the caption", async () => {
    const share = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal("fetch", async () => new Response(new Blob(["x"], { type: "video/mp4" })));
    Object.defineProperty(navigator, "share", { configurable: true, value: share });
    Object.defineProperty(navigator, "canShare", { configurable: true, value: () => true });
    mount();
    fireEvent.click(await screen.findByRole("button", { name: /Title fresh/ }));
    await screen.findByRole("dialog");
    await act(async () => { fireEvent.click(screen.getByRole("button", { name: "home.share" })); });
    expect(share).toHaveBeenCalledTimes(1);
    const arg = share.mock.calls[0]![0] as { files: File[]; text: string };
    expect(arg.files[0]!.name).toBe("brief-reel.mp4");
    expect(arg.text).toContain("Caption fresh");
    expect(arg.text).toContain(`${window.location.origin}/brief?e=KE#story-1`);
  });

  it("falls back to share links where the browser has no share sheet", async () => {
    Object.defineProperty(navigator, "share", { configurable: true, value: undefined });
    mount();
    fireEvent.click(await screen.findByRole("button", { name: /Title fresh/ }));
    await screen.findByRole("dialog");
    await act(async () => { fireEvent.click(screen.getByRole("button", { name: "home.share" })); });
    expect(screen.getByRole("link", { name: "WhatsApp" }).getAttribute("href")).toContain("https://wa.me/?text=");
    expect(screen.getByRole("link", { name: "Facebook" })).toBeTruthy();
  });
});
