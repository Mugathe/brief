/**
 * Prepares text to be read aloud: money, percentages and acronyms are written the way a presenter
 * would say them, and a pronunciation dictionary (built-in plus the team's own) respells tricky words.
 * Pure, so it runs on the server and is easy to test.
 */

/** Initialisms a presenter reads letter by letter. */
export const SPELL_OUT = [
  "IEBC", "KDF", "KRA", "KPLC", "NHIF", "NSSF", "SHA", "SHIF", "KCSE", "KCPE", "KNEC", "DCI", "EACC", "ODPP", "NTSA", "KBC", "KTN", "NTV",
  "UDA", "ODM", "ANC", "DAP", "MP", "MCA", "CS", "PS", "DP", "IG", "AG", "CJ", "KWS", "KeNHA", "KURA", "KeRRA", "NYS", "CBK", "NSE", "GDP", "IMF",
  "VAT", "CEO", "ICT", "AI", "UN", "EU", "AU", "USA", "UK", "UAE", "WHO", "WTO", "ICC", "IPOA", "NCIC", "NIS", "GSU", "ATM", "SGR", "LPG", "KMTC",
  "TSC", "HELB", "KEBS", "KNH", "MTRH", "ECDE", "NEMA", "KFS", "KALRO", "KUCCPS", "SRC", "IEBC", "NGO", "NGOs", "SME", "SMEs", "TV", "PM", "FM",
];

/** Built-in respellings. Kept short on purpose: add names your voice gets wrong in the admin page. */
export const DEFAULT_DICTIONARY: Record<string, string> = {
  // The apostrophe in Kenyan "ng'" names makes some voices stumble or pause; this reads them smoothly.
  "murang'a": "Muranga", "wetang'ula": "Wetangula", "kang'ethe": "Kangethe", "ng'ang'a": "Nganga", "mang'u": "Mangu", "ng'ong'o": "Ngongo",
  "kang'ata": "Kangata", "wang'ombe": "Wangombe", "ol pejeta": "Ol Pejeta", "kapenguria": "Kapenguria",
};

const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const B = "(?<![\\p{L}\\p{N}'’])"; // not preceded by a letter, digit or apostrophe
const A = "(?![\\p{L}\\p{N}])";    // not followed by a letter or digit

/** Replaces whole words (case-insensitive), keeping a trailing 's. Longest entries win. */
export function applyDictionary(text: string, dict: Record<string, string>): string {
  const keys = Object.keys(dict).filter((k) => k.trim().length >= 2).sort((a, b) => b.length - a.length);
  if (!keys.length) return text;
  const lower: Record<string, string> = {};
  for (const k of keys) lower[k.toLowerCase().replace(/’/g, "'")] = dict[k]!;
  const re = new RegExp(`${B}(${keys.map((k) => escapeRe(k).replace(/'/g, "['’]")).join("|")})(['’]s)?${A}`, "giu");
  return text.replace(re, (_m, word: string, poss?: string) => `${lower[word.toLowerCase().replace(/’/g, "'")] ?? word}${poss ?? ""}`);
}

const UNITS: Record<string, string> = { m: "million", mn: "million", million: "million", bn: "billion", b: "billion", billion: "billion", tn: "trillion", trn: "trillion", trillion: "trillion", k: "thousand", thousand: "thousand" };
const unit = (u?: string) => (u ? ` ${UNITS[u.trim().toLowerCase()] ?? u.trim()}` : "");
const NUM = "(\\d[\\d,]*(?:\\.\\d+)?)";
const SCALE = "(\\s?(?:million|billion|trillion|thousand|mn|bn|tn|trn|m|b|k)\\b)?";

export function expandMoney(text: string): string {
  return text
    .replace(new RegExp(`(?<![\\p{L}\\p{N}])(?:KSh|Ksh|KShs|Kshs|KES|Sh|Shs)\\.?\\s?${NUM}${SCALE}`, "gu"), (_m, n: string, u?: string) => `${n}${unit(u)} shillings`)
    .replace(new RegExp(`(?:US\\$|USD\\s?|\\$)\\s?${NUM}${SCALE}`, "g"), (_m, n: string, u?: string) => `${n}${unit(u)} US dollars`)
    .replace(/(\d+(?:\.\d+)?)\s?%/g, "$1 percent")
    .replace(/\s&\s/g, " and ")
    .replace(/\bvs\.?\s/gi, "versus ");
}

/** "IEBC" -> "I E B C", "MPs" -> "M Ps". Only for the listed initialisms, so ordinary capitalised words are never mangled. */
export function spellOutAcronyms(text: string): string {
  const list = [...new Set(SPELL_OUT)].sort((a, b) => b.length - a.length);
  const re = new RegExp(`${B}(${list.map(escapeRe).join("|")})(s?)${A}`, "gu");
  return text.replace(re, (m, word: string, plural: string) => {
    // Skip ordinary words that merely look like an initialism, e.g. "Who" or "Sha" in a sentence.
    if (word !== word.toUpperCase() && !/^[a-z]+[A-Z]/.test(word)) return m;
    return word.split("").join(" ") + plural;
  });
}

const PERCENT: Record<string, string> = { sw: "asilimia", fr: "pour cent", es: "por ciento", pt: "por cento", ar: "في المئة", hi: "प्रतिशत" };

/**
 * Writes text the way a presenter says it. Money and percentages are spelled out in English; for the other languages
 * only the percent sign is spoken in that language, and the voice reads the rest (currencies, numbers) itself.
 */
export function prepareSpeech(text: string, custom: Record<string, string> = {}, lang = "en"): string {
  const dict = { ...DEFAULT_DICTIONARY, ...Object.fromEntries(Object.entries(custom).map(([k, v]) => [k.toLowerCase(), v])) };
  const prepared = spellOutAcronyms(applyDictionary(text, dict));
  const spoken = lang === "en" ? expandMoney(prepared) : prepared.replace(/(\d+(?:[.,]\d+)?)\s?%/g, `$1 ${PERCENT[lang] ?? "%"}`);
  return spoken.replace(/\s{2,}/g, " ").trim();
}
