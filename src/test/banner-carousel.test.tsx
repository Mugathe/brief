import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { clampSeconds, orderBanners, pickAdsense, stepIndex, usableBanners } from "@/lib/ad-rotation";
import { BannerCarousel } from "@/components/BannerCarousel";
import type { PublicAd } from "@/lib/site-types";

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const ad = (id: string, priority = 0, over: Partial<PublicAd> = {}): PublicAd => ({
  id, title: `Ad ${id}`, kind: "banner", image_url: `https://img.test/${id}.png`, link_url: `https://sponsor.test/${id}`, adsense_slot: null,
  placement: "home_top", priority, sponsor: `Sponsor ${id}`, alt_text: null, editions: [], ...over,
});

describe("ordering", () => {
  it("puts higher priority first and shuffles equal priorities", () => {
    const ads = [ad("a", 0), ad("b", 5), ad("c", 0), ad("d", 5)];
    const out = orderBanners(ads, () => 0.99);
    expect(out.slice(0, 2).map((x) => x.priority)).toEqual([5, 5]);
    expect(out.slice(2).map((x) => x.priority)).toEqual([0, 0]);
    expect(new Set(orderBanners(ads, () => 0.01).map((x) => x.id)).size).toBe(4);
  });
  it("gives every banner a turn at the front across visits", () => {
    const ads = [ad("a"), ad("b"), ad("c")];
    const fronts = new Set(Array.from({ length: 60 }, () => orderBanners(ads)[0]!.id));
    expect(fronts.size).toBe(3);
  });
  it("leaves out AdSense units and banners with no image or link", () => {
    const ads = [ad("a"), ad("x", 0, { kind: "adsense", adsense_slot: "123" }), ad("noimg", 0, { image_url: null }), ad("nolink", 0, { link_url: null })];
    expect(usableBanners(ads).map((a) => a.id)).toEqual(["a"]);
    expect(pickAdsense(ads)?.id).toBe("x");
  });
  it("wraps around and clamps the speed", () => {
    expect([stepIndex(2, 3, 1), stepIndex(0, 3, -1), stepIndex(0, 0, 1)]).toEqual([0, 2, 0]);
    expect([clampSeconds(1), clampSeconds(99), clampSeconds("8"), clampSeconds("x")]).toEqual([3, 30, 8, 6]);
  });
});

// ---- browser pieces jsdom does not have ----
let observers: ((visible: boolean) => void)[] = [];
let reducedMotion = false;
beforeEach(() => {
  vi.useFakeTimers();
  observers = [];
  reducedMotion = false;
  vi.stubGlobal("IntersectionObserver", class { cb: (e: { isIntersecting: boolean }[]) => void; constructor(cb: (e: { isIntersecting: boolean }[]) => void) { this.cb = cb; observers.push((v) => this.cb([{ isIntersecting: v }])); } observe() {} disconnect() {} unobserve() {} });
  window.matchMedia = ((q: string) => ({ matches: reducedMotion && q.includes("reduce"), addEventListener() {}, removeEventListener() {} })) as unknown as typeof window.matchMedia;
});
afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); });

let root: Root | null = null; let host: HTMLDivElement | null = null;
function mount(ads: PublicAd[], seconds = 5, visible = true) {
  const shown: string[] = [];
  host = document.createElement("div"); document.body.appendChild(host);
  root = createRoot(host);
  act(() => { root!.render(<BannerCarousel ads={ads} seconds={seconds} onShow={(a) => shown.push(a.id)} />); });
  if (visible) act(() => observers.forEach((o) => o(true)));
  return { shown, host, current: () => host!.querySelector("[aria-roledescription='slide'][aria-hidden='false']")?.getAttribute("aria-label") };
}
afterEach(() => { act(() => root?.unmount()); host?.remove(); root = null; host = null; });
const wait = (ms: number) => act(() => { vi.advanceTimersByTime(ms); });
const btn = (label: string) => host!.querySelector<HTMLButtonElement>(`button[aria-label='${label}']`)!;
const click = (el: Element) => act(() => { el.dispatchEvent(new MouseEvent("click", { bubbles: true })); });

