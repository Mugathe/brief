import type { Segment } from "./bulletin";

export type StingerKind = "open" | "next" | "close";
export type PlayerState = { status: "idle" | "playing" | "paused" | "done"; index: number; total: number };

/** Something that can read one segment aloud (studio recording or the device's voice). */
export interface Engine {
  /** Resolves when the segment has finished, or when cancel() is called. */
  play(seg: Segment): Promise<void>;
  pause(): void;
  resume(): void;
  cancel(): void;
  prefetch?(seg: Segment): void;
}

/**
 * Plays a bulletin like a radio programme: opening theme, the headlines, then each story with a
 * short musical breaker before it, and a closing theme after the sign-off.
 */
export class BulletinPlayer {
  private gen = 0;
  private paused = false;
  private waiters: (() => void)[] = [];
  private state: PlayerState;

  constructor(private segs: Segment[], private engine: Engine, private stinger: (k: StingerKind) => Promise<void>, private onChange: (s: PlayerState) => void) {
    this.state = { status: "idle", index: 0, total: segs.length };
  }

  private emit(patch: Partial<PlayerState>) { this.state = { ...this.state, ...patch }; this.onChange(this.state); }
  private release() { this.waiters.splice(0).forEach((w) => w()); }
  private async gate(gen: number) { while (this.paused && gen === this.gen) await new Promise<void>((r) => this.waiters.push(r)); }

  async start(from = 0): Promise<void> {
    const gen = ++this.gen;
    this.engine.cancel();
    this.paused = false;
    this.release();
    from = Math.min(Math.max(0, from), this.segs.length - 1);
    this.emit({ status: "playing", index: from });
    try {
      if (from === 0) await this.stinger("open");
      for (let i = from; i < this.segs.length; i++) {
        await this.gate(gen);
        if (gen !== this.gen) return;
        this.emit({ index: i, status: this.paused ? "paused" : "playing" });
        const seg = this.segs[i]!;
        if (i > 0) { await this.stinger("next"); await this.gate(gen); if (gen !== this.gen) return; } // the breaker that tells the listener a new item is starting
        const upcoming = this.segs[i + 1];
        if (upcoming) this.engine.prefetch?.(upcoming);
        await this.engine.play(seg);
        if (gen !== this.gen) return;
      }
      await this.stinger("close");
      if (gen === this.gen) this.emit({ status: "done" });
    } catch (e) {
      if (gen === this.gen) { this.emit({ status: "idle" }); throw e; }
    }
  }

  pause() { if (this.state.status !== "playing") return; this.paused = true; this.engine.pause(); this.emit({ status: "paused" }); }
  resume() { if (this.state.status !== "paused") return; this.paused = false; this.engine.resume(); this.release(); this.emit({ status: "playing" }); }
  stop() { this.gen++; this.engine.cancel(); this.paused = false; this.release(); this.emit({ status: "idle", index: 0 }); }
  next() { if (this.state.index < this.segs.length - 1) void this.start(this.state.index + 1).catch(() => {}); }
  previous() { void this.start(Math.max(0, this.state.index - 1)).catch(() => {}); }
}
