import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Field, Section, errMsg, useAction } from "./shared";
import { getSiteSettings, saveSetting } from "@/lib/manage.functions";
import { getSocialStatus } from "@/lib/studio.functions";
import { DEFAULT_STUDIO, type StudioConfig, type StudioVoice } from "@/lib/studio-config";
import { EDITIONS } from "@/lib/editions";
import { supabase } from "@/integrations/supabase/client";

type RunItem = { title: string; state: "done" | "failed"; note?: string };
type Run = { id: number; edition: string; started_at: string; finished_at: string | null; status: "running" | "done" | "failed"; planned: number; made: number; failed: number; items: RunItem[]; note: string };

const STALLED_MS = 25 * 60_000;
const ago = (iso: string, now = Date.now()) => {
  const m = Math.max(0, Math.round((now - new Date(iso).getTime()) / 60_000));
  return m < 1 ? "just now" : m < 60 ? `${m} min ago` : m < 1440 ? `${Math.round(m / 60)} h ago` : `${Math.round(m / 1440)} d ago`;
};
const live = (r: Run) => r.status === "running" && Date.now() - new Date(r.started_at).getTime() < STALLED_MS;

async function loadRuns(): Promise<Run[]> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase as unknown as { from: (t: string) => any }).from("studio_runs").select("*").order("started_at", { ascending: false }).limit(20);
  if (error) throw new Error(error.message);
  return (data ?? []) as Run[];
}

