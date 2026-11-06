import type { Aspirant, CandidateStatement, AspirantStatus, EvidenceState, ManifestoSource, PillarLevel } from "./manifestos";
import { PILLAR_LABELS, PILLAR_LEVELS } from "./manifestos";

export type EntryRow = {
  id: string; slug: string; name: string; office: string; region: string | null; affiliation: string | null;
  status: string; status_note: string; evidence_state: string; overview: string; priorities: string[]; gaps: string[];
  sources: unknown; pillars: unknown; published: boolean; reviewed_at: string | null; updated_at: string;
  candidate_statement?: unknown; origin?: string;
};

export function parseStatement(v: unknown): CandidateStatement | null {
  if (!isObj(v)) return null;
  const out = { pledges: s(v["pledges"]), costing: s(v["costing"]), delivery: s(v["delivery"]), trackRecord: s(v["track_record"]) };
  return out.pledges || out.costing || out.delivery || out.trackRecord ? out : null;
}

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null;
const s = (v: unknown) => (typeof v === "string" ? v : "");

export function parseSources(v: unknown): ManifestoSource[] {
  if (!Array.isArray(v)) return [];
  return v.filter(isObj).map((o): ManifestoSource => ({
    title: s(o["title"]), publisher: s(o["publisher"]), date: s(o["date"]), url: s(o["url"]),
    kind: o["kind"] === "Candidate or party" ? "Candidate or party" : "Independent reporting",
  })).filter((x) => /^https?:\/\//.test(x.url));
}

export function parsePillars(v: unknown): Aspirant["pillars"] {
  const arr = Array.isArray(v) ? v.filter(isObj) : [];
  return PILLAR_LABELS.map((label) => {
    const found = arr.find((o) => o["label"] === label);
    const level = PILLAR_LEVELS.find((l) => l === found?.["level"]) ?? ("Under review" as PillarLevel);
    return { label, level, note: s(found?.["note"]) || "Not yet reviewed." };
  });
}

export function rowToAspirant(r: EntryRow): Aspirant {
  return {
    slug: r.slug, name: r.name, office: r.office, region: r.region,
    affiliation: r.affiliation ?? "Not stated",
    status: (r.status === "Declared intent" ? "Declared intent" : "Prospective") as AspirantStatus,
    statusNote: r.status_note,
    evidenceState: (r.evidence_state === "Partial evidence" ? "Partial evidence" : "Not yet assessed") as EvidenceState,
    overview: r.overview, priorities: r.priorities, gaps: r.gaps,
    pillars: parsePillars(r.pillars), sources: parseSources(r.sources),
    statement: parseStatement(r.candidate_statement), submittedByTeam: r.origin === "candidate_submitted",
  };
}
