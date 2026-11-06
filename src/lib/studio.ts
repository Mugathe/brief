// Brief Studio: quote cards and video overlays, drawn on a canvas and recorded in the browser (no server, no ffmpeg).
// Browser-only: every function here needs `document`, canvas and MediaRecorder.

export type Format = "square" | "story" | "landscape";
export const FORMATS: Record<Format, { w: number; h: number; label: string }> = {
  square: { w: 1080, h: 1080, label: "Square 1:1 (Facebook, Instagram feed)" },
  story: { w: 1080, h: 1920, label: "Vertical 9:16 (Reels, Shorts, TikTok, Status)" },
  landscape: { w: 1280, h: 720, label: "Landscape 16:9 (Facebook, YouTube, X)" },
};

/** "quote" shows opening quote marks; "headline" is a top-story card with no marks (used for auto-made cards, where nobody is being quoted). */
export type CardInput = { quote: string; speaker: string; role: string; category: string; url: string; kind?: "quote" | "headline" };
export type OverlayInput = { lead: string; highlight: string; credit: string; date: string; url: string };
export type Track = { kind: "none" } | { kind: "pad" } | { kind: "news" } | { kind: "file"; file: File };

const INK = "#111111", PAPER = "#f5f1e8", RED = "#c8102e", GREEN = "#0a7a3b", YELLOW = "#ffd400", MUTED = "#a8a29e";
const SERIF = "'Fraunces', Georgia, serif";
const SANS = "'IBM Plex Sans', 'Helvetica Neue', Arial, sans-serif";

const clamp = (n: number) => Math.max(0, Math.min(1, n));
const seg = (t: number, a: number, b: number) => clamp((t - a) / (b - a));
const ease = (x: number) => 1 - Math.pow(1 - x, 3);

function wrap(ctx: CanvasRenderingContext2D, text: string, max: number) {
  const lines: string[] = [];
  let line = "";
  for (const w of text.split(/\s+/).filter(Boolean)) {
    const next = line ? `${line} ${w}` : w;
    if (ctx.measureText(next).width > max && line) { lines.push(line); line = w; } else line = next;
  }
  if (line) lines.push(line);
  return lines;
}

/** Waits for the site's fonts so the canvas does not fall back to a plain serif. */
export async function loadStudioFonts() {
  if (!document.fonts) return;
  await Promise.all([
    document.fonts.load("800 40px Fraunces"),
    document.fonts.load("600 40px 'IBM Plex Sans'"),
    document.fonts.load("400 40px 'IBM Plex Sans'"),
  ]).catch(() => undefined);
}

