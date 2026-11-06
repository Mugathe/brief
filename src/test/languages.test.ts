import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { canonEdition, editionForCountry, editionOf, EDITIONS, type Lang } from "@/lib/editions";
import { bulletinTitle, categoryLabel, editionLabel, inPlace, LANGS, placeName, t, type Key } from "@/lib/i18n";
import { buildIntro, buildSegments, extractivePicks, leadIn, outro, clusterStories } from "@/lib/bulletin";
import { prepareSpeech } from "@/lib/pronounce";
import { AZURE_VOICES, azureVoice } from "@/lib/tts.server";
import { isVoiceLocale, VOICE_LOCALES, voiceLocale } from "@/lib/voice-locale";
import { categorize, feedsFor } from "@/lib/editions.server";
import { compact, parseXTrends, parseYouTube } from "@/lib/social-feeds";
import { currentPeriodStart, periodLabel } from "@/lib/trends";
import { when } from "@/components/StoryCard";

const codes = LANGS.map((l) => l.code);
const placeholders = (s: string) => [...new Set([...s.matchAll(/\{(\w+)\}/g)].map((m) => (m[1] === "where" ? "place" : m[1]!)))].sort();

describe("translations", () => {
  // Keys are checked by the compiler; this checks the text itself.
  const keys = Object.keys(
    (() => { const o: Record<string, true> = {}; for (const k of ["nav.allStories", "home.count", "tr.vs", "his.intro", "brief.storyOf", "tr.share", "foot.info"]) o[k] = true; return o; })(),
  ) as Key[];

  it("fills in placeholders in every language", () => {
    for (const lang of codes) {
      expect(t(lang, "home.count", { n: 12, when: "5m" })).toContain("12");
      expect(t(lang, "brief.storyOf", { n: 2, total: 7, title: "Titre" })).toMatch(/2.*7.*Titre/);
      expect(t(lang, "tr.vs", { pct: 40, vs: "x" })).toContain("40");
      expect(t(lang, "foot.info", { brand: "Brief" })).toContain("Brief");
    }
    expect(keys.length).toBeGreaterThan(0);
  });
  it("keeps the same placeholders in every language, so nothing is left as {text}", () => {
    const sample = ["home.tagPlace", "home.count", "brief.storyOf", "brief.sub", "tr.since", "tr.vs", "tr.share", "tr.basis", "trl.newCount", "tv.since", "his.heading", "his.intro", "his.earlier", "his.partialNote", "his.farthest", "his.to", "foot.info", "tr.google", "tr.youtubeNote", "tr.xNote", "ago.min", "ago.hour", "ago.day"] as Key[];
    for (const key of sample) {
      const base = placeholders(t("en", key));
      for (const lang of codes) expect(placeholders(t(lang, key)), `${lang} ${key}`).toEqual(base);
    }
  });
  it("never leaves an unfilled placeholder on the Trending and home pages once place and where are supplied", () => {
    for (const lang of codes) {
      const ed = editionOf("KE");
      const vars = { place: placeName(ed, lang), where: inPlace(ed, lang), pct: 3, vs: "x", n: 4, when: "now", term: "x", window: "w", stories: 1, sources: 1, date: "d", view: "v", zone: "z", unit: "u", brand: "B", total: 5, title: "T", a: "a", b: "b" };
      for (const key of ["home.tagPlace", "tr.title", "tr.google", "tr.share", "his.intro", "tr.basis"] as Key[]) expect(t(lang, key, vars), `${lang} ${key}`).not.toMatch(/\{\w+\}/);
    }
  });
  it("translates category names and leaves unknown ones alone", () => {
    expect(categoryLabel("fr", "Politics")).toBe("Politique");
    expect(categoryLabel("sw", "Health")).toBe("Afya");
    expect(categoryLabel("es", "Sports")).toBe("Deportes");
    expect(categoryLabel("pt", "Sports")).toBe("Esportes");
    expect(categoryLabel("fr", "Local news from Kisumu")).toBe("Local news from Kisumu");
  });
});

