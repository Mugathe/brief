import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Check, ChevronDown, ChevronRight, RotateCcw, Trash2, X } from "lucide-react";
import { deleteResearch, getResearchAdmin, reviewAiItem, runResearchNow, type AdminRun } from "@/lib/research.functions";
import { saveSetting } from "@/lib/manage.functions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Section, useAction } from "./shared";

const tone = (s: string) => (s === "done" ? "secondary" : s === "failed" ? "destructive" : "default");

function Run({ run, canEdit, onChange }: { run: AdminRun; canEdit: boolean; onChange: string[] }) {
  const [open, setOpen] = useState(false);
  const review = useAction(reviewAiItem, "Updated", onChange);
  const del = useAction(deleteResearch, "Research deleted", onChange);
  const pending = run.items.filter((i) => i.status === "unreviewed").length;
  return (
    <li className="py-3">
      <div className="flex flex-wrap items-center gap-3">
        <button className="flex min-w-0 flex-1 items-center gap-2 text-left" onClick={() => setOpen(!open)} aria-expanded={open}>
          {open ? <ChevronDown className="h-4 w-4 shrink-0" /> : <ChevronRight className="h-4 w-4 shrink-0" />}
          <span className="min-w-0"><span className="font-semibold">{run.query}</span>
            <span className="block text-xs text-muted-foreground">{run.origin} · {new Date(run.created_at).toLocaleString()} · {run.items_found} items · {run.searches} searches{run.error ? ` · ${run.error}` : ""}</span></span>
        </button>
        {pending > 0 && <Badge>{pending} to review</Badge>}
        <Badge variant={tone(run.status)}>{run.status}</Badge>
        {canEdit && <Button variant="ghost" size="icon" aria-label="Delete research" onClick={() => { if (confirm(`Delete this research and all its ${run.items.length} items?`)) del.mutate({ id: run.id }); }}><Trash2 className="h-4 w-4 text-destructive" /></Button>}
      </div>
      {open && (
        <ul className="mt-3 space-y-3 border-l-2 border-border pl-4">
          {run.items.length === 0 && <li className="text-sm text-muted-foreground">No items.</li>}
          {run.items.map((i) => (
            <li key={i.id} className="text-sm">
              <p><span className="text-xs text-muted-foreground">{i.event_date}</span> <a href={i.url} target="_blank" rel="noreferrer noopener" className="font-semibold underline">{i.title}</a> <Badge variant={i.status === "approved" ? "secondary" : i.status === "rejected" ? "destructive" : "outline"}>{i.status}</Badge></p>
              {i.summary && <p className="text-muted-foreground">{i.summary}</p>}
              <p className="text-xs text-muted-foreground">{i.publisher} · open the link and check it says this before approving</p>
              {canEdit && (
                <div className="mt-1 flex gap-2">
                  <Button size="sm" variant="outline" className="rounded-none" disabled={i.status === "approved"} onClick={() => review.mutate({ id: i.id, status: "approved" })}><Check className="mr-1 h-3.5 w-3.5" />Approve</Button>
                  <Button size="sm" variant="outline" className="rounded-none" disabled={i.status === "rejected"} onClick={() => review.mutate({ id: i.id, status: "rejected" })}><X className="mr-1 h-3.5 w-3.5" />Reject</Button>
                  {i.status !== "unreviewed" && <Button size="sm" variant="ghost" className="rounded-none" onClick={() => review.mutate({ id: i.id, status: "unreviewed" })}><RotateCcw className="mr-1 h-3.5 w-3.5" />Undo</Button>}
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </li>
  );
}

/** `scope` is the region chosen at the top of the admin: research is kept per country, and "*" (whole site) researches the world. */
export function ResearchPanel({ canEdit, scope = "*" }: { canEdit: boolean; scope?: string }) {
  const q = useQuery({ queryKey: ["research-admin"], queryFn: () => getResearchAdmin(), refetchInterval: (s) => (s.state.data?.runs.some((r) => r.status === "running") ? 6000 : 30_000) });
  const save = useAction(saveSetting, "Saved", ["research-admin"]);
  const run = useAction(runResearchNow, "Research started. It takes about a minute.", ["research-admin"]);
  const [topic, setTopic] = useState("");
  const d = q.data;
  if (!d) return <p className="text-sm text-muted-foreground">Loading…</p>;
  const set = (patch: Partial<typeof d.settings>) => save.mutate({ key: "ai_trails", value: { ...d.settings, ...patch } });
  return (
    <div className="space-y-5">
      {!d.config.ready && (
        <p role="alert" className="border-l-4 border-primary pl-3 text-sm">
          The research agent is off. It needs <code>ANTHROPIC_API_KEY</code> and <code>SUPABASE_SERVICE_ROLE_KEY</code> on the server, and <strong>web search must be enabled</strong> for your Anthropic organisation (Claude Console, organisation settings). Existing results still show.
        </p>
      )}
      <div className="flex flex-wrap items-center gap-x-8 gap-y-3 text-sm">
        <label className="flex items-center gap-2 font-semibold"><Switch checked={d.settings.enabled} disabled={!canEdit} onCheckedChange={(v) => set({ enabled: v })} />Show AI history on the site</label>
        <label className="flex items-center gap-2 font-semibold"><Switch checked={d.settings.showUnreviewed} disabled={!canEdit} onCheckedChange={(v) => set({ showUnreviewed: v })} />Show items before an editor approves them</label>
        <span className="text-xs text-muted-foreground">Today: {d.config.usedToday} of {d.config.dailyLimit} runs · visitors may use {d.config.visitorLimit} · model {d.config.model}</span>
      </div>
      <p className="text-xs text-muted-foreground">Turn off “before approval” to publish only what an editor has checked. Rejected items never show. Each run costs a few cents in searches and tokens, so the daily limits above protect your budget.</p>
      {canEdit && (
        <div className="flex gap-2">
          <Input className="max-w-md rounded-none" value={topic} onChange={(e) => setTopic(e.target.value)} placeholder='Research a topic now, e.g. drought OR famine' onKeyDown={(e) => { if (e.key === "Enter" && topic.trim().length >= 3) run.mutate({ q: topic }, { onSuccess: () => setTopic("") }); }} />
          <Button className="rounded-none" disabled={run.isPending || topic.trim().length < 3 || !d.config.ready} onClick={() => run.mutate({ q: topic, edition: scope === "*" ? "world" : scope }, { onSuccess: () => setTopic("") })}>Research</Button>
        </div>
      )}
      {d.runs.length === 0 ? <p className="text-sm text-muted-foreground">No research has been run yet.</p> : (
        <ul className="divide-y divide-border">{d.runs.map((r) => <Run key={r.id} run={r} canEdit={canEdit} onChange={["research-admin"]} />)}</ul>
      )}
    </div>
  );
}