/** The quote card. `t` is seconds into the animation; the default draws the finished card. */
export function drawCard(ctx: CanvasRenderingContext2D, W: number, H: number, c: CardInput, t = 99) {
  const u = Math.min(W, H) / 1080;
  const m = 90 * u;
  ctx.save();
  ctx.textBaseline = "alphabetic";
  ctx.textAlign = "left";
  ctx.fillStyle = INK; ctx.fillRect(0, 0, W, H);
  const bar = ease(seg(t, 0, 0.6));
  [PAPER, RED, GREEN].forEach((col, n) => { ctx.fillStyle = col; ctx.fillRect((W / 3) * n, 0, (W / 3) * bar, 20 * u); });

  const top = 120 * u, bottom = H - 200 * u;
  const maxW = W - 2 * m;
  const text = c.quote.trim();
  let size = 74 * u, lines: string[] = [], lh = 0;
  const maxH = bottom - top - 440 * u;
  for (; size > 26 * u; size -= 2 * u) {
    ctx.font = `800 ${size}px ${SERIF}`;
    lines = wrap(ctx, text, maxW);
    lh = size * 1.26;
    if (lines.length * lh <= maxH) break;
  }
  const isQuote = c.kind !== "headline";
  const lead = (isQuote ? 250 : 110) * u;
  const blockH = lead + lines.length * lh + 130 * u;
  const y0 = top + Math.max(0, (bottom - top - blockH) / 2);

  ctx.globalAlpha = ease(seg(t, 0.1, 0.5));
  ctx.fillStyle = RED; ctx.font = `700 ${38 * u}px ${SANS}`;
  ctx.fillText(c.category.toUpperCase(), m, y0);
  if (isQuote) {
    ctx.globalAlpha = ease(seg(t, 0.2, 0.7));
    ctx.fillStyle = PAPER; ctx.font = `800 ${190 * u}px ${SERIF}`;
    ctx.fillText("“", m - 10 * u, y0 + 170 * u);
  }

  ctx.font = `800 ${size}px ${SERIF}`;
  const textTop = y0 + lead;
  lines.forEach((l, n) => {
    const k = ease(seg(t, 0.7 + n * 0.22, 1.2 + n * 0.22));
    ctx.globalAlpha = k;
    ctx.fillStyle = PAPER;
    ctx.fillText(l, m, textTop + n * lh + (1 - k) * 24 * u);
  });

  const endOfLines = 0.7 + lines.length * 0.22 + 0.5;
  ctx.globalAlpha = ease(seg(t, endOfLines, endOfLines + 0.5));
  const ay = textTop + lines.length * lh + 50 * u;
  ctx.fillStyle = YELLOW; ctx.fillRect(m, ay - 30 * u, 70 * u, 6 * u);
  ctx.fillStyle = PAPER; ctx.font = `700 ${40 * u}px ${SANS}`;
  ctx.fillText(c.speaker, m, ay + 28 * u);
  if (c.role) { ctx.fillStyle = MUTED; ctx.font = `400 ${30 * u}px ${SANS}`; ctx.fillText(c.role, m, ay + 72 * u); }

  ctx.globalAlpha = ease(seg(t, 0.3, 0.9));
  ctx.fillStyle = PAPER; ctx.font = `800 ${64 * u}px ${SERIF}`; ctx.fillText("Brief", m, H - 120 * u);
  ctx.fillStyle = MUTED; ctx.font = `400 ${28 * u}px ${SANS}`;
  ctx.fillText(c.url, m, H - 70 * u);
  ctx.restore();
}

/** One frame of an animated card video: the card at time `t`, fading to black over the last half second. Shared by the browser recorder and the server renderer. */
export function drawCardFrame(ctx: CanvasRenderingContext2D, W: number, H: number, c: CardInput, t: number, seconds: number) {
  drawCard(ctx, W, H, c, t);
  const fade = seg(t, seconds - 0.5, seconds);
  if (fade > 0) { ctx.fillStyle = `rgba(0,0,0,${fade})`; ctx.fillRect(0, 0, W, H); }
}

