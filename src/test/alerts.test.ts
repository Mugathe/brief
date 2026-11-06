import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { _resetAlertState, alertConfig, maskEmail, maskPhone, recordFailedLogin, sendAlert } from "@/lib/alerts.server";

const KEYS = ["RESEND_API_KEY", "ALERT_EMAILS", "ALERT_FROM", "AT_API_KEY", "AT_USERNAME", "AT_ENV", "ALERT_SMS", "AT_SENDER_ID", "TELEGRAM_BOT_TOKEN", "TELEGRAM_CHAT_ID"];
let calls: { url: string; init: RequestInit }[] = [];

function allOn() {
  Object.assign(process.env, {
    RESEND_API_KEY: "re_test", ALERT_EMAILS: "boss@example.com, deputy@example.com", AT_API_KEY: "at_key", AT_USERNAME: "kenyapulse",
    ALERT_SMS: "+254700111222", TELEGRAM_BOT_TOKEN: "123:abc", TELEGRAM_CHAT_ID: "-100999",
  });
}

beforeEach(() => {
  calls = [];
  for (const k of KEYS) delete process.env[k];
  _resetAlertState();
  vi.stubGlobal("fetch", vi.fn(async (url: string, init: RequestInit) => {
    calls.push({ url: String(url), init });
    return new Response(JSON.stringify({ SMSMessageData: { Recipients: [{ status: "Success" }] } }), { status: 200 });
  }));
});
afterEach(() => vi.unstubAllGlobals());

const hosts = () => calls.map((c) => new URL(c.url).host).sort();

describe("alert channels", () => {
  it("does nothing, safely, when nothing is configured", async () => {
    const r = await sendAlert({ severity: "critical", title: "x", detail: "y" });
    expect(r.skipped).toMatch(/no alert channel/);
    expect(calls).toHaveLength(0);
  });
  it("critical alerts go by email, SMS and Telegram", async () => {
    allOn();
    const r = await sendAlert({ severity: "critical", title: "New ADMIN granted", detail: "a gave b admin" });
    expect(r.sent.sort()).toEqual(["email", "sms", "telegram"]);
    expect(hosts()).toEqual(["api.resend.com", "api.sandbox.africastalking.com", "api.telegram.org"]);
  });
  it("warnings skip SMS to save cost", async () => {
    allOn();
    const r = await sendAlert({ severity: "warning", title: "w", detail: "d" });
    expect(r.sent.sort()).toEqual(["email", "telegram"]);
  });
  it("sends the right request shapes", async () => {
    allOn(); process.env["AT_ENV"] = "live";
    await sendAlert({ severity: "critical", title: "T", detail: "D" });
    const email = calls.find((c) => c.url.includes("resend"))!;
    expect((email.init.headers as Record<string, string>)["Authorization"]).toBe("Bearer re_test");
    expect(JSON.parse(String(email.init.body)).to).toEqual(["boss@example.com", "deputy@example.com"]);
    const sms = calls.find((c) => c.url.includes("africastalking"))!;
    expect(sms.url).toBe("https://api.africastalking.com/version1/messaging");
    expect((sms.init.headers as Record<string, string>)["apiKey"]).toBe("at_key");
    expect(String(sms.init.body)).toContain("to=%2B254700111222");
    const tg = calls.find((c) => c.url.includes("telegram"))!;
    expect(tg.url).toBe("https://api.telegram.org/bot123:abc/sendMessage");
  });
  it("one failing channel does not stop the others", async () => {
    allOn();
    vi.stubGlobal("fetch", vi.fn(async (url: string) => (String(url).includes("resend") ? new Response("nope", { status: 403 }) : new Response("{}", { status: 200 }))));
    const r = await sendAlert({ severity: "warning", title: "w", detail: "d" });
    expect(r.sent).toEqual(["telegram"]);
    expect(r.failed[0]).toMatch(/^email: Resend 403/);
  });
  it("treats an SMS rejected for every recipient as a failure", async () => {
    allOn();
    vi.stubGlobal("fetch", vi.fn(async (url: string) => new Response(JSON.stringify({ SMSMessageData: { Recipients: [{ status: "InvalidPhoneNumber" }] } }), { status: 201 })));
    const r = await sendAlert({ severity: "critical", title: "c", detail: "d" });
    expect(r.failed.some((f) => f.startsWith("sms:"))).toBe(true);
  });
  it("does not repeat the same alert within the quiet period, but force overrides", async () => {
    allOn();
    await sendAlert({ severity: "warning", title: "same", detail: "d" });
    const again = await sendAlert({ severity: "warning", title: "same", detail: "d" });
    expect(again.skipped).toBe("recently sent");
    const forced = await sendAlert({ severity: "warning", title: "same", detail: "d", force: true });
    expect(forced.sent.length).toBeGreaterThan(0);
  });
});

describe("failed sign-in bursts", () => {
  it("stays quiet for a few typos", async () => {
    allOn();
    for (let i = 0; i < 4; i++) await recordFailedLogin();
    expect(calls).toHaveLength(0);
  });
  it("warns at 5 failures (no SMS) and goes critical at 15", async () => {
    allOn();
    for (let i = 0; i < 5; i++) await recordFailedLogin();
    expect(hosts()).toEqual(["api.resend.com", "api.telegram.org"]);
    calls = [];
    for (let i = 0; i < 10; i++) await recordFailedLogin();
    expect(hosts()).toContain("api.sandbox.africastalking.com");
  });
});

describe("masking", () => {
  it("hides most of an email and phone number", () => {
    expect(maskEmail("boss@example.com")).toBe("b•••@example.com");
    expect(maskPhone("+254700111222")).toBe("+254•••222");
  });
  it("reports readiness only with every needed setting", () => {
    process.env["RESEND_API_KEY"] = "k";
    expect(alertConfig().email.ready).toBe(false);
    process.env["ALERT_EMAILS"] = "a@b.co";
    expect(alertConfig().email.ready).toBe(true);
  });
});
