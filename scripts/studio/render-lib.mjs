// Draws Brief's cards and reels with no browser: the same drawing code the admin Studio uses, a Node canvas, offline audio, and ffmpeg.
import { spawn } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { createRequire } from "node:module";
import { createCanvas, GlobalFonts } from "@napi-rs/canvas";
import audio from "node-web-audio-api";
import ffmpegPath from "ffmpeg-static";
import { MUSIC_UNDER_VOICE, drawCard, drawCardFrame, playVoice, secondsForVoice, startTrack } from "../../src/lib/studio.ts";

const require = createRequire(import.meta.url);
const fontFile = (pkg, name) => path.join(path.dirname(require.resolve(`${pkg}/package.json`)), "files", name);
let fontsDone = false;
export function registerFonts() {
  if (fontsDone) return;
  for (const w of [600, 800]) GlobalFonts.registerFromPath(fontFile("@fontsource/fraunces", `fraunces-latin-${w}-normal.woff2`), "Fraunces");
  for (const w of [400, 500, 600, 700]) GlobalFonts.registerFromPath(fontFile("@fontsource/ibm-plex-sans", `ibm-plex-sans-latin-${w}-normal.woff2`), "IBM Plex Sans");
  fontsDone = true;
}

/** The finished picture, as PNG bytes. */
export function cardPng(card, W = 1080, H = 1080) {
  registerFonts();
  const c = createCanvas(W, H);
  drawCard(c.getContext("2d"), W, H, card);
  return c.toBuffer("image/png");
}

const SR = 44100;
const toArrayBuffer = (b) => b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength); // a Buffer may be a slice of a larger shared block
/** How long an MP3 voice-over is, in seconds. */
export async function voiceSeconds(mp3) {
  const ac = new audio.OfflineAudioContext(2, SR, SR);
  return (await ac.decodeAudioData(toArrayBuffer(Buffer.from(mp3)))).duration;
}

/** The soundtrack for a reel, rendered to WAV bytes: the music, with the voice-over on top of it if there is one. */
async function soundtrackWav(kind, seconds, mp3) {
  const ac = new audio.OfflineAudioContext(2, Math.ceil(SR * seconds), SR);
  const voice = mp3 ? await ac.decodeAudioData(toArrayBuffer(Buffer.from(mp3))) : null;
  if (kind !== "none") await startTrack(ac, ac.destination, { kind }, seconds, voice ? MUSIC_UNDER_VOICE : 0.85);
  if (voice) playVoice(ac, ac.destination, voice);
  const buf = await ac.startRendering();
  const [l, r] = [buf.getChannelData(0), buf.getChannelData(1)];
  const n = l.length, out = Buffer.alloc(44 + n * 4);
  out.write("RIFF", 0); out.writeUInt32LE(36 + n * 4, 4); out.write("WAVEfmt ", 8); out.writeUInt32LE(16, 16);
  out.writeUInt16LE(1, 20); out.writeUInt16LE(2, 22); out.writeUInt32LE(SR, 24); out.writeUInt32LE(SR * 4, 28); out.writeUInt16LE(4, 32); out.writeUInt16LE(16, 34);
  out.write("data", 36); out.writeUInt32LE(n * 4, 40);
  const q = (x) => Math.round(Math.max(-1, Math.min(1, x)) * 32767);
  for (let i = 0; i < n; i++) { out.writeInt16LE(q(l[i]), 44 + i * 4); out.writeInt16LE(q(r[i]), 46 + i * 4); }
  return out;
}

/** An animated vertical card with music, as MP4 bytes (H.264 and AAC, which Facebook, Instagram and YouTube all take). */
export async function cardReel(card, { seconds = 9, music = "news", voice = null, W = 1080, H = 1920, fps = 30 } = {}) {
  registerFonts();
  if (voice) seconds = secondsForVoice(await voiceSeconds(voice), seconds); // the reel runs as long as the voice needs
  const dir = await mkdtemp(path.join(tmpdir(), "reel-"));
  try {
    const args = ["-y", "-loglevel", "error", "-f", "rawvideo", "-pix_fmt", "rgba", "-s", `${W}x${H}`, "-r", String(fps), "-i", "-"];
    if (music !== "none" || voice) { await writeFile(path.join(dir, "m.wav"), await soundtrackWav(music, seconds, voice)); args.push("-i", path.join(dir, "m.wav")); }
    else args.push("-f", "lavfi", "-i", "anullsrc=r=44100:cl=stereo");
    args.push("-t", String(seconds), "-c:v", "libx264", "-preset", "veryfast", "-crf", "23", "-pix_fmt", "yuv420p", "-c:a", "aac", "-b:a", "128k", "-movflags", "+faststart", "-shortest", path.join(dir, "out.mp4"));
    const ff = spawn(ffmpegPath, args, { stdio: ["pipe", "ignore", "pipe"] });
    let err = "";
    ff.stderr.on("data", (d) => { err += d; });
    const done = new Promise((res, rej) => { ff.on("close", (code) => (code === 0 ? res() : rej(new Error(`ffmpeg exited ${code}: ${err.slice(-400)}`)))); ff.on("error", rej); });
    ff.stdin.on("error", () => undefined); // ffmpeg's own error is reported through `done`
    const c = createCanvas(W, H), ctx = c.getContext("2d");
    const frames = Math.round(seconds * fps);
    for (let f = 0; f < frames; f++) {
      drawCardFrame(ctx, W, H, card, f / fps, seconds);
      if (!ff.stdin.write(Buffer.from(c.data()))) await new Promise((r) => ff.stdin.once("drain", r));
    }
    ff.stdin.end();
    await done;
    return await readFile(path.join(dir, "out.mp4"));
  } finally { await rm(dir, { recursive: true, force: true }); }
}
