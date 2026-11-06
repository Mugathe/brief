import { trackEvent, trackView } from "./track.functions";
import { getConsent, shouldTrack, type ConsentMode } from "./consent";

type EventType = "whatsapp_share" | "quote_card" | "story_click" | "audio_play" | "ad_view" | "ad_click";

function rid() {
  return Array.from(crypto.getRandomValues(new Uint8Array(12)), (b) => b.toString(16).padStart(2, "0")).join("");
}

export function getVisitorId() {
  let v = localStorage.getItem("kp_vid");
  if (!v) { v = rid(); localStorage.setItem("kp_vid", v); }
  return v;
}

function getSessionId() {
  let s = sessionStorage.getItem("kp_sid");
  if (!s) { s = rid(); sessionStorage.setItem("kp_sid", s); }
  return s;
}

const IGNORE = "kp_ignore";
/** True when this device has been left out of the counts (the team's own devices). */
export function isIgnoredDevice(): boolean { try { return localStorage.getItem(IGNORE) === "1"; } catch { return false; } }
export function setIgnoredDevice(on: boolean) { try { localStorage.setItem(IGNORE, on ? "1" : "0"); } catch { /* storage unavailable */ } }
/** First time a staff member signs in on a device, stop counting that device. They can turn counting back on. */
export function ignoreStaffDeviceByDefault() { try { if (localStorage.getItem(IGNORE) === null) localStorage.setItem(IGNORE, "1"); } catch { /* storage unavailable */ } }

let consentMode: ConsentMode = "optin"; // until the page says otherwise, count nothing without a yes
export const setConsentMode = (m: ConsentMode) => { consentMode = m; };

const skip = () => typeof window === "undefined" || isIgnoredDevice() || location.pathname.startsWith("/admin") || location.pathname.startsWith("/auth") || !shouldTrack(getConsent(), consentMode);

let lastView = { path: "", at: 0 };

export function recordView(path: string) {
  if (skip()) return;
  // Ignore the same page being reported twice within a moment (double-fired effects, quick re-renders).
  if (lastView.path === path && Date.now() - lastView.at < 3000) return;
  lastView = { path, at: Date.now() };
  void trackView({ data: { visitorId: getVisitorId(), sessionId: getSessionId(), path, referrer: document.referrer || undefined } })
    .then((r) => { if (!r.ok) console.warn("[tracking] page view was not saved. Check the server log; the database setup SQL may not have been run."); })
    .catch((e) => console.warn("[tracking] page view failed", e));
}

export function recordEvent(type: EventType, target?: string) {
  if (skip()) return;
  void trackEvent({ data: { visitorId: getVisitorId(), type, target: target?.slice(0, 300), path: location.pathname } })
    .then((r) => { if (!r.ok) console.warn("[tracking] event was not saved", type); })
    .catch((e) => console.warn("[tracking] event failed", e));
}

/** One global listener: WhatsApp shares, outbound story clicks and [data-track] elements. */
export function installClickTracking() {
  const handler = (e: MouseEvent) => {
    const el = (e.target as HTMLElement | null)?.closest("a,button,[data-track]") as HTMLElement | null;
    if (!el) return;
    const tagged = el.getAttribute("data-track") as EventType | null;
    if (tagged) return recordEvent(tagged, el.getAttribute("data-track-target") ?? undefined);
    const href = el.getAttribute("href") ?? "";
    if (href.startsWith("https://wa.me")) return recordEvent("whatsapp_share", location.pathname);
    if (/^https?:\/\//.test(href) && !href.includes(location.host)) recordEvent("story_click", href);
  };
  document.addEventListener("click", handler, true);
  return () => document.removeEventListener("click", handler, true);
}
