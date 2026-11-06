import { Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { ArrowUpRight, Bot, CheckCircle2, Loader2 } from "lucide-react";
import { getResearch, requestResearch } from "@/lib/research.functions";
import { LEGAL } from "@/lib/legal";
import { useEdition } from "@/lib/use-edition";
import { researchScope } from "@/lib/editions";
import { Button } from "@/components/ui/button";

const serif = { fontFamily: "'Fraunces', serif" };
const when = (date: string, precision: string) => {
  const d = new Date(date + "T00:00:00Z");
  if (precision === "year") return String(d.getUTCFullYear());
  return d.toLocaleDateString("en-GB", precision === "month" ? { month: "short", year: "numeric", timeZone: "UTC" } : { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });
};

/** Earlier history compiled by the research agent, clearly labelled, with a button to request it when missing. */
export function AiHistory({ query }: { query: string }) {
  const qc = useQueryClient();
  const edition = useEdition();
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const key = ["ai-research", query.toLowerCase().trim(), researchScope(edition)];
  const q = useQuery({
    queryKey: key,
    queryFn: () => getResearch({ data: { q: query, edition: edition.code } }),
    refetchInterval: (state) => (state.state.data?.status === "running" ? 4000 : false),
    staleTime: 30_000,
  });
  const s = q.data;
  if (!s || !s.enabled || (!s.items.length && !s.available)) return null;

  const ask = async () => {
    setBusy(true); setMessage("");
    try {
      const r = await requestResearch({ data: { q: query, edition: edition.code } });
      setMessage(r.message);
      await qc.invalidateQueries({ queryKey: key });
    } catch (e) {
      setMessage(query.trim().length < 3 ? "Type a topic of at least three letters." : "Something went wrong. Please try again.");
      void e;
    } finally { setBusy(false); }
  };

  return (
    <section className="mt-10" aria-labelledby="ai-history">
      <h3 id="ai-history" className="flex items-center gap-2 border-b-2 border-foreground pb-2 text-2xl font-bold" style={serif}><Bot className="h-6 w-6 text-primary" />Earlier history, compiled with AI</h3>
      <p className="mt-3 border-l-4 border-secondary pl-3 text-sm text-muted-foreground">
        Compiled by AI from web search results. Every item links to the page it came from. AI can make mistakes, so read the source before relying on it.
        Items marked “not yet reviewed” haven’t been checked by our editors. <Link to="/editorial" className="underline">How we use AI</Link>.
      </p>

      {s.items.length > 0 && (
        <ol className="mt-4 divide-y divide-border">
          {s.items.map((i) => (
            <li key={i.id} className="grid gap-x-6 py-4 md:grid-cols-[10rem_1fr]">
              <p className="text-sm font-bold uppercase tracking-wider text-primary">{when(i.date, i.precision)}</p>
              <div className="text-sm">
                <a href={i.url} target="_blank" rel="noreferrer noopener" data-track="story_click" data-track-target={i.url} className="font-semibold hover:text-primary">{i.title}<ArrowUpRight className="ml-0.5 inline h-3.5 w-3.5 opacity-60" /></a>
                {i.summary && <p className="mt-1 text-muted-foreground">{i.summary}</p>}
                <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                  <span>Source: {i.publisher}</span>
                  {i.reviewed
                    ? <span className="inline-flex items-center gap-1 font-semibold text-secondary"><CheckCircle2 className="h-3.5 w-3.5" />Reviewed by our editors</span>
                    : <span className="font-semibold">Not yet reviewed by our editors</span>}
                  <a className="underline hover:text-primary" href={`mailto:${LEGAL.email}?subject=${encodeURIComponent(`Problem with an item: ${i.title}`)}&body=${encodeURIComponent(`Item: ${i.title}\nLink: ${i.url}\n\nWhat is wrong:\n`)}`}>Report a problem</a>
                </p>
              </div>
            </li>
          ))}
        </ol>
      )}

      {s.status === "running" && (
        <p role="status" className="mt-4 flex items-center gap-2 text-sm"><Loader2 className="h-4 w-4 animate-spin" />Researching earlier history. This can take up to a minute; you can leave this page open.</p>
      )}
      {s.status === "done" && s.items.length === 0 && <p className="mt-4 text-sm text-muted-foreground">We searched, but couldn’t find enough reliable sources to build a timeline for this topic.</p>}
      {s.status === "failed" && !s.canRequest && <p className="mt-4 text-sm text-muted-foreground">The research couldn’t be completed just now. You can try again in a few minutes.</p>}

      {s.canRequest && (
        <div className="mt-4 border border-dashed border-foreground p-4">
          <p className="text-sm">{s.items.length ? "Want fresh research?" : "No earlier history is on file for this topic yet."} We can search the web for reporting on it over the years and list what we find, with links. It takes about a minute.</p>
          <Button className="mt-3 rounded-none" disabled={busy} onClick={() => void ask()}>{busy ? "Starting…" : "Research earlier history with AI"}</Button>
        </div>
      )}
      {message && <p role="status" className="mt-3 text-sm font-semibold">{message}</p>}
    </section>
  );
}