/** The lower-third over a video: headline (white part, then a yellow part), credit, date, address, and the Brief mark. */
export function drawOverlay(ctx: CanvasRenderingContext2D, W: number, H: number, o: OverlayInput, t = 99) {
  const u = W >= H ? H / 720 : (W / 1080) * 1.25;
  const mx = 48 * u;
  ctx.save();
  ctx.textBaseline = "alphabetic";
  ctx.textAlign = "left";

  const g = ctx.createLinearGradient(0, H * 0.5, 0, H);
  g.addColorStop(0, "rgba(0,0,0,0)"); g.addColorStop(1, "rgba(0,0,0,0.82)");
  ctx.globalAlpha = ease(seg(t, 0, 0.6));
  ctx.fillStyle = g; ctx.fillRect(0, H * 0.5, W, H * 0.5);

  const k = ease(seg(t, 0.4, 1.1));
  ctx.globalAlpha = k;
  const dy = (1 - k) * 36 * u;

  const strip = 8 * u;
  const lift = H > W * 1.5 ? 200 * u : 0; // vertical video: keep clear of the Reels / Shorts / TikTok buttons
  const dateY = H - strip - 26 * u - lift + dy;
  const creditY = dateY - 34 * u;
  const fs = 46 * u, lh = fs * 1.2;
  ctx.font = `700 ${fs}px ${SANS}`;
  const words = [
    ...o.lead.trim().split(/\s+/).filter(Boolean).map((w) => ({ w, col: "#ffffff" })),
    ...o.highlight.trim().split(/\s+/).filter(Boolean).map((w) => ({ w, col: YELLOW })),
  ];
  const rows: { w: string; col: string }[][] = [[]];
  let rowW = 0;
  const space = ctx.measureText(" ").width, maxW = W - 2 * mx;
  for (const word of words) {
    const w = ctx.measureText(word.w).width;
    if (rowW + w > maxW && rows[rows.length - 1]!.length) { rows.push([]); rowW = 0; }
    rows[rows.length - 1]!.push(word); rowW += w + space;
  }
  const lastBase = creditY - 52 * u;
  rows.forEach((row, n) => {
    let x = mx;
    const y = lastBase - (rows.length - 1 - n) * lh;
    for (const word of row) { ctx.fillStyle = word.col; ctx.fillText(word.w, x, y); x += ctx.measureText(word.w).width + space; }
  });

  ctx.font = `600 ${22 * u}px ${SANS}`;
  ctx.fillStyle = "#d6d3d1"; ctx.fillText(o.credit, mx, creditY);
  ctx.fillStyle = YELLOW; ctx.font = `500 ${22 * u}px ${SANS}`; ctx.fillText(o.date, mx, dateY);

  ctx.textAlign = "right";
  ctx.fillStyle = "#ffffff"; ctx.font = `800 ${46 * u}px ${SERIF}`; ctx.fillText("Brief", W - mx, creditY + 10 * u);
  ctx.fillStyle = "#d6d3d1"; ctx.font = `500 ${20 * u}px ${SANS}`; ctx.fillText(o.url, W - mx, dateY);

  ctx.globalAlpha = ease(seg(t, 0, 0.5));
  [INK, RED, GREEN].forEach((col, n) => { ctx.fillStyle = col === INK ? "#ffffff" : col; ctx.fillRect((W / 3) * n, H - strip, W / 3, strip); });
  ctx.restore();
}

export function canvasToBlob(canvas: HTMLCanvasElement) {
  return new Promise<Blob>((res, rej) => canvas.toBlob((b) => (b ? res(b) : rej(new Error("Could not make the image"))), "image/png"));
}

// ---------- sound ----------

/** Starts the soundtrack into `dest`. Returns a function that stops it. */
export async function startTrack(ac: BaseAudioContext, dest: AudioNode, track: Track, seconds: number, level: number): Promise<() => void> {
  if (track.kind === "none") return () => undefined;
  const master = ac.createGain();
  const now = ac.currentTime;
  master.gain.setValueAtTime(0, now);
  master.gain.linearRampToValueAtTime(level, now + 1);
  master.gain.setValueAtTime(level, now + Math.max(1, seconds - 1.2));
  master.gain.linearRampToValueAtTime(0, now + seconds);
  master.connect(dest);
  if (track.kind === "news") return scheduleNews(ac, master, seconds);
  if (track.kind === "file") {
    const buf = await ac.decodeAudioData(await track.file.arrayBuffer());
    const src = ac.createBufferSource();
    src.buffer = buf; src.loop = true; src.connect(master); src.start();
    return () => { try { src.stop(); } catch { /* already stopped */ } };
  }
  // A soft synthesized bed (A minor) with a slow shimmer and one bell when the quote appears. No copyright to worry about.
  const stops: (() => void)[] = [];
  [110, 164.81, 220, 261.63, 329.63].forEach((f, n) => {
    const o = ac.createOscillator(), gain = ac.createGain(), lfo = ac.createOscillator(), lfoGain = ac.createGain();
    o.type = n % 2 ? "triangle" : "sine"; o.frequency.value = f;
    gain.gain.value = 0.16;
    lfo.frequency.value = 0.15 + n * 0.07; lfoGain.gain.value = 0.06;
    lfo.connect(lfoGain); lfoGain.connect(gain.gain);
    o.connect(gain); gain.connect(master);
    o.start(); lfo.start();
    stops.push(() => { try { o.stop(); lfo.stop(); } catch { /* already stopped */ } });
  });
  const bell = ac.createOscillator(), bg = ac.createGain();
  bell.type = "sine"; bell.frequency.value = 880;
  bg.gain.setValueAtTime(0, now + 0.7); bg.gain.linearRampToValueAtTime(0.5, now + 0.72); bg.gain.exponentialRampToValueAtTime(0.001, now + 2.6);
  bell.connect(bg); bg.connect(master); bell.start(now + 0.7); bell.stop(now + 2.7);
  return () => stops.forEach((s) => s());
}


