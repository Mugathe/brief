import { BulletinPlayer, type Engine, type PlayerState, type StingerKind } from "./bulletin-player";
import type { Segment } from "./bulletin";

/* ---------- Radio breakers, made with the Web Audio API (no sound files needed) ---------- */
type AC = AudioContext;

function bell(ctx: AC, out: AudioNode, freq: number, at: number, len: number, vol = 0.22) {
  for (const [mult, gainMult] of [[1, 1], [2, 0.35], [3.01, 0.12]] as const) {
    const osc = ctx.createOscillator(), g = ctx.createGain();
    osc.type = "sine"; osc.frequency.value = freq * mult;
    g.gain.setValueAtTime(0.0001, at);
    g.gain.exponentialRampToValueAtTime(vol * gainMult, at + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, at + len);
    osc.connect(g); g.connect(out); osc.start(at); osc.stop(at + len + 0.05);
  }
}

function whoosh(ctx: AC, out: AudioNode, at: number, len: number) {
  const buf = ctx.createBuffer(1, Math.floor(ctx.sampleRate * len), ctx.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
  const src = ctx.createBufferSource(); src.buffer = buf;
  const filter = ctx.createBiquadFilter(); filter.type = "bandpass"; filter.Q.value = 1.2;
  filter.frequency.setValueAtTime(400, at); filter.frequency.exponentialRampToValueAtTime(3200, at + len);
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.0001, at); g.gain.exponentialRampToValueAtTime(0.09, at + len * 0.4); g.gain.exponentialRampToValueAtTime(0.0001, at + len);
  src.connect(filter); filter.connect(g); g.connect(out); src.start(at);
}

const NOTE = { C5: 523.25, E5: 659.25, G5: 783.99, A5: 880, C6: 1046.5, E6: 1318.51 };

/** A short musical sting. "next" is the breaker played between headlines. Resolves when it has finished. */
export function playStinger(ctx: AC, kind: StingerKind): Promise<void> {
  const t = ctx.currentTime + 0.05;
  let ms = 1100;
  if (kind === "next") {
    bell(ctx, ctx.destination, NOTE.E5, t, 0.5); bell(ctx, ctx.destination, NOTE.A5, t + 0.12, 0.5); bell(ctx, ctx.destination, NOTE.E6, t + 0.24, 0.8);
    whoosh(ctx, ctx.destination, t, 0.55);
    ms = 1050;
  } else if (kind === "open") {
    [NOTE.C5, NOTE.E5, NOTE.G5, NOTE.C6].forEach((f, n) => bell(ctx, ctx.destination, f, t + n * 0.14, 0.9));
    [NOTE.C5, NOTE.E5, NOTE.G5, NOTE.C6].forEach((f) => bell(ctx, ctx.destination, f, t + 0.7, 1.5, 0.12));
    whoosh(ctx, ctx.destination, t, 0.7);
    ms = 2300;
  } else {
    [NOTE.C6, NOTE.G5, NOTE.E5, NOTE.C5].forEach((f, n) => bell(ctx, ctx.destination, f, t + n * 0.16, 0.9));
    [NOTE.C5, NOTE.E5, NOTE.G5].forEach((f) => bell(ctx, ctx.destination, f, t + 0.7, 1.4, 0.12));
    ms = 2200;
  }
  return new Promise((r) => setTimeout(r, ms));
}

/* ---------- Voices ---------- */
type Voice = "amani" | "baraka";

class StudioEngine implements Engine {
  private audio: HTMLAudioElement | null = null;
  private done: (() => void) | null = null;
  private urls = new Map<string, Promise<string>>();
  constructor(private voice: Voice, private locale: string) {}

  private load(seg: Segment): Promise<string> {
    let p = this.urls.get(seg.id);
    if (!p) {
      p = fetch("/api/public/bulletin-audio", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ text: seg.script, sig: seg.sig, voice: this.voice, locale: this.locale }) })
        .then(async (r) => { if (!r.ok) throw new Error(`Studio voice unavailable (${r.status})`); return URL.createObjectURL(await r.blob()); });
      this.urls.set(seg.id, p);
      p.catch(() => this.urls.delete(seg.id));
    }
    return p;
  }
  prefetch(seg: Segment) { void this.load(seg).catch(() => {}); }
  async play(seg: Segment) {
    const url = await this.load(seg);
    await new Promise<void>((resolve, reject) => {
      const a = new Audio(url);
      this.audio = a; this.done = resolve;
      a.onended = () => resolve();
      a.onerror = () => reject(new Error("Could not play the studio recording"));
      void a.play().catch(reject);
    });
  }
  pause() { this.audio?.pause(); }
  resume() { void this.audio?.play(); }
  cancel() { this.audio?.pause(); this.audio = null; const d = this.done; this.done = null; d?.(); }
  dispose() { this.cancel(); for (const p of this.urls.values()) void p.then((u) => URL.revokeObjectURL(u)).catch(() => {}); this.urls.clear(); }
}

