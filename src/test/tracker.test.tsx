import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

const trackView = vi.fn(async (_arg?: unknown) => ({ ok: true }));
const trackEvent = vi.fn(async (_arg?: unknown) => ({ ok: true }));
vi.mock("@/lib/track.functions", () => ({ trackView: (a: unknown) => trackView(a), trackEvent: (a: unknown) => trackEvent(a), reportFailedLogin: vi.fn() }));
vi.mock("@/lib/admin.functions", () => ({ getAnalytics: vi.fn() }));
vi.mock("@/lib/manage.functions", () => ({ listAds: vi.fn() }));

import { ignoreStaffDeviceByDefault, isIgnoredDevice, recordEvent, recordView, setConsentMode, setIgnoredDevice } from "@/lib/tracker";
import { setConsent } from "@/lib/consent";
import { summarize, type ViewRow } from "@/lib/analytics";
import { AnalyticsTab } from "@/components/admin/AnalyticsTab";

// These tests are about a reader in a place where counting starts unless they decline; the opt-in rule has its own tests below.
beforeEach(() => { localStorage.clear(); sessionStorage.clear(); trackView.mockClear(); trackEvent.mockClear(); vi.useRealTimers(); setConsentMode("optout"); });

describe("view recording", () => {
  it("records a page once, even if it is reported twice in a moment", () => {
    recordView("/brief"); recordView("/brief");
    expect(trackView).toHaveBeenCalledTimes(1);
  });
  it("still records different pages, and the same page again after a few seconds", () => {
    vi.useFakeTimers(); vi.setSystemTime(new Date("2026-10-12T10:00:00Z"));
    recordView("/a"); recordView("/b"); vi.setSystemTime(new Date("2026-10-12T10:00:10Z")); recordView("/b");
    expect(trackView).toHaveBeenCalledTimes(3);
  });
  it("skips staff pages", () => { window.history.pushState({}, "", "/admin"); recordView("/admin"); expect(trackView).not.toHaveBeenCalled(); window.history.pushState({}, "", "/"); });
});

describe("asking first where the law says so", () => {
  it("counts nothing from an unanswered reader in an opt-in place, then counts after they accept", () => {
    setConsentMode("optin");
    recordView("/"); recordEvent("story_click", "https://x");
    expect(trackView).not.toHaveBeenCalled();
    expect(trackEvent).not.toHaveBeenCalled();
    expect(localStorage.getItem("kp_vid")).toBeNull(); // not even an anonymous ID is created
    setConsent("granted");
    recordView("/after-yes");
    expect(trackView).toHaveBeenCalledTimes(1);
  });
  it("counts nothing after a decline, wherever the reader is", () => {
    for (const mode of ["optin", "optout"] as const) {
      setConsentMode(mode); setConsent("declined");
      recordView("/" + mode);
    }
    expect(trackView).not.toHaveBeenCalled();
  });
  it("assumes the careful rule until the page says where the reader is", async () => {
    vi.resetModules();
    const fresh = await import("@/lib/tracker");
    fresh.recordView("/early");
    expect(trackView).not.toHaveBeenCalled();
  });
});

describe("leaving the team's own devices out", () => {
  it("stops counting a device the first time a staff member signs in on it", () => {
    ignoreStaffDeviceByDefault();
    expect(isIgnoredDevice()).toBe(true);
    recordView("/brief"); recordEvent("story_click", "https://x");
    expect(trackView).not.toHaveBeenCalled();
    expect(trackEvent).not.toHaveBeenCalled();
  });
  it("respects a staff member who turned counting back on, and does not switch it off again", () => {
    setIgnoredDevice(false);
    ignoreStaffDeviceByDefault();
    expect(isIgnoredDevice()).toBe(false);
    recordView("/brief");
    expect(trackView).toHaveBeenCalledTimes(1);
  });
  it("counts ordinary readers", () => { expect(isIgnoredDevice()).toBe(false); recordView("/"); expect(trackView).toHaveBeenCalledTimes(1); });
});

describe("dashboard wording", () => {
  it("shows one device as one visitor with its page loads as views", () => {
    const views: ViewRow[] = Array.from({ length: 14 }, (_, i) => ({ visitor_id: "phone-1", session_id: "s1", path: ["/", "/brief", "/trending", "/trails", "/manifestos"][i % 5]!, referrer: null, country: "KE", device: "mobile", created_at: new Date(Date.now() - i * 60_000).toISOString() }));
    const qc = new QueryClient();
    qc.setQueryData(["analytics", 14], { ...summarize(views, [], 14), truncated: false });
    qc.setQueryData(["ads"], []);
    const html = renderToStaticMarkup(<QueryClientProvider client={qc}><AnalyticsTab /></QueryClientProvider>);
    expect(html).toContain("Unique visitors");
    expect(html).toContain("14 pages per visit");
    expect(html).toContain("one visitor");
    expect(html).toMatch(/<strong>1<\/strong> <span[^>]*>device · 3 views/); // /brief opened 3 times by the same device
  });
});