// ---------- news music ----------

/**
 * A "news bulletin" bed made entirely from synthesis, so there are no rights to clear: a punchy opening sting and riser,
 * then a driving 118 BPM groove (kick, snare, hats, pulsing bass, plucked arpeggio, a brass-style stab on every bar)
 * over Em – C – G – D. Short pieces are scheduled at once; long ones a few seconds ahead, to keep the browser light.
 */
function scheduleNews(ac: BaseAudioContext, out: AudioNode, seconds: number): () => void {
  const t0 = ac.currentTime + 0.05;
  const step = 60 / 118 / 4;
  const total = Math.floor(seconds / step);
  const noise = ac.createBuffer(1, ac.sampleRate, ac.sampleRate);
  const nd = noise.getChannelData(0);
  for (let i = 0; i < nd.length; i++) nd[i] = Math.random() * 2 - 1;

  const prog = [
    { bass: 82.41, chord: [329.63, 392.0, 493.88], arp: [329.63, 392.0, 493.88, 659.25] },
    { bass: 65.41, chord: [261.63, 329.63, 392.0], arp: [261.63, 329.63, 392.0, 523.25] },
    { bass: 98.0, chord: [392.0, 493.88, 587.33], arp: [392.0, 493.88, 587.33, 783.99] },
    { bass: 73.42, chord: [293.66, 369.99, 440.0], arp: [293.66, 369.99, 440.0, 587.33] },
  ];
  const ARP = [0, 1, 2, 3, 2, 1, 2, 3, 0, 1, 2, 3, 2, 1, 3, 2];
  const nodes: AudioScheduledSourceNode[] = [];

  const tone = (type: OscillatorType, freq: number, at: number, dur: number, peak: number, cutoff: number) => {
    const o = ac.createOscillator(), f = ac.createBiquadFilter(), g = ac.createGain();
    o.type = type; o.frequency.value = freq;
    f.type = "lowpass"; f.frequency.value = cutoff;
    g.gain.setValueAtTime(0.0001, at);
    g.gain.exponentialRampToValueAtTime(peak, at + 0.012);
    g.gain.exponentialRampToValueAtTime(0.0001, at + dur);
    o.connect(f); f.connect(g); g.connect(out);
    o.start(at); o.stop(at + dur + 0.05);
    nodes.push(o);
  };
  const hit = (at: number, dur: number, peak: number, kind: BiquadFilterType, freq: number) => {
    const n = ac.createBufferSource(), f = ac.createBiquadFilter(), g = ac.createGain();
    n.buffer = noise; n.loop = true;
    f.type = kind; f.frequency.value = freq;
    g.gain.setValueAtTime(peak, at);
    g.gain.exponentialRampToValueAtTime(0.0001, at + dur);
    n.connect(f); f.connect(g); g.connect(out);
    n.start(at); n.stop(at + dur + 0.05);
    nodes.push(n);
  };
  const kick = (at: number) => {
    const o = ac.createOscillator(), g = ac.createGain();
    o.type = "sine";
    o.frequency.setValueAtTime(150, at);
    o.frequency.exponentialRampToValueAtTime(48, at + 0.12);
    g.gain.setValueAtTime(0.9, at);
    g.gain.exponentialRampToValueAtTime(0.0001, at + 0.28);
    o.connect(g); g.connect(out);
    o.start(at); o.stop(at + 0.3);
    nodes.push(o);
  };

  // Opening sting: a riser into a big chord on the first downbeat.
  const riser = ac.createBufferSource(), rf = ac.createBiquadFilter(), rg = ac.createGain();
  riser.buffer = noise; riser.loop = true;
  rf.type = "bandpass"; rf.Q.value = 2;
  rf.frequency.setValueAtTime(300, t0); rf.frequency.exponentialRampToValueAtTime(6000, t0 + 0.9);
  rg.gain.setValueAtTime(0.0001, t0); rg.gain.exponentialRampToValueAtTime(0.35, t0 + 0.88); rg.gain.exponentialRampToValueAtTime(0.0001, t0 + 1.0);
  riser.connect(rf); rf.connect(rg); rg.connect(out);
  riser.start(t0); riser.stop(t0 + 1.05);
  nodes.push(riser);

  const place = (i: number) => {
    const at = t0 + 0.9 + i * step; // the groove starts as the riser lands
    const ch = prog[Math.floor(i / 16) % 4]!;
    const s = i % 16;
    if (s % 4 === 0) kick(at);
    if (s === 4 || s === 12) hit(at, 0.16, 0.28, "bandpass", 1800);
    if (s % 4 === 2) hit(at, 0.05, 0.1, "highpass", 7000);
    if (s % 2 === 0) tone("sawtooth", ch.bass, at, step * 1.7, 0.3, 420);
    tone("triangle", ch.arp[ARP[s]!]!, at, step * 1.4, 0.1, 3200);
    if (s === 0) ch.chord.forEach((f) => tone("sawtooth", f, at, step * 5, 0.07, 2400));
    if (i === 0) ch.chord.forEach((f) => { tone("sawtooth", f, at, 1.6, 0.14, 3000); tone("sawtooth", f / 2, at, 1.6, 0.1, 1500); });
  };

  const ahead = seconds <= 40;
  let next = 0;
  const fill = () => {
    const until = ahead ? total : Math.min(total, Math.ceil((ac.currentTime - t0 + 5) / step));
    for (; next < until; next++) place(next);
  };
  fill();
  const timer = ahead ? undefined : setInterval(fill, 1000);
  return () => {
    if (timer) clearInterval(timer);
    nodes.forEach((n) => { try { n.stop(); } catch { /* already stopped */ } });
  };
}

