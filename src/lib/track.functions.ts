import { createServerFn } from "@tanstack/react-start";
import { getRequestHeader } from "@tanstack/react-start/server";
import { z } from "zod";

const id = z.string().min(8).max(64).regex(/^[a-zA-Z0-9_-]+$/);

function deviceFrom(ua: string) {
  if (/bot|crawl|spider|slurp|preview/i.test(ua)) return "bot";
  if (/ipad|tablet/i.test(ua)) return "tablet";
  if (/mobi|android|iphone/i.test(ua)) return "mobile";
  return "desktop";
}

export const trackView = createServerFn({ method: "POST" })
  .inputValidator((d) =>
    z.object({ visitorId: id, sessionId: id, path: z.string().max(300), referrer: z.string().max(300).optional() }).parse(d),
  )
  .handler(async ({ data }) => {
    const ua = getRequestHeader("user-agent") ?? "";
    const device = deviceFrom(ua);
    if (device === "bot") return { ok: true };
    const { anonWriteClient } = await import("./write-client.server");
    let referrer: string | null = null;
    try { referrer = data.referrer ? new URL(data.referrer).hostname : null; } catch { referrer = null; }
    const { error } = await anonWriteClient().from("page_views").insert({
      visitor_id: data.visitorId,
      session_id: data.sessionId,
      path: data.path,
      referrer,
      country: getRequestHeader("cf-ipcountry") ?? null,
      device,
    });
    if (error) { console.error("[track] page view not saved:", error.message); return { ok: false }; }
    return { ok: true };
  });

export const trackEvent = createServerFn({ method: "POST" })
  .inputValidator((d) =>
    z.object({
      visitorId: id,
      type: z.enum(["whatsapp_share", "quote_card", "story_click", "audio_play", "ad_view", "ad_click"]),
      target: z.string().max(300).optional(),
      path: z.string().max(300).optional(),
    }).parse(d),
  )
  .handler(async ({ data }) => {
    const { anonWriteClient } = await import("./write-client.server");
    const { error } = await anonWriteClient().from("site_events").insert({ visitor_id: data.visitorId, type: data.type, target: data.target ?? null, path: data.path ?? null });
    if (error) { console.error("[track] event not saved:", error.message); return { ok: false }; }
    return { ok: true };
  });

export const reportFailedLogin = createServerFn({ method: "POST" })
  .inputValidator((d) => z.object({ email: z.string().max(200) }).parse(d))
  .handler(async ({ data }) => {
    const { anonWriteClient } = await import("./write-client.server");
    const { error } = await anonWriteClient().from("security_events").insert({
      severity: "warning",
      type: "failed_login",
      detail: `Failed sign-in for ${data.email.slice(0, 120)} from ${getRequestHeader("cf-ipcountry") ?? "unknown country"}`,
    });
    if (error) console.error("[track] failed login not saved:", error.message);
    const { recordFailedLogin } = await import("./alerts.server");
    await recordFailedLogin();
    return { ok: !error };
  });
