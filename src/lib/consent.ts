const KEY = "kp_consent";
export type Consent = "granted" | "declined" | "unset";

/**
 * How visit counting works for a reader:
 *   "optin"   nothing is counted until they accept (the EU and EEA, the UK, Switzerland, and any reader whose country we cannot tell)
 *   "optout"  counted until they decline (everywhere else)
 * The country comes from the host's or Cloudflare's country header, which is why Cloudflare in front of the site is recommended.
 */
export type ConsentMode = "optin" | "optout";

const OPT_IN = new Set(("AT BE BG HR CY CZ DK EE FI FR DE GR HU IE IT LV LT LU MT NL PL PT RO SK SI ES SE IS LI NO GB CH").split(" "));
export const consentModeFor = (country: string | undefined): ConsentMode => (!country || OPT_IN.has(country.toUpperCase()) ? "optin" : "optout");

/** Should a visit or click be counted, given what the reader chose and the rules where they are? */
export const shouldTrack = (consent: Consent, mode: ConsentMode): boolean => consent === "granted" || (consent === "unset" && mode === "optout");

export function getConsent(): Consent {
  try { const v = localStorage.getItem(KEY); return v === "granted" || v === "declined" ? v : "unset"; } catch { return "unset"; }
}
/** Declining stops all counting and deletes the anonymous ID straight away. */
export function setConsent(c: "granted" | "declined") {
  try {
    localStorage.setItem(KEY, c);
    if (c === "declined") { localStorage.removeItem("kp_vid"); sessionStorage.removeItem("kp_sid"); }
  } catch { /* storage unavailable */ }
}

export const PRIVACY_CHOICES_EVENT = "kp:privacy-choices";
type GoogleFc = { callbackQueue?: Array<() => void> | { push: (f: () => void) => void }; showRevocationMessage?: () => void };

/** The footer's "Privacy choices": asks about analytics again and, when ads are on, opens Google's consent message. */
export function reopenPrivacyChoices() {
  try { localStorage.removeItem(KEY); } catch { /* storage unavailable */ }
  window.dispatchEvent(new Event(PRIVACY_CHOICES_EVENT));
  const fc = (window as unknown as { googlefc?: GoogleFc }).googlefc;
  const open = () => fc?.showRevocationMessage?.();
  if (!fc) return;
  if (fc.callbackQueue && "push" in fc.callbackQueue) fc.callbackQueue.push(open);
  else open();
}
