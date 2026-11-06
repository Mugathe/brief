import { createServerFn } from "@tanstack/react-start";
import { getRequestHeader } from "@tanstack/react-start/server";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { OFFICES } from "./offices";

type Ctx = { supabase: any; userId: string };
const c = (x: unknown) => x as Ctx;

const src = z.object({
  title: z.string().trim().min(2).max(200),
  publisher: z.string().trim().max(120),
  date: z.string().trim().max(40),
  url: z.string().trim().max(1000).regex(/^https?:\/\//i, "Source links must start with http:// or https://"),
});

export const submissionInput = z.object({
  hp: z.string().max(200).optional(), // honeypot: real people leave this empty
  consent: z.literal(true, { errorMap: () => ({ message: "Please confirm the declaration." }) }),
  name: z.string().trim().min(2).max(120),
  office: z.enum(OFFICES),
  region: z.string().trim().max(80),
  affiliation: z.string().trim().max(120),
  contact_name: z.string().trim().min(2).max(120),
  contact_role: z.string().trim().max(80),
  contact_email: z.string().trim().email().max(200),
  contact_phone: z.string().trim().max(40),
  overview: z.string().trim().min(20, "Describe the candidate and their platform in at least a couple of sentences.").max(3000),
  priorities: z.array(z.string().trim().min(1).max(100)).max(12),
  pledges: z.string().trim().max(8000),
  costing: z.string().trim().max(4000),
  delivery: z.string().trim().max(4000),
  track_record: z.string().trim().max(4000),
  sources: z.array(src).min(1, "Add at least one link where your manifesto or statements can be checked.").max(10),
});

// Best-effort throttle per visitor: 5 submissions an hour per server instance.
const hits = new Map<string, number[]>();

export const submitProfile = createServerFn({ method: "POST" })
  .inputValidator((d) => submissionInput.parse(d))
  .handler(async ({ data }) => {
    if (data.hp) return { ok: true as const }; // silently drop bots
    const ip = (getRequestHeader("cf-connecting-ip") ?? getRequestHeader("x-forwarded-for") ?? "unknown").split(",")[0]!.trim();
    const recent = (hits.get(ip) ?? []).filter((t) => Date.now() - t < 3600_000);
    if (recent.length >= 5) throw new Error("Too many submissions from this connection. Please try again later.");
    hits.set(ip, [...recent, Date.now()]);

    const { anonWriteClient } = await import("./write-client.server");
    const { hp: _hp, consent: _consent, ...row } = data;
    const { error } = await anonWriteClient().from("aspirant_submissions").insert({
      ...row,
      region: row.region || null,
      affiliation: row.affiliation || null,
      contact_role: row.contact_role || null,
      contact_phone: row.contact_phone || null,
    });
    if (error) {
      console.error("[submissions] insert failed:", error.message);
      throw new Error("We couldn't save your submission. Please try again shortly.");
    }
    return { ok: true as const };
  });

/* ---------------- Staff review ---------------- */
export type Submission = {
  id: string; status: "pending" | "needs_info" | "approved" | "rejected"; name: string; office: string; region: string | null; affiliation: string | null;
  contact_name: string; contact_role: string | null; contact_email: string; contact_phone: string | null; overview: string; priorities: string[];
  pledges: string; costing: string; delivery: string; track_record: string; sources: Array<{ title: string; publisher: string; date: string; url: string }>;
  review_notes: string | null; reviewed_at: string | null; entry_id: string | null; created_at: string;
};

async function staff(ctx: Ctx) {
  const { data } = await ctx.supabase.from("user_roles").select("role").eq("user_id", ctx.userId);
  if (!(data ?? []).length) throw new Error("Staff only");
}
async function audit(ctx: Ctx, type: string, detail: string) {
  await ctx.supabase.from("security_events").insert({ severity: "info", type, detail: detail.slice(0, 250), actor: ctx.userId });
}

export const listSubmissions = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await staff(c(context));
    const { data, error } = await c(context).supabase.from("aspirant_submissions").select("*").order("created_at", { ascending: false }).limit(300);
    if (error) throw new Error(error.message);
    return data as Submission[];
  });

export const reviewSubmission = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ id: z.string().uuid(), status: z.enum(["pending", "needs_info", "rejected"]), notes: z.string().trim().max(1000) }).parse(d))
  .handler(async ({ context, data }) => {
    await staff(c(context));
    const { error } = await c(context).supabase.from("aspirant_submissions").update({
      status: data.status, review_notes: data.notes || null, reviewed_by: c(context).userId, reviewed_at: new Date().toISOString(),
    }).eq("id", data.id);
    if (error) throw new Error(error.message);
    await audit(c(context), `submission_${data.status}`, data.id);
    return { ok: true };
  });

const slugify = (v: string) => v.toLowerCase().replace(/[’']/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 70);

/** Turns a submission into a DRAFT profile for the team to verify, edit and publish. Never publishes. */
export const approveSubmission = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ context, data }) => {
    await staff(c(context));
    const sb = c(context).supabase;
    const { data: sub, error: e1 } = await sb.from("aspirant_submissions").select("*").eq("id", data.id).single();
    if (e1 || !sub) throw new Error(e1?.message ?? "Submission not found");
    if (sub.entry_id) throw new Error("A draft profile was already created from this submission.");
    const s = sub as Submission;
    const base = slugify(`${s.name} ${s.office === "President" ? "" : (s.region ?? s.office)}`) || "profile";
    const entry = {
      name: s.name, office: s.office, region: s.region, affiliation: s.affiliation,
      status: "Prospective", status_note: `Submitted by the candidate's team on ${new Date(s.created_at).toLocaleDateString("en-GB")}. Candidacy and identity are being verified.`,
      evidence_state: "Not yet assessed", overview: s.overview, priorities: s.priorities, gaps: [],
      sources: s.sources.map((x) => ({ ...x, kind: "Candidate or party" })), pillars: [], published: false, origin: "candidate_submitted",
      candidate_statement: { pledges: s.pledges, costing: s.costing, delivery: s.delivery, track_record: s.track_record },
    };
    let created: { id: string } | null = null;
    for (let n = 0; n < 4 && !created; n++) {
      const slug = n === 0 ? base : `${base}-${Math.random().toString(36).slice(2, 6)}`;
      const { data: row, error } = await sb.from("aspirant_entries").insert({ ...entry, slug }).select("id").single();
      if (!error) created = row;
      else if (error.code !== "23505") throw new Error(error.message);
    }
    if (!created) throw new Error("Could not create a unique page address. Please try again.");
    const { error: e3 } = await sb.from("aspirant_submissions").update({ status: "approved", entry_id: created.id, reviewed_by: c(context).userId, reviewed_at: new Date().toISOString() }).eq("id", data.id);
    if (e3) throw new Error(e3.message);
    await audit(c(context), "submission_approved", `${s.office}: ${s.name}`);
    return { ok: true };
  });

export const deleteSubmission = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ context, data }) => {
    const { data: roles } = await c(context).supabase.from("user_roles").select("role").eq("user_id", c(context).userId);
    if (!(roles ?? []).some((r: { role: string }) => r.role === "admin" || r.role === "editor")) throw new Error("Only admins and editors can delete submissions");
    const { error } = await c(context).supabase.from("aspirant_submissions").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    await audit(c(context), "submission_deleted", data.id);
    return { ok: true };
  });