/** Plays a voice-over into `out`, starting `at` seconds in (after the opening sting). Returns a function that stops it. */
export function playVoice(ac: BaseAudioContext, out: AudioNode, buffer: AudioBuffer, at = 1): () => void {
  const src = ac.createBufferSource(), g = ac.createGain();
  src.buffer = buffer; g.gain.value = 1;
  src.connect(g); g.connect(out);
  src.start(ac.currentTime + at);
  return () => { try { src.stop(); } catch { /* already stopped */ } };
}
/** How long a card video must run to fit a voice-over of this length: it starts at 1 s and needs a moment of calm after it. */
export const secondsForVoice = (voiceSeconds: number, minimum = 9) => Math.min(40, Math.max(minimum, Math.ceil(voiceSeconds + 2.5)));
/** The music sits low under a voice. */
export const MUSIC_UNDER_VOICE = 0.28;

// ---------- recording ----------

const MIMES = ["video/mp4;codecs=avc1.42E01E,mp4a.40.2", "video/mp4", "video/webm;codecs=vp9,opus", "video/webm;codecs=vp8,opus", "video/webm"];
export const recordingSupported = () => typeof MediaRecorder !== "undefined" && typeof HTMLCanvasElement !== "undefined" && "captureStream" in HTMLCanvasElement.prototype;
const pickMime = () => MIMES.find((m) => MediaRecorder.isTypeSupported(m)) ?? "";
export const extensionOf = (blob: Blob) => (blob.type.includes("mp4") ? "mp4" : "webm");