/** The automatic service: switch it on, say what it should do, and see what it has made and what is happening now. */
export function StudioService({ canConfigure }: { canConfigure: boolean }) {
  const settings = useQuery({ queryKey: ["settings", "studio"], queryFn: () => getSiteSettings({ data: {} }) });
  const runs = useQuery({ queryKey: ["studio-runs"], queryFn: loadRuns, refetchInterval: (q) => (q.state.data?.some(live) ? 5_000 : 60_000) });
  const social = useQuery({ queryKey: ["social-status"], queryFn: () => getSocialStatus(), retry: false });
  const save = useAction(saveSetting, "Studio service settings saved", ["settings"]);
  const [cfg, setCfg] = useState<StudioConfig>(DEFAULT_STUDIO);
  useEffect(() => { if (settings.data?.studio) setCfg(settings.data.studio); }, [settings.data?.studio]);

  const list = runs.data ?? [];
  const running = list.filter(live);
  const last = list.find((r) => r.status !== "running");
  const stalled = list.some((r) => r.status === "running" && !live(r));
  const saved = settings.data?.studio;
  const headline = !saved?.enabled
    ? "Switched off"
    : running.length
      ? `Making reels now: ${running.map((r) => `${r.edition} (${r.made + r.failed} of ${r.planned})`).join(", ")}`
      : last ? `Idle. Last run ${ago(last.finished_at ?? last.started_at)}: ${last.made} made${last.failed ? `, ${last.failed} failed` : ""}` : "On, waiting for its first run";
  const toggleEdition = (code: string) => setCfg((c) => ({ ...c, editions: c.editions.includes(code) ? c.editions.filter((x) => x !== code) : [...c.editions, code] }));

  return (
    <Section title="Automatic service" hint="Every 30 minutes a GitHub job checks the Brief's top stories, makes a picture and a reel for each new one, and publishes them. You get an alert on your phone when a batch finishes.">
      <div className="mb-4 flex flex-wrap items-center gap-3 border border-border p-3" role="status" aria-live="polite">
        <span className={`h-2.5 w-2.5 rounded-full ${running.length ? "animate-pulse bg-secondary" : saved?.enabled ? "bg-secondary" : "bg-muted-foreground"}`} aria-hidden />
        <p className="text-sm font-semibold">{headline}</p>
        {stalled && <Badge variant="destructive">A run stopped without finishing</Badge>}
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-3">
          <label className="flex items-center gap-2 text-sm font-semibold"><input type="checkbox" checked={cfg.enabled} disabled={!canConfigure} onChange={(e) => setCfg({ ...cfg, enabled: e.target.checked })} />Service is on</label>
          <label className="flex items-start gap-2 text-sm"><input type="checkbox" className="mt-1" checked={cfg.autoPublish} disabled={!canConfigure} onChange={(e) => setCfg({ ...cfg, autoPublish: e.target.checked })} /><span><span className="font-semibold">Publish straight away</span><span className="block text-xs text-muted-foreground">Off means everything waits in the review list for you to publish.</span></span></label>
          <Field label="Voice-over on reels">
            <Select value={cfg.voice} onValueChange={(v) => setCfg({ ...cfg, voice: v as StudioVoice })} disabled={!canConfigure}>
              <SelectTrigger className="rounded-none"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="off">No voice, music only</SelectItem>
                <SelectItem value="amani">Amani (woman) reads the headline</SelectItem>
                <SelectItem value="baraka">Baraka (man) reads the headline</SelectItem>
              </SelectContent>
            </Select>
          </Field>
          {([["facebook", "Also post each new reel to our Facebook Page", "FACEBOOK_PAGE_ID and FACEBOOK_PAGE_TOKEN"], ["youtube", "Also post each new reel to YouTube as a Short", "YOUTUBE_CLIENT_ID, YOUTUBE_CLIENT_SECRET and YOUTUBE_REFRESH_TOKEN"]] as const).map(([k, label, vars]) => (
            <label key={k} className="flex items-start gap-2 text-sm"><input type="checkbox" className="mt-1" checked={cfg[k]} disabled={!canConfigure} onChange={(e) => setCfg({ ...cfg, [k]: e.target.checked })} /><span><span className="font-semibold">{label}</span>{social.data && !social.data[k] && <span className="block text-xs text-destructive">Not set up on the server yet. Add {vars} (SETUP.md, section 13).</span>}{k === "youtube" && <span className="block text-xs text-muted-foreground">YouTube keeps uploads private until Google has approved your API project.</span>}</span></label>
          ))}
          <div className="grid grid-cols-2 gap-3">
            <Field label="New stories per run"><Input className="rounded-none" type="number" min={1} max={5} disabled={!canConfigure} value={cfg.perRun} onChange={(e) => setCfg({ ...cfg, perRun: Number(e.target.value) })} /></Field>
            <Field label="Most per edition per day"><Input className="rounded-none" type="number" min={1} max={30} disabled={!canConfigure} value={cfg.perDay} onChange={(e) => setCfg({ ...cfg, perDay: Number(e.target.value) })} /></Field>
          </div>
        </div>
        <fieldset className="min-w-0">
          <legend className="mb-1 text-xs font-bold uppercase tracking-wider text-muted-foreground">Editions to cover</legend>
          <div className="grid max-h-44 grid-cols-2 gap-x-3 gap-y-1 overflow-y-auto border border-border p-2 text-sm">
            {EDITIONS.map((e) => <label key={e.code} className="flex items-center gap-2"><input type="checkbox" disabled={!canConfigure} checked={cfg.editions.includes(e.code)} onChange={() => toggleEdition(e.code)} /><span className="truncate">{e.flag} {e.name}</span></label>)}
          </div>
        </fieldset>
      </div>
      <div className="mt-4 flex flex-wrap items-center gap-3">
        <Button className="rounded-none" disabled={!canConfigure || save.isPending || !cfg.editions.length} onClick={() => save.mutate({ key: "studio", value: cfg })}>Save</Button>
        {!canConfigure && <p className="text-xs text-muted-foreground">Only editors of the whole site can change these. Choose “Whole site” at the top of the admin.</p>}
        <p className="text-xs text-muted-foreground">To start a run right now: GitHub → Actions → “Studio reels” → Run workflow.</p>
      </div>

      <h3 className="mb-2 mt-6 text-sm font-bold">What it has done</h3>
      {runs.isError && <p className="text-sm text-destructive">{errMsg(runs.error)}. Has the 0013 section of supabase-setup.sql been run?</p>}
      {runs.data && list.length === 0 && <p className="text-sm text-muted-foreground">No runs yet.</p>}
      <ul className="divide-y divide-border border border-border">
        {list.map((r) => (
          <li key={r.id} className="p-3 text-sm">
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
              <span className="font-semibold">{r.edition}</span>
              <span className="text-muted-foreground">{ago(r.started_at)}</span>
              <Badge variant={live(r) ? "default" : r.status === "failed" || (r.status === "running") ? "destructive" : "secondary"}>{live(r) ? "running" : r.status === "running" ? "stopped" : r.status}</Badge>
              <span className="text-muted-foreground">{r.made} made{r.failed ? `, ${r.failed} failed` : ""} of {r.planned}</span>
            </div>
            {r.items.length > 0 && (
              <ul className="mt-1 space-y-0.5 text-xs">
                {r.items.map((i, n) => <li key={n} className={i.state === "failed" ? "text-destructive" : "text-muted-foreground"}>{i.state === "done" ? "✓" : "✗"} {i.title}{i.note ? `: ${i.note}` : ""}</li>)}
              </ul>
            )}
          </li>
        ))}
      </ul>
    </Section>
  );
}
