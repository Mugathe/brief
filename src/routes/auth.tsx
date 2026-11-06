import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { reportFailedLogin } from "@/lib/track.functions";
import { googleIsEnabled, takeAuthErrorFromUrl } from "@/lib/auth-errors";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export const Route = createFileRoute("/auth")({
  head: () => ({ meta: [{ title: "Staff sign-in — Brief" }, { name: "robots", content: "noindex,nofollow" }] }),
  component: AuthPage,
});

/** Set VITE_GOOGLE_SIGNIN=false to hide the Google button until it is configured. */
const SHOW_GOOGLE = (import.meta.env["VITE_GOOGLE_SIGNIN"] as string | undefined) !== "false";

type Notice = { tone: "info" | "error"; text: string; canResend?: boolean };

function AuthPage() {
  const navigate = useNavigate();
  const [mode, setMode] = useState<"in" | "up">("in");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<Notice | null>(null);
  const [cooldown, setCooldown] = useState(0);

  useEffect(() => {
    const fromUrl = takeAuthErrorFromUrl();
    if (fromUrl) setNotice({ tone: "error", text: fromUrl });
    void supabase.auth.getSession().then(({ data }) => { if (data.session) void navigate({ to: "/admin" }); });
    // Google and email links return here, so a successful sign-in is picked up and forwarded to /admin.
    const { data } = supabase.auth.onAuthStateChange((event, s) => { if (s && (event === "SIGNED_IN" || event === "TOKEN_REFRESHED")) void navigate({ to: "/admin" }); });
    return () => data.subscription.unsubscribe();
  }, [navigate]);

  useEffect(() => {
    if (cooldown <= 0) return;
    const t = setTimeout(() => setCooldown(cooldown - 1), 1000);
    return () => clearTimeout(t);
  }, [cooldown]);

  const redirectTo = () => `${window.location.origin}/auth`;

  const explain = (error: { message: string; code?: string | undefined }): Notice => {
    const text = `${error.code ?? ""} ${error.message}`.toLowerCase();
    if (text.includes("email_not_confirmed") || text.includes("not confirmed"))
      return { tone: "info", canResend: true, text: "Your email isn't confirmed yet. Open the confirmation email (check Spam and Promotions too), or send a new one." };
    if (text.includes("rate_limit") || text.includes("rate limit") || text.includes("too many"))
      return { tone: "error", text: "Too many emails have been requested. Wait a few minutes and try again. If you manage the project, you can raise the email limit or switch on auto-confirm in the backend's Auth settings." };
    return { tone: "error", text: error.message };
  };

  const resend = async () => {
    setBusy(true);
    const { error } = await supabase.auth.resend({ type: "signup", email: email.trim(), options: { emailRedirectTo: redirectTo() } });
    setBusy(false);
    if (error) { setNotice(explain(error)); return; }
    setCooldown(60);
    setNotice({ tone: "info", canResend: true, text: `We sent a new confirmation link to ${email.trim()}. It can take a few minutes. Check Spam and Promotions.` });
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true); setNotice(null);
    try {
      if (mode === "in") {
        const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
        if (error) {
          const n = explain(error);
          if (error.code === "invalid_credentials" || /invalid login/i.test(error.message)) {
            void reportFailedLogin({ data: { email: email.trim() } }).catch(() => {});
            setNotice({ tone: "error", text: "That email or password is not right. If you signed up but never confirmed your email, use “Resend confirmation” below." , canResend: true });
          } else setNotice(n);
          return;
        }
        await navigate({ to: "/admin" });
      } else {
        if (password.length < 8) { setNotice({ tone: "error", text: "Use a password of at least 8 characters." }); return; }
        const { data, error } = await supabase.auth.signUp({ email: email.trim(), password, options: { emailRedirectTo: redirectTo() } });
        if (error) { setNotice(explain(error)); return; }
        if (data.session) { await navigate({ to: "/admin" }); return; }
        // An existing address returns a fake success with no identities, and no email is sent.
        if (data.user && (data.user.identities?.length ?? 0) === 0) {
          setMode("in");
          setNotice({ tone: "info", canResend: true, text: "This email already has an account, so no new email was sent. Sign in with your password. If you never confirmed it, use “Resend confirmation”." });
          return;
        }
        setCooldown(60);
        setNotice({ tone: "info", canResend: true, text: `Account created. We sent a confirmation link to ${email.trim()}. Open it (check Spam and Promotions), then sign in. An admin must give you a role afterwards, unless you are the very first account.` });
      }
    } finally { setBusy(false); }
  };

  const google = async () => {
    setNotice(null);
    if ((await googleIsEnabled()) === false) {
      setNotice({ tone: "error", text: "Google sign-in is switched off on the database. In Supabase open Authentication, then Sign In / Providers, then Google, and turn it on (see SETUP.md)." });
      return;
    }
    const { error } = await supabase.auth.signInWithOAuth({ provider: "google", options: { redirectTo: redirectTo(), queryParams: { prompt: "select_account" } } });
    if (error) setNotice({ tone: "error", text: error.message });
    // On success the browser is sent to Google, then back to /admin.
  };

  return (
    <div className="min-h-screen bg-background text-foreground" style={{ fontFamily: "'IBM Plex Sans', sans-serif" }}>
      <div className="flex h-1.5"><div className="flex-1 bg-foreground" /><div className="flex-1 bg-primary" /><div className="flex-1 bg-secondary" /></div>
      <main className="mx-auto max-w-sm px-4 py-16">
        <Link to="/" className="text-xs font-semibold uppercase tracking-wider hover:text-primary">← Back to Brief</Link>
        <h1 className="mt-6 text-4xl font-black leading-none" style={{ fontFamily: "'Fraunces', serif" }}>Staff <span className="text-primary">sign-in</span></h1>
        <p className="mt-2 text-sm text-muted-foreground">For the Brief team only. The first account created becomes the site admin.</p>
        <form onSubmit={(e) => void submit(e)} className="mt-8 space-y-3">
          <Input type="email" required autoComplete="email" placeholder="Email" className="rounded-none" value={email} onChange={(e) => setEmail(e.target.value)} />
          <Input type="password" required autoComplete={mode === "in" ? "current-password" : "new-password"} placeholder="Password" className="rounded-none" value={password} onChange={(e) => setPassword(e.target.value)} />
          <Button type="submit" className="w-full rounded-none" disabled={busy}>{busy ? "Please wait…" : mode === "in" ? "Sign in" : "Create account"}</Button>
          {SHOW_GOOGLE && <Button type="button" variant="outline" className="w-full rounded-none" onClick={() => void google()}>Continue with Google</Button>}
        </form>
        {notice && (
          <div role="status" className={`mt-4 border-l-4 pl-3 text-sm ${notice.tone === "error" ? "border-primary" : "border-secondary"}`}>
            <p>{notice.text}</p>
            {notice.canResend && email.includes("@") && (
              <button type="button" disabled={busy || cooldown > 0} onClick={() => void resend()} className="mt-2 font-semibold underline underline-offset-4 hover:text-primary disabled:opacity-50 disabled:no-underline">
                {cooldown > 0 ? `Resend confirmation (${cooldown}s)` : "Resend confirmation"}
              </button>
            )}
          </div>
        )}
        <button className="mt-6 text-sm text-muted-foreground underline hover:text-primary" onClick={() => { setMode(mode === "in" ? "up" : "in"); setNotice(null); }}>
          {mode === "in" ? "New team member? Create an account" : "Already have an account? Sign in"}
        </button>
      </main>
    </div>
  );
}
