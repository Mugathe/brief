import { createServerFn } from "@tanstack/react-start";
import { getCookie, getRequestHeader } from "@tanstack/react-start/server";
import { canonEdition, countryFromHeaders, DEFAULT_EDITION, editionForCountry, type Lang } from "./editions";
import { canonLang } from "./i18n";
import { EDITION_COOKIE, LANG_COOKIE } from "./visitor-edition";
import { consentModeFor, type ConsentMode } from "./consent";

/**
 * Which edition a visitor with no ?e= in the address should see: the one they chose last time, otherwise the one for
 * their country (from the Cloudflare or host header), otherwise the world. Also the language they chose, if they did
 * (otherwise the pages follow the edition's own language).
 */
export const getVisitor = createServerFn({ method: "GET" }).handler(async (): Promise<{ edition: string; lang: Lang | null; consent: ConsentMode }> => {
  const country = countryFromHeaders((n) => getRequestHeader(n as never));
  const consent = consentModeFor(country); // opt-in in the EU, EEA, UK and Switzerland, and when the country is unknown
  const chosen = canonEdition(getCookie(EDITION_COOKIE));
  const lang = canonLang(getCookie(LANG_COOKIE)) ?? null;
  if (chosen) return { edition: chosen, lang, consent };
  return { edition: editionForCountry(country) ?? DEFAULT_EDITION, lang, consent };
});
