import { describe, expect, it } from "vitest";
import { BulletinPlayer, type Engine, type PlayerState, type StingerKind } from "@/lib/bulletin-player";
import type { Segment } from "@/lib/bulletin";

const seg = (id: string, kind: Segment["kind"]): Segment => ({ id, kind, title: id, category: "", script: `${id} script text here`, sources: [] });
const SEGS = [seg("intro", "intro"), seg("s1", "story"), seg("s2", "story"), seg("outro", "outro")];

function rig() {
  const log: string[] = [];
  const states: PlayerState[] = [];
  let release: (() => void) | null = null;
  const engine: Engine & { hold: boolean } = {
    hold: false,
    play: (s) => { log.push(`say:${s.id}`); return engine.hold ? new Promise<void>((r) => { release = r; }) : Promise.resolve(); },
    pause: () => log.push("engine:pause"), resume: () => log.push("engine:resume"),
    cancel: () => { log.push("engine:cancel"); release?.(); release = null; },
    prefetch: (s) => log.push(`prefetch:${s.id}`),
  };
  const stinger = async (k: StingerKind) => { log.push(`sting:${k}`); };
  const player = new BulletinPlayer(SEGS, engine, stinger, (s) => states.push(s));
  return { log, states, engine, player, finish: () => { release?.(); release = null; } };
}
const tick = () => new Promise((r) => setTimeout(r, 0));

describe("bulletin player", () => {
  it("plays like a radio programme: theme, headlines, breaker before every story, sign-off, closing theme", async () => {
    const { log, player, states } = rig();
    await player.start();
    expect(log.filter((l) => !l.startsWith("prefetch") && l !== "engine:cancel")).toEqual([
      "sting:open", "say:intro", "sting:next", "say:s1", "sting:next", "say:s2", "sting:next", "say:outro", "sting:close",
    ]);
    expect(states.at(-1)!.status).toBe("done");
  });
  it("loads the next segment while the current one is playing", async () => {
    const { log, player } = rig();
    await player.start();
    expect(log.indexOf("prefetch:s1")).toBeLessThan(log.indexOf("say:intro") + 1);
    expect(log).toContain("prefetch:outro");
  });
  it("pauses and resumes mid-story", async () => {
    const { log, player, engine, finish, states } = rig();
    engine.hold = true;
    const run = player.start(1);
    await tick();
    player.pause();
    expect(states.at(-1)!.status).toBe("paused");
    player.resume();
    expect(states.at(-1)!.status).toBe("playing");
    engine.hold = false;
    finish();
    await run;
    expect(log).toContain("engine:pause");
    expect(log).toContain("engine:resume");
  });
  it("skips to the next story with a breaker and no repeat of the opening theme", async () => {
    const { log, player, engine, states } = rig();
    engine.hold = true;
    void player.start(1);
    await tick();
    expect(states.at(-1)!.index).toBe(1);
    engine.hold = false;
    player.next();
    await tick(); await tick();
    expect(log.filter((l) => l === "sting:open")).toHaveLength(0);
    expect(log).toContain("say:s2");
  });
  it("stop silences everything and resets", async () => {
    const { log, player, engine, states } = rig();
    engine.hold = true;
    void player.start();
    await tick();
    player.stop();
    await tick();
    expect(states.at(-1)).toMatchObject({ status: "idle", index: 0 });
    expect(log).not.toContain("say:s1");
  });
  it("reports failure and goes idle when the voice breaks", async () => {
    const { player, engine, states } = rig();
    engine.play = () => Promise.reject(new Error("no audio"));
    await expect(player.start()).rejects.toThrow("no audio");
    expect(states.at(-1)!.status).toBe("idle");
  });
});
