import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { editionOf, parseEdition, WORLD, type Edition, type Lang } from "./editions";
import { canonLang } from "./i18n";
import { loadNews } from "./news.server";
import { prepareSpeech } from "./pronounce";
import { buildSegments, clusterStories, extractivePicks, validatePicks, type Cluster, type Pick, type Segment } from "./bulletin";

export type { Segment } from "./bulletin";
export type Brief = {
  headline: string;
  segments: Segment[];
  generatedAt: number;
  error?: string;
  /** Set when the bulletin was written without an AI writer. */
  note?: string;
};

const LANGUAGE: Record<Lang, string> = { en: "English", sw: "Kiswahili (Swahili)", fr: "French", es: "Spanish", pt: "Brazilian Portuguese", ar: "Modern Standard Arabic, with full diacritics left out", hi: "Hindi, in Devanagari script" };

const instructions = (e: Edition, lang: Lang) => `You are a radio news editor writing a spoken news bulletin ${e.code === WORLD ? "for a global audience, covering what is happening around the world" : `for listeners in ${e.name}`}. You are given numbered story clusters. Each cluster is one event as reported by several outlets.

Choose the 6 to 8 most important clusters and write each as a radio segment. Reply with JSON only:
{"stories":[{"cluster": number, "category": one word such as Politics, Business, Conflict, Weather, Security, Health, Science, Sports, Entertainment or Education, "title": a spoken headline of under 14 words, "detail": 3 to 5 short sentences, 70 to 120 words}]}

Rules:
- Use ONLY facts in the supplied text. Where outlets add different details, combine them and attribute naturally, for example "The BBC reports..." or "Al Jazeera adds...". If outlets disagree, say so plainly.
${e.code === WORLD ? "- Choose stories that matter beyond one country, spread across regions and topics where the news allows, and name the country or place early so a listener anywhere knows where it is happening.\n" : ""}- Write the whole bulletin, headlines and details, in ${LANGUAGE[lang]}, whatever language the source stories are in. Translate faithfully, keep names of people, places and organisations as they are normally written, and never leave sentences in another language.\n- Write for the ear: short sentences, no brackets, no URLs, no abbreviations a presenter would stumble on, and numbers as they are spoken.
- Neutral tone. No speculation, no opinion, no sensational words. Never say "the article".
- Most important story first. If the supplied text is thin, write fewer sentences. Never invent details to fill length.`;

/** One bulletin per edition, kept for a while so a crowd of listeners shares one AI call. */
const caches = new Map<string, { at: number; ttl: number; brief: Brief; dictVersion: number }>();

async function viaLovable(input: string, edition: Edition, lang: Lang): Promise<string> {
  const key = process.env["LOVABLE_API_KEY"];
  if (!key) throw new Error("LOVABLE_API_KEY not set");
  const res = await fetch("https://ai.gateway.lovable.dev/v1/responses", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({ model: "openai/gpt-6-astra", instructions: instructions(edition, lang), input }),
  });
  if (!res.ok) throw new Error(`Lovable AI ${res.status}: ${(await res.text()).slice(0, 200)}`);
  const json = await res.json();
  return json.output_text ?? (json.output ?? []).flatMap((o: any) => o.content ?? []).map((c: any) => c.text ?? "").join("");
}

async function viaAnthropic(input: string, edition: Edition, lang: Lang): Promise<string> {
  const key = process.env["ANTHROPIC_API_KEY"];
  if (!key) throw new Error("ANTHROPIC_API_KEY not set");
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "x-api-key": key, "anthropic-version": "2023-06-01", "Content-Type": "application/json" },
    body: JSON.stringify({ model: process.env["BRIEF_MODEL"] || "claude-haiku-4-5-20251001", max_tokens: 3500, system: instructions(edition, lang), messages: [{ role: "user", content: input }] }),
    signal: AbortSignal.timeout(60_000),
  });
  if (!res.ok) throw new Error(`Anthropic ${res.status}: ${(await res.text()).slice(0, 200)}`);
  const json = await res.json();
  return (json.content ?? []).map((c: any) => c.text ?? "").join("");
}

function parsePicks(raw: string, clusters: Cluster[]): Pick[] {
  const parsed = JSON.parse(raw.slice(raw.indexOf("{"), raw.lastIndexOf("}") + 1));
  const picks = validatePicks(parsed.stories, clusters);
  if (picks.length < 3) throw new Error(`Only ${picks.length} usable stories came back`);
  return picks;
}