describe("carousel", () => {
  const three = [ad("a"), ad("b"), ad("c")];
  it("shows the first banner and rotates through all of them, then wraps", () => {
    const m = mount(three, 5);
    expect(m.current()).toBe("1 of 3");
    wait(5000); expect(m.current()).toBe("2 of 3");
    wait(5000); expect(m.current()).toBe("3 of 3");
    wait(5000); expect(m.current()).toBe("1 of 3");
  });
  it("pauses while hovered and carries on afterwards", () => {
    const m = mount(three, 5);
    const region = m.host.querySelector("section")!;
    act(() => { region.dispatchEvent(new MouseEvent("mouseover", { bubbles: true })); });
    wait(20000); expect(m.current()).toBe("1 of 3");
    act(() => { region.dispatchEvent(new MouseEvent("mouseout", { bubbles: true })); });
    wait(5000); expect(m.current()).toBe("2 of 3");
  });
  it("has a pause button that stops and restarts rotation", () => {
    const m = mount(three, 5);
    click(btn("Pause rotation")); wait(30000); expect(m.current()).toBe("1 of 3");
    click(btn("Resume rotation")); wait(5000); expect(m.current()).toBe("2 of 3");
  });
  it("does not rotate while off screen or while the tab is hidden", () => {
    const m = mount(three, 5, false);
    wait(20000); expect(m.current()).toBe("1 of 3");
    act(() => observers.forEach((o) => o(true)));
    Object.defineProperty(document, "visibilityState", { value: "hidden", configurable: true });
    act(() => { document.dispatchEvent(new Event("visibilitychange")); });
    wait(20000); expect(m.current()).toBe("1 of 3");
    Object.defineProperty(document, "visibilityState", { value: "visible", configurable: true });
    act(() => { document.dispatchEvent(new Event("visibilitychange")); });
    wait(5000); expect(m.current()).toBe("2 of 3");
  });
  it("does not rotate by itself for people who reduce motion, but arrows still work", () => {
    reducedMotion = true;
    const m = mount(three, 5);
    wait(30000); expect(m.current()).toBe("1 of 3");
    click(btn("Next banner")); expect(m.current()).toBe("2 of 3");
  });
  it("supports arrows, dots, wrap-around and the keyboard", () => {
    const m = mount(three, 5);
    click(btn("Previous banner")); expect(m.current()).toBe("3 of 3");
    click(btn("Show banner 2 of 3")); expect(m.current()).toBe("2 of 3");
    act(() => { m.host.querySelector("section")!.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowRight", bubbles: true })); });
    expect(m.current()).toBe("3 of 3");
  });
  it("makes hidden slides unreachable by keyboard and screen reader", () => {
    const m = mount(three, 5);
    const links = [...m.host.querySelectorAll("a")];
    expect(links.map((l) => l.tabIndex)).toEqual([0, -1, -1]);
    expect(m.host.querySelectorAll("[aria-roledescription='slide'][aria-hidden='true']")).toHaveLength(2);
    expect(m.host.querySelectorAll("[aria-roledescription='slide'][aria-hidden='false']")).toHaveLength(1);
  });
  it("opens the sponsor link in a new tab and tags it for click counting", () => {
    const m = mount(three, 5);
    const a = m.host.querySelector("a")!;
    expect(a.getAttribute("href")).toBe("https://sponsor.test/a");
    expect(a.getAttribute("rel")).toContain("sponsored");
    expect(a.getAttribute("data-track")).toBe("ad_click");
    expect(a.getAttribute("data-track-target")).toBe("a");
  });
});

describe("counting views", () => {
  it("counts each banner once, the first time it is really on screen", () => {
    const m = mount([ad("a"), ad("b")], 5);
    expect(m.shown).toEqual(["a"]);
    wait(5000); expect(m.shown).toEqual(["a", "b"]);
    wait(5000); wait(5000); expect(m.shown).toEqual(["a", "b"]); // second lap adds nothing
  });
  it("counts nothing while the carousel was never visible", () => {
    const m = mount([ad("a"), ad("b")], 5, false);
    wait(30000);
    expect(m.shown).toEqual([]);
  });
});

describe("a single banner", () => {
  it("has no controls, never rotates, and is still counted", () => {
    const m = mount([ad("only")], 5);
    expect(m.host.querySelectorAll("button")).toHaveLength(0);
    wait(30000); expect(m.current()).toBe("1 of 1");
    expect(m.shown).toEqual(["only"]);
  });
});
