import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { Lock, UserMinus } from "lucide-react";
import { grantRole, listStaffRegions, listTeam, revokeRole, setStaffRegions } from "@/lib/admin.functions";
import { EDITIONS, editionOf } from "@/lib/editions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Field, Section, errMsg } from "./shared";
import { useQueryClient } from "@tanstack/react-query";

const ROLE_INFO = [
  ["Admin", "Everything: team, security log, ads, settings, publishing. Cannot be removed from this page."],
  ["Editor", "Analytics, ads, banner, content rules and the social board for the regions they are given, plus manifesto publishing. With the \"All regions\" access they also manage site-wide settings."],
  ["Moderator", "Analytics, content rules for their regions, and manifesto drafts (an editor publishes)."],
];

export function TeamTab() {
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ["team"], queryFn: () => listTeam() });
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<"admin" | "editor" | "moderator">("editor");
  const [busy, setBusy] = useState(false);
  const [understood, setUnderstood] = useState(false);
  const regionsQ = useQuery({ queryKey: ["staff-regions"], queryFn: () => listStaffRegions() });
  const [editing, setEditing] = useState<{ userId: string; picked: string[] } | null>(null);
  const saveRegions = async () => {
    if (!editing) return;
    try {
      const r = await setStaffRegions({ data: { userId: editing.userId, editions: editing.picked } });
      if (r.ok) { toast.success(r.message); setEditing(null); await qc.invalidateQueries({ queryKey: ["staff-regions"] }); } else toast.error(r.message);
    } catch (e) { toast.error(errMsg(e)); }
  };

  const grant = async () => {
    setBusy(true);
    try {
      const r = await grantRole({ data: { email: email.trim(), role } });
      if (r.ok) { toast.success(r.message); setEmail(""); setUnderstood(false); await qc.invalidateQueries({ queryKey: ["team"] }); } else toast.error(r.message);
    } catch (e) { toast.error(errMsg(e)); } finally { setBusy(false); }
  };
  const revoke = async (userId: string, r: "admin" | "editor" | "moderator") => {
    try {
      const res = await revokeRole({ data: { userId, role: r } });
      if (res.ok) { toast.success(res.message); await qc.invalidateQueries({ queryKey: ["team"] }); } else toast.error(res.message);
    } catch (e) { toast.error(errMsg(e)); }
  };

  return (
    <div className="space-y-6">
      <Section title="Add a team member" hint="They must first create an account on the staff sign-in page, then you grant a role here.">
        <div className="flex flex-wrap items-end gap-3">
          <div className="min-w-64 flex-1"><Field label="Their email"><Input type="email" className="rounded-none" value={email} onChange={(e) => setEmail(e.target.value)} /></Field></div>
          <Field label="Role">
            <Select value={role} onValueChange={(v) => setRole(v as typeof role)}>
              <SelectTrigger className="w-40 rounded-none"><SelectValue /></SelectTrigger>
              <SelectContent><SelectItem value="admin">Admin</SelectItem><SelectItem value="editor">Editor</SelectItem><SelectItem value="moderator">Moderator</SelectItem></SelectContent>
            </Select>
          </Field>
          <Button className="rounded-none" disabled={busy || !email.includes("@") || (role === "admin" && !understood)} onClick={() => void grant()}>Grant access</Button>
        </div>
        {role === "admin" && (
          <label className="mt-3 flex items-start gap-2 border-l-4 border-primary pl-3 text-sm">
            <input type="checkbox" className="mt-1" checked={understood} onChange={(e) => setUnderstood(e.target.checked)} />
            <span>I understand an admin has full control and <strong>cannot be removed from this page</strong>. Only add people you fully trust. Everyone on the alert list is notified.</span>
          </label>
        )}
        <p className="mt-3 text-xs text-muted-foreground">Changing the team needs a session verified with your authenticator app, and every change is logged and alerted.</p>
        <ul className="mt-4 space-y-1 text-xs text-muted-foreground">{ROLE_INFO.map(([n, d]) => <li key={n}><strong className="text-foreground">{n}:</strong> {d}</li>)}</ul>
      </Section>
      <Section title="Team" hint="Editors and moderators manage only the regions listed here. With none, they can sign in but cannot change anything.">
        {q.isLoading ? <p className="text-sm text-muted-foreground">Loading…</p> : (
          <ul className="divide-y divide-border">
            {(q.data ?? []).map((m) => (
              <li key={`${m.userId}-${m.role}`} className="flex items-center gap-3 py-2 text-sm">
                <span className="flex-1 truncate">{m.email}</span><Badge variant="secondary" className="capitalize">{m.role}</Badge>
                {m.role !== "admin" && (() => {
                  const mine = regionsQ.data?.[m.userId] ?? [];
                  const open = editing?.userId === m.userId;
                  return (
                    <span className="flex flex-wrap items-center gap-1.5 text-xs">
                      {open ? (
                        <span className="flex flex-wrap items-center gap-x-3 gap-y-1 border border-border p-2">
                          {["*", ...EDITIONS.map((e) => e.code)].map((c) => (
                            <label key={c} className="flex items-center gap-1">
                              <input type="checkbox" checked={editing.picked.includes(c)} onChange={(ev) => setEditing({ ...editing, picked: ev.target.checked ? [...editing.picked, c] : editing.picked.filter((x) => x !== c) })} />
                              {c === "*" ? "All regions" : `${editionOf(c).flag} ${editionOf(c).name}`}
                            </label>
                          ))}
                          <Button size="sm" className="rounded-none" onClick={() => void saveRegions()}>Save</Button>
                          <Button size="sm" variant="ghost" className="rounded-none" onClick={() => setEditing(null)}>Cancel</Button>
                        </span>
                      ) : (
                        <>
                          {mine.length === 0 ? <span className="font-semibold text-destructive">No regions yet</span> : mine.map((c) => <Badge key={c} variant="outline">{c === "*" ? "All regions" : editionOf(c).name}</Badge>)}
                          <Button size="sm" variant="outline" className="rounded-none" onClick={() => setEditing({ userId: m.userId, picked: mine })}>Edit regions</Button>
                        </>
                      )}
                    </span>
                  );
                })()}
                {m.role === "admin" ? (
                  <span className="inline-flex items-center gap-1 text-xs text-muted-foreground" title="Admin access is protected and cannot be removed from this page"><Lock className="h-3.5 w-3.5" />Protected</span>
                ) : (
                  <Button variant="ghost" size="icon" aria-label={`Remove ${m.role} from ${m.email}`} onClick={() => { if (confirm(`Remove ${m.role} access for ${m.email}?`)) void revoke(m.userId, m.role as "admin" | "editor" | "moderator"); }}><UserMinus className="h-4 w-4 text-destructive" /></Button>
                )}
              </li>
            ))}
          </ul>
        )}
      </Section>
    </div>
  );
}
