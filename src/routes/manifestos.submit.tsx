import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { CheckCircle2, Plus, X } from "lucide-react";
import { submitProfile } from "@/lib/submissions.functions";
import { COUNTIES, OFFICES, REGION_LABEL, type Office } from "@/lib/offices";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export const Route = createFileRoute("/manifestos/submit")({
  head: () => ({
    meta: [
      { title: "Submit your manifesto — Brief" },
      { name: "description", content: "Aspirants and their teams can submit a manifesto profile to Brief Manifesto Watch. Every submission is reviewed and sourced before it is published." },
    ],
  }),
  component: SubmitPage,
});

type Src = { title: string; publisher: string; date: string; url: string };
const lines = (v: string) => v.split("\n").map((x) => x.trim()).filter(Boolean);
const serif = { fontFamily: "'Fraunces', serif" };

function Block({ n, title, hint, children }: { n: number; title: string; hint?: string; children: React.ReactNode }) {
  return (
    <section className="mt-10">
      <h2 className="flex items-baseline gap-3 border-b-2 border-foreground pb-2 text-xl font-bold" style={serif}><span className="text-primary">{n}</span>{title}</h2>
      {hint && <p className="mt-2 text-sm text-muted-foreground">{hint}</p>}
      <div className="mt-4 grid gap-4 sm:grid-cols-2">{children}</div>
    </section>
  );
}
function L({ label, hint, wide, children }: { label: string; hint?: string | undefined; wide?: boolean; children: React.ReactNode }) {
  return (
    <label className={`block text-sm ${wide ? "sm:col-span-2" : ""}`}>
      <span className="mb-1 block text-[11px] font-bold uppercase tracking-wider text-muted-foreground">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-xs text-muted-foreground">{hint}</span>}
    </label>
  );
}