async function record(canvas: HTMLCanvasElement, dest: MediaStreamAudioDestinationNode, seconds: number, draw: (t: number) => void, onProgress?: (p: number) => void) {
  const stream = canvas.captureStream(30);
  dest.stream.getAudioTracks().forEach((tr) => stream.addTrack(tr));
  const mime = pickMime();
  const rec = new MediaRecorder(stream, { ...(mime ? { mimeType: mime } : {}), videoBitsPerSecond: 5_000_000, audioBitsPerSecond: 128_000 });
  const chunks: Blob[] = [];
  rec.ondataavailable = (e) => { if (e.data.size) chunks.push(e.data); };
  const done = new Promise<Blob>((res) => { rec.onstop = () => res(new Blob(chunks, { type: rec.mimeType || mime || "video/webm" })); });
  rec.start(250);
  const t0 = performance.now();
  await new Promise<void>((resolve) => {
    const tick = () => {
      const t = (performance.now() - t0) / 1000;
      draw(t);
      onProgress?.(Math.min(1, t / seconds));
      if (t >= seconds) resolve(); else requestAnimationFrame(tick);
    };
    tick();
  });
  rec.stop();
  return done;
}

/** An animated quote card with sound. Takes `seconds` (real time): keep the tab open while it records. With a voice-over (MP3 bytes) it runs as long as the voice needs. */
export async function makeCardVideo(canvas: HTMLCanvasElement, card: CardInput, track: Track, seconds: number, onProgress?: (p: number) => void, voice?: ArrayBuffer) {
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("No canvas");
  const ac = new AudioContext(); await ac.resume();
  const dest = ac.createMediaStreamDestination();
  try {
    const spoken = voice ? await ac.decodeAudioData(voice.slice(0)) : null;
    const length = spoken ? secondsForVoice(spoken.duration, seconds) : seconds;
    const stopMusic = await startTrack(ac, dest, track, length, spoken ? MUSIC_UNDER_VOICE : track.kind === "news" ? 0.85 : 0.5);
    const stopVoice = spoken ? playVoice(ac, dest, spoken) : () => undefined;
    try {
      return await record(canvas, dest, length, (t) => drawCardFrame(ctx, canvas.width, canvas.height, card, t, length), onProgress);
    } finally { stopMusic(); stopVoice(); }
  } finally { await ac.close(); }
}

/** The person's own video with the lower-third on top, and optionally a quiet soundtrack under its own sound. */
export async function makeOverlayVideo(canvas: HTMLCanvasElement, file: File, overlay: OverlayInput, track: Track, onProgress?: (p: number) => void) {
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("No canvas");
  const v = document.createElement("video");
  v.playsInline = true; v.preload = "auto";
  const src = URL.createObjectURL(file);
  v.src = src;
  await new Promise<void>((res, rej) => { v.onloadedmetadata = () => res(); v.onerror = () => rej(new Error("This browser cannot read that video file")); });
  const seconds = Math.min(v.duration || 30, 180);
  const ac = new AudioContext(); await ac.resume();
  const dest = ac.createMediaStreamDestination();
  ac.createMediaElementSource(v).connect(dest); // the video's own sound, recorded but not played aloud
  const stop = await startTrack(ac, dest, track, seconds, 0.12);
  try {
    const W = canvas.width, H = canvas.height;
    await v.play();
    return await record(canvas, dest, seconds, (t) => {
      ctx.fillStyle = "#000"; ctx.fillRect(0, 0, W, H);
      if (v.videoWidth) {
        const s = Math.max(W / v.videoWidth, H / v.videoHeight);
        const w = v.videoWidth * s, h = v.videoHeight * s;
        ctx.drawImage(v, (W - w) / 2, (H - h) / 2, w, h);
      }
      drawOverlay(ctx, W, H, overlay, t);
    }, onProgress);
  } finally { v.pause(); stop(); URL.revokeObjectURL(src); await ac.close(); }
}

/** MP3 bytes that arrived as base64 text, ready to decode. */
export function base64ToArrayBuffer(b64: string): ArrayBuffer {
  const bin = atob(b64), out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out.buffer;
}

/** Opens the phone's share sheet (Facebook, WhatsApp, Instagram, YouTube…) with the file; downloads it where that is not possible. */
export async function shareOrDownload(blob: Blob, name: string, text: string) {
  const file = new File([blob], name, { type: blob.type });
  if (navigator.canShare?.({ files: [file] })) {
    try { await navigator.share({ files: [file], text }); return "shared"; } catch { return "cancelled"; }
  }
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob); a.download = name; a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 10_000);
  return "downloaded";
}
