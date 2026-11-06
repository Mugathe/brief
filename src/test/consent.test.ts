// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from "vitest";
import { consentModeFor, getConsent, PRIVACY_CHOICES_EVENT, reopenPrivacyChoices, setConsent, shouldTrack } from "@/lib/consent";
import { adsenseClientId, GOOGLE_FC_SIGNAL } from "@/lib/ads";

describe("who must opt in", () => {
  it("asks first in the EU, EEA, UK and Switzerland, and when the country is unknown", () => {
    for (const c of ["FR", "DE", "IE", "ES", "SE", "NO", "IS", "LI", "GB", "CH", "gb"]) expect(consentModeFor(c), c).toBe("optin");
    expect(consentModeFor(undefined)).toBe("optin");
    expect(consentModeFor("")).toBe("optin");
  });
  it("counts until the reader declines everywhere else", () => {
    for (const c of ["KE", "NG", "ZA", "US", "IN", "BR", "AU", "CA", "MX"]) expect(consentModeFor(c), c).toBe("optout");
  });
  it("counts the whole EU list", () => {
    const eu = "AT BE BG HR CY CZ DK EE FI FR DE GR HU IE IT LV LT LU MT NL PL PT RO SK SI ES SE".split(" ");
    expect(eu).toHaveLength(27);
    for (const c of eu) expect(consentModeFor(c), c).toBe("optin");
  });
});

describe("when a visit may be counted", () => {
  it("never counts a decline, and counts a yes", () => {
    for (const mode of ["optin", "optout"] as const) {
      expect(shouldTrack("declined", mode)).toBe(false);
      expect(shouldTrack("granted", mode)).toBe(true);
    }
  });
  it("counts an unanswered reader only where opting out is allowed", () => {
    expect(shouldTrack("unset", "optin")).toBe(false);
    expect(shouldTrack("unset", "optout")).toBe(true);
  });
});

describe("remembering the choice and asking again", () => {
  beforeEach(() => { localStorage.clear(); sessionStorage.clear(); delete (window as unknown as { googlefc?: unknown }).googlefc; });
  it("deletes the anonymous ID when someone declines", () => {
    localStorage.setItem("kp_vid", "abc"); sessionStorage.setItem("kp_sid", "def");
    setConsent("declined");
    expect(getConsent()).toBe("declined");
    expect(localStorage.getItem("kp_vid")).toBeNull();
    expect(sessionStorage.getItem("kp_sid")).toBeNull();
  });
  it("asks again when 'Privacy choices' is used, and opens Google's message when it is there", () => {
    setConsent("granted");
    const asked = vi.fn(); window.addEventListener(PRIVACY_CHOICES_EVENT, asked);
    const show = vi.fn();
    const queue: Array<() => void> = [];
    (window as unknown as { googlefc: unknown }).googlefc = { callbackQueue: queue, showRevocationMessage: show };
    reopenPrivacyChoices();
    expect(getConsent()).toBe("unset");
    expect(asked).toHaveBeenCalledTimes(1);
    queue.forEach((f) => f()); // Google runs queued callbacks once its message is ready
    expect(show).toHaveBeenCalledTimes(1);
    window.removeEventListener(PRIVACY_CHOICES_EVENT, asked);
  });
  it("works when Google's script is absent (no ads)", () => {
    setConsent("granted");
    expect(() => reopenPrivacyChoices()).not.toThrow();
    expect(getConsent()).toBe("unset");
  });
});

describe("the AdSense publisher ID", () => {
  it("accepts a real ID and refuses anything that could change a script address", () => {
    expect(adsenseClientId("ca-pub-1234567890123456")).toBe("ca-pub-1234567890123456");
    expect(adsenseClientId("  ca-pub-1234567890123456 ")).toBe("ca-pub-1234567890123456");
    for (const bad of ["", null, undefined, "pub-123", "ca-pub-12", "ca-pub-1234567890123456&evil=1", "ca-pub-1234567890123456\"><script>", "https://x"]) expect(adsenseClientId(bad as string), String(bad)).toBeNull();
  });
  it("gives the consent frame signal as a self-contained script", () => {
    expect(GOOGLE_FC_SIGNAL).toContain("googlefcPresent");
    expect(() => new Function(GOOGLE_FC_SIGNAL)).not.toThrow();
  });
});
