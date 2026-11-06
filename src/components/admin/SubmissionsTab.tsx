import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { ExternalLink, Mail, MessageCircle, Trash2 } from "lucide-react";
import { approveSubmission, deleteSubmission, listSubmissions, reviewSubmission, type Submission } from "@/lib/submissions.functions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Section, useAction } from "./shared";

const FILTERS = [["pending", "New"], ["needs_info", "Waiting on them"], ["approved", "Draft created"], ["rejected", "Declined"]] as const;
const tone = (s: Submission["status"]) => (s === "pending" ? "default" : s === "approved" ? "secondary" : "outline");

function Row({ label, value }: { label: string; value: string | null | undefined }) {
  if (!value) return null;
  return <div><p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">{label}</p><p className="mt-0.5 whitespace-pre-line text-sm">{value}</p></div>;
}

export function SubmissionsTab({ canDelete }: { canDelete: boolean }) {
  const q = useQuery({ queryKey: ["submissions"], queryFn: () => listSubmissions() });
  const [filter, setFilter] = useState<Submission["status"]>("pending");
  const [open, setOpen] = useState<Submission | null>(null);
  const [notes, setNotes] = useState("");
  const keys = ["submissions", "entries-admin"];
  const review = useAction(reviewSubmission, "Updated", keys);
  const approve = useAction(approveSubmission, "Draft profile created. Open the Manifestos tab to verify, edit and publish it.", keys);
  const remove = useAction(deleteSubmission, "Submission deleted", keys);

  const all = q.data ?? [];
  const shown = all.filter((s) => s.status === filter);
  const close = () => { setOpen(null); setNotes(""); };

  return (
    <div className="space-y-6">
      <p className="border-l-4 border-primary pl-3 text-sm text-muted-foreground">
        Submissions come from the public form at <a className="underline" href="/manifestos/submit" target="_blank" rel="noreferrer">/manifestos/submit</a>. Before approving: confirm the sender really represents the candidate (reply to their email or phone), and open each source link. Approving only creates a <strong>draft</strong>; nothing is public until an editor publishes it.
      </p>
      <nav className="flex flex-wrap gap-2">
        {FILTERS.map(([id, label]) => (
          <button key={id} onClick={() => setFilter(id)} className={`border px-3 py-1.5 text-xs font-bold uppercase tracking-wide ${filter === id ? "border-foreground bg-foreground text-background" : "border-border text-muted-foreground hover:border-foreground"}`}>
            {label} · {all.filter((s) => s.status === id).length}
          </button>
        ))}
      </nav>
      <Section title={FILTERS.find((f) => f[0] === filter)?.[1] ?? ""}>
        {q.isLoading ? <p className="text-sm text-muted-foreground">Loading…</p> : shown.length === 0 ? <p className="text-sm text-muted-foreground">Nothing here.</p> : (
          <ul className="divide-y divide-border">
            {shown.map((s) => (
              <li key={s.id} className="flex flex-wrap items-center gap-3 py-3">
                <div className="min-w-0 flex-1">
                  <p className="font-semibold">{s.name} <span className="font-normal text-muted-foreground">· {s.office}{s.region ? ` · ${s.region}` : ""}{s.affiliation ? ` · ${s.affiliation}` : ""}</span></p>
                  <p className="text-xs text-muted-foreground">From {s.contact_name}{s.contact_role ? ` (${s.contact_role})` : ""} · {new Date(s.created_at).toLocaleString()} · {s.sources.length} source{s.sources.length === 1 ? "" : "s"}</p>
                </div>
                <Badge variant={tone(s.status)}>{s.status.replace("_", " ")}</Badge>
                <Button variant="outline" className="rounded-none" onClick={() => { setOpen(s); setNotes(s.review_notes ?? ""); }}>Review</Button>
              </li>
            ))}
          </ul>
        )}
      </Section>

      <Dialog open={!!open} onOpenChange={(o) => { if (!o) close(); }}>
        <DialogContent className="max-h-[92vh] max-w-3xl overflow-y-auto rounded-none">
          <DialogHeader><DialogTitle>{open?.name} · {open?.office}{open?.region ? ` · ${open.region}` : ""}</DialogTitle></DialogHeader>
          {open && (
            <div className="space-y-5">
              <div className="border border-border p-3">
                <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Contact (private)</p>
                <p className="mt-1 text-sm font-semibold">{open.contact_name}{open.contact_role ? ` · ${open.contact_role}` : ""}</p>
                <div className="mt-2 flex flex-wrap gap-3 text-sm">
                  <a className="inline-flex items-center gap-1 underline" href={`mailto:${open.contact_email}?subject=${encodeURIComponent("Your Brief manifesto submission")}`}><Mail className="h-4 w-4" />{open.contact_email}</a>
                  {open.contact_phone && <a className="inline-flex items-center gap-1 underline" href={`https://wa.me/${open.contact_phone.replace(/[^\d]/g, "")}`} target="_blank" rel="noreferrer"><MessageCircle className="h-4 w-4" />{open.contact_phone}</a>}
                </div>
              </div>
              <Row label="Party / affiliation" value={open.affiliation} />
              <Row label="Overview" value={open.overview} />
              <Row label="Priorities" value={open.priorities.join(" · ")} />
              <Row label="Key pledges" value={open.pledges} />
              <Row label="How it will be paid for" value={open.costing} />
              <Row label="How and when it will be delivered" value={open.delivery} />
              <Row label="Track record claimed" value={open.track_record} />
              <div>
                <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Sources they supplied (open and check each one)</p>
                <ul className="mt-1 space-y-1 text-sm">
                  {open.sources.map((x) => <li key={x.url}><a className="inline-flex items-center gap-1 underline" href={x.url} target="_blank" rel="noreferrer noopener">{x.title}<ExternalLink className="h-3.5 w-3.5" /></a><span className="text-muted-foreground"> · {[x.publisher, x.date].filter(Boolean).join(" · ")}</span></li>)}
                </ul>
              </div>
              <div>
                <p className="mb-1 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Internal notes</p>
                <Textarea className="rounded-none" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="What you checked, what you asked them…" />
              </div>
            </div>
          )}
          <DialogFooter className="flex-wrap gap-2 sm:justify-between">
            <div className="flex gap-2">
              {canDelete && open && <Button variant="ghost" className="rounded-none text-destructive" onClick={() => { if (confirm("Delete this submission permanently?")) remove.mutate({ id: open.id }, { onSuccess: close }); }}><Trash2 className="mr-1 h-4 w-4" />Delete</Button>}
            </div>
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" className="rounded-none" disabled={review.isPending || !open} onClick={() => open && review.mutate({ id: open.id, status: "rejected", notes }, { onSuccess: close })}>Decline</Button>
              <Button variant="outline" className="rounded-none" disabled={review.isPending || !open} onClick={() => open && review.mutate({ id: open.id, status: "needs_info", notes }, { onSuccess: close })}>Need more info</Button>
              <Button className="rounded-none" disabled={approve.isPending || !open || open.status === "approved"} onClick={() => open && approve.mutate({ id: open.id }, { onSuccess: close })}>Create draft profile</Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
