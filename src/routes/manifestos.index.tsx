import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { ArrowRight, BookOpen, CheckCircle2, CircleHelp, Scale } from "lucide-react";
import { queryOptions, useSuspenseQuery } from "@tanstack/react-query";
import { ASPIRANTS, METHODOLOGY, REVIEWED_AT, type Aspirant, type AspirantStatus } from "@/lib/manifestos";
import { getPublishedEntries } from "@/lib/entries.functions";
import { OFFICES, REGION_LABEL, type Office } from "@/lib/offices";
import { AdSlot } from "@/components/AdSlot";
import { useSiteUrl } from "@/lib/site-url";
import { SourceSummary } from "@/components/SourceList";
import { signedShareText, waLink } from "@/lib/share";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const entriesQuery = queryOptions({ queryKey: ["entries"], queryFn: () => getPublishedEntries(), staleTime: 60_000 });

export const Route = createFileRoute("/manifestos/")({
  loader: ({ context }) => context.queryClient.ensureQueryData(entriesQuery),
  head: () => ({
    meta: [
      { title: "Kenya 2027 Manifesto Watch — Brief" },
      { name: "description", content: "Neutral, source-linked evidence analysis of declared and prospective Kenya 2027 presidential aspirants." },
      { property: "og:title", content: "Kenya 2027 Manifesto Watch — Brief" },
      { property: "og:description", content: "Compare presidential aspirants’ promises, costing, feasibility, track records and unanswered questions." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: ManifestosPage,
});

function ManifestosPage() {
  const siteUrl = useSiteUrl();
  const { data: entries } = useSuspenseQuery(entriesQuery);
  const [status, setStatus] = useState<"All" | AspirantStatus>("All");
  const [issue, setIssue] = useState("All issues");
  const [office, setOffice] = useState<Office>("President");
  const [region, setRegion] = useState("All");
  const everyone = useMemo<Aspirant[]>(() => {
    const known = new Set(ASPIRANTS.map((a) => a.slug));
    return [...ASPIRANTS, ...entries.filter((e) => !known.has(e.slug))].sort((a, b) => a.name.localeCompare(b.name));
  }, [entries]);
  const inOffice = useMemo(() => everyone.filter((a) => a.office === office), [everyone, office]);
  const regions = useMemo(() => [...new Set(inOffice.map((a) => a.region).filter((r): r is string => !!r))].sort(), [inOffice]);
  const policyIssues = useMemo(() => [...new Set(inOffice.flatMap((a) => a.priorities))].sort(), [inOffice]);
  const candidates = useMemo(
    () => inOffice.filter((candidate) => (status === "All" || candidate.status === status) && (issue === "All issues" || candidate.priorities.includes(issue)) && (region === "All" || candidate.region === region)),
    [inOffice, issue, status, region],
  );
  const pickOffice = (o: Office) => { setOffice(o); setRegion("All"); setIssue("All issues"); };

  return (
    <div className="min-h-screen bg-background text-foreground" style={{ fontFamily: "'IBM Plex Sans', sans-serif" }}>
      <div className="flex h-1.5"><div className="flex-1 bg-foreground" /><div className="flex-1 bg-primary" /><div className="flex-1 bg-secondary" /></div>
      <header className="border-b-2 border-foreground">
        <div className="mx-auto max-w-6xl px-4 py-8">
          <Link to="/" className="text-xs font-semibold uppercase tracking-wider hover:text-primary">← All stories</Link>
          <div className="mt-6 grid gap-6 md:grid-cols-[1fr_auto] md:items-end">
            <div>
              <p className="text-xs font-bold uppercase tracking-widest text-secondary">Kenya 2027 · {office === "President" ? "Presidential race" : office}</p>
              <h1 className="mt-2 text-5xl font-black leading-none md:text-7xl" style={{ fontFamily: "'Fraunces', serif" }}>Manifesto <span className="text-primary">Watch</span></h1>
              <p className="mt-4 max-w-3xl text-base text-muted-foreground">A source-linked look at what aspirants have promised, what the plans may cost, how delivery could work, and what remains unanswered.</p>
            </div>
            <a href={waLink(signedShareText("*Kenya 2027 Manifesto Watch*\nCompare the evidence behind presidential aspirants’ public commitments.", siteUrl + "/manifestos", "Kenya2027"))} target="_blank" rel="noreferrer">
              <Button variant="secondary">Share on WhatsApp</Button>
            </a>
          </div>
        </div>
      </header>

      <AdSlot placement="manifestos_top" className="mt-4" />
      <main className="mx-auto max-w-6xl px-4 py-8">
        <div className="mb-5 flex flex-wrap items-center justify-between gap-3 border border-dashed border-foreground p-3 text-sm">
          <p><strong>Are you an aspirant or part of a campaign team?</strong> Submit your manifesto and sources for review.</p>
          <Link to="/manifestos/submit" className="font-bold underline underline-offset-4 hover:text-primary">Submit a profile →</Link>
        </div>
        <nav className="-mt-2 mb-6 flex gap-2 overflow-x-auto pb-1" aria-label="Elective office">
          {OFFICES.map((o) => {
            const n = everyone.filter((a) => a.office === o).length;
            return (
              <button key={o} onClick={() => pickOffice(o)} className={`whitespace-nowrap border px-3 py-1.5 text-xs font-bold uppercase tracking-wide transition-colors ${office === o ? "border-foreground bg-foreground text-background" : "border-border text-muted-foreground hover:border-foreground hover:text-foreground"}`}>
                {o} <span className="opacity-60">· {n}</span>
              </button>
            );
          })}
        </nav>
        <section className="border-y border-border py-5">
          <div className="grid gap-4 text-sm md:grid-cols-3">
            <div className="flex gap-3"><Scale className="mt-0.5 h-5 w-5 shrink-0 text-primary" /><p><strong>Not an endorsement.</strong> We assess available documentation and evidence, not ideology, popularity or fitness for office.</p></div>
            <div className="flex gap-3"><CircleHelp className="mt-0.5 h-5 w-5 shrink-0 text-primary" /><p><strong>No manifesto is not a zero.</strong> Thin evidence is marked “Not yet assessed,” never treated as failure.</p></div>
            <div className="flex gap-3"><CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-primary" /><p><strong>Status is provisional.</strong> These are declared intentions or credible prospects, not IEBC-cleared nominees.</p></div>
          </div>
        </section>

        <div className="mt-7 flex flex-wrap items-end gap-3">
          <div className="min-w-44">
            <label className="mb-1 block text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Candidate status</label>
            <Select value={status} onValueChange={(value) => setStatus(value as "All" | AspirantStatus)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent><SelectItem value="All">All aspirants</SelectItem><SelectItem value="Declared intent">Declared intent</SelectItem><SelectItem value="Prospective">Prospective</SelectItem></SelectContent>
            </Select>
          </div>
          <div className="min-w-56">
            <label className="mb-1 block text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Policy issue</label>
            <Select value={issue} onValueChange={setIssue}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent><SelectItem value="All issues">All issues</SelectItem>{policyIssues.map((item) => <SelectItem key={item} value={item}>{item}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          {regions.length > 0 && (
            <div className="min-w-48">
              <label className="mb-1 block text-[11px] font-bold uppercase tracking-wider text-muted-foreground">{REGION_LABEL[office]}</label>
              <Select value={region} onValueChange={setRegion}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent><SelectItem value="All">All</SelectItem>{regions.map((r) => <SelectItem key={r} value={r}>{r}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          )}
          <p className="ml-auto text-xs text-muted-foreground">{candidates.length} aspirants{office === "President" ? ` · reviewed ${REVIEWED_AT}` : ""}</p>
        </div>

        {candidates.length === 0 && (
          <p className="mt-6 border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
            {inOffice.length === 0 ? `${office} profiles are coming soon. We publish a profile only once its sources have been reviewed.` : "No aspirants match these filters."}
          </p>
        )}
        <section className="mt-6 grid gap-px border border-border bg-border md:grid-cols-2 lg:grid-cols-3">
          {candidates.map((candidate) => (
            <article key={candidate.slug} className="flex min-h-80 flex-col bg-background p-5">
              <div className="flex items-start justify-between gap-3">
                <span className={`px-2 py-1 text-[10px] font-bold uppercase tracking-wider ${candidate.status === "Declared intent" ? "bg-secondary text-secondary-foreground" : "bg-muted text-muted-foreground"}`}>{candidate.status}</span>
                <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">{candidate.evidenceState}</span>
              </div>
              <h2 className="mt-5 text-2xl font-bold" style={{ fontFamily: "'Fraunces', serif" }}>{candidate.name}</h2>
              <p className="mt-1 text-xs font-semibold uppercase tracking-wider text-primary">{candidate.affiliation}{candidate.region ? ` · ${candidate.region}` : ""}</p>
              <p className="mt-4 line-clamp-4 text-sm leading-relaxed text-muted-foreground">{candidate.overview}</p>
              <div className="mt-4 space-y-1"><SourceSummary sources={candidate.sources} />{candidate.submittedByTeam && <p className="text-[11px] font-semibold text-muted-foreground">Statements supplied by the candidate’s team</p>}</div>
              <div className="mt-3 flex flex-wrap gap-1.5">{candidate.priorities.slice(0, 4).map((priority) => <span key={priority} className="bg-muted px-2 py-1 text-[11px]">{priority}</span>)}</div>
              <Link to="/manifestos/$slug" params={{ slug: candidate.slug }} className="mt-auto flex items-center justify-between border-t border-border pt-4 text-sm font-bold hover:text-primary">
                Read evidence analysis <ArrowRight className="h-4 w-4" />
              </Link>
            </article>
          ))}
        </section>

        <AdSlot placement="manifestos_bottom" inline className="mt-10" />
        <section className="mt-12 border-t-2 border-foreground pt-6">
          <div className="flex items-center gap-2"><BookOpen className="h-5 w-5 text-primary" /><h2 className="text-xl font-bold">How the evidence check works</h2></div>
          <ol className="mt-4 grid gap-3 md:grid-cols-2">{METHODOLOGY.map((item, index) => <li key={item} className="flex gap-3 text-sm text-muted-foreground"><span className="font-black text-primary">0{index + 1}</span><span>{item}</span></li>)}</ol>
          <p className="mt-5 max-w-4xl text-xs leading-relaxed text-muted-foreground">Profiles use the same framework for every aspirant. Published candidate or party documents establish promises; official records and credible independent reporting test feasibility and past delivery. Unverified social posts and opponents’ characterisations are not scored. Profiles are snapshots and will change as manifestos are published.</p>
        </section>
      </main>
    </div>
  );
}