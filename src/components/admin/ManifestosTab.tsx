import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { ExternalLink, Pencil, Plus, Trash2, X } from "lucide-react";
import { deleteEntry, listEntries, saveEntry } from "@/lib/manage.functions";
import { COUNTIES, OFFICES, REGION_LABEL, type Office } from "@/lib/offices";
import { PILLAR_LABELS, PILLAR_LEVELS, type PillarLevel } from "@/lib/manifestos";
import { parsePillars, parseSources } from "@/lib/entries";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Field, Section, lines, useAction } from "./shared";

type Entry = Awaited<ReturnType<typeof listEntries>>[number];
type Src = { title: string; publisher: string; date: string; url: string; kind: "Candidate or party" | "Independent reporting" };
type Draft = {
  id?: string; name: string; slug: string; office: Office; region: string; affiliation: string; status: "Declared intent" | "Prospective";
  status_note: string; evidence_state: "Partial evidence" | "Not yet assessed"; overview: string; priorities: string; gaps: string;
  pillars: { label: (typeof PILLAR_LABELS)[number]; level: PillarLevel; note: string }[]; sources: Src[]; published: boolean; reviewed_at: string;
};

const slugify = (v: string) => v.toLowerCase().replace(/[’']/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
const blankPillars = () => PILLAR_LABELS.map((label) => ({ label, level: "Under review" as PillarLevel, note: "" }));
const blank = (office: Office): Draft => ({
  name: "", slug: "", office, region: "", affiliation: "", status: "Prospective", status_note: "", evidence_state: "Not yet assessed",
  overview: "", priorities: "", gaps: "", pillars: blankPillars(), sources: [], published: false, reviewed_at: new Date().toISOString().slice(0, 10),
});
const toDraft = (e: Entry): Draft => ({
  id: e.id, name: e.name, slug: e.slug, office: (OFFICES.find((o) => o === e.office) ?? "Governor") as Office, region: e.region ?? "", affiliation: e.affiliation ?? "",
  status: e.status === "Declared intent" ? "Declared intent" : "Prospective", status_note: e.status_note ?? "",
  evidence_state: e.evidence_state === "Partial evidence" ? "Partial evidence" : "Not yet assessed", overview: e.overview,
  priorities: e.priorities.join("\n"), gaps: e.gaps.join("\n"),
  pillars: parsePillars(e.pillars).map((p) => ({ label: p.label as Draft["pillars"][number]["label"], level: p.level, note: p.note === "Not yet reviewed." ? "" : p.note })),
  sources: parseSources(e.sources), published: e.published, reviewed_at: e.reviewed_at ?? "",
});

export function ManifestosTab({ canPublish }: { canPublish: boolean }) {
  const q = useQuery({ queryKey: ["entries-admin"], queryFn: () => listEntries() });
  const [draft, setDraft] = useState<Draft | null>(null);
  const [office, setOffice] = useState<Office>("Governor");
  const save = useAction(saveEntry, "Profile saved", ["entries-admin", "entries"]);
  const remove = useAction(deleteEntry, "Profile deleted", ["entries-admin", "entries"]);

  const submit = () => {
    if (!draft) return;
    const { priorities, gaps, ...rest } = draft;
    save.mutate(
      { ...rest, priorities: lines(priorities), gaps: lines(gaps), reviewed_at: rest.reviewed_at || null },
      { onSuccess: () => setDraft(null) },
    );
  };

  const all = q.data ?? [];
  const shown = all.filter((e) => e.office === office);
  const set = (patch: Partial<Draft>) => setDraft((d) => (d ? { ...d, ...patch } : d));

  return (
    <div className="space-y-6">
      <p className="border-l-4 border-primary pl-3 text-sm text-muted-foreground">
        Profiles follow the same neutral method for every office. A profile can only be published with at least one linked source, an overview and your review date.
        {!canPublish && " As a moderator you can prepare drafts; an editor or admin publishes them."}
      </p>

      <nav className="flex gap-2 overflow-x-auto pb-1" aria-label="Office">
        {OFFICES.map((o) => (
          <button key={o} onClick={() => setOffice(o)} className={`whitespace-nowrap border px-3 py-1.5 text-xs font-bold uppercase tracking-wide ${office === o ? "border-foreground bg-foreground text-background" : "border-border text-muted-foreground hover:border-foreground"}`}>
            {o} · {all.filter((e) => e.office === o).length}
          </button>
        ))}
      </nav>

      <Section title={`${office} profiles`} hint="Presidential profiles built into the site are read-only here; add extra presidential aspirants as new profiles."
        action={<Button className="rounded-none" onClick={() => setDraft(blank(office))}><Plus className="mr-1 h-4 w-4" />New profile</Button>}>
        {q.isLoading ? <p className="text-sm text-muted-foreground">Loading…</p> : shown.length === 0 ? <p className="text-sm text-muted-foreground">No {office} profiles yet.</p> : (
          <ul className="divide-y divide-border">
            {shown.map((e) => (
              <li key={e.id} className="flex flex-wrap items-center gap-3 py-3">
                <div className="min-w-0 flex-1">
                  <p className="font-semibold">{e.name} <span className="font-normal text-muted-foreground">· {e.affiliation || "no party"}{e.region ? ` · ${e.region}` : ""}</span></p>
                  <p className="text-xs text-muted-foreground">Updated {new Date(e.updated_at).toLocaleDateString()}</p>
                </div>
                <Badge variant={e.published ? "default" : "secondary"}>{e.published ? "Published" : "Draft"}</Badge>
                {e.published && <a href={`/manifestos/${e.slug}`} target="_blank" rel="noreferrer" aria-label="View public page" className="text-muted-foreground hover:text-primary"><ExternalLink className="h-4 w-4" /></a>}
                <Button variant="ghost" size="icon" aria-label="Edit" disabled={e.published && !canPublish} onClick={() => setDraft(toDraft(e))}><Pencil className="h-4 w-4" /></Button>
                {canPublish && <Button variant="ghost" size="icon" aria-label="Delete" onClick={() => { if (confirm(`Delete ${e.name}'s profile permanently?`)) remove.mutate({ id: e.id }); }}><Trash2 className="h-4 w-4 text-destructive" /></Button>}
              </li>
            ))}
          </ul>
        )}
      </Section>

      <Dialog open={!!draft} onOpenChange={(o) => { if (!o) setDraft(null); }}>
        <DialogContent className="max-h-[92vh] max-w-3xl overflow-y-auto rounded-none">
          <DialogHeader><DialogTitle>{draft?.id ? "Edit profile" : "New profile"}</DialogTitle></DialogHeader>
          {draft && (
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Full name"><Input className="rounded-none" value={draft.name} onChange={(e) => set({ name: e.target.value, ...(draft.id ? {} : { slug: slugify(e.target.value) }) })} /></Field>
              <Field label="Page address (slug)" hint="/manifestos/…"><Input className="rounded-none" value={draft.slug} onChange={(e) => set({ slug: slugify(e.target.value) })} /></Field>
              <Field label="Office">
                <Select value={draft.office} onValueChange={(v) => set({ office: v as Office, region: "" })}>
                  <SelectTrigger className="rounded-none"><SelectValue /></SelectTrigger>
                  <SelectContent>{OFFICES.map((o) => <SelectItem key={o} value={o}>{o}</SelectItem>)}</SelectContent>
                </Select>
              </Field>
              <Field label={REGION_LABEL[draft.office]} hint={draft.office === "Member of Parliament" ? "Constituency name" : undefined}>
                {["Governor", "Senator", "Woman Representative"].includes(draft.office) ? (
                  <Select value={draft.region || "none"} onValueChange={(v) => set({ region: v === "none" ? "" : v })}>
                    <SelectTrigger className="rounded-none"><SelectValue /></SelectTrigger>
                    <SelectContent><SelectItem value="none">Not set</SelectItem>{COUNTIES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
                  </Select>
                ) : draft.office === "President" ? <Input className="rounded-none" disabled value="Nationwide" /> : (
                  <Input className="rounded-none" value={draft.region} onChange={(e) => set({ region: e.target.value })} placeholder={draft.office === "MCA" ? "Ward, County" : "Constituency, County"} />
                )}
              </Field>
              <Field label="Party / affiliation"><Input className="rounded-none" value={draft.affiliation} onChange={(e) => set({ affiliation: e.target.value })} /></Field>
              <Field label="Status">
                <Select value={draft.status} onValueChange={(v) => set({ status: v as Draft["status"] })}>
                  <SelectTrigger className="rounded-none"><SelectValue /></SelectTrigger>
                  <SelectContent><SelectItem value="Declared intent">Declared intent (they said so)</SelectItem><SelectItem value="Prospective">Prospective (named by others)</SelectItem></SelectContent>
                </Select>
              </Field>
              <div className="sm:col-span-2"><Field label="Status note" hint="What is the evidence for this status, and is anything contested?"><Textarea className="rounded-none" value={draft.status_note} onChange={(e) => set({ status_note: e.target.value })} /></Field></div>
              <div className="sm:col-span-2"><Field label="Overview" hint="Neutral and factual. Describe what is published; never speculate."><Textarea className="min-h-28 rounded-none" value={draft.overview} onChange={(e) => set({ overview: e.target.value })} /></Field></div>
              <Field label="Published priorities (one per line)"><Textarea className="min-h-28 rounded-none" value={draft.priorities} onChange={(e) => set({ priorities: e.target.value })} /></Field>
              <Field label="Unanswered questions (one per line)"><Textarea className="min-h-28 rounded-none" value={draft.gaps} onChange={(e) => set({ gaps: e.target.value })} /></Field>

              <div className="sm:col-span-2">
                <p className="mb-2 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Evidence scorecard</p>
                <div className="space-y-2">
                  {draft.pillars.map((p, n) => (
                    <div key={p.label} className="grid gap-2 sm:grid-cols-[11rem_9.5rem_1fr] sm:items-center">
                      <span className="text-sm font-semibold">{p.label}</span>
                      <Select value={p.level} onValueChange={(v) => set({ pillars: draft.pillars.map((x, i) => (i === n ? { ...x, level: v as PillarLevel } : x)) })}>
                        <SelectTrigger className="rounded-none"><SelectValue /></SelectTrigger>
                        <SelectContent>{PILLAR_LEVELS.map((l) => <SelectItem key={l} value={l}>{l}</SelectItem>)}</SelectContent>
                      </Select>
                      <Input className="rounded-none" placeholder="Evidence note" value={p.note} onChange={(e) => set({ pillars: draft.pillars.map((x, i) => (i === n ? { ...x, note: e.target.value } : x)) })} />
                    </div>
                  ))}
                </div>
              </div>

              <div className="sm:col-span-2">
                <div className="mb-2 flex items-center justify-between">
                  <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Sources reviewed (required to publish)</p>
                  <Button type="button" size="sm" variant="outline" className="rounded-none" onClick={() => set({ sources: [...draft.sources, { title: "", publisher: "", date: "", url: "", kind: "Independent reporting" }] })}><Plus className="mr-1 h-3.5 w-3.5" />Add source</Button>
                </div>
                <div className="space-y-3">
                  {draft.sources.map((s, n) => {
                    const upd = (patch: Partial<Src>) => set({ sources: draft.sources.map((x, i) => (i === n ? { ...x, ...patch } : x)) });
                    return (
                      <div key={n} className="grid gap-2 border border-border p-2 sm:grid-cols-2">
                        <Input className="rounded-none" placeholder="Title" value={s.title} onChange={(e) => upd({ title: e.target.value })} />
                        <Input className="rounded-none" placeholder="https://link" value={s.url} onChange={(e) => upd({ url: e.target.value })} />
                        <Input className="rounded-none" placeholder="Publisher" value={s.publisher} onChange={(e) => upd({ publisher: e.target.value })} />
                        <div className="flex gap-2">
                          <Input className="rounded-none" placeholder="Date (e.g. 4 Oct 2026)" value={s.date} onChange={(e) => upd({ date: e.target.value })} />
                          <Select value={s.kind} onValueChange={(v) => upd({ kind: v as Src["kind"] })}>
                            <SelectTrigger className="w-44 rounded-none"><SelectValue /></SelectTrigger>
                            <SelectContent><SelectItem value="Independent reporting">Independent</SelectItem><SelectItem value="Candidate or party">Candidate or party</SelectItem></SelectContent>
                          </Select>
                          <Button type="button" variant="ghost" size="icon" aria-label="Remove source" onClick={() => set({ sources: draft.sources.filter((_, i) => i !== n) })}><X className="h-4 w-4" /></Button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              <Field label="Evidence state">
                <Select value={draft.evidence_state} onValueChange={(v) => set({ evidence_state: v as Draft["evidence_state"] })}>
                  <SelectTrigger className="rounded-none"><SelectValue /></SelectTrigger>
                  <SelectContent><SelectItem value="Not yet assessed">Not yet assessed</SelectItem><SelectItem value="Partial evidence">Partial evidence</SelectItem></SelectContent>
                </Select>
              </Field>
              <Field label="Reviewed on"><Input type="date" className="rounded-none" value={draft.reviewed_at} onChange={(e) => set({ reviewed_at: e.target.value })} /></Field>
              <label className="flex items-center gap-2 text-sm font-semibold sm:col-span-2">
                <Switch checked={draft.published} disabled={!canPublish} onCheckedChange={(v) => set({ published: v })} />
                Published (visible to the public){!canPublish && <span className="font-normal text-muted-foreground"> — editors and admins only</span>}
              </label>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" className="rounded-none" onClick={() => setDraft(null)}>Cancel</Button>
            <Button className="rounded-none" disabled={save.isPending || !draft?.name.trim() || !draft?.slug} onClick={submit}>{save.isPending ? "Saving…" : draft?.published ? "Save and publish" : "Save draft"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
