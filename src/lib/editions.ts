/**
 * Editions: the "countries" Brief covers. Everything that used to assume Kenya (news sources, time zone,
 * Google Trends location, bulletin name) is read from here, so adding a country is one entry in EDITIONS
 * plus, optionally, its own outlets in editions.server.ts.
 *
 * "world" is the global edition: international outlets and Google News' World, Business, Tech, Science, Health,
 * Sports and Entertainment sections. Every other edition is one country.
 */
export type Lang = "en" | "sw" | "fr" | "es" | "pt" | "ar" | "hi";

export type Edition = {
  /** "world", a country code such as "KE", or a country in a second language such as "KE-sw". Stored with every archived headline. */
  code: string;
  /** Name in the edition picker (English; the picker shows it in the reader's language). */
  name: string;
  /** Short place name for sentences ("Kenya"). */
  place: string;
  /** ISO 3166 country code, absent for the world edition. */
  iso?: string;
  /** Language of this edition's news, and of its bulletin unless the reader chooses another. */
  lang: Lang;
  /** What outlets from here are called ("Kenyan outlets"), in the edition's language. */
  outlets: string;
  /** IANA time zone used for dates, "today" and the bulletin greeting. */
  tz: string;
  /** Google News / Google Trends language and country. */
  hl: string;
  gl: string;
  ceid: string;
  /** Google Trends "trending now" location. Absent for the world edition (Google has no worldwide feed). */
  trendsGeo?: string;
  /** X (Twitter) "Where On Earth" ID for this location's trends. */
  woeid?: number;
  /** YouTube "most popular" region (a country code). Absent for the world edition. */
  ytRegion?: string;
  flag: string;
};

const OUTLETS: Record<Lang, (adjective: string) => string> = {
  en: (a) => `${a} outlets`, sw: (a) => `Vyombo vya habari vya ${a}`, fr: (a) => `Médias ${a}`, es: (a) => `Medios ${a}`, pt: (a) => `Veículos ${a}`,
  ar: (a) => `وسائل الإعلام ${a}`, hi: (a) => `${a} मीडिया`,
};

type Options = { iso?: string; lang?: Lang; woeid: number; place?: string };
const country = (code: string, name: string, adjective: string, tz: string, o: Options): Edition => {
  const iso = o.iso ?? code;
  const lang = o.lang ?? "en";
  return {
    code, name, place: o.place ?? name, iso, lang, outlets: OUTLETS[lang](adjective), tz,
    hl: lang === "en" ? `en-${iso}` : `${lang}-${iso}`, gl: iso, ceid: `${iso}:${lang}`, trendsGeo: iso, woeid: o.woeid, ytRegion: iso,
    flag: String.fromCodePoint(...[...iso].map((c) => 0x1f1a5 + c.charCodeAt(0))),
  };
};

// WOEIDs were written from memory: if X reports a location as unknown, the error is logged and the trends are skipped.
export const EDITIONS: readonly Edition[] = [
  { code: "world", name: "World", place: "the world", lang: "en", outlets: "Global outlets", tz: "UTC", hl: "en", gl: "US", ceid: "US:en", woeid: 1, flag: "🌍" },
  country("KE", "Kenya", "Kenyan", "Africa/Nairobi", { woeid: 23424863 }),
  country("KE-sw", "Kenya (Kiswahili)", "Kenya", "Africa/Nairobi", { iso: "KE", lang: "sw", woeid: 23424863, place: "Kenya" }),
  country("UG", "Uganda", "Ugandan", "Africa/Kampala", { woeid: 23424974 }),
  country("TZ", "Tanzania", "Tanzanian", "Africa/Dar_es_Salaam", { woeid: 23424973 }),
  country("TZ-sw", "Tanzania (Kiswahili)", "Tanzania", "Africa/Dar_es_Salaam", { iso: "TZ", lang: "sw", woeid: 23424973, place: "Tanzania" }),
  country("NG", "Nigeria", "Nigerian", "Africa/Lagos", { woeid: 23424908 }),
  country("GH", "Ghana", "Ghanaian", "Africa/Accra", { woeid: 23424824 }),
  country("ZA", "South Africa", "South African", "Africa/Johannesburg", { woeid: 23424942 }),
  country("SN", "Senegal", "sénégalais", "Africa/Dakar", { lang: "fr", woeid: 23424943 }),
  country("CI", "Côte d'Ivoire", "ivoiriens", "Africa/Abidjan", { lang: "fr", woeid: 23424854 }),
  country("GB", "United Kingdom", "British", "Europe/London", { woeid: 23424975 }),
  country("US", "United States", "American", "America/New_York", { woeid: 23424977 }),
  country("IN", "India", "Indian", "Asia/Kolkata", { woeid: 23424848 }),
  country("AU", "Australia", "Australian", "Australia/Sydney", { woeid: 23424748 }),
  country("CA", "Canada", "Canadian", "America/Toronto", { woeid: 23424775 }),
  country("FR", "France", "français", "Europe/Paris", { lang: "fr", woeid: 23424819 }),
  country("ES", "Spain", "españoles", "Europe/Madrid", { lang: "es", woeid: 23424950 }),
  country("MX", "Mexico", "mexicanos", "America/Mexico_City", { lang: "es", woeid: 23424900 }),
  country("BR", "Brazil", "brasileiros", "America/Sao_Paulo", { lang: "pt", woeid: 23424768 }),
  country("EG", "Egypt", "المصرية", "Africa/Cairo", { lang: "ar", woeid: 23424802 }),
  country("SA", "Saudi Arabia", "السعودية", "Asia/Riyadh", { lang: "ar", woeid: 23424938 }),
  country("IN-hi", "India (Hindi)", "भारतीय", "Asia/Kolkata", { iso: "IN", lang: "hi", woeid: 23424848, place: "India" }),
];

