import { useCallback, useEffect, useState, type ReactNode } from "react";
import { toast } from "sonner";
import { ShieldCheck } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { reportMfaChange } from "@/lib/security.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Section, errMsg } from "./shared";

/** Set VITE_REQUIRE_MFA=false only while first setting things up. */
export const MFA_REQUIRED = (import.meta.env["VITE_REQUIRE_MFA"] as string | undefined) !== "false";

type Factor = { id: string; friendly_name?: string | undefined; created_at: string };

async function verifiedFactors(): Promise<Factor[]> {
  const { data } = await supabase.auth.mfa.listFactors();
  return (data?.totp ?? []) as Factor[];
}

/** Adds a new authenticator app. Shows a QR code, then asks for the first 6-digit code to prove it works. */
export function EnrollTotp({ isFirst, onDone, onCancel }: { isFirst: boolean; onDone: () => void; onCancel?: () => void }) {
  const [setup, setSetup] = useState<{ id: string; qr: string; secret: string } | null>(null);
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const start = useCallback(async () => {
    setError("");
    // Remove any half-finished attempts so a new one can start cleanly.
    const { data: all } = await supabase.auth.mfa.listFactors();
    for (const f of all?.all ?? []) if (f.status === "unverified") await supabase.auth.mfa.unenroll({ factorId: f.id });
    const { data, error: e } = await supabase.auth.mfa.enroll({ factorType: "totp", friendlyName: `Authenticator ${new Date().toISOString().slice(0, 16).replace("T", " ")}`, issuer: "Brief" });
    if (e || !data) { setError(e?.message ?? "Could not start setup."); return; }
    setSetup({ id: data.id, qr: data.totp.qr_code, secret: data.totp.secret });
  }, []);

  useEffect(() => { void start(); }, [start]);

  const verify = async () => {
    if (!setup) return;
    setBusy(true); setError("");
    const { error: e } = await supabase.auth.mfa.challengeAndVerify({ factorId: setup.id, code: code.replace(/\s/g, "") });
    setBusy(false);
    if (e) { setError("That code isn't right. Check the code in your app and try again."); return; }
    if (!isFirst) void reportMfaChange({ data: { action: "added" } }).catch(() => {});
    toast.success("Two-factor sign-in is on");
    onDone();
  };

  const notEnabled = /not enabled|disabled|not supported|MFA/i.test(error) && !setup;
  return (
    <div className="space-y-4">
      {error && !setup && (
        <div role="alert" className="border-l-4 border-primary pl-3 text-sm">
          <p className="font-semibold">{error}</p>
          {notEnabled && <p className="mt-1 text-muted-foreground">Two-factor sign-in may not be switched on for this project. In Supabase open Authentication, then Multi-Factor, and enable TOTP.</p>}
        </div>
      )}
      {setup && (
        <div className="grid gap-4 sm:grid-cols-[auto_1fr] sm:items-start">
          <img src={setup.qr} alt="QR code to add Brief to your authenticator app" className="h-44 w-44 border border-border bg-white p-2" />
          <div className="space-y-3 text-sm">
            <ol className="list-decimal space-y-1 pl-5">
              <li>Install an authenticator app (Google Authenticator, Microsoft Authenticator, Authy…).</li>
              <li>Scan the QR code, or type this key in by hand:</li>
            </ol>
            <code className="block break-all bg-muted px-2 py-1 text-xs">{setup.secret}</code>
            <label className="block"><span className="mb-1 block text-[11px] font-bold uppercase tracking-wider text-muted-foreground">6-digit code from the app</span>
              <Input inputMode="numeric" autoComplete="one-time-code" maxLength={7} className="w-40 rounded-none text-center text-lg tracking-widest" value={code} onChange={(e) => setCode(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") void verify(); }} /></label>
            {error && <p role="alert" className="font-semibold text-primary">{error}</p>}
            <div className="flex gap-2">
              <Button className="rounded-none" disabled={busy || code.replace(/\s/g, "").length < 6} onClick={() => void verify()}>{busy ? "Checking…" : "Turn on two-factor"}</Button>
              {onCancel && <Button variant="outline" className="rounded-none" onClick={onCancel}>Cancel</Button>}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Challenge({ onDone }: { onDone: () => void }) {
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const submit = async () => {
    setBusy(true); setError("");
    const factors = await verifiedFactors();
    const f = factors[0];
    if (!f) { setBusy(false); setError("No authenticator found on this account."); return; }
    const { error: e } = await supabase.auth.mfa.challengeAndVerify({ factorId: f.id, code: code.replace(/\s/g, "") });
    setBusy(false);
    if (e) { setError("That code isn't right or has expired. Wait for the next code and try again."); return; }
    onDone();
  };
  return (
    <div className="mx-auto max-w-sm space-y-4 text-center">
      <ShieldCheck className="mx-auto h-10 w-10 text-primary" />
      <h2 className="text-2xl font-black" style={{ fontFamily: "'Fraunces', serif" }}>Enter your code</h2>
      <p className="text-sm text-muted-foreground">Open your authenticator app and type the 6-digit code for Brief.</p>
      <Input autoFocus inputMode="numeric" autoComplete="one-time-code" maxLength={7} className="mx-auto w-44 rounded-none text-center text-2xl tracking-widest" value={code} onChange={(e) => setCode(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") void submit(); }} />
      {error && <p role="alert" className="text-sm font-semibold text-primary">{error}</p>}
      <Button className="w-full rounded-none" disabled={busy || code.replace(/\s/g, "").length < 6} onClick={() => void submit()}>{busy ? "Checking…" : "Verify"}</Button>
      <button className="text-xs text-muted-foreground underline" onClick={() => void supabase.auth.signOut()}>Sign out</button>
    </div>
  );
}

/** Blocks the admin area until the staff member has proven a second factor this session. */
export function MfaGate({ children }: { children: ReactNode }) {
  const [state, setState] = useState<"loading" | "enroll" | "challenge" | "ok">("loading");
  const check = useCallback(async () => {
    const { data, error } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
    if (error || !data) { setState("enroll"); return; }
    if (data.currentLevel === "aal2") setState("ok");
    else if (data.nextLevel === "aal2") setState("challenge");
    else setState("enroll");
  }, []);
  useEffect(() => { if (MFA_REQUIRED) void check(); }, [check]);

  if (!MFA_REQUIRED) return <>{children}</>;
  if (state === "loading") return <p className="py-24 text-center text-muted-foreground">Checking your sign-in…</p>;
  if (state === "ok") return <>{children}</>;
  return (
    <main className="mx-auto max-w-2xl px-4 py-16">
      {state === "challenge" ? <Challenge onDone={() => void check()} /> : (
        <>
          <h1 className="text-3xl font-black" style={{ fontFamily: "'Fraunces', serif" }}>Secure your account</h1>
          <p className="mt-2 mb-6 text-sm text-muted-foreground">Staff accounts can change what thousands of readers see, so each one needs a second step at sign-in. It takes about a minute, and you only set it up once.</p>
          <EnrollTotp isFirst onDone={() => void check()} />
        </>
      )}
    </main>
  );
}

/** "My security" tab: see, add and remove authenticator devices. */
export function AccountSecurity() {
  const [factors, setFactors] = useState<Factor[] | null>(null);
  const [adding, setAdding] = useState(false);
  const load = useCallback(async () => setFactors(await verifiedFactors()), []);
  useEffect(() => { void load(); }, [load]);

  const remove = async (f: Factor) => {
    if ((factors?.length ?? 0) <= 1) { toast.error("Add a second device before removing your only one, or you could be locked out."); return; }
    if (!confirm("Remove this authenticator device? Anyone using it will no longer be able to sign in with it.")) return;
    const { error } = await supabase.auth.mfa.unenroll({ factorId: f.id });
    if (error) { toast.error(errMsg(error)); return; }
    void reportMfaChange({ data: { action: "removed" } }).catch(() => {});
    toast.success("Device removed");
    await load();
  };

  return (
    <div className="space-y-6">
      <Section title="Two-factor sign-in" hint="Each time you sign in you need your password (or Google) and a code from your authenticator app.">
        {factors === null ? <p className="text-sm text-muted-foreground">Loading…</p> : (
          <ul className="divide-y divide-border">
            {factors.map((f) => (
              <li key={f.id} className="flex items-center gap-3 py-3 text-sm">
                <ShieldCheck className="h-5 w-5 text-secondary" />
                <span className="flex-1">{f.friendly_name ?? "Authenticator"}<span className="block text-xs text-muted-foreground">Added {new Date(f.created_at).toLocaleDateString("en-GB")}</span></span>
                <Button variant="outline" size="sm" className="rounded-none" onClick={() => void remove(f)}>Remove</Button>
              </li>
            ))}
          </ul>
        )}
        {!adding ? <Button className="mt-4 rounded-none" variant="outline" onClick={() => setAdding(true)}>Add a backup device</Button>
          : <div className="mt-4 border-t border-border pt-4"><EnrollTotp isFirst={false} onCancel={() => setAdding(false)} onDone={() => { setAdding(false); void load(); }} /></div>}
        <p className="mt-4 text-xs text-muted-foreground">There are no recovery codes, so add a second device (for example a spare phone) as a backup. If you lose every device, someone with database access has to reset it for you.</p>
      </Section>
    </div>
  );
}