async function finish(picks: Pick[], clusters: Cluster[], edition: Edition, lang: Lang, note?: string): Promise<Brief> {
  const { signText } = await import("./audio-sign.server");
  const { loadDictionary } = await import("./pronunciation.server");
  const dict = await loadDictionary();
  // The spoken script gets money, acronyms and tricky names written the way a presenter says them; the page text is untouched.
  const segments = buildSegments(new Date(), picks, clusters, edition, lang).map((s) => { const script = prepareSpeech(s.script, dict, lang); return { ...s, script, sig: signText(script) }; });
  return { headline: picks[0]?.title ?? "", segments, generatedAt: Date.now(), ...(note ? { note } : {}) };
}

const NO_STORIES: Record<Lang, string> = {
  en: "No fresh stories could be loaded just now. Check your connection and try again in a minute.",
  sw: "Habari mpya hazikuweza kupakiwa sasa hivi. Angalia muunganisho wako na ujaribu tena baada ya dakika moja.",
  fr: "Aucun article récent n’a pu être chargé pour le moment. Vérifiez votre connexion et réessayez dans une minute.",
  es: "No se pudieron cargar noticias recientes en este momento. Comprueba tu conexión e inténtalo de nuevo en un minuto.",
  pt: "Não foi possível carregar notícias recentes agora. Verifique sua conexão e tente novamente em um minuto.",
  ar: "تعذّر تحميل أخبار حديثة الآن. تحقق من اتصالك وحاول مرة أخرى بعد دقيقة.",
  hi: "अभी ताज़ा खबरें लोड नहीं हो सकीं। अपना कनेक्शन जांचें और एक मिनट बाद दोबारा कोशिश करें।",
};
const NO_AI: Record<Lang, string> = {
  en: "Written from the outlets' own summaries. The AI editor is unavailable right now.",
  sw: "Imeandikwa kutoka kwenye muhtasari wa vyombo vya habari vyenyewe. Mhariri wa AI hapatikani kwa sasa.",
  fr: "Rédigé à partir des résumés des médias eux-mêmes. L’éditeur IA est indisponible pour le moment.",
  es: "Redactado a partir de los resúmenes de los propios medios. El editor de IA no está disponible ahora mismo.",
  pt: "Redigido a partir dos resumos dos próprios veículos. O editor de IA não está disponível agora.",
  ar: "كُتبت من ملخصات وسائل الإعلام نفسها. محرر الذكاء الاصطناعي غير متاح الآن.",
  hi: "मीडिया संस्थानों के अपने सारांशों से तैयार। AI संपादक अभी उपलब्ध नहीं है।",
};

export const getBrief = createServerFn({ method: "GET" })
  .inputValidator((d) => z.object({ edition: z.string().max(8).optional(), lang: z.string().max(5).optional() }).parse(d ?? {}))
  .handler(async ({ data }): Promise<Brief> => {
    const code = parseEdition(data.edition);
    const edition = editionOf(code);
    // The bulletin is written in the reader's language, which defaults to the edition's own.
    const lang: Lang = canonLang(data.lang) ?? edition.lang;
    const cacheKey = `${code}:${lang}`;
    const { dictionaryVersion } = await import("./pronunciation.server");
    const hit = caches.get(cacheKey);
    if (hit && Date.now() - hit.at < hit.ttl && hit.dictVersion === dictionaryVersion()) return hit.brief;
    const fresh = (await loadNews(code)).filter((i) => Date.now() - i.published < 36 * 3600_000).slice(0, 160);
    if (!fresh.length) {
      return { headline: "", segments: [], generatedAt: Date.now(), error: NO_STORIES[lang] };
    }
    const clusters = clusterStories(fresh.map((i) => ({ category: i.category, source: i.source, title: i.title, summary: i.summary, link: i.link })));
    const input = clusters
      .map((c, n) => `CLUSTER ${n} (${c.sources} outlet${c.sources === 1 ? "" : "s"})\n${c.items.slice(0, 4).map((i) => `- ${i.source} | ${i.title} | ${i.summary.slice(0, 360)}`).join("\n")}`)
      .join("\n\n")
      .replace(/[\uD800-\uDFFF]/g, "")
      .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, " ");

    for (const [name, writer] of [["lovable", viaLovable], ["anthropic", viaAnthropic]] as const) {
      try {
        const brief = await finish(parsePicks(await writer(input, edition, lang), clusters), clusters, edition, lang);
        caches.set(cacheKey, { at: Date.now(), ttl: 15 * 60_000, brief, dictVersion: dictionaryVersion() });
        return brief;
      } catch (e) {
        if (!(e instanceof Error && /not set$/.test(e.message))) console.error(`[brief] ${name} writer failed:`, e instanceof Error ? e.message : e);
      }
    }
    const brief = await finish(extractivePicks(clusters, 6, lang), clusters, edition, lang, NO_AI[lang]);
    caches.set(cacheKey, { at: Date.now(), ttl: 3 * 60_000, brief, dictVersion: dictionaryVersion() }); // try the AI writer again soon
    return brief;
  });
