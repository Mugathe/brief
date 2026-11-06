import { useQuery } from "@tanstack/react-query";
import { useRef, useState } from "react";
import { toast } from "sonner";
import { Trash2, Volume2 } from "lucide-react";
import { deletePronunciation, getVoiceAdmin, previewVoice, savePronunciation } from "@/lib/voice.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Section, errMsg, useAction } from "./shared";

function speakHere(text: string, voice: "amani" | "baraka") {
  if (!("speechSynthesis" in window)) { toast.error("This browser can't speak."); return; }
  const synth = window.speechSynthesis; synth.cancel();
  const voices = synth.getVoices();
  const want = voice === "amani" ? /asilia|female|zira|jenny/i : /chilemba|male|david|guy/i;
  const ke = voices.filter((v) => /^en[-_]KE/i.test(v.lang));
  const pick = ke.find((v) => want.test(v.name)) ?? ke[0] ?? voices.find((v) => /^en/i.test(v.lang));
  const u = new SpeechSynthesisUtterance(text);
  if (pick) { u.voice = pick; u.lang = pick.lang; } else u.lang = "en-GB";
  synth.speak(u);
  if (!ke.length) toast("No Kenyan English voice found on this device. Microsoft Edge on Windows has Asilia and Chilemba.");
}

export function VoiceTab({ canEdit }: { canEdit: boolean }) {
  const q = useQuery({ queryKey: ["voice-admin"], queryFn: () => getVoiceAdmin() });
  const save = useAction(savePronunciation, "Saved. The next bulletin uses it.", ["voice-admin"]);
  const del = useAction(deletePronunciation, "Removed", ["voice-admin"]);
  const [text, setText] = useState("Governor Kang'ethe of Murang'a told MPs the IEBC needs Sh2.5 billion, up 8% from last year.");
  const [voice, setVoice] = useState<"amani" | "baraka">("amani");
  const [spoken, setSpoken] = useState("");
  const [busy, setBusy] = useState(false);
  const [entry, setEntry] = useState({ word: "", spoken: "", note: "" });
  const audio = useRef<HTMLAudioElement | null>(null);

  const run = async (withAudio: boolean) => {
    setBusy(true);
    try {
      const r = await previewVoice({ data: { text, voice, withAudio } });
      setSpoken(r.spoken);
      if (r.message) toast(r.message);
      if (r.audio) { audio.current?.pause(); audio.current = new Audio(`data:audio/mpeg;base64,${r.audio}`); void audio.current.play(); }
      return r.spoken;
    } catch (e) { toast.error(errMsg(e)); } finally { setBusy(false); }
    return "";
  };

  const d = q.data;
  if (!d) return <p className="py-10 text-center text-muted-foreground">Loading…</p>;
  const providerText = d.provider === "azure" ? `Microsoft Azure Speech, Kenyan English (${d.azure.amani} and ${d.azure.baraka})` : d.provider === "elevenlabs" ? `ElevenLabs (model ${d.elevenlabs.model})` : "None. Listeners hear their own device's voice.";

  return (
    <div className="space-y-6">
      <Section title="Which voice reads the bulletin" hint="Chosen automatically from what is set up on the server.">
        <p className="text-sm"><strong>Now:</strong> {providerText}</p>
        {d.provider !== "azure" && (
          <p className="mt-3 border-l-4 border-secondary pl-3 text-sm text-muted-foreground">
            For a real <strong>Kenyan accent</strong>, add a Microsoft Azure Speech key (<code>AZURE_SPEECH_KEY</code> and <code>AZURE_SPEECH_REGION</code>). It includes Kenyan-English voices, and its free monthly allowance covers a daily bulletin comfortably. With ElevenLabs, pick a Kenyan voice from its Voice Library and set <code>ELEVENLABS_VOICE_AMANI</code> and <code>ELEVENLABS_VOICE_BARAKA</code>. See SETUP.md.
          </p>
        )}
      </Section>

      <Section title="Try a sentence" hint="Type anything. You will see exactly what the voice is told to say, then hear it.">
        <Textarea className="min-h-20 rounded-none" maxLength={300} value={text} onChange={(e) => setText(e.target.value)} />
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <Select value={voice} onValueChange={(v) => setVoice(v as typeof voice)}>
            <SelectTrigger className="w-40 rounded-none"><SelectValue /></SelectTrigger>
            <SelectContent><SelectItem value="amani">Amani (woman)</SelectItem><SelectItem value="baraka">Baraka (man)</SelectItem></SelectContent>
          </Select>
          <Button className="rounded-none" disabled={busy || text.trim().length < 2} onClick={() => void run(true)}><Volume2 className="mr-2 h-4 w-4" />Hear it</Button>
          <Button variant="outline" className="rounded-none" disabled={busy || text.trim().length < 2} onClick={() => void run(false).then((s) => s && speakHere(s, voice))}>Hear on this device</Button>
          <Button variant="ghost" className="rounded-none" disabled={busy || text.trim().length < 2} onClick={() => void run(false)}>Just show the text</Button>
        </div>
        {spoken && <p className="mt-3 border border-border bg-muted/50 p-3 text-sm"><span className="mb-1 block text-[11px] font-bold uppercase tracking-wider text-muted-foreground">What the voice is told to say</span>{spoken}</p>}
      </Section>

      <Section title="Pronunciation dictionary" hint="When a name sounds wrong, write it the way it should be said. The respelling replaces the word only in what is read aloud, never on the page.">
        {!d.tableReady && <p role="alert" className="mb-3 border-l-4 border-primary pl-3 text-sm font-semibold">The dictionary table isn’t set up yet. Run the latest database SQL (see SETUP.md).</p>}
        {canEdit && (
          <div className="grid gap-2 sm:grid-cols-[1fr_1fr_1fr_auto]">
            <Input className="rounded-none" placeholder="Word as written, e.g. Gachagua" value={entry.word} onChange={(e) => setEntry({ ...entry, word: e.target.value })} />
            <Input className="rounded-none" placeholder="Say it like, e.g. Ga-CHA-gwa" value={entry.spoken} onChange={(e) => setEntry({ ...entry, spoken: e.target.value })} />
            <Input className="rounded-none" placeholder="Note (optional)" value={entry.note} onChange={(e) => setEntry({ ...entry, note: e.target.value })} />
            <Button className="rounded-none" disabled={save.isPending || entry.word.trim().length < 2 || !entry.spoken.trim()} onClick={() => save.mutate(entry, { onSuccess: () => { setText(`${entry.word}.`); setEntry({ word: "", spoken: "", note: "" }); } })}>Save</Button>
          </div>
        )}
        <p className="mt-2 text-xs text-muted-foreground">Tip: write it the way English letters would sound (Ga-CHA-gwa), try “Hear it”, and adjust until it sounds right. Capitals mark the stressed part. Hyphens help some voices and slow others, so test both.</p>
        <ul className="mt-4 divide-y divide-border text-sm">
          {d.entries.map((e) => (
            <li key={e.word} className="flex items-center gap-3 py-2">
              <span className="w-40 font-semibold">{e.word}</span><span className="text-muted-foreground">says</span><span className="min-w-0 flex-1">{e.spoken}{e.note && <span className="text-xs text-muted-foreground"> · {e.note}</span>}</span>
              <Button variant="ghost" size="sm" className="rounded-none" onClick={() => { setText(`${e.word}.`); void run(true); }}>Hear</Button>
              {canEdit && <Button variant="ghost" size="icon" aria-label={`Remove ${e.word}`} onClick={() => del.mutate({ word: e.word })}><Trash2 className="h-4 w-4 text-destructive" /></Button>}
            </li>
          ))}
          {d.entries.length === 0 && <li className="py-2 text-muted-foreground">No custom entries yet.</li>}
        </ul>
        <details className="mt-4 text-sm">
          <summary className="cursor-pointer font-semibold">Built-in rules (always applied)</summary>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-muted-foreground">
            <li>Money: “Sh1.2 billion” is read “1.2 billion shillings”; “$2m” as US dollars; “8%” as “8 percent”.</li>
            <li>Letter-by-letter: {d.builtIn.acronyms.slice(0, 40).join(", ")}…</li>
            <li>Names with an apostrophe are smoothed: {d.builtIn.respellings.slice(0, 6).map((r) => `${r.word} → ${r.spoken}`).join(", ")}…</li>
            <li>Your entries above override all of these.</li>
          </ul>
        </details>
      </Section>
    </div>
  );
}
