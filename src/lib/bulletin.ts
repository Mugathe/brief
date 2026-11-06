/** Pure helpers for building a radio-style news bulletin. No server or browser code here, so it can be tested. */
import { WORLD, type Edition, type Lang } from "./editions";
import { bulletinTitle, dateLocale, t } from "./i18n";
import { LEGAL } from "./legal";

export type Story = { category: string; source: string; title: string; summary: string; link: string };
export type Cluster = { items: Story[]; sources: number; first: number };
export type Pick = { cluster: number; category: string; title: string; detail: string };
export type Segment = {
  id: string; kind: "intro" | "story" | "outro"; title: string; category: string; script: string; detail?: string;
  sources: { name: string; link: string }[]; sig?: string;
};

const STOP = new Set("about after again also amid among being between could first from have into just kenya kenyan kenyans more news over said says should since still than that their them then there these they this those through today under were what when where which while will with would your latest live update breaking".split(" "));

const STOP_OTHER = new Set("في من على إلى عن مع هذا هذه ذلك تلك التي الذي الذين كان كانت يكون بعد قبل بين حتى منذ خلال عند لدى أيضا كما وقد قال قالت للمرة का की के में से को है हैं था थी थे पर और यह वह एक भी ने कि जो तो कहा हो गया गई गए रहा रही रहे लिए साथ बाद पहले अपने उन इस उस यहां वहां कुछ सभी हुआ हुई हुए सकता सकती सकते वाले वाली नहीं या तक द्वारा बीच अब जब तब क्या dans pour avec sans sont être cette ces leur leurs plus mais comme aussi après avant selon entre depuis contre encore alors tout tous fait déjà para como pero esta este estos estas sobre entre desde hasta tras según también después antes cuando donde porque más muy sido será uma como mais para pelo pela pelos pelas sobre entre desde até após segundo também depois antes quando onde porque muito foram será kwamba kwamba ambao ambayo ambaye kuhusu baada kabla pamoja wakati lakini pia sana hivyo huo hizo wake wao yake yao".split(" "));

/** Words of four or more letters (three in Arabic and Devanagari, whose words are shorter), in any alphabet, without the everyday ones. */
const tokens = (t: string) => new Set(t.toLowerCase().replace(/[^\p{L}\p{N}\s]/gu, " ").split(/\s+/).filter((w) => w.length >= (/[\u0600-\u06FF\u0900-\u097F]/.test(w) ? 3 : 4) && !STOP.has(w) && !STOP_OTHER.has(w)));

