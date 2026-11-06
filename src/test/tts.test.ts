import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { buildSsml, synthesize, ttsProvider, voiceConfig } from "@/lib/tts.server";

const KEYS = ["AZURE_SPEECH_KEY", "AZURE_SPEECH_REGION", "AZURE_VOICE_AMANI", "AZURE_VOICE_BARAKA", "ELEVENLABS_API_KEY", "ELEVENLABS_VOICE_AMANI", "ELEVENLABS_VOICE_BARAKA", "ELEVENLABS_MODEL", "TTS_PROVIDER"];
let calls: { url: string; init: RequestInit }[] = [];
beforeEach(() => {
  calls = [];
  for (const k of KEYS) delete process.env[k];
  vi.stubGlobal("fetch", vi.fn(async (url: string, init: RequestInit) => { calls.push({ url: String(url), init }); return new Response(new Uint8Array([1, 2, 3]), { status: 200 }); }));
});
afterEach(() => vi.unstubAllGlobals());

describe("choosing a provider", () => {
  it("is none by default, so listeners get their device voice", () => expect(ttsProvider()).toBeNull());
  it("prefers Azure's Kenyan voices when both are set", () => {
    Object.assign(process.env, { AZURE_SPEECH_KEY: "k", AZURE_SPEECH_REGION: "southafricanorth", ELEVENLABS_API_KEY: "e" });
    expect(ttsProvider()).toBe("azure");
  });
  it("can be forced, and falls back when the forced one is not set up", () => {
    Object.assign(process.env, { AZURE_SPEECH_KEY: "k", AZURE_SPEECH_REGION: "r", ELEVENLABS_API_KEY: "e", TTS_PROVIDER: "elevenlabs" });
    expect(ttsProvider()).toBe("elevenlabs");
    delete process.env["ELEVENLABS_API_KEY"];
    expect(ttsProvider()).toBe("azure");
  });
  it("needs both an Azure key and a region", () => { process.env["AZURE_SPEECH_KEY"] = "k"; expect(ttsProvider()).toBeNull(); });
});

describe("Azure Kenyan English", () => {
  beforeEach(() => Object.assign(process.env, { AZURE_SPEECH_KEY: "azure-key", AZURE_SPEECH_REGION: "southafricanorth" }));
  it("uses Kenyan voices by default, one per presenter", () => {
    expect(voiceConfig().azure.amani).toBe("en-KE-AsiliaNeural");
    expect(voiceConfig().azure.baraka).toBe("en-KE-ChilembaNeural");
  });
  it("sends the right request", async () => {
    const r = await synthesize("Good morning, Kenya.", "amani");
    expect(r.provider).toBe("azure");
    expect(calls[0]!.url).toBe("https://southafricanorth.tts.speech.microsoft.com/cognitiveservices/v1");
    const h = calls[0]!.init.headers as Record<string, string>;
    expect(h["Ocp-Apim-Subscription-Key"]).toBe("azure-key");
    expect(h["Content-Type"]).toBe("application/ssml+xml");
    expect(h["X-Microsoft-OutputFormat"]).toMatch(/mp3/);
    expect(String(calls[0]!.init.body)).toContain('<voice name="en-KE-AsiliaNeural">');
  });
  it("gives Baraka the male Kenyan voice at a slightly slower pace", async () => {
    await synthesize("Good evening.", "baraka");
    const body = String(calls[0]!.init.body);
    expect(body).toContain("en-KE-ChilembaNeural");
    expect(body).toContain('rate="-2%"');
  });
  it("lets you swap voices, for example to Swahili", async () => {
    process.env["AZURE_VOICE_AMANI"] = "sw-KE-ZuriNeural";
    await synthesize("Habari za asubuhi.", "amani");
    expect(String(calls[0]!.init.body)).toContain('xml:lang="sw-KE"');
  });
  it("escapes text safely and adds a pause after each sentence", () => {
    const ssml = buildSsml(`Tom & Jerry said "no". Then <left>. Done`, "en-KE-AsiliaNeural");
    expect(ssml).toContain("Tom &amp; Jerry");
    expect(ssml).toContain("&quot;no&quot;.");
    expect(ssml).toContain("&lt;left&gt;");
    expect(ssml).not.toContain("<left>");
    expect(ssml.match(/<break time="280ms"\/>/g)!.length).toBe(2);
  });
  it("reports a refusal clearly", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response("Invalid key", { status: 401 })));
    await expect(synthesize("Hello there everyone.", "amani")).rejects.toThrow(/Azure Speech 401/);
  });
});

describe("ElevenLabs", () => {
  beforeEach(() => process.env["ELEVENLABS_API_KEY"] = "el-key");
  it("uses configurable voice IDs and model", async () => {
    Object.assign(process.env, { ELEVENLABS_VOICE_AMANI: "KENYAN_VOICE_ID", ELEVENLABS_MODEL: "eleven_v3" });
    const r = await synthesize("Hello there everyone.", "amani");
    expect(r.provider).toBe("elevenlabs");
    expect(calls[0]!.url).toContain("/text-to-speech/KENYAN_VOICE_ID?");
    expect(JSON.parse(String(calls[0]!.init.body)).model_id).toBe("eleven_v3");
  });
  it("keeps the previous defaults when nothing is set", () => {
    expect(voiceConfig().elevenlabs.amani).toBe("EXAVITQu4vr4xnSDxMaL");
    expect(voiceConfig().elevenlabs.model).toBe("eleven_multilingual_v2");
  });
});

describe("no provider", () => {
  it("refuses cleanly", async () => { await expect(synthesize("Hello there everyone.", "amani")).rejects.toThrow(/No studio voice/); });
});