class DeviceEngine implements Engine {
  private done: (() => void) | null = null;
  constructor(private voice: Voice, private locale: string) {}
  static available() { return typeof window !== "undefined" && "speechSynthesis" in window; }
  play(seg: Segment): Promise<void> {
    return new Promise<void>((resolve) => {
      const synth = window.speechSynthesis;
      synth.cancel();
      this.done = resolve;
      const voices = synth.getVoices();
      // Prefer a voice for this exact locale (Edge ships Kenyan English Asilia and Chilemba, and Swahili ones), then any voice in the language.
      const want = this.voice === "amani" ? /asilia|zuri|rehema|denise|elvira|dalia|francisca|salma|zariyah|swara|hoda|naayf|female|zira|jenny|sonia|natasha/i : /chilemba|rafiki|daudi|henri|alvaro|jorge|antonio|shakir|hamed|madhur|male|david|guy|ryan|william/i;
      const norm = (l: string) => l.replace("_", "-").toLowerCase();
      const exact = voices.filter((v) => norm(v.lang) === this.locale.toLowerCase());
      const sameLanguage = voices.filter((v) => norm(v.lang).startsWith(this.locale.slice(0, 2).toLowerCase()));
      const pick = exact.find((v) => want.test(v.name)) ?? exact[0] ?? sameLanguage.find((v) => want.test(v.name)) ?? sameLanguage[0]
        ?? (this.locale.startsWith("en") ? voices.find((v) => /^en[-_](ZA|NG|GB|IN)/i.test(v.lang)) : undefined);
      const pieces = seg.script.match(/[^.!?:]+[.!?:]*/g)?.map((x) => x.trim()).filter(Boolean) ?? [seg.script];
      pieces.forEach((piece, n) => {
        const u = new SpeechSynthesisUtterance(piece);
        if (pick) { u.voice = pick; u.lang = pick.lang; } else u.lang = this.locale;
        u.rate = this.voice === "baraka" ? 0.96 : 1.02;
        u.pitch = this.voice === "baraka" ? 0.85 : 1.05;
        if (n === pieces.length - 1) { u.onend = () => resolve(); u.onerror = () => resolve(); }
        synth.speak(u);
      });
    });
  }
  pause() { window.speechSynthesis.pause(); }
  resume() { window.speechSynthesis.resume(); }
  cancel() { window.speechSynthesis.cancel(); const d = this.done; this.done = null; d?.(); }
}

/** Tries the studio voice first; if it is unavailable, switches to the device's voice for the rest of the bulletin. */
class FallbackEngine implements Engine {
  private usingDevice = false;
  constructor(private studio: StudioEngine, private device: DeviceEngine | null, private onFallback: () => void) {}
  private get active(): Engine { return this.usingDevice && this.device ? this.device : this.studio; }
  prefetch(seg: Segment) { if (!this.usingDevice) this.studio.prefetch(seg); }
  async play(seg: Segment) {
    if (!this.usingDevice) {
      try { await this.studio.play(seg); return; } catch (e) {
        if (!this.device) throw e;
        this.usingDevice = true; this.onFallback();
      }
    }
    await this.device!.play(seg);
  }
  pause() { this.active.pause(); }
  resume() { this.active.resume(); }
  cancel() { this.studio.cancel(); this.device?.cancel(); }
  dispose() { this.studio.dispose(); }
}

export type BulletinController = {
  start(from?: number): Promise<void>; pause(): void; resume(): void; stop(): void; next(): void; previous(): void; dispose(): void;
};

/** Must be created and started from a click, because browsers only allow sound after a user gesture. */
export function createBulletinController(segments: Segment[], voice: Voice, locale: string, onState: (s: PlayerState) => void, onDeviceVoice: () => void): BulletinController {
  const AudioCtor = (window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext);
  const ctx = new AudioCtor();
  const engine = new FallbackEngine(new StudioEngine(voice, locale), DeviceEngine.available() ? new DeviceEngine(voice, locale) : null, onDeviceVoice);
  const player = new BulletinPlayer(segments, engine, async (k) => { await ctx.resume(); await playStinger(ctx, k); }, onState);
  return {
    start: async (from = 0) => { await ctx.resume(); return player.start(from); },
    pause: () => player.pause(), resume: () => player.resume(), stop: () => player.stop(),
    next: () => player.next(), previous: () => player.previous(),
    dispose: () => { player.stop(); engine.dispose(); void ctx.close().catch(() => {}); },
  };
}