export const cleanText = (s: string) =>
  s.replace(/<[^>]*>/g, " ").replace(/&nbsp;|&#160;/g, " ").replace(/&amp;/g, "&").replace(/&quot;|&#34;/g, '"').replace(/&#39;|&apos;|&#8217;/g, "'").replace(/\s+/g, " ").trim();

/** Groups headlines about the same event from different outlets. Bigger clusters (more outlets) come first. */
export function clusterStories(items: Story[], max = 14): Cluster[] {
  const clusters: { items: Story[]; tok: Set<string>; first: number }[] = [];
  items.forEach((it, index) => {
    const tk = tokens(it.title);
    let best = -1, bestOverlap = 0;
    clusters.forEach((c, n) => {
      let overlap = 0;
      for (const w of tk) if (c.tok.has(w)) overlap++;
      const ok = overlap >= 3 || (overlap >= 2 && overlap / Math.min(tk.size, c.tok.size) >= 0.6);
      if (ok && overlap > bestOverlap) { best = n; bestOverlap = overlap; }
    });
    if (best >= 0) { clusters[best]!.items.push(it); for (const w of tk) clusters[best]!.tok.add(w); }
    else clusters.push({ items: [it], tok: tk, first: index });
  });
  return clusters
    .map((c) => ({ items: c.items, sources: new Set(c.items.map((i) => i.source)).size, first: c.first }))
    .sort((a, b) => b.sources - a.sources || a.first - b.first)
    .slice(0, max);
}

/** Formats a moment in a time zone, so the greeting and the date match the edition's listeners, in the language they hear. */
const inZone = (now: Date, tz: string, opts: Intl.DateTimeFormatOptions, lang: Lang = "en") => new Intl.DateTimeFormat(dateLocale(lang), { timeZone: tz, ...opts }).format(now);
export const dayPart = (now: Date, tz = "UTC") => { const h = Number(inZone(now, tz, { hour: "numeric", hourCycle: "h23" })); return h < 12 ? "morning" : h < 17 ? "afternoon" : "evening"; };

/** The fixed phrases of a bulletin, per language: greeting, numbering, lead-ins, sign-off. */
type Phrases = {
  greet: Record<"morning" | "afternoon" | "evening", string>;
  numbers: string[];
  first: string; last: string; middle: string[];
  intro: (a: { greeting: string; title: string; brand: string; date: string; time: string; heads: string }) => string;
  outro: (a: { title: string; brand: string }) => string;
  signoff: string; and: string; noDetail: string; reportedBy: (names: string) => string; reportedByOne: (name: string) => string;
};

const PHRASES: Record<Lang, Phrases> = {
  en: {
    greet: { morning: "Good morning", afternoon: "Good afternoon", evening: "Good evening" },
    numbers: ["One", "Two", "Three", "Four", "Five", "Six"], first: "Our top story", last: "And finally", middle: ["Next", "Also making news", "Turning now to", "In other news", "Meanwhile"],
    intro: ({ greeting, title, brand, date, time, heads }) => `${greeting}, and welcome to ${title}, your ${brand} news bulletin. It is ${time} on ${date}. The headlines. ${heads} Now, the details.`,
    outro: ({ title, brand }) => `That was ${title}. The full stories, with links to the original reports, are on ${brand}. Thank you for listening, and stay informed.`,
    signoff: "Sign-off", and: "and", noDetail: "Details are in the original report.",
    reportedBy: (n) => ` The story is being reported by ${n}.`, reportedByOne: (n) => ` Reported by ${n}.`,
  },
  sw: {
    greet: { morning: "Habari za asubuhi", afternoon: "Habari za mchana", evening: "Habari za jioni" },
    numbers: ["Moja", "Mbili", "Tatu", "Nne", "Tano", "Sita"], first: "Habari kuu", last: "Na mwisho", middle: ["Inayofuata", "Pia katika habari", "Tukigeukia", "Katika habari nyingine", "Wakati huo huo"],
    intro: ({ greeting, title, brand, date, heads }) => `${greeting}, na karibu kwenye ${title}, taarifa yako ya habari ya ${brand}. Leo ni ${date}. Vichwa vya habari. ${heads} Sasa, kwa undani.`,
    outro: ({ title, brand }) => `Hiyo ilikuwa ${title}. Habari kamili, pamoja na viungo vya ripoti asili, ziko kwenye ${brand}. Asante kwa kusikiliza, na endelea kujua yanayotokea.`,
    signoff: "Kuhitimisha", and: "na", noDetail: "Maelezo yako kwenye ripoti asili.",
    reportedBy: (n) => ` Habari hii inaripotiwa na ${n}.`, reportedByOne: (n) => ` Imeripotiwa na ${n}.`,
  },
  fr: {
    greet: { morning: "Bonjour", afternoon: "Bonjour", evening: "Bonsoir" },
    numbers: ["Un", "Deux", "Trois", "Quatre", "Cinq", "Six"], first: "À la une", last: "Et pour finir", middle: ["Ensuite", "Également à la une", "Passons à", "Dans l’actualité", "Pendant ce temps"],
    intro: ({ greeting, title, brand, date, heads }) => `${greeting}, et bienvenue dans ${title}, votre bulletin d’actualités ${brand}. Nous sommes le ${date}. Les titres. ${heads} Maintenant, les détails.`,
    outro: ({ title, brand }) => `C’était ${title}. Les articles complets, avec les liens vers les reportages d’origine, sont sur ${brand}. Merci de votre écoute, et restez informés.`,
    signoff: "Au revoir", and: "et", noDetail: "Les détails figurent dans l’article d’origine.",
    reportedBy: (n) => ` L’information est rapportée par ${n}.`, reportedByOne: (n) => ` Rapporté par ${n}.`,
  },
  es: {
    greet: { morning: "Buenos días", afternoon: "Buenas tardes", evening: "Buenas noches" },
    numbers: ["Uno", "Dos", "Tres", "Cuatro", "Cinco", "Seis"], first: "Nuestra noticia principal", last: "Y para terminar", middle: ["A continuación", "También es noticia", "Pasamos a", "En otras noticias", "Mientras tanto"],
    intro: ({ greeting, title, brand, date, heads }) => `${greeting}, y bienvenidos a ${title}, tu boletín de noticias de ${brand}. Hoy es ${date}. Los titulares. ${heads} Ahora, los detalles.`,
    outro: ({ title, brand }) => `Eso fue ${title}. Las noticias completas, con enlaces a los reportajes originales, están en ${brand}. Gracias por escuchar, y mantente informado.`,
    signoff: "Despedida", and: "y", noDetail: "Los detalles están en el reportaje original.",
    reportedBy: (n) => ` La noticia la cuentan ${n}.`, reportedByOne: (n) => ` Informa ${n}.`,
  },
  pt: {
    greet: { morning: "Bom dia", afternoon: "Boa tarde", evening: "Boa noite" },
    numbers: ["Um", "Dois", "Três", "Quatro", "Cinco", "Seis"], first: "Nossa principal notícia", last: "E para terminar", middle: ["A seguir", "Também é notícia", "Passando para", "Em outras notícias", "Enquanto isso"],
    intro: ({ greeting, title, brand, date, heads }) => `${greeting}, e bem-vindo ao ${title}, seu boletim de notícias ${brand}. Hoje é ${date}. As manchetes. ${heads} Agora, os detalhes.`,
    outro: ({ title, brand }) => `Esse foi o ${title}. As notícias completas, com links para as reportagens originais, estão no ${brand}. Obrigado por ouvir, e continue bem informado.`,
    signoff: "Despedida", and: "e", noDetail: "Os detalhes estão na reportagem original.",
    reportedBy: (n) => ` A notícia é contada por ${n}.`, reportedByOne: (n) => ` Informa ${n}.`,
  },
  ar: {
    greet: { morning: "صباح الخير", afternoon: "مساء الخير", evening: "مساء الخير" },
    numbers: ["الأول", "الثاني", "الثالث", "الرابع", "الخامس", "السادس"], first: "أبرز الأخبار", last: "وأخيراً", middle: ["بعد ذلك", "وفي الأخبار أيضاً", "وننتقل إلى", "وفي أخبار أخرى", "في الأثناء"],
    intro: ({ greeting, title, brand, date, heads }) => `${greeting}، ومرحباً بكم في ${title}، نشرتكم الإخبارية من ${brand}. اليوم هو ${date}. أبرز العناوين. ${heads} والآن، التفاصيل.`,
    outro: ({ title, brand }) => `كانت هذه ${title}. القصص الكاملة، مع روابط التقارير الأصلية، على ${brand}. شكراً لاستماعكم، وابقوا على اطلاع.`,
    signoff: "ختام", and: "و", noDetail: "التفاصيل في التقرير الأصلي.",
    reportedBy: (n) => ` يتابع الخبر ${n}.`, reportedByOne: (n) => ` نقلاً عن ${n}.`,
  },
  hi: {
    greet: { morning: "सुप्रभात", afternoon: "नमस्कार", evening: "शुभ संध्या" },
    numbers: ["एक", "दो", "तीन", "चार", "पांच", "छह"], first: "सबसे बड़ी खबर", last: "और अंत में", middle: ["इसके बाद", "खबरों में यह भी", "अब रुख करते हैं", "अन्य खबरों में", "इस बीच"],
    intro: ({ greeting, title, brand, date, heads }) => `${greeting}! यह है ${title}, ${brand} का आपका समाचार बुलेटिन। आज ${date} है। मुख्य सुर्खियां। ${heads} अब, विस्तार से।`,
    outro: ({ title, brand }) => `यह था ${title}। पूरी खबरें, मूल रिपोर्टों के लिंक के साथ, ${brand} पर हैं। सुनने के लिए धन्यवाद, और जानकारी में बने रहें।`,
    signoff: "समापन", and: "और", noDetail: "विवरण मूल रिपोर्ट में हैं।",
    reportedBy: (n) => ` यह खबर ${n} द्वारा रिपोर्ट की जा रही है।`, reportedByOne: (n) => ` रिपोर्ट: ${n}।`,
  },
};

export function leadIn(n: number, total: number, lang: Lang = "en"): string {
  const p = PHRASES[lang];
  if (n === 0) return p.first;
  if (n === total - 1 && total > 2) return p.last;
  return p.middle[(n - 1) % p.middle.length]!;
}

const stripEnd = (s: string) => s.replace(/[.!?\s]+$/, "");

export function buildIntro(now: Date, titles: string[], edition: Edition, lang: Lang = edition.lang): string {
  const tz = edition.tz;
  const p = PHRASES[lang];
  const part = dayPart(now, tz) as "morning" | "afternoon" | "evening";
  const hour24 = Number(inZone(now, tz, { hour: "numeric", hourCycle: "h23" }));
  const minute = inZone(now, tz, { minute: "2-digit" }).padStart(2, "0");
  const time = `${hour24 % 12 === 0 ? 12 : hour24 % 12}:${minute} ${hour24 < 12 ? "AM" : "PM"}${edition.code === WORLD ? " UTC" : ""}`;
  // Built from parts so there is always a comma, which makes the voice pause after the weekday.
  const date = lang === "en"
    ? `${inZone(now, tz, { weekday: "long" })}, ${inZone(now, tz, { day: "numeric" })} ${inZone(now, tz, { month: "long" })}`
    : inZone(now, tz, { weekday: "long", day: "numeric", month: "long" }, lang);
  const heads = titles.slice(0, 6).map((t, n) => `${p.numbers[n]}: ${stripEnd(t)}.`).join(" ");
  return p.intro({ greeting: p.greet[part], title: bulletinTitle(edition, lang), brand: LEGAL.brand, date, time, heads });
}

export const outro = (edition: Edition, lang: Lang = edition.lang) => PHRASES[lang].outro({ title: bulletinTitle(edition, lang), brand: LEGAL.brand });

/** Turns the chosen stories into the segments that are read out, in order. */
export function buildSegments(now: Date, picks: Pick[], clusters: Cluster[], edition: Edition, lang: Lang = edition.lang): Segment[] {
  const stories: Segment[] = picks.map((p, n) => {
    const c = clusters[p.cluster];
    const seen = new Set<string>();
    const sources = (c?.items ?? []).filter((i) => (seen.has(i.source) ? false : (seen.add(i.source), true))).slice(0, 3).map((i) => ({ name: i.source, link: i.link }));
    return { id: `s${n + 1}`, kind: "story", title: stripEnd(p.title), category: p.category, script: `${leadIn(n, picks.length, lang)}. ${stripEnd(p.title)}. ${p.detail}`, detail: p.detail, sources };
  });
  return [
    { id: "intro", kind: "intro", title: t(lang, "brief.headlines"), category: "", script: buildIntro(now, stories.map((s) => s.title), edition, lang), sources: [] },
    ...stories,
    { id: "outro", kind: "outro", title: PHRASES[lang].signoff, category: "", script: outro(edition, lang), sources: [] },
  ];
}

/** Checks the model's choices: real clusters, enough detail, sensible lengths. */
export function validatePicks(raw: unknown, clusters: Cluster[]): Pick[] {
  const list = Array.isArray(raw) ? (raw as Record<string, unknown>[]) : [];
  const used = new Set<number>();
  const out: Pick[] = [];
  for (const r of list) {
    const cluster = Number(r?.["cluster"]);
    const title = cleanText(String(r?.["title"] ?? "")).slice(0, 120);
    const detail = cleanText(String(r?.["detail"] ?? "")).slice(0, 950);
    if (!Number.isInteger(cluster) || !clusters[cluster] || used.has(cluster) || title.length < 8 || detail.length < 40) continue;
    used.add(cluster);
    out.push({ cluster, category: cleanText(String(r?.["category"] ?? "General")).slice(0, 30) || "General", title, detail });
    if (out.length >= 8) break;
  }
  return out;
}

/** Splits only where punctuation is followed by a space, so "Sh2.5 billion" and "8.5%" stay in one piece. */
const sentences = (s: string) => cleanText(s).split(/(?<=[.!?])\s+/).map((x) => x.trim()).filter(Boolean);
const NAMES = (xs: string[], lang: Lang = "en") => (xs.length <= 1 ? xs.join("") : `${xs.slice(0, -1).join(", ")} ${PHRASES[lang].and} ${xs.at(-1)}`);

/** No AI needed: the best-covered stories with what the outlets themselves say. */
export function extractivePicks(clusters: Cluster[], count = 6, lang: Lang = "en"): Pick[] {
  const picks: Pick[] = [];
  clusters.forEach((c, index) => {
    if (picks.length >= count) return;
    const lead = c.items[0];
    if (!lead) return;
    const body = c.items.map((i) => sentences(i.summary).slice(0, 2).join(" ")).find((s) => s.length >= 40) ?? "";
    const outlets = [...new Set(c.items.map((i) => i.source))];
    const ph = PHRASES[lang];
    const also = outlets.length > 1 ? ph.reportedBy(NAMES(outlets.slice(0, 4), lang)) : ph.reportedByOne(outlets[0] ?? "");
    picks.push({ cluster: index, category: lead.category || "General", title: cleanText(lead.title).slice(0, 120), detail: `${body || ph.noDetail}${also}` });
  });
  return picks;
}
