import { describe, expect, it } from "vitest";
import { shareLinks, shareText } from "@/lib/studio-share";

describe("status sharing", () => {
  it("always carries the link to the story in the Brief", () => {
    expect(shareText("A headline", "x", "https://s.co/brief?e=KE#story-2")).toBe("A headline\n\nhttps://s.co/brief?e=KE#story-2");
    expect(shareText("Read the Brief: https://s.co/brief?e=KE#story-2", "x", "https://s.co/brief?e=KE#story-2")).toBe("Read the Brief: https://s.co/brief?e=KE#story-2");
    expect(shareText("", "Title only", "https://s.co/brief")).toContain("Title only");
  });
  it("builds links that survive odd characters", () => {
    const l = shareLinks("Ruto & co: 100% “quote”\nnext", "https://s.co/brief?e=KE#story-1");
    expect(l.whatsapp).toBe(`https://wa.me/?text=${encodeURIComponent("Ruto & co: 100% “quote”\nnext")}`);
    expect(l.facebook).toContain("u=https%3A%2F%2Fs.co%2Fbrief%3Fe%3DKE%23story-1");
  });
});
