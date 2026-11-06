import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { getTrail } from "@/lib/trends.functions";
import { PageShell } from "@/components/PageShell";
import { TrailView } from "@/components/TrailView";
import { AdSlot } from "@/components/AdSlot";
import { validateEditionSearch } from "@/lib/editions";
import { LEGAL } from "@/lib/legal";

export const Route = createFileRoute("/trails/$slug")({
  validateSearch: validateEditionSearch,
  loader: async ({ params }) => {
    const page = await getTrail({ data: { slug: params.slug } });
    if (!page) throw notFound();
    return page;
  },
  head: ({ loaderData }) => ({
    meta: [
      { title: `${loaderData?.trail.title ?? "News trail"} — ${LEGAL.brand}` },
      { name: "description", content: loaderData?.trail.description || "Follow a story through time across the news." },
    ],
  }),
  notFoundComponent: () => (
    <PageShell kicker="Trails" title="Trail" accent="not found" intro="That trail doesn’t exist or hasn’t been published.">
      <main className="mx-auto max-w-6xl px-4 py-10"><Link to="/trails" className="font-semibold underline">Browse all trails</Link></main>
    </PageShell>
  ),
  component: TrailPage,
});

function TrailPage() {
  const { trail, events, data } = Route.useLoaderData();
  return (
    <PageShell kicker="News trail" title="Follow the" accent="story" intro="A topic traced through time: what was reported, when, and by whom. Every item links to its original publisher.">
      <AdSlot placement="trails_top" className="mt-4" />
      <main className="mx-auto max-w-6xl px-4 py-8">
        <TrailView title={trail.title} description={trail.description} query={trail.query} slug={trail.slug} data={data} events={events} />
      </main>
    </PageShell>
  );
}
