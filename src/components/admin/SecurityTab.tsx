import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { listSecurityEvents } from "@/lib/manage.functions";
import { getAlertStatus, sendTestAlert } from "@/lib/security.functions";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Section, errMsg } from "./shared";

function Dot({ on }: { on: boolean }) { return <span className={`inline-block h-2.5 w-2.5 rounded-full ${on ? "bg-secondary" : "bg-muted-foreground/40"}`} aria-hidden />; }

function AlertChannels() {
  const q = useQuery({ queryKey: ["alert-status"], queryFn: () => getAlertStatus() });
  const [busy, setBusy] = useState(false);
  const s = q.data;
  const test = async () => {
    setBusy(true);
    try {
      const r = await sendTestAlert();
      if (r.skipped) toast.error(`Nothing sent: ${r.skipped}.`);
      else if (r.failed.length) toast.error(`Sent via ${r.sent.join(", ") || "nothing"}. Failed: ${r.failed.join(" | ")}`);
      else toast.success(`Test alert sent via ${r.sent.join(", ")}.`);
    } catch (e) { toast.error(errMsg(e)); } finally { setBusy(false); }
  };
  if (!s) return <p className="text-sm text-muted-foreground">Loading…</p>;
  const none = !s.email.ready && !s.sms.ready && !s.telegram.ready;
  return (
    <div className="space-y-3 text-sm">
      <ul className="grid gap-2 sm:grid-cols-3">
        <li className="border border-border p-3"><p className="flex items-center gap-2 font-semibold"><Dot on={s.email.ready} />Email</p><p className="mt-1 text-xs text-muted-foreground">{s.email.ready ? s.email.to.join(", ") : "Not set up"}</p></li>
        <li className="border border-border p-3"><p className="flex items-center gap-2 font-semibold"><Dot on={s.sms.ready} />SMS{s.sms.ready && !s.sms.live ? " (sandbox)" : ""}</p><p className="mt-1 text-xs text-muted-foreground">{s.sms.ready ? s.sms.to.join(", ") : "Not set up"}</p></li>
        <li className="border border-border p-3"><p className="flex items-center gap-2 font-semibold"><Dot on={s.telegram.ready} />Telegram</p><p className="mt-1 text-xs text-muted-foreground">{s.telegram.ready ? "Connected" : "Not set up"}</p></li>
      </ul>
      <p className="text-xs text-muted-foreground">Warnings (repeated failed sign-ins, role changes) go to email and Telegram. Critical alerts (a new admin, a two-factor device removed, a sustained password attack) also go by SMS.</p>
      {none && <p role="alert" className="border-l-4 border-primary pl-3">No alert channel is set up, so nobody is notified. Add the settings listed in SETUP.md to the server environment, restart, and test.</p>}
      <Button variant="outline" className="rounded-none" disabled={busy || none} onClick={() => void test()}>{busy ? "Sending…" : "Send a test alert"}</Button>
    </div>
  );
}

export function SecurityTab() {
  const q = useQuery({ queryKey: ["security"], queryFn: () => listSecurityEvents(), refetchInterval: 60_000 });
  const rows = q.data ?? [];
  const failed = rows.filter((r) => r.type === "failed_login" && Date.now() - Date.parse(r.created_at) < 3600_000).length;
  return (
    <div className="space-y-6">
      {failed >= 5 && <div role="alert" className="border-2 border-primary bg-primary/10 p-3 text-sm font-semibold">{failed} failed sign-in attempts in the last hour. Someone may be guessing passwords.</div>}
      <Section title="Alert notifications" hint="Who is told, and how, when something suspicious happens."><AlertChannels /></Section>
      <Section title="Security and audit log" hint="Sign-in failures, role changes and every change made in this admin area. Newest first.">
        {q.isLoading ? <p className="text-sm text-muted-foreground">Loading…</p> : rows.length === 0 ? <p className="text-sm text-muted-foreground">Nothing recorded yet.</p> : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr className="border-b text-left text-[11px] uppercase tracking-wider text-muted-foreground"><th className="py-2">When</th><th>Level</th><th>Event</th><th>Detail</th></tr></thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id} className="border-b border-border/60 align-top">
                    <td className="whitespace-nowrap py-2 text-xs text-muted-foreground">{new Date(r.created_at).toLocaleString()}</td>
                    <td><Badge variant={r.severity === "warning" ? "destructive" : "secondary"}>{r.severity}</Badge></td>
                    <td className="font-medium">{r.type}</td>
                    <td className="max-w-md break-words text-muted-foreground">{r.detail}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Section>
    </div>
  );
}
