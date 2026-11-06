import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { ArrowUpRight, CheckCircle2, CircleAlert } from "lucide-react";
import { getAspirant, METHODOLOGY, REVIEWED_AT } from "@/lib/manifestos";
import { signedShareText, waLink } from "@/lib/share";
import { Button } from "@/components/ui/button";
import { SourceList } from "@/components/SourceList";
import { AdSlot } from "@/components/AdSlot";
import { useSiteUrl } from "@/lib/site-url";
import { getPublishedEntry } from "@/lib/entries.functions";

export const Route = createFileRoute("/manifestos/$slug")({
  loader: async ({ params }) => {
    const candidate = getAspirant(params.slug) ?? (await getPublishedEntry({ data: { slug: params.slug } }));
    if (!candidate) throw notFound();
    return candidate;
  },
  head: ({ loaderData }) => ({
    meta: [
      { title: `${loaderData?.name ?? "Aspirant"} manifesto analysis — Brief` },
      { name: "description", content: `Source-linked Kenya 2027 manifesto evidence analysis for ${loaderData?.name ?? "an aspirant"}${loaderData ? `, ${loaderData.office}` : ""}.` },
      { property: "og:title", content: `${loaderData?.name ?? "Aspirant"} — Kenya 2027 Manifesto Watch` },
      { property: "og:description", content: "Promises, costing, feasibility, track-record evidence and unanswered questions." },
      { property: "og:type", content: "article" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: AspirantPage,
});

const levelStyle: Record<string, string> = {
  "Strong detail": "bg-secondary text-secondary-foreground",
  "Some detail": "bg-accent text-accent-foreground",
  "Limited detail": "bg-muted text-foreground",
  "Not disclosed": "border border-border text-muted-foreground",
  "Under review": "border border-border text-muted-foreground",
};

function AspirantPage() {
  const siteUrl = useSiteUrl();
  const candidate = Route.useLoaderData();
  const detailed = candidate.pillars.filter((p) => p.level === "Strong detail" || p.level === "Some detail").length;
  const independent = candidate.sources.filter((x) => x.kind === "Independent reporting").length;
  const own = candidate.sources.length - independent;
  const share = signedShareText(`*${candidate.name} — Kenya 2027 manifesto analysis*\n${candidate.overview}`, siteUrl + "/manifestos/" + candidate.slug, "Kenya2027");

  return (
    <div className="min-h-screen bg-background text-foreground" style={{ fontFamily: "'IBM Plex Sans', sans-serif" }}>
      <div className="flex h-1.5"><div className="flex-1 bg-foreground" /><div className="flex-1 bg-primary" /><div className="flex-1 bg-secondary" /></div>
      <main className="mx-auto max-w-5xl px-4 py-8">
        <Link to="/manifestos" className="text-xs font-semibold uppercase tracking-wider hover:text-primary">← Manifesto Watch</Link>
        <header className="mt-7 border-b-2 border-foreground pb-7">
          <div className="flex flex-wrap items-center gap-2 text-[11px] font-bold uppercase tracking-wider">
            <span className="bg-secondary px-2 py-1 text-secondary-foreground">{candidate.status}</span>
            <span className="bg-muted px-2 py-1 text-muted-foreground">{candidate.evidenceState}</span>
            <span className="text-muted-foreground">{candidate.office === "President" ? `Reviewed ${REVIEWED_AT}` : "Editorial review"}</span>
          </div>
          <h1 className="mt-4 text-5xl font-black leading-none md:text-7xl" style={{ fontFamily: "'Fraunces', serif" }}>{candidate.name}</h1>
          <p className="mt-2 font-semibold text-primary">{candidate.office}{candidate.region ? ` · ${candidate.region}` : ""} · {candidate.affiliation}</p>
          <p className="mt-5 max-w-3xl text-lg leading-relaxed">{candidate.overview}</p>
          <p className="mt-4 max-w-3xl border-l-4 border-primary pl-4 text-sm text-muted-foreground">{candidate.statusNote}</p>
          <a href={waLink(share)} target="_blank" rel="noreferrer" className="mt-5 inline-block"><Button variant="secondary">Share analysis on WhatsApp</Button></a>
        </header>

        <section aria-label="At a glance" className="mt-6 grid gap-px border border-border bg-border sm:grid-cols-2 lg:grid-cols-4">
          <div className="bg-background p-4"><p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Status</p><p className="mt-1 font-bold">{candidate.status}</p><p className="text-xs text-muted-foreground">{candidate.status === "Declared intent" ? "They have said they are running." : "Named by others; not confirmed by them."}</p></div>
          <div className="bg-background p-4"><p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Priorities found</p><p className="mt-1 font-bold">{candidate.priorities.length}</p><p className="text-xs text-muted-foreground">Issues they have publicly committed to.</p></div>
          <div className="bg-background p-4"><p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Evidence found</p><p className="mt-1 font-bold">{detailed} of {candidate.pillars.length} areas</p><p className="text-xs text-muted-foreground">Areas with at least “some detail”.</p></div>
          <a href="#sources" className="bg-background p-4 hover:bg-accent"><p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Sources</p><p className="mt-1 font-bold">{candidate.sources.length} linked</p><p className="text-xs text-muted-foreground">{independent} independent · {own} from the candidate. See below ↓</p></a>
        </section>

        {candidate.submittedByTeam && (
          <p className="mt-4 border-l-4 border-primary pl-3 text-sm"><strong>Supplied by the candidate’s team.</strong> The statements below came from the aspirant’s own side and were reviewed by our team before publishing. Claims are not independently verified unless an independent source is listed.</p>
        )}

        <section id="sources" className="mt-8 scroll-mt-6">
          <h2 className="text-xs font-bold uppercase tracking-widest">Where this information comes from</h2>
          <p className="mt-1 mb-3 text-sm text-muted-foreground">Everything on this page is drawn from the sources below. Open any of them to check for yourself. We do not use rumours or unverified posts.</p>
          <SourceList sources={candidate.sources} />
        </section>

        <section className="mt-8">
          <h2 className="text-xs font-bold uppercase tracking-widest">Published priorities found</h2>
          {candidate.priorities.length ? <div className="mt-3 flex flex-wrap gap-2">{candidate.priorities.map((priority) => <span key={priority} className="border border-foreground px-3 py-1 text-sm font-semibold">{priority}</span>)}</div> : <p className="mt-3 text-sm text-muted-foreground">No sufficiently detailed presidential priorities were found by the review date.</p>}
        </section>

        {candidate.statement && (
          <section className="mt-10">
            <h2 className="border-b-2 border-foreground pb-2 text-2xl font-bold" style={{ fontFamily: "'Fraunces', serif" }}>In their own words</h2>
            <p className="mt-2 text-xs text-muted-foreground">Supplied by the candidate’s team. Not independently verified.</p>
            <div className="mt-4 grid gap-6 md:grid-cols-2">
              {([["Key pledges", candidate.statement.pledges], ["How it will be paid for", candidate.statement.costing], ["How and when it will be delivered", candidate.statement.delivery], ["Track record they cite", candidate.statement.trackRecord]] as const).filter(([, v]) => v).map(([label, v]) => (
                <div key={label}><h3 className="text-xs font-bold uppercase tracking-wider text-primary">{label}</h3><p className="mt-1 whitespace-pre-line text-sm leading-relaxed">{v}</p></div>
              ))}
            </div>
          </section>
        )}

        <section className="mt-10">
          <div className="border-b-2 border-foreground pb-2">
            <h2 className="text-2xl font-bold" style={{ fontFamily: "'Fraunces', serif" }}>Evidence scorecard</h2>
            <p className="mt-1 text-xs text-muted-foreground">Rated only from the {candidate.sources.length} source{candidate.sources.length === 1 ? "" : "s"} listed above. Qualitative until enough directly cited evidence exists for a defensible score.</p>
          </div>
          <dl className="mt-4 grid gap-x-6 gap-y-1 border border-border p-3 text-xs text-muted-foreground md:grid-cols-2">
            <div><dt className="inline font-bold text-foreground">Strong detail: </dt><dd className="inline">specific, measurable commitments with numbers, dates and a named body responsible.</dd></div>
            <div><dt className="inline font-bold text-foreground">Some detail: </dt><dd className="inline">partly specific, with key details still missing.</dd></div>
            <div><dt className="inline font-bold text-foreground">Limited detail: </dt><dd className="inline">general themes only.</dd></div>
            <div><dt className="inline font-bold text-foreground">Not disclosed: </dt><dd className="inline">we looked in the sources above and found nothing. It may exist elsewhere.</dd></div>
            <div><dt className="inline font-bold text-foreground">Under review: </dt><dd className="inline">our team has not assessed this yet.</dd></div>
          </dl>
          <div className="divide-y divide-border">
            {candidate.pillars.map((pillar) => (
              <div key={pillar.label} className="grid gap-3 py-5 md:grid-cols-[13rem_9rem_1fr] md:items-start">
                <h3 className="font-bold">{pillar.label}</h3>
                <span className={`w-fit px-2 py-1 text-[11px] font-bold uppercase tracking-wider ${levelStyle[pillar.level]}`}>{pillar.level}</span>
                <p className="text-sm leading-relaxed text-muted-foreground">{pillar.note}</p>
              </div>
            ))}
          </div>
          <div className="mt-4 flex gap-3 border border-border p-4 text-sm text-muted-foreground"><CircleAlert className="h-5 w-5 shrink-0 text-primary" /><p>This measures the completeness, costing, feasibility documentation and track-record evidence available for public commitments as of {candidate.office === "President" ? REVIEWED_AT : "its last editorial review"}. It is not an endorsement, prediction or ranking of fitness for office. Candidates without a published manifesto are not penalised.</p></div>
        </section>

        <section className="mt-10">
          <div>
            <h2 className="border-b-2 border-foreground pb-2 text-xl font-bold">Unanswered questions</h2>
            <ul className="mt-4 space-y-3">{candidate.gaps.map((gap) => <li key={gap} className="flex gap-3 text-sm"><span className="mt-2 h-1.5 w-1.5 shrink-0 bg-primary" />{gap}</li>)}</ul>
          </div>
        </section>

        <section className="mt-12 border-t-2 border-foreground pt-6">
          <div className="flex items-center gap-2"><CheckCircle2 className="h-5 w-5 text-secondary" /><h2 className="font-bold">Assessment method</h2></div>
          <ul className="mt-3 grid gap-2 text-xs text-muted-foreground md:grid-cols-2">{METHODOLOGY.map((item) => <li key={item}>• {item}</li>)}</ul>
        </section>
      </main>
      <AdSlot placement="manifestos_bottom" className="mb-8" />
    </div>
  );
}