describe("place names", () => {
  it("names places in the reader's language", () => {
    expect(placeName(editionOf("KE"), "en")).toBe("Kenya");
    expect(placeName(editionOf("ES"), "es")).toBe("España");
    expect(placeName(editionOf("GB"), "fr")).toBe("Royaume-Uni");
    expect(placeName(editionOf("world"), "fr")).toBe("le monde");
  });
  it("says where something is with the right preposition", () => {
    expect(inPlace(editionOf("KE"), "en")).toBe("in Kenya");
    expect(inPlace(editionOf("world"), "en")).toBe("in the world");
    expect(inPlace(editionOf("KE"), "fr")).toBe("au Kenya");
    expect(inPlace(editionOf("US"), "fr")).toBe("aux États-Unis");
    expect(inPlace(editionOf("FR"), "fr")).toBe("en France");
    expect(inPlace(editionOf("KE"), "sw")).toBe("nchini Kenya");
    expect(inPlace(editionOf("world"), "sw")).toBe("duniani");
    expect(inPlace(editionOf("KE"), "pt")).toBe("no Quênia");
    expect(inPlace(editionOf("US"), "pt")).toBe("nos Estados Unidos");
    expect(inPlace(editionOf("MX"), "es")).toBe("en México");
  });
  it("labels the picker in the reader's language and marks second-language editions", () => {
    expect(editionLabel(editionOf("KE"), "en")).toBe("🇰🇪 Kenya");
    expect(editionLabel(editionOf("KE-sw"), "en")).toBe("🇰🇪 Kenya · Kiswahili");
    expect(editionLabel(editionOf("world"), "es")).toBe("🌍 El mundo");
  });
  it("names the bulletin in the language it is read in", () => {
    expect(bulletinTitle(editionOf("KE"), "en")).toBe("Kenya in a Nutshell");
    expect(bulletinTitle(editionOf("world"), "en")).toBe("The World in a Nutshell");
    expect(bulletinTitle(editionOf("KE"), "sw")).toBe("Kenya kwa Ufupi");
    expect(bulletinTitle(editionOf("FR"), "fr")).toBe("France en bref");
    expect(bulletinTitle(editionOf("world"), "es")).toBe("El mundo en breve");
    expect(bulletinTitle(editionOf("BR"), "pt")).toBe("Brasil em resumo");
  });
});

