import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

type Ctx = { supabase: any; userId: string; claims?: { email?: string; aal?: string } };
const c = (x: unknown) => x as Ctx;

async function roles(ctx: Ctx): Promise<string[]> {
  const { data } = await ctx.supabase.from("user_roles").select("role").eq("user_id", ctx.userId);
  return (data ?? []).map((r: { role: string }) => r.role);
}

/** Which alert channels are switched on (recipients are partly hidden). Admins only. */
export const getAlertStatus = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    if (!(await roles(c(context))).includes("admin")) throw new Error("Admins only");
    const { alertConfig, maskEmail, maskPhone } = await import("./alerts.server");
    const cfg = alertConfig();
    return {
      email: { ready: cfg.email.ready, to: cfg.email.to.map(maskEmail) },
      sms: { ready: cfg.sms.ready, to: cfg.sms.to.map(maskPhone), live: cfg.sms.live },
      telegram: { ready: cfg.telegram.ready },
    };
  });

/** Sends a test alert through every configured channel (as critical, so SMS is tested too). */
export const sendTestAlert = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    if (!(await roles(c(context))).includes("admin")) throw new Error("Admins only");
    const { sendAlert } = await import("./alerts.server");
    return sendAlert({ severity: "critical", title: "Test alert", detail: `Sent by ${c(context).claims?.email ?? "an admin"}. If you can read this, alerts work.`, force: true });
  });

/** Called by the browser after a two-factor device is added or removed, so the team is told. */
export const reportMfaChange = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ action: z.enum(["added", "removed"]) }).parse(d))
  .handler(async ({ context, data }) => {
    const ctx = c(context);
    if (!(await roles(ctx)).length) return { ok: false };
    const who = ctx.claims?.email ?? ctx.userId;
    await ctx.supabase.from("security_events").insert({
      severity: data.action === "removed" ? "notice" : "info", type: `mfa_${data.action}`, detail: `${who} ${data.action} an authenticator device`, actor: ctx.userId,
    });
    const { sendAlert } = await import("./alerts.server");
    await sendAlert({
      severity: data.action === "removed" ? "critical" : "warning",
      title: data.action === "removed" ? "Two-factor device removed" : "Two-factor device added",
      detail: `${who} ${data.action} an authenticator device on their staff account.`,
      dedupeKey: `mfa-${data.action}-${ctx.userId}`, quietMinutes: 5,
    });
    return { ok: true };
  });
