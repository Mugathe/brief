import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { Pencil, Plus, Trash2, X } from "lucide-react";
import {
  addStopwords, archiveNow, deleteTrail, deleteTrailEvent, getArchiveStatus, importTrailEvents, listStopwords, listTrailsAdmin,
  previewQuery, removeStopword, saveTrail, saveTrailEvent, type AdminTrail,
} from "@/lib/history.functions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Field, Section, errMsg, useAction } from "./shared";
import { ResearchPanel } from "./ResearchPanel";
import { SocialPanel } from "./SocialPanel";
import { manageAll, type Access } from "@/lib/regions";
import { EDITIONS, editionOf } from "@/lib/editions";

type Draft = { id?: string; slug: string; title: string; description: string; query: string; since: string; published: boolean; edition: string | null };
const blank: Draft = { slug: "", title: "", description: "", query: "", since: "", published: false, edition: null };
const slugify = (v: string) => v.toLowerCase().replace(/[’']/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 60);
const day = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" }) : "—");

const OLD_LOVABLE_PROJECT = "bqisgdtqmhhkqykostmc";

/** Says exactly what the server can see about the database settings, without revealing any secret. */
function KeyDiagnosis({ env }: { env: { urlSet: boolean; projectRef: string; keySet: boolean; keyKind: string | null; keyTest: { ok: boolean; status: number | null; message: string } | null } }) {
  const good = env.keySet && env.keyTest?.ok && (env.keyKind === "service_role" || env.keyKind === "secret");
  let problem = "";
  if (!env.urlSet) problem = "The server cannot see SUPABASE_URL.";
  else if (!env.keySet) problem = "The server cannot see SUPABASE_SERVICE_ROLE_KEY. Check that it is in the file named exactly .env in the project folder (not .env.example), that the name is spelled exactly like that with no spaces, and that you stopped and restarted npm run dev after saving. If you unzipped an update over your folder, check it did not replace your .env.";
  else if (env.keyKind === "same-as-public" || env.keyKind === "publishable") problem = "That is the public (anon / publishable) key. You need the secret one: in Supabase open Project Settings, then API, and copy the service_role key (or the secret key under the new API keys tab).";
  else if (env.keyKind === "wrong-role") problem = "That key is a JWT, but not the service_role one. Copy the key labelled service_role.";
  else if (env.keyTest && !env.keyTest.ok) problem = `The database rejected the key (${env.keyTest.status ?? "no connection"}: ${env.keyTest.message}). The key must come from the same Supabase project as SUPABASE_URL. Check both are from the project shown below.`;
  return (
    <div className="space-y-2 text-sm">
      <p className="text-xs text-muted-foreground">
        The server is using database project <code>{env.projectRef || "(none)"}</code>.
        {env.projectRef === OLD_LOVABLE_PROJECT && " That is the original Lovable Cloud project, not your own Supabase project. Update SUPABASE_URL and the keys in .env if you have moved."}
      </p>
      {good ? <p className="font-semibold text-secondary">The service key is set and the database accepts it.</p>
        : problem ? <p role="alert" className="border-l-4 border-primary pl-3"><strong>History is not being saved.</strong> {problem}</p> : null}
    </div>
  );
}

function SaveNow() {
  const run = useAction(archiveNow, "Headlines saved", ["archive-status"]);
  return (
    <div className="flex flex-wrap items-center gap-3">
      <Button variant="outline" className="rounded-none" disabled={run.isPending} onClick={() => run.mutate(undefined as never)}>{run.isPending ? "Saving…" : "Fetch and save headlines now"}</Button>
      <span className="text-xs text-muted-foreground">News feeds only hold recent items, so this fills Today and This week straight away. Longer periods fill in over time.</span>
    </div>
  );
}

function ArchiveStatus() {
  const q = useQuery({ queryKey: ["archive-status"], queryFn: () => getArchiveStatus(), refetchInterval: 60_000 });
  const s = q.data;
  if (!s) return <p className="text-sm text-muted-foreground">Loading…</p>;
  const origin = typeof window === "undefined" ? "https://your-site" : window.location.origin;
  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {[
          ["Stories on record", s.total === null ? "—" : s.total.toLocaleString()],
          ["Archive began", day(s.since)],
          ["Latest story", day(s.latest)],
          ["Last save", s.lastRun ? `${new Date(s.lastRun.at).toLocaleTimeString()} (${s.lastRun.sent})` : "not yet this session"],
        ].map(([k, v]) => <div key={k} className="border border-border p-3"><p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">{k}</p><p className="mt-1 font-bold">{v}</p></div>)}
      </div>
      {!s.tablesReady && <p role="alert" className="border-l-4 border-primary pl-3 text-sm font-semibold">The history tables don’t exist yet. Run the database setup SQL (see SETUP.md), then reload.</p>}
      <KeyDiagnosis env={s.env} />
      {s.writerConfigured && <SaveNow />}
      {s.writerConfigured && (
        <p className="text-sm text-muted-foreground">
          Headlines are saved whenever the site refreshes its news (every 5 minutes while anyone is visiting).{" "}
          {s.schedulerKeySet
            ? <>To keep history growing with no visitors, schedule a call every 20 minutes: <code className="break-all bg-muted px-1">curl -H "Authorization: Bearer $INGEST_KEY" {origin}/api/public/ingest</code></>
            : <>For uninterrupted history, set an <code>INGEST_KEY</code> (any long random text) on the server and have a free cron service call <code className="break-all bg-muted px-1">{origin}/api/public/ingest</code> with it every 20 minutes.</>}
        </p>
      )}
    </div>
  );
}

function Stopwords() {
  const q = useQuery({ queryKey: ["stopwords"], queryFn: () => listStopwords() });
  const add = useAction(addStopwords, "Words will now be ignored", ["stopwords"]);
  const remove = useAction(removeStopword, "Word is counted again", ["stopwords"]);
  const [text, setText] = useState("");
  const submit = () => {
    const words = [...new Set(text.split(/[\s,]+/).map((w) => w.trim().toLowerCase()).filter((w) => w.length >= 2))];
    if (words.length) add.mutate({ words }, { onSuccess: () => setText("") });
  };
  return (
    <div>
      <div className="flex gap-2">
        <Input className="rounded-none" value={text} onChange={(e) => setText(e.target.value)} placeholder="e.g. ruto, raila, live (separate with spaces or commas)" onKeyDown={(e) => { if (e.key === "Enter") submit(); }} />
        <Button className="rounded-none" disabled={add.isPending || !text.trim()} onClick={submit}>Ignore</Button>
      </div>
      <div className="mt-3 flex max-h-56 flex-wrap gap-1.5 overflow-y-auto">
        {(q.data ?? []).map((w) => (
          <span key={w} className="inline-flex items-center gap-1 border border-border px-2 py-0.5 text-xs">{w}
            <button aria-label={`Count ${w} again`} onClick={() => remove.mutate({ word: w })}><X className="h-3 w-3" /></button></span>
        ))}
      </div>
    </div>
  );
}

function TrailDialog({ trail, onClose, canEdit, access }: { trail: Draft | null; onClose: () => void; canEdit: boolean; access: Access }) {
  const q = useQuery({ queryKey: ["trails-admin"], queryFn: () => listTrailsAdmin() });
  const save = useAction(saveTrail, "Trail saved", ["trails-admin", "trail-list"]);
  const saveEv = useAction(saveTrailEvent, "Milestone saved", ["trails-admin"]);
  const delEv = useAction(deleteTrailEvent, "Milestone deleted", ["trails-admin"]);
  const imp = useAction(importTrailEvents, "Imported", ["trails-admin"]);
  const [d, setD] = useState<Draft | null>(trail);
  const [preview, setPreview] = useState<{ total: number; sample: { title: string; source: string }[] } | null>(null);
  const [ev, setEv] = useState({ event_date: "", title: "", summary: "", url: "", publisher: "" });
  const [bulk, setBulk] = useState("");
  const current: AdminTrail | undefined = q.data?.find((t) => t.id === d?.id);
  const set = (p: Partial<Draft>) => setD((x) => (x ? { ...x, ...p } : x));

  const runPreview = async () => {
    if (!d) return;
    try { setPreview(await previewQuery({ data: { query: d.query, since: d.since || null } })); } catch (e) { toast.error(errMsg(e)); }
  };

  return (
    <Dialog open={!!trail} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="max-h-[92vh] max-w-3xl overflow-y-auto rounded-none">
        <DialogHeader><DialogTitle>{d?.id ? "Edit trail" : "New trail"}</DialogTitle></DialogHeader>
        {d && (
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Title"><Input className="rounded-none" value={d.title} onChange={(e) => set({ title: e.target.value, ...(d.id ? {} : { slug: slugify(e.target.value) }) })} /></Field>
            <Field label="Page address" hint="/trails/…"><Input className="rounded-none" value={d.slug} onChange={(e) => set({ slug: slugify(e.target.value) })} /></Field>
            <div className="sm:col-span-2"><Field label="Description" hint="Neutral. Say what the trail covers, not what to think."><Textarea className="rounded-none" value={d.description} onChange={(e) => set({ description: e.target.value })} /></Field></div>
            <div className="sm:col-span-2">
              <Field label="What to follow (search)" hint={'Use OR between alternatives, "quotes" for exact phrases, - to exclude. Example: flood OR floods OR "el nino"'}>
                <div className="flex gap-2"><Input className="rounded-none" value={d.query} onChange={(e) => set({ query: e.target.value })} /><Button type="button" variant="outline" className="rounded-none" disabled={d.query.trim().length < 2} onClick={() => void runPreview()}>Test</Button></div>
              </Field>
              {preview && <div className="mt-2 border border-border p-2 text-sm"><strong>{preview.total.toLocaleString()}</strong> archived stories match.{preview.sample.map((s) => <p key={s.title} className="truncate text-xs text-muted-foreground">· {s.title} ({s.source})</p>)}</div>}
            </div>
            <Field label="Shown in" hint="Which edition's Trails page features this trail. Anyone can still open it by its address.">
              <select value={d.edition ?? ""} onChange={(e) => set({ edition: e.target.value || null })} className="h-10 w-full border border-input bg-background px-2 text-sm">
                {manageAll(access) && <option value="">Every edition</option>}
                {EDITIONS.filter((e) => manageAll(access) || access.regions.includes(e.code)).map((e) => <option key={e.code} value={e.code}>{e.flag} {e.name}</option>)}
              </select>
            </Field>
            <Field label="Only count stories from (optional)"><Input type="date" className="rounded-none" value={d.since} onChange={(e) => set({ since: e.target.value })} /></Field>
            <label className="flex items-center gap-2 pt-6 text-sm font-semibold"><Switch checked={d.published} onCheckedChange={(v) => set({ published: v })} />Published</label>
          </div>
        )}

        {d?.id && current && (
          <div className="mt-2 border-t border-border pt-4">
            <h3 className="text-sm font-bold uppercase tracking-wider">Editor’s milestones ({current.events.length})</h3>
            <p className="mt-1 text-xs text-muted-foreground">Add key moments from before the archive began. Each needs a link to a real source, so readers can check it. Only add what you have verified.</p>
            <ul className="mt-3 divide-y divide-border text-sm">
              {current.events.map((e) => (
                <li key={e.id} className="flex items-start gap-2 py-2">
                  <span className="w-24 shrink-0 text-xs text-muted-foreground">{e.event_date}</span>
                  <span className="min-w-0 flex-1"><span className="font-medium">{e.title}</span>{e.publisher && <span className="text-xs text-muted-foreground"> · {e.publisher}</span>}</span>
                  {canEdit && <button aria-label="Delete milestone" onClick={() => { if (confirm("Delete this milestone?")) delEv.mutate({ id: e.id }); }}><Trash2 className="h-4 w-4 text-destructive" /></button>}
                </li>
              ))}
            </ul>
            {canEdit && (
              <>
                <div className="mt-3 grid gap-2 sm:grid-cols-2">
                  <Input type="date" className="rounded-none" value={ev.event_date} onChange={(e) => setEv({ ...ev, event_date: e.target.value })} />
                  <Input className="rounded-none" placeholder="Title" value={ev.title} onChange={(e) => setEv({ ...ev, title: e.target.value })} />
                  <Input className="rounded-none" placeholder="Publisher / source name" value={ev.publisher} onChange={(e) => setEv({ ...ev, publisher: e.target.value })} />
                  <Input className="rounded-none" placeholder="https://link-to-source" value={ev.url} onChange={(e) => setEv({ ...ev, url: e.target.value })} />
                  <div className="sm:col-span-2"><Input className="rounded-none" placeholder="One-sentence summary (optional)" value={ev.summary} onChange={(e) => setEv({ ...ev, summary: e.target.value })} /></div>
                </div>
                <Button className="mt-2 rounded-none" size="sm" disabled={saveEv.isPending || !ev.event_date || !ev.title || !ev.url} onClick={() => d.id && saveEv.mutate({ ...ev, trail_id: d.id }, { onSuccess: () => setEv({ event_date: "", title: "", summary: "", url: "", publisher: "" }) })}><Plus className="mr-1 h-4 w-4" />Add milestone</Button>
                <details className="mt-4 text-sm"><summary className="cursor-pointer font-semibold">Add many at once</summary>
                  <p className="mt-2 text-xs text-muted-foreground">One per line: <code>2023-11-20 | Title | Publisher | https://link | optional summary</code></p>
                  <Textarea className="mt-2 min-h-28 rounded-none font-mono text-xs" value={bulk} onChange={(e) => setBulk(e.target.value)} />
                  <Button size="sm" variant="outline" className="mt-2 rounded-none" disabled={imp.isPending || !bulk.trim()} onClick={() => d.id && imp.mutate({ trailId: d.id, text: bulk }, { onSuccess: (r) => { if (r.errors.length) toast.error(r.errors.join(" · ")); else setBulk(""); if (r.added) toast.success(`${r.added} milestones added`); } })}>Import</Button>
                </details>
              </>
            )}
          </div>
        )}
        <DialogFooter>
          <Button variant="outline" className="rounded-none" onClick={onClose}>Close</Button>
          {canEdit && <Button className="rounded-none" disabled={save.isPending || !d || d.title.trim().length < 3 || d.query.trim().length < 2 || d.slug.length < 3}
            onClick={() => d && save.mutate({ ...(d.id ? { id: d.id } : {}), slug: d.slug, title: d.title, description: d.description, query: d.query, since: d.since || null, published: d.published }, { onSuccess: () => { if (!d.id) onClose(); } })}>{save.isPending ? "Saving…" : "Save trail"}</Button>}
        </DialogFooter>
        {!d?.id && <p className="text-xs text-muted-foreground">Save the trail first, then reopen it to add milestones.</p>}
      </DialogContent>
    </Dialog>
  );
}

export function HistoryTab({ canEdit, access, scope }: { canEdit: boolean; access: Access; scope: string }) {
  const q = useQuery({ queryKey: ["trails-admin"], queryFn: () => listTrailsAdmin() });
  const del = useAction(deleteTrail, "Trail deleted", ["trails-admin", "trail-list"]);
  const [open, setOpen] = useState<Draft | null>(null);
  return (
    <div className="space-y-6">
      <Section title="History archive" hint="Every headline the site sees is kept, so trends and trails can look back over weeks, months and years."><ArchiveStatus /></Section>
      <Section title="Trails" hint="Featured topics followed through time. Anyone can also trace their own topic from the public Trails page."
        action={canEdit ? <Button className="rounded-none" onClick={() => setOpen({ ...blank, edition: scope === "*" ? null : scope })}><Plus className="mr-1 h-4 w-4" />New trail</Button> : null}>
        {q.isLoading ? <p className="text-sm text-muted-foreground">Loading…</p> : !(q.data ?? []).length ? <p className="text-sm text-muted-foreground">No trails yet.</p> : (
          <ul className="divide-y divide-border">
            {(q.data ?? []).filter((t) => scope === "*" || t.edition === null || t.edition === scope).map((t) => (
              <li key={t.id} className="flex flex-wrap items-center gap-3 py-3">
                <div className="min-w-0 flex-1"><p className="font-semibold">{t.title}</p><p className="truncate text-xs text-muted-foreground">{t.query} · {t.events.length} milestones · {t.edition ? editionOf(t.edition).name : "every edition"}</p></div>
                <Badge variant={t.published ? "default" : "secondary"}>{t.published ? "Published" : "Draft"}</Badge>
                {t.published && <a className="text-xs underline" href={`/trails/${t.slug}`} target="_blank" rel="noreferrer">View</a>}
                <Button variant="ghost" size="icon" aria-label="Edit" onClick={() => setOpen({ id: t.id, slug: t.slug, title: t.title, description: t.description, query: t.query, since: t.since ?? "", published: t.published, edition: t.edition })}><Pencil className="h-4 w-4" /></Button>
                {canEdit && <Button variant="ghost" size="icon" aria-label="Delete" onClick={() => { if (confirm(`Delete the trail "${t.title}" and its milestones?`)) del.mutate({ id: t.id }); }}><Trash2 className="h-4 w-4 text-destructive" /></Button>}
              </li>
            ))}
          </ul>
        )}
      </Section>
      <Section title="AI research" hint="The agent searches the web for the history behind a topic. Every item must link to a page it really found. Review before trusting."><ResearchPanel canEdit={canEdit} scope={scope} /></Section>
      <Section title="Social media trends board" hint="What editors have spotted trending on X, TikTok, Instagram and other platforms."><SocialPanel canEdit={canEdit} access={access} scope={scope} /></Section>
      <Section title="Ignored words" hint="Words that are too common or too constant to count as trending (names that appear in every headline, filler words). Applies to Trending and to Trails’ related words."><Stopwords /></Section>
      {open && <TrailDialog key={open.id ?? "new"} trail={open} canEdit={canEdit} access={access} onClose={() => setOpen(null)} />}
    </div>
  );
}