function SubmitPage() {
  const [f, setF] = useState({
    name: "", office: "Governor" as Office, region: "", affiliation: "", contact_name: "", contact_role: "", contact_email: "", contact_phone: "",
    overview: "", priorities: "", pledges: "", costing: "", delivery: "", track_record: "", hp: "", consent: false,
  });
  const [sources, setSources] = useState<Src[]>([{ title: "", publisher: "", date: "", url: "" }]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);
  const set = (p: Partial<typeof f>) => setF((x) => ({ ...x, ...p }));
  const countyOffice = ["Governor", "Senator", "Woman Representative"].includes(f.office);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true); setError("");
    try {
      await submitProfile({ data: { ...f, consent: f.consent as true, priorities: lines(f.priorities), sources: sources.filter((s) => s.url.trim() || s.title.trim()).map((s) => ({ ...s, title: s.title || s.url })) } });
      setDone(true);
      window.scrollTo({ top: 0 });
    } catch (err) {
      const msg = err instanceof Error ? err.message : "";
      try { const first = JSON.parse(msg)?.[0]?.message; setError(first ?? "Please check the form and try again."); } catch { setError(msg || "Please check the form and try again."); }
    } finally { setBusy(false); }
  };

  return (
    <div className="min-h-screen bg-background text-foreground" style={{ fontFamily: "'IBM Plex Sans', sans-serif" }}>
      <div className="flex h-1.5"><div className="flex-1 bg-foreground" /><div className="flex-1 bg-primary" /><div className="flex-1 bg-secondary" /></div>
      <main className="mx-auto max-w-3xl px-4 py-8">
        <Link to="/manifestos" className="text-xs font-semibold uppercase tracking-wider hover:text-primary">← Manifesto Watch</Link>
        <h1 className="mt-6 text-4xl font-black leading-none md:text-5xl" style={serif}>Put your manifesto <span className="text-primary">on the record</span></h1>
        <p className="mt-4 max-w-2xl text-lg leading-relaxed">Aspirants and their campaign teams can submit a profile for any elective seat. It is free, and every submission is treated the same way.</p>

        {done ? (
          <div role="status" className="mt-8 border-2 border-secondary p-6">
            <div className="flex items-center gap-2 text-lg font-bold"><CheckCircle2 className="h-6 w-6 text-secondary" />Submission received</div>
            <p className="mt-2 text-sm leading-relaxed">Thank you. Our team will review it and may contact you at the email you gave to confirm that you represent the candidate or to ask for more sources. Nothing is published until that review is done.</p>
            <Button asChild className="mt-4 rounded-none"><Link to="/manifestos">Back to Manifesto Watch</Link></Button>
          </div>
        ) : (
          <>
            <ul className="mt-6 space-y-2 border border-border p-4 text-sm">
              <li><strong>1. You submit</strong> your platform and the links where it can be checked.</li>
              <li><strong>2. We review.</strong> We confirm who you are, check your sources, and may ask questions.</li>
              <li><strong>3. We publish</strong> a profile where your statements are labelled as coming from your team, next to the sources and our neutral evidence rating.</li>
              <li className="text-muted-foreground">Submitting does not buy a better rating, and we may decline or edit entries for accuracy and neutrality. Your contact details are never shown publicly.</li>
            </ul>

            <form onSubmit={(e) => void submit(e)}>
              <div aria-hidden className="absolute -left-[9999px] h-0 w-0 overflow-hidden"><label>Website<input tabIndex={-1} autoComplete="off" value={f.hp} onChange={(e) => set({ hp: e.target.value })} /></label></div>

              <Block n={1} title="The aspirant">
                <L label="Full name"><Input required className="rounded-none" value={f.name} onChange={(e) => set({ name: e.target.value })} /></L>
                <L label="Party / affiliation (or Independent)"><Input className="rounded-none" value={f.affiliation} onChange={(e) => set({ affiliation: e.target.value })} /></L>
                <L label="Seat they are seeking">
                  <Select value={f.office} onValueChange={(v) => set({ office: v as Office, region: "" })}>
                    <SelectTrigger className="rounded-none"><SelectValue /></SelectTrigger>
                    <SelectContent>{OFFICES.map((o) => <SelectItem key={o} value={o}>{o}</SelectItem>)}</SelectContent>
                  </Select>
                </L>
                {f.office !== "President" && (
                  <L label={REGION_LABEL[f.office]} hint={f.office === "MCA" ? "Ward and county" : f.office === "Member of Parliament" ? "Constituency and county" : undefined}>
                    {countyOffice ? (
                      <Select value={f.region || "none"} onValueChange={(v) => set({ region: v === "none" ? "" : v })}>
                        <SelectTrigger className="rounded-none"><SelectValue /></SelectTrigger>
                        <SelectContent><SelectItem value="none">Choose a county</SelectItem>{COUNTIES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
                      </Select>
                    ) : <Input required className="rounded-none" value={f.region} onChange={(e) => set({ region: e.target.value })} />}
                  </L>
                )}
              </Block>

              <Block n={2} title="Their platform" hint="Be specific. Numbers, dates and named institutions make a profile stronger; vague slogans do not.">
                <L wide label="Overview" hint="Who they are and what they are offering, in a few factual sentences."><Textarea required minLength={20} className="min-h-28 rounded-none" value={f.overview} onChange={(e) => set({ overview: e.target.value })} /></L>
                <L wide label="Top priorities (one per line)"><Textarea className="min-h-24 rounded-none" placeholder={"Affordable healthcare\nRoads and water"} value={f.priorities} onChange={(e) => set({ priorities: e.target.value })} /></L>
                <L wide label="Key pledges" hint="What exactly will you do?"><Textarea className="min-h-28 rounded-none" value={f.pledges} onChange={(e) => set({ pledges: e.target.value })} /></L>
                <L label="How will it be paid for?"><Textarea className="min-h-24 rounded-none" value={f.costing} onChange={(e) => set({ costing: e.target.value })} /></L>
                <L label="How and by when will it be delivered?"><Textarea className="min-h-24 rounded-none" value={f.delivery} onChange={(e) => set({ delivery: e.target.value })} /></L>
                <L wide label="Track record you want considered" hint="Include links in the sources below so it can be checked."><Textarea className="min-h-24 rounded-none" value={f.track_record} onChange={(e) => set({ track_record: e.target.value })} /></L>
              </Block>

              <Block n={3} title="Sources (required)" hint="Link your published manifesto, official party page, or recorded statements, so readers can check everything for themselves.">
                <div className="space-y-3 sm:col-span-2">
                  {sources.map((s, n) => {
                    const upd = (p: Partial<Src>) => setSources(sources.map((x, i) => (i === n ? { ...x, ...p } : x)));
                    return (
                      <div key={n} className="grid gap-2 border border-border p-3 sm:grid-cols-2">
                        <Input aria-label="Source link" className="rounded-none" placeholder="https://link-to-the-document-or-page" value={s.url} onChange={(e) => upd({ url: e.target.value })} />
                        <Input aria-label="Source title" className="rounded-none" placeholder="Title, e.g. “2027 Manifesto (PDF)”" value={s.title} onChange={(e) => upd({ title: e.target.value })} />
                        <Input aria-label="Publisher" className="rounded-none" placeholder="Published by" value={s.publisher} onChange={(e) => upd({ publisher: e.target.value })} />
                        <div className="flex gap-2">
                          <Input aria-label="Date" className="rounded-none" placeholder="Date" value={s.date} onChange={(e) => upd({ date: e.target.value })} />
                          {sources.length > 1 && <Button type="button" variant="ghost" size="icon" aria-label="Remove source" onClick={() => setSources(sources.filter((_, i) => i !== n))}><X className="h-4 w-4" /></Button>}
                        </div>
                      </div>
                    );
                  })}
                  {sources.length < 10 && <Button type="button" variant="outline" className="rounded-none" onClick={() => setSources([...sources, { title: "", publisher: "", date: "", url: "" }])}><Plus className="mr-1 h-4 w-4" />Add another source</Button>}
                </div>
              </Block>

              <Block n={4} title="Who is submitting?" hint="Private. Used only by our review team to verify you represent the aspirant.">
                <L label="Your name"><Input required className="rounded-none" value={f.contact_name} onChange={(e) => set({ contact_name: e.target.value })} /></L>
                <L label="Your role" hint="Candidate, campaign manager, communications lead…"><Input className="rounded-none" value={f.contact_role} onChange={(e) => set({ contact_role: e.target.value })} /></L>
                <L label="Email"><Input required type="email" className="rounded-none" value={f.contact_email} onChange={(e) => set({ contact_email: e.target.value })} /></L>
                <L label="Phone / WhatsApp (optional)"><Input className="rounded-none" value={f.contact_phone} onChange={(e) => set({ contact_phone: e.target.value })} /></L>
              </Block>

              <label className="mt-8 flex gap-3 text-sm">
                <input type="checkbox" required className="mt-1 h-4 w-4" checked={f.consent} onChange={(e) => set({ consent: e.target.checked })} />
                <span>I confirm I am the aspirant or authorised to submit for them, that the information is accurate and the sources are genuine, and that Brief may edit, label or decline it before publishing.</span>
              </label>
              {error && <p role="alert" className="mt-4 border-l-4 border-primary pl-3 text-sm font-semibold">{error}</p>}
              <Button type="submit" disabled={busy || !f.consent} className="mt-6 rounded-none px-8">{busy ? "Sending…" : "Submit for review"}</Button>
            </form>
          </>
        )}
      </main>
    </div>
  );
}
