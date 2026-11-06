/**
 * Security alert delivery by email (Resend), SMS (Africa's Talking) and Telegram.
 * Every channel is optional and switches on when its settings exist in the server environment.
 *   warning  -> email + Telegram
 *   critical -> email + SMS + Telegram
 *   info     -> email + Telegram (Studio progress reports)
 */
export type AlertSeverity = "warning" | "critical" | "info";
export type AlertResult = { sent: string[]; failed: string[]; skipped?: string };

const env = (k: string) => (process.env[k] ?? "").trim();
const list = (k: string) => env(k).split(/[,;\s]+/).map((x) => x.trim()).filter(Boolean);

export function alertConfig() {
  return {
    email: { ready: !!(env("RESEND_API_KEY") && list("ALERT_EMAILS").length), to: list("ALERT_EMAILS"), from: env("ALERT_FROM") || "Brief Alerts <onboarding@resend.dev>" },
    sms: { ready: !!(env("AT_API_KEY") && env("AT_USERNAME") && list("ALERT_SMS").length), to: list("ALERT_SMS"), live: env("AT_ENV") === "live" },
    telegram: { ready: !!(env("TELEGRAM_BOT_TOKEN") && env("TELEGRAM_CHAT_ID")) },
  };
}

export const maskEmail = (e: string) => e.replace(/^(.).*(@.*)$/, "$1•••$2");
export const maskPhone = (p: string) => (p.length > 6 ? `${p.slice(0, 4)}•••${p.slice(-3)}` : "•••");

const lastSent = new Map<string, number>();
const timeout = () => AbortSignal.timeout(8000);

async function viaEmail(subject: string, text: string): Promise<void> {
  const c = alertConfig().email;
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${env("RESEND_API_KEY")}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from: c.from, to: c.to, subject, text }),
    signal: timeout(),
  });
  if (!res.ok) throw new Error(`Resend ${res.status}: ${(await res.text()).slice(0, 160)}`);
}

async function viaSms(text: string): Promise<void> {
  const c = alertConfig().sms;
  const body = new URLSearchParams({ username: env("AT_USERNAME"), to: c.to.join(","), message: text.slice(0, 300) });
  if (env("AT_SENDER_ID")) body.set("from", env("AT_SENDER_ID"));
  const res = await fetch(c.live ? "https://api.africastalking.com/version1/messaging" : "https://api.sandbox.africastalking.com/version1/messaging", {
    method: "POST",
    headers: { apiKey: env("AT_API_KEY"), Accept: "application/json", "Content-Type": "application/x-www-form-urlencoded" },
    body,
    signal: timeout(),
  });
  if (!res.ok) throw new Error(`Africa's Talking ${res.status}: ${(await res.text()).slice(0, 160)}`);
  const json = (await res.json().catch(() => null)) as { SMSMessageData?: { Recipients?: { status?: string }[] } } | null;
  const recipients = json?.SMSMessageData?.Recipients ?? [];
  if (recipients.length && !recipients.some((r) => r.status === "Success")) throw new Error(`Africa's Talking rejected every recipient: ${recipients[0]?.status ?? "unknown"}`);
}

async function viaTelegram(text: string): Promise<void> {
  const res = await fetch(`https://api.telegram.org/bot${env("TELEGRAM_BOT_TOKEN")}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: env("TELEGRAM_CHAT_ID"), text }),
    signal: timeout(),
  });
  if (!res.ok) throw new Error(`Telegram ${res.status}: ${(await res.text()).slice(0, 160)}`);
}

/** Sends an alert to every configured channel. Never throws. `dedupeKey` stops the same alert repeating within `quietMinutes`. */
export async function sendAlert(a: { severity: AlertSeverity; title: string; detail: string; dedupeKey?: string; quietMinutes?: number; force?: boolean }): Promise<AlertResult> {
  const key = a.dedupeKey ?? a.title;
  const quiet = (a.quietMinutes ?? 10) * 60_000;
  if (!a.force && Date.now() - (lastSent.get(key) ?? 0) < quiet) return { sent: [], failed: [], skipped: "recently sent" };

  const cfg = alertConfig();
  const site = env("VITE_SITE_URL") || "your site";
  const when = new Date().toLocaleString("en-GB", { timeZone: "Africa/Nairobi", dateStyle: "medium", timeStyle: "short" });
  const label = a.severity === "critical" ? "CRITICAL" : a.severity === "info" ? "UPDATE" : "WARNING";
  const full = `${a.severity === "info" ? "Brief Studio" : `Brief security ${label}`}\n\n${a.title}\n${a.detail}\n\nWhen: ${when} (EAT)\nSite: ${site}`;
  const sms = `Brief ${label}: ${a.title}. ${a.detail}`.slice(0, 300);

  const jobs: [string, () => Promise<void>][] = [];
  if (cfg.email.ready) jobs.push(["email", () => viaEmail(`[${label}] ${a.title}`, full)]);
  if (cfg.telegram.ready) jobs.push(["telegram", () => viaTelegram(full)]);
  if (cfg.sms.ready && a.severity === "critical") jobs.push(["sms", () => viaSms(sms)]);
  if (!jobs.length) return { sent: [], failed: [], skipped: "no alert channel is configured" };

  const out: AlertResult = { sent: [], failed: [] };
  await Promise.all(jobs.map(async ([name, run]) => {
    try { await run(); out.sent.push(name); } catch (e) { out.failed.push(`${name}: ${e instanceof Error ? e.message : String(e)}`); console.error(`[alerts] ${name} failed:`, e instanceof Error ? e.message : e); }
  }));
  if (out.sent.length) lastSent.set(key, Date.now());
  return out;
}

/* ---- Failed sign-in bursts (per server instance) ---- */
const failures: number[] = [];

export async function recordFailedLogin(): Promise<void> {
  const now = Date.now();
  failures.push(now);
  while (failures.length && now - failures[0]! > 15 * 60_000) failures.shift();
  if (failures.length >= 15) {
    await sendAlert({ severity: "critical", title: "Sustained password-guessing attack", detail: `${failures.length} failed staff sign-ins in the last 15 minutes.`, dedupeKey: "burst-critical", quietMinutes: 30 });
  } else if (failures.length >= 5) {
    await sendAlert({ severity: "warning", title: "Repeated failed sign-ins", detail: `${failures.length} failed staff sign-ins in the last 15 minutes.`, dedupeKey: "burst-warning", quietMinutes: 30 });
  }
}
export const _resetAlertState = () => { failures.length = 0; lastSent.clear(); };
