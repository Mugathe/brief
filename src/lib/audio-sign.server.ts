import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";

/**
 * Every line the presenter may speak is signed when the bulletin is written, and the audio endpoint
 * refuses anything unsigned. That stops outsiders using your voice credits to read arbitrary text.
 * Set AUDIO_SIGNING_KEY (any long random text) if you run more than one server instance.
 */
const fallback = randomBytes(32).toString("hex");
const secret = () => process.env["AUDIO_SIGNING_KEY"] || process.env["INGEST_KEY"] || process.env["SUPABASE_SERVICE_ROLE_KEY"] || fallback;

export const signText = (text: string) => createHmac("sha256", secret()).update(text, "utf8").digest("hex").slice(0, 32);

export function verifyText(text: string, sig: string): boolean {
  const want = Buffer.from(signText(text)), got = Buffer.from(sig);
  return want.length === got.length && timingSafeEqual(want, got);
}
