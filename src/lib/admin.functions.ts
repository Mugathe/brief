import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { summarize, type EventRow, type ViewRow } from "./analytics";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

type Ctx = { supabase: any; userId: string };

async function rolesOf(ctx: Ctx): Promise<string[]> {
  const { data } = await ctx.supabase.from("user_roles").select("role").eq("user_id", ctx.userId);
  return (data ?? []).map((r: { role: string }) => r.role);
}

async function requireAdmin(ctx: Ctx) {
  if (!(await rolesOf(ctx)).includes("admin")) throw new Error("Admins only");
}

/** Roles, and the regions (edition codes; "*" means all) this person manages. Admins manage everything. */
export const getMyRoles = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const ctx = context as Ctx;
    const roles = await rolesOf(ctx);
    if (roles.includes("admin")) return { roles, regions: ["*"] };
    const { data } = await ctx.supabase.from("staff_regions").select("edition").eq("user_id", ctx.userId);
    return { roles, regions: ((data ?? []) as { edition: string }[]).map((r) => r.edition) };
  });

const count = (arr: (string | null)[], n = 10) => {
  const m = new Map<string, number>();
  for (const k of arr) { const key = k || "(direct)"; m.set(key, (m.get(key) ?? 0) + 1); }
  return [...m.entries()].sort((a, b) => b[1] - a[1]).slice(0, n).map(([label, value]) => ({ label, value }));
};

// PostgREST returns at most 1,000 rows per request, so page through the results.
async function fetchAll<T>(page: (from: number, to: number) => PromiseLike<{ data: unknown[] | null }>, max = 50000): Promise<T[]> {
  const out: T[] = [];
  for (let from = 0; from < max; from += 1000) {
    const { data } = await page(from, from + 999);
    const rows = (data ?? []) as T[];
    out.push(...rows);
    if (rows.length < 1000) break;
  }
  return out;
}

export const getAnalytics = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ days: z.number().int().min(1).max(90) }).parse(d))
  .handler(async ({ context, data }) => {
    const sb = (context as Ctx).supabase;
    if (!(await rolesOf(context as Ctx)).length) throw new Error("Staff only");
    const since = new Date(Date.now() - data.days * 86400_000).toISOString();
    const [v, ev] = await Promise.all([
      fetchAll<ViewRow>((a, b) => sb.from("page_views").select("visitor_id,session_id,path,referrer,country,device,created_at").gte("created_at", since).order("created_at", { ascending: false }).range(a, b)),
      fetchAll<EventRow>((a, b) => sb.from("site_events").select("visitor_id,type,target,created_at").gte("created_at", since).order("created_at", { ascending: false }).range(a, b)),
    ]);
    return { ...summarize(v, ev, data.days), truncated: v.length >= 50000 || ev.length >= 50000 };
  });

export const listTeam = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await requireAdmin(context as Ctx);
    const { data, error } = await (context as Ctx).supabase.rpc("list_team");
    if (error) throw new Error(error.message);
    return ((data ?? []) as { user_id: string; email: string; role: string }[]).map((r) => ({ userId: r.user_id, role: r.role, email: r.email ?? "unknown" }));
  });

const role = z.enum(["admin", "editor", "moderator"]);

export const grantRole = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ email: z.string().email().max(200), role }).parse(d))
  .handler(async ({ context, data }) => {
    await requireAdmin(context as Ctx);
    const { data: ok, error } = await (context as Ctx).supabase.rpc("grant_role_by_email", { _email: data.email, _role: data.role });
    if (error) throw new Error(error.message);
    if (!ok) return { ok: false, message: "That person must sign up on the staff sign-in page first." };
    const { sendAlert } = await import("./alerts.server");
    const by = ((context as unknown as { claims?: { email?: string } }).claims?.email) ?? "an admin";
    await sendAlert({ severity: data.role === "admin" ? "critical" : "warning", title: `${data.role === "admin" ? "New ADMIN" : "Role"} granted`, detail: `${by} gave ${data.email} the ${data.role} role.`, dedupeKey: `grant-${data.email}-${data.role}`, quietMinutes: 1 });
    return { ok: true, message: `${data.email} is now ${data.role}.` };
  });

export const revokeRole = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ userId: z.string().uuid(), role }).parse(d))
  .handler(async ({ context, data }) => {
    await requireAdmin(context as Ctx);
    const { data: ok, error } = await (context as Ctx).supabase.rpc("revoke_role", { _user: data.userId, _role: data.role });
    if (error) throw new Error(error.message);
    if (!ok) return { ok: false, message: "Nothing was changed." };
    const { sendAlert } = await import("./alerts.server");
    const by = ((context as unknown as { claims?: { email?: string } }).claims?.email) ?? "an admin";
    await sendAlert({ severity: "warning", title: "Team role removed", detail: `${by} removed a ${data.role} role.`, dedupeKey: `revoke-${data.userId}-${data.role}`, quietMinutes: 1 });
    return { ok: true, message: "Access removed." };
  });

/** Admin: which regions each staff member manages, by user id. */
export const listStaffRegions = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await requireAdmin(context as Ctx);
    const { data, error } = await (context as Ctx).supabase.rpc("list_staff_regions");
    if (error) throw new Error(error.message);
    const by: Record<string, string[]> = {};
    for (const r of (data ?? []) as { user_id: string; edition: string }[]) (by[r.user_id] ??= []).push(r.edition);
    return by;
  });

export const setStaffRegions = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ userId: z.string().uuid(), editions: z.array(z.string().max(8)).max(30) }).parse(d))
  .handler(async ({ context, data }) => {
    await requireAdmin(context as Ctx);
    const { isEdition } = await import("./editions");
    const bad = data.editions.find((e) => e !== "*" && !isEdition(e));
    if (bad) throw new Error(`Unknown region: ${bad}`);
    const { data: ok, error } = await (context as Ctx).supabase.rpc("set_staff_regions", { _user: data.userId, _editions: data.editions });
    if (error) throw new Error(error.message);
    if (!ok) return { ok: false, message: "That person has no staff role." };
    const { sendAlert } = await import("./alerts.server");
    const by = ((context as unknown as { claims?: { email?: string } }).claims?.email) ?? "an admin";
    await sendAlert({ severity: "warning", title: "Staff regions changed", detail: `${by} set a staff member's regions to: ${data.editions.join(", ") || "none"}.`, dedupeKey: `regions-${data.userId}`, quietMinutes: 1 });
    return { ok: true, message: data.editions.length ? "Regions saved." : "Regions removed. They can't manage anything until you add some." };
  });

export const logAdminAction = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ type: z.string().max(60), detail: z.string().max(240) }).parse(d))
  .handler(async ({ context, data }) => {
    if (!(await rolesOf(context as Ctx)).length) return { ok: false };
    const { error } = await (context as Ctx).supabase.from("security_events").insert({ severity: "info", type: data.type, detail: data.detail, actor: (context as Ctx).userId });
    return { ok: !error };
  });