export const WORLD = "world";
/** What visitors see first. Set VITE_DEFAULT_EDITION (for example "KE") to open on a country instead. */
export const DEFAULT_EDITION: string = (() => {
  const wanted = String(import.meta.env?.["VITE_DEFAULT_EDITION"] ?? "").trim();
  return EDITIONS.some((e) => e.code === wanted) ? wanted : WORLD;
})();

export const isEdition = (v: unknown): v is string => typeof v === "string" && EDITIONS.some((e) => e.code === v);

/** Reads an edition code from a URL or request, falling back to the default. Accepts any letter case. */
export function parseEdition(v: unknown): string {
  if (typeof v !== "string") return DEFAULT_EDITION;
  const code = v.trim().toUpperCase();
  const hit = EDITIONS.find((e) => e.code.toUpperCase() === code);
  return hit ? hit.code : DEFAULT_EDITION;
}

export function editionOf(code?: string | null): Edition {
  return EDITIONS.find((e) => e.code === code) ?? EDITIONS.find((e) => e.code === DEFAULT_EDITION)!;
}

/** The edition a value names, in canonical form ("ng" gives "NG"), or undefined if it names none. Used for ?e= in addresses. */
export function canonEdition(v: unknown): string | undefined {
  if (typeof v !== "string") return undefined;
  const code = v.trim().toUpperCase();
  return EDITIONS.find((e) => e.code.toUpperCase() === code)?.code;
}

/** Headers that hosts and CDNs set to say which country a request came from, most trusted first. */
const COUNTRY_HEADERS = ["cf-ipcountry", "x-vercel-ip-country", "cloudfront-viewer-country", "x-appengine-country", "x-country-code"];

/** The two-letter country in the request headers, if any (Cloudflare uses XX for unknown and T1 for Tor, which are ignored). */
export function countryFromHeaders(header: (name: string) => string | undefined): string | undefined {
  for (const name of COUNTRY_HEADERS) {
    const v = header(name)?.trim().toUpperCase();
    if (v && /^[A-Z]{2}$/.test(v) && v !== "XX") return v;
  }
  return undefined;
}

/** The edition for a visitor's country, or undefined when Brief has no edition for that country (they get the world). */
export const editionForCountry = (country: string | undefined): string | undefined => (country ? canonEdition(country) : undefined);

/** The edition to show: the one named in the address, else the visitor's own region, else the default. */
export const resolveEdition = (e: unknown, visitor: string | undefined): Edition => editionOf(canonEdition(e) ?? visitor ?? DEFAULT_EDITION);

/** "Kenya", or "the world" for the global edition, for use in sentences like "trending in ...". */
export const placeOf = (e: Edition): string => (e.code === WORLD ? "the world" : e.place);

/** The URL setting every edition-aware page shares: ?e=NG. When absent, the visitor's own region is used (see use-edition.ts). */
export type EditionSearch = { e?: string | undefined };
export const validateEditionSearch = (s: Record<string, unknown>): EditionSearch => ({ e: canonEdition(s["e"]) });

/**
 * Where an AI-researched timeline is about: the edition's country (so "KE-sw" shares Kenya's research), or "world".
 * Research is kept per scope, so a Nigerian reader and a Kenyan reader asking about "floods" each get their own country's history.
 */
export const researchScope = (e: Edition): string => e.iso ?? WORLD;
/** Kenya's research keeps its original keys, so everything researched before editions existed is still found. */
export const researchKey = (key: string, scope: string): string => (scope === "KE" ? key : `${key}@${scope}`);