describe("language editions", () => {
  it("carries a language, a country and the right Google locale", () => {
    const sw = editionOf("KE-sw");
    expect([sw.lang, sw.iso, sw.hl, sw.gl, sw.ceid]).toEqual(["sw", "KE", "sw-KE", "KE", "KE:sw"]);
    const br = editionOf("BR");
    expect([br.lang, br.hl, br.ceid]).toEqual(["pt", "pt-BR", "BR:pt"]);
    expect(editionOf("KE").lang).toBe("en");
    expect(editionOf("KE-sw").flag).toBe("🇰🇪");
  });
  it("reads second-language codes from the address, and sends visitors from a country to its main edition", () => {
    expect(canonEdition("ke-sw")).toBe("KE-sw");
    expect(editionForCountry("KE")).toBe("KE");
    expect(editionForCountry("BR")).toBe("BR");
  });
  it("keeps every edition's tools usable: unique codes, X location and YouTube region for countries", () => {
    expect(new Set(EDITIONS.map((e) => e.code)).size).toBe(EDITIONS.length);
    for (const e of EDITIONS) {
      expect(e.woeid, e.code).toBeGreaterThan(0);
      if (e.code !== "world") expect(e.ytRegion, e.code).toMatch(/^[A-Z]{2}$/);
    }
  });
  it("has feeds for each, with BBC Swahili for the Swahili ones and French outlets for France", () => {
    for (const code of ["KE-sw", "TZ-sw", "FR", "ES", "MX", "BR", "SN", "CI"]) {
      const feeds = feedsFor(code);
      expect(feeds.length, code).toBeGreaterThan(4);
      for (const f of feeds) expect(f.url, `${code} ${f.name}`).toMatch(/^https:\/\//);
      expect(new Set(feeds.map((f) => f.name)).size, code).toBe(feeds.length);
    }
    expect(feedsFor("KE-sw").some((f) => f.name === "BBC Swahili")).toBe(true);
    expect(feedsFor("FR").some((f) => f.name === "Le Monde")).toBe(true);
    expect(feedsFor("KE-sw").find((f) => f.name === "Google News Kenya (Kiswahili)")?.url).toContain("hl=sw-KE");
    expect(feedsFor("FR").find((f) => f.name === "Le Monde")?.platform).toBe("Médias français");
  });
  it("guesses categories from headlines in each language, using English names", () => {
    expect(categorize("Le Parlement adopte le budget après un long débat", "FR")).toBe("Politics");
    expect(categorize("Inundaciones dejan miles de desplazados en la costa", "ES")).toBe("Climate & Weather");
    expect(categorize("Polícia prende suspeitos após roubo no centro", "BR")).toBe("Crime & Courts");
    expect(categorize("Mafuriko yaathiri maelfu ya watu", "KE-sw")).toBe("Climate & Weather");
    expect(categorize("L’économie française croît de 0,3 %", "FR")).toBe("Business");
    expect(categorize("Algo sin categoría clara", "ES")).toBe("General");
    expect(categorize("Anything", "FR", "Sports")).toBe("Sports");
  });
});

describe("the bulletin in other languages", () => {
  const now = new Date("2026-10-10T06:30:00Z");
  const world = editionOf("world");
  it("greets, names itself and signs off in each language", () => {
    expect(buildIntro(now, ["Un", "Deux"], editionOf("FR"), "fr")).toMatch(/^Bonjour, et bienvenue dans France en bref, votre bulletin d’actualités Brief\. Nous sommes le samedi 10 octobre\. Les titres\. Un: Un\. Deux: Deux\./);
    expect(buildIntro(now, ["Uno"], editionOf("ES"), "es")).toMatch(/^Buenos días, y bienvenidos a España en breve, tu boletín de noticias de Brief\. Hoy es sábado, 10 de octubre\./);
    expect(buildIntro(now, ["Um"], editionOf("BR"), "pt")).toMatch(/^Bom dia, e bem-vindo ao Brasil em resumo, seu boletim de notícias Brief\. Hoje é sábado, 10 de outubro\./);
    expect(buildIntro(now, ["Moja"], editionOf("KE-sw"), "sw")).toMatch(/^Habari za asubuhi, na karibu kwenye Kenya kwa Ufupi, taarifa yako ya habari ya Brief\. Leo ni /);
    expect(outro(editionOf("FR"), "fr")).toContain("Merci de votre écoute");
    expect(outro(editionOf("KE-sw"), "sw")).toContain("Asante kwa kusikiliza");
  });
  it("uses the evening greeting for the right local hour", () => {
    expect(buildIntro(new Date("2026-10-10T20:00:00Z"), ["x"], editionOf("FR"), "fr")).toMatch(/^Bonsoir/);
    expect(buildIntro(new Date("2026-10-10T20:00:00Z"), ["x"], editionOf("ES"), "es")).toMatch(/^Buenas noches/);
  });
  it("reads a country's edition in another language when the reader chooses one", () => {
    const text = buildIntro(now, ["One"], editionOf("KE"), "fr");
    expect(text).toContain("Kenya en bref");
    expect(text).toContain("Bonjour");
  });
  it("numbers headlines and varies lead-ins in each language", () => {
    expect(leadIn(0, 6, "fr")).toBe("À la une");
    expect(leadIn(5, 6, "es")).toBe("Y para terminar");
    expect(leadIn(2, 6, "pt")).toBe("Também é notícia");
    expect(leadIn(1, 6, "sw")).toBe("Inayofuata");
    expect(leadIn(0, 6)).toBe("Our top story");
  });
  it("builds whole segments in the chosen language", () => {
    const clusters = clusterStories([
      { category: "Politics", source: "Le Monde", title: "Le Parlement adopte le budget de l’État", summary: "Les députés ont voté le texte après un long débat à l’Assemblée nationale.", link: "https://a" },
      { category: "Politics", source: "Le Figaro", title: "Budget de l’État adopté au Parlement", summary: "Le texte a été voté par les députés à l’Assemblée nationale.", link: "https://b" },
    ]);
    expect(clusters.length).toBe(1); // accents no longer split words, so the two reports group together
    const segs = buildSegments(now, extractivePicks(clusters, 1, "fr"), clusters, editionOf("FR"), "fr");
    expect(segs[0]!.title).toBe("Les titres");
    expect(segs.at(-1)!.title).toBe("Au revoir");
    expect(segs[1]!.script).toMatch(/^À la une\./);
    expect(segs[1]!.script).toMatch(/L’information est rapportée par Le Monde et Le Figaro\.$/);
  });
  it("keeps English as before", () => {
    expect(buildIntro(now, ["First"], world, "en")).toContain("welcome to The World in a Nutshell, your Brief news bulletin. It is 6:30 AM UTC on Saturday, 10 October.");
  });
});

describe("speaking other languages", () => {
  it("spells percentages in the language and leaves English money rules to English", () => {
    expect(prepareSpeech("La croissance est de 3,5 %", {}, "fr")).toBe("La croissance est de 3,5 pour cent");
    expect(prepareSpeech("El paro baja un 8%", {}, "es")).toBe("El paro baja un 8 por ciento");
    expect(prepareSpeech("Mfumuko wa bei ni 6%", {}, "sw")).toBe("Mfumuko wa bei ni 6 asilimia");
    expect(prepareSpeech("Sh2.5 billion & 8%", {}, "en")).toBe("2.5 billion shillings and 8 percent");
    expect(prepareSpeech("Un budget de $5 millions", {}, "fr")).toContain("$5 millions"); // the voice reads currencies itself
  });
});

describe("voices", () => {
  it("picks the accent from the language and country", () => {
    expect(voiceLocale(editionOf("KE"), "en")).toBe("en-KE");
    expect(voiceLocale(editionOf("UG"), "en")).toBe("en-KE");
    expect(voiceLocale(editionOf("GH"), "en")).toBe("en-NG");
    expect(voiceLocale(editionOf("world"), "en")).toBe("en-GB");
    expect(voiceLocale(editionOf("KE-sw"), "sw")).toBe("sw-KE");
    expect(voiceLocale(editionOf("TZ-sw"), "sw")).toBe("sw-TZ");
    expect(voiceLocale(editionOf("KE"), "sw")).toBe("sw-KE"); // a Kenyan reader who chose Swahili
    expect(voiceLocale(editionOf("SN"), "fr")).toBe("fr-FR");
    expect(voiceLocale(editionOf("MX"), "es")).toBe("es-MX");
    expect(voiceLocale(editionOf("ES"), "es")).toBe("es-ES");
    expect(voiceLocale(editionOf("world"), "es")).toBe("es-MX");
    expect(voiceLocale(editionOf("BR"), "pt")).toBe("pt-BR");
  });
  it("has a woman's and a man's voice for every locale, named for its own language", () => {
    for (const l of VOICE_LOCALES) {
      const [w, m] = AZURE_VOICES[l];
      expect(w.startsWith(`${l}-`), l).toBe(true);
      expect(m.startsWith(`${l}-`), l).toBe(true);
      expect(w).not.toBe(m);
    }
    expect(isVoiceLocale("sw-KE")).toBe(true);
    expect(isVoiceLocale("xx-YY")).toBe(false);
  });
  describe("overrides", () => {
    const keep = { ...process.env };
    afterEach(() => { process.env = { ...keep }; });
    it("lets one voice be replaced without touching the rest, and keeps the old Kenyan settings working", () => {
      expect(azureVoice("sw-KE", "amani")).toBe("sw-KE-ZuriNeural");
      process.env["AZURE_VOICE_SW_KE_AMANI"] = "sw-KE-CustomNeural";
      expect(azureVoice("sw-KE", "amani")).toBe("sw-KE-CustomNeural");
      expect(azureVoice("sw-KE", "baraka")).toBe("sw-KE-RafikiNeural");
      process.env["AZURE_VOICE_AMANI"] = "en-KE-OldNeural";
      expect(azureVoice("en-KE", "amani")).toBe("en-KE-OldNeural");
      expect(azureVoice("fr-FR", "amani")).toBe("fr-FR-DeniseNeural");
    });
  });
});

describe("history headings in other languages", () => {
  const NOW = new Date("2026-10-14T07:00:00Z");
  it("names yesterday, last week and months in the reader's language", () => {
    expect(periodLabel("day", "2026-10-13", NOW, "Europe/Paris", "fr").title).toBe("Hier");
    expect(periodLabel("day", "2026-10-14", NOW, "Europe/Madrid", "es").title).toBe("Hoy");
    expect(periodLabel("week", "2026-10-05", NOW, "Africa/Nairobi", "sw").title).toBe("Wiki iliyopita");
    expect(periodLabel("week", "2026-10-05", NOW, "UTC", "fr").sub).toMatch(/^du 5 oct\.? au 11 oct\.? 2026$/);
    expect(periodLabel("month", "2026-08-01", NOW, "UTC", "pt")).toMatchObject({ title: "agosto", sub: "2026" });
    expect(currentPeriodStart("day", NOW, "America/Sao_Paulo")).toBe("2026-10-14");
  });
});

describe("story ages", () => {
  const now = Date.parse("2026-10-17T12:00:00Z");
  it("says it in the reader's language", () => {
    expect(when(now - 5 * 60_000, now, "fr")).toBe("il y a 5 min");
    expect(when(now - 3 * 3600_000, now, "es")).toBe("hace 3 h");
    expect(when(now - 5 * 86400_000, now, "sw")).toBe("siku 5 zilizopita");
    expect(when(now - 3 * 3600_000, now)).toBe("3h ago");
  });
});

describe("YouTube and X lists", () => {
  it("reads YouTube's most-popular answer, skipping anything unusable", () => {
    const json = { items: [
      { id: "dQw4w9WgXcQ", snippet: { title: "A video", channelTitle: "Channel", publishedAt: "2026-10-10T10:00:00Z", thumbnails: { medium: { url: "https://i.ytimg.com/vi/x/mqdefault.jpg" } } }, statistics: { viewCount: "1234567" } },
      { id: "bad id!", snippet: { title: "Broken" } },
      { id: "abcdefghijk", snippet: { title: "" } },
      { id: "zzzzzzzzzzz", snippet: { title: "No stats", thumbnails: { default: { url: "http://insecure/x.jpg" } } } },
    ] };
    const out = parseYouTube(json);
    expect(out.map((v) => v.id)).toEqual(["dQw4w9WgXcQ", "zzzzzzzzzzz"]);
    expect(out[0]).toMatchObject({ views: 1234567, url: "https://www.youtube.com/watch?v=dQw4w9WgXcQ" });
    expect(out[1]).toMatchObject({ views: null, thumbnail: "" }); // insecure thumbnails are dropped
    expect(parseYouTube({})).toEqual([]);
    expect(parseYouTube(null)).toEqual([]);
  });
  it("reads X trends, with or without post counts, once each", () => {
    const out = parseXTrends({ data: [{ trend_name: "#Nairobi", tweet_count: 52000 }, { trend_name: "Finance Bill" }, { trend_name: "#nairobi" }, { trend_name: "" }, {}] });
    expect(out.map((t) => t.name)).toEqual(["#Nairobi", "Finance Bill"]);
    expect(out[0]!.posts).toBe(52000);
    expect(out[1]!.posts).toBeNull();
    expect(out[1]!.url).toBe("https://x.com/search?q=Finance%20Bill");
    expect(parseXTrends({ errors: [{ title: "Forbidden" }] })).toEqual([]);
  });
  it("shortens big numbers for the reader's language", () => {
    expect(compact(1_234_000, "en-GB")).toMatch(/^1\.2m$/i);
    expect(compact(52_000, "fr")).toMatch(/52\s?k/i);
  });
});

describe("YouTube and X loaders", () => {
  const keep = { ...process.env };
  beforeEach(() => { vi.resetModules(); });
  afterEach(() => { process.env = { ...keep }; vi.unstubAllGlobals(); });

  const ytBody = { items: [{ id: "dQw4w9WgXcQ", snippet: { title: "V", channelTitle: "C" }, statistics: { viewCount: "10" } }] };
  const ok = (body: unknown) => ({ ok: true, status: 200, json: async () => body });
  const fail = (status: number) => ({ ok: false, status, json: async () => ({}) });

  it("does nothing without a key", async () => {
    delete process.env["YOUTUBE_API_KEY"]; delete process.env["X_BEARER_TOKEN"];
    const fetchMock = vi.fn(); vi.stubGlobal("fetch", fetchMock);
    const { loadYouTube, loadXTrends } = await import("@/lib/social-feeds.server");
    expect(await loadYouTube("KE")).toEqual([]);
    expect(await loadXTrends(23424863)).toEqual([]);
    expect(fetchMock).not.toHaveBeenCalled();
  });
  it("sends keys in headers, never in the address, and shares one answer between callers", async () => {
    process.env["YOUTUBE_API_KEY"] = "SECRET-YT"; process.env["X_BEARER_TOKEN"] = "SECRET-X";
    const fetchMock = vi.fn(async (url: string) => (url.includes("youtube") ? ok(ytBody) : ok({ data: [{ trend_name: "#One", tweet_count: 5 }] })));
    vi.stubGlobal("fetch", fetchMock);
    const { loadYouTube, loadXTrends } = await import("@/lib/social-feeds.server");
    const [a, b, c] = await Promise.all([loadYouTube("KE"), loadYouTube("KE"), loadXTrends(23424863)]);
    expect(a).toEqual(b);
    expect(c[0]!.name).toBe("#One");
    expect(fetchMock).toHaveBeenCalledTimes(2); // one YouTube call for two callers, one X call
    for (const [url, init] of fetchMock.mock.calls as unknown as [string, RequestInit][]) {
      expect(url).not.toContain("SECRET");
      expect(JSON.stringify(init.headers)).toMatch(/SECRET/);
    }
    await loadYouTube("KE"); await loadXTrends(23424863);
    expect(fetchMock).toHaveBeenCalledTimes(2); // remembered
  });
  it("does not keep asking when X says the token or plan is not allowed", async () => {
    process.env["X_BEARER_TOKEN"] = "t";
    const fetchMock = vi.fn(async () => fail(403)); vi.stubGlobal("fetch", fetchMock);
    const errors = vi.spyOn(console, "error").mockImplementation(() => {});
    const { loadXTrends } = await import("@/lib/social-feeds.server");
    expect(await loadXTrends(23424863)).toEqual([]);
    expect(await loadXTrends(23424863)).toEqual([]);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(errors.mock.calls.join(" ")).not.toContain("Bearer");
    errors.mockRestore();
  });
  it("refuses nonsense regions and locations without calling out", async () => {
    process.env["YOUTUBE_API_KEY"] = "k"; process.env["X_BEARER_TOKEN"] = "t";
    const fetchMock = vi.fn(); vi.stubGlobal("fetch", fetchMock);
    const { loadYouTube, loadXTrends } = await import("@/lib/social-feeds.server");
    expect(await loadYouTube("../etc")).toEqual([]);
    expect(await loadXTrends(0)).toEqual([]);
    expect(await loadXTrends(1.5)).toEqual([]);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

import { bulletinParts, isRtl } from "@/lib/i18n";

describe("Arabic and Hindi", () => {
  const now = new Date("2026-10-10T06:30:00Z");
  it("flips only Arabic to right-to-left", () => {
    expect(isRtl("ar")).toBe(true);
    for (const l of ["en", "sw", "fr", "es", "pt", "hi"] as const) expect(isRtl(l), l).toBe(false);
  });
  it("has editions with the right language, country and locale", () => {
    const eg = editionOf("EG");
    expect([eg.lang, eg.iso, eg.hl, eg.ceid, eg.tz]).toEqual(["ar", "EG", "ar-EG", "EG:ar", "Africa/Cairo"]);
    expect(editionOf("SA").lang).toBe("ar");
    const hi = editionOf("IN-hi");
    expect([hi.lang, hi.iso, hi.hl, hi.gl, hi.flag]).toEqual(["hi", "IN", "hi-IN", "IN", "🇮🇳"]);
    expect(canonEdition("in-HI")).toBe("IN-hi");
  });
  it("names places and says where in each", () => {
    expect(placeName(editionOf("EG"), "ar")).toBe("مصر");
    expect(inPlace(editionOf("EG"), "ar")).toBe("في مصر");
    expect(inPlace(editionOf("world"), "ar")).toBe("في العالم");
    expect(inPlace(editionOf("IN-hi"), "hi")).toMatch(/ में$/);
    expect(inPlace(editionOf("world"), "hi")).toBe("दुनिया भर में");
    expect(editionLabel(editionOf("IN-hi"), "en")).toBe("🇮🇳 India · हिन्दी");
    expect(editionLabel(editionOf("world"), "ar")).toBe("🌍 العالم");
  });
  it("names the bulletin and splits its heading for the page", () => {
    expect(bulletinTitle(editionOf("world"), "ar")).toBe("العالم باختصار");
    expect(bulletinParts(editionOf("world"), "ar")).toEqual({ lead: "العالم", accent: "باختصار" });
    expect(bulletinTitle(editionOf("world"), "hi")).toBe("दुनिया संक्षेप में");
    expect(bulletinParts(editionOf("world"), "hi")).toEqual({ lead: "दुनिया", accent: "संक्षेप में" });
    expect(bulletinParts(editionOf("KE"), "en")).toEqual({ lead: "Kenya in a", accent: "Nutshell" });
  });
  it("greets, names itself and signs off", () => {
    expect(buildIntro(now, ["أول", "ثاني"], editionOf("EG"), "ar")).toMatch(/^صباح الخير، ومرحباً بكم في مصر باختصار، نشرتكم الإخبارية من Brief\. اليوم هو .+\. أبرز العناوين\. الأول: أول\. الثاني: ثاني\./);
    expect(buildIntro(new Date("2026-10-10T20:00:00Z"), ["x"], editionOf("SA"), "ar")).toMatch(/^مساء الخير/);
    expect(buildIntro(new Date("2026-10-10T03:00:00Z"), ["एक"], editionOf("IN-hi"), "hi")).toMatch(/^सुप्रभात! यह है भारत संक्षेप में, Brief का आपका समाचार बुलेटिन। आज .+ है। मुख्य सुर्खियां। एक: एक\./); // 08:30 in India
    expect(buildIntro(now, ["एक"], editionOf("IN-hi"), "hi")).toMatch(/^नमस्कार!/); // 12:00 there
    expect(outro(editionOf("EG"), "ar")).toContain("شكراً لاستماعكم");
    expect(outro(editionOf("IN-hi"), "hi")).toContain("सुनने के लिए धन्यवाद");
    expect(leadIn(0, 6, "ar")).toBe("أبرز الأخبار");
    expect(leadIn(0, 6, "hi")).toBe("सबसे बड़ी खबर");
  });
  it("uses Latin digits for Arabic dates, and the reader's calendar words", () => {
    const date = buildIntro(now, ["x"], editionOf("EG"), "ar");
    expect(date).toMatch(/10/); // not ١٠
    expect(date).not.toMatch(/[٠-٩]/);
  });
  it("groups the same story across outlets in these scripts", () => {
    const a = clusterStories([
      { category: "Politics", source: "الأهرام", title: "الحكومة المصرية تعلن عن الموازنة الجديدة للعام المالي", summary: "أعلنت الحكومة الموازنة الجديدة للعام المالي المقبل", link: "https://a" },
      { category: "Politics", source: "اليوم السابع", title: "الموازنة الجديدة للعام المالي تعلنها الحكومة المصرية", summary: "تعلن الحكومة الموازنة الجديدة للعام المالي المقبل", link: "https://b" },
    ]);
    expect(a.length).toBe(1);
    const h = clusterStories([
      { category: "Politics", source: "आज तक", title: "सरकार ने किसानों के लिए नया बजट पेश किया", summary: "किसानों के लिए नया बजट सरकार ने पेश किया है", link: "https://a" },
      { category: "Politics", source: "भास्कर", title: "किसानों के लिए नया बजट पेश, सरकार का दावा", summary: "सरकार ने किसानों के लिए नया बजट पेश किया है", link: "https://b" },
    ]);
    expect(h.length).toBe(1);
  });
  it("guesses categories in Arabic (with attached prefixes) and Hindi", () => {
    expect(categorize("البرلمان يناقش مشروع الموازنة", "EG")).toBe("Politics");
    expect(categorize("والحكومة تعلن خطة جديدة", "EG")).toBe("Politics");
    expect(categorize("فيضانات تضرب المحافظات الجنوبية", "EG")).toBe("Climate & Weather");
    expect(categorize("ارتفاع أسعار الوقود في الأسواق", "SA")).toBe("Business");
    expect(categorize("पुलिस ने आरोपी को गिरफ्तार किया", "IN-hi")).toBe("Crime & Courts");
    expect(categorize("भारी बारिश से कई शहरों में बाढ़", "IN-hi")).toBe("Climate & Weather");
    expect(categorize("सेंसेक्स में भारी गिरावट", "IN-hi")).toBe("Business");
    expect(categoryLabel("ar", "Politics")).toBe("سياسة");
    expect(categoryLabel("hi", "Politics")).toBe("राजनीति");
  });
  it("has feeds for each, including BBC Arabic and BBC Hindi", () => {
    for (const code of ["EG", "SA", "IN-hi"]) {
      const feeds = feedsFor(code);
      expect(feeds.length, code).toBeGreaterThan(5);
      for (const f of feeds) expect(f.url, `${code} ${f.name}`).toMatch(/^https:\/\//);
      expect(new Set(feeds.map((f) => f.name)).size, code).toBe(feeds.length);
    }
    expect(feedsFor("EG").some((f) => f.name === "BBC Arabic")).toBe(true);
    expect(feedsFor("IN-hi").some((f) => f.name === "BBC Hindi")).toBe(true);
    expect(feedsFor("EG").find((f) => f.name === "Google News Egypt")?.url).toContain("hl=ar-EG");
  });
  it("picks voices for them", () => {
    expect(voiceLocale(editionOf("EG"), "ar")).toBe("ar-EG");
    expect(voiceLocale(editionOf("SA"), "ar")).toBe("ar-SA");
    expect(voiceLocale(editionOf("KE"), "ar")).toBe("ar-EG");
    expect(voiceLocale(editionOf("IN-hi"), "hi")).toBe("hi-IN");
    expect(AZURE_VOICES["ar-SA"]).toEqual(["ar-SA-ZariyahNeural", "ar-SA-HamedNeural"]);
    expect(AZURE_VOICES["hi-IN"]).toEqual(["hi-IN-SwaraNeural", "hi-IN-MadhurNeural"]);
  });
  it("speaks percentages in the language", () => {
    expect(prepareSpeech("ارتفع التضخم 7%", {}, "ar")).toBe("ارتفع التضخم 7 في المئة");
    expect(prepareSpeech("महंगाई 6% बढ़ी", {}, "hi")).toBe("महंगाई 6 प्रतिशत बढ़ी");
  });
  it("says ages and dates in them", () => {
    const n = Date.parse("2026-10-17T12:00:00Z");
    expect(when(n - 5 * 60_000, n, "ar")).toBe("منذ 5 د");
    expect(when(n - 3 * 3600_000, n, "hi")).toBe("3 घंटे पहले");
    expect(periodLabel("day", "2026-10-13", new Date("2026-10-14T07:00:00Z"), "Africa/Cairo", "ar").title).toBe("أمس");
    expect(periodLabel("day", "2026-10-13", new Date("2026-10-14T07:00:00Z"), "Asia/Kolkata", "hi").title).toBe("कल");
  });
});
