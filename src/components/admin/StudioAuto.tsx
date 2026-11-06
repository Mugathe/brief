import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Field, Section, errMsg } from "./shared";
import { getBrief } from "@/lib/brief.functions";
import { base64ToArrayBuffer, canvasToBlob, drawCard, loadStudioFonts, makeCardVideo, recordingSupported, type Track } from "@/lib/studio";
import { getStudioVoice } from "@/lib/studio.functions";
import { captionFor, dayKey, headlineCard, planStories, voiceScript, type StoryPlan } from "@/lib/studio-feed";
import { saveStudioPost } from "@/lib/studio-db";
import { useSiteUrl } from "@/lib/site-url";

type Row = { plan: StoryPlan; state: "waiting" | "image" | "reel" | "done" | "failed"; note?: string };
const LABEL: Record<Row["state"], string> = { waiting: "Waiting", image: "Making the picture…", reel: "Recording the reel…", done: "Done, in the review list", failed: "Failed" };

/** One button: take today's top stories from the Brief, and render a picture and a reel for each. */
export function StudioAuto({ edition }: { edition: string }) {
  const site = useSiteUrl();
  const qc = useQueryClient();
  const [count, setCount] = useState("5");
  const [music, setMusic] = useState<"news" | "pad" | "none">("news");
  const [reels, setReels] = useState(true);
  const [voice, setVoice] = useState<"off" | "amani" | "baraka">("off");
  const [rows, setRows] = useState<Row[]>([]);
  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState(0);
  const noRec = !recordingSupported();

  const mark = (n: number, patch: Partial<Row>) => setRows((r) => r.map((x) => (x.plan.n === n ? { ...x, ...patch } : x)));

  const run = async () => {
    setRunning(true); setRows([]); setProgress(0);
    let lock: { release: () => Promise<void> } | undefined;
    try { lock = await (navigator as unknown as { wakeLock?: { request: (t: string) => Promise<{ release: () => Promise<void> }> } }).wakeLock?.request("screen"); } catch { /* the screen may sleep; recording then pauses */ }
    try {
      await loadStudioFonts();
      const brief = await getBrief({ data: { edition } });
      const plans = planStories(brief.segments, edition, dayKey(), Number(count));
      if (!plans.length) { toast.error(brief.error || "There are no stories to render yet. Try again in a few minutes."); return; }
      setRows(plans.map((plan) => ({ plan, state: "waiting" })));
      const track: Track = music === "none" ? { kind: "none" } : { kind: music };
      const address = `${site.replace(/^https?:\/\//, "")}/brief`;
      let failed = 0;
      for (const p of plans) {
        try {
          const card = headlineCard(p, address);
          const base = { edition, day: dayKey(), storyKey: p.key, style: "headline" as const, title: p.title, category: p.category, caption: captionFor(p, site, p.path), link: p.path, links: p.links };
          mark(p.n, { state: "image" });
          const ic = document.createElement("canvas"); ic.width = 1080; ic.height = 1080;
          drawCard(ic.getContext("2d")!, 1080, 1080, card);
          await saveStudioPost({ ...base, kind: "image", blob: await canvasToBlob(ic) });
          if (reels && !noRec) {
            mark(p.n, { state: "reel" });
            const vc = document.createElement("canvas"); vc.width = 1080; vc.height = 1920;
            let spoken: ArrayBuffer | undefined;
            if (voice !== "off") {
              try { spoken = base64ToArrayBuffer((await getStudioVoice({ data: { edition, text: voiceScript(p), voice } })).audio); }
              catch (e) { mark(p.n, { note: `no voice-over: ${errMsg(e)}` }); } // the reel is still made
            }
            const blob = await makeCardVideo(vc, card, track, 9, setProgress, spoken);
            await saveStudioPost({ ...base, kind: "video", blob });
          }
          mark(p.n, { state: "done" });
        } catch (e) { failed++; mark(p.n, { state: "failed", note: errMsg(e) }); }
      }
      await qc.invalidateQueries({ queryKey: ["studio-posts", edition] });
      if (failed) toast.error(`${failed} of ${plans.length} failed. Details are in the list.`);
      else toast.success("All rendered. Review them below, then publish.");
    } catch (e) { toast.error(errMsg(e)); } finally { void lock?.release(); setRunning(false); setProgress(0); }
  };

  return (
    <Section title="Make today’s top stories now" hint="Takes the stories at the top of the Read the Brief page and makes a picture and a 9-second vertical reel with news music for each. Every post links to its story in the Brief. Nothing goes live until you publish it below.">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Field label="How many stories">
          <Select value={count} onValueChange={setCount}>
            <SelectTrigger className="rounded-none"><SelectValue /></SelectTrigger>
            <SelectContent>{["3", "5", "6"].map((n) => <SelectItem key={n} value={n}>{n} stories</SelectItem>)}</SelectContent>
          </Select>
        </Field>
        <Field label="Music">
          <Select value={music} onValueChange={(v) => setMusic(v as "news" | "pad" | "none")}>
            <SelectTrigger className="rounded-none"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="news">News bulletin theme</SelectItem>
              <SelectItem value="pad">Soft background</SelectItem>
              <SelectItem value="none">No music</SelectItem>
            </SelectContent>
          </Select>
        </Field>
        <Field label="Voice-over">
          <Select value={voice} onValueChange={(v) => setVoice(v as "off" | "amani" | "baraka")}>
            <SelectTrigger className="rounded-none"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="off">None</SelectItem>
              <SelectItem value="amani">Amani (woman)</SelectItem>
              <SelectItem value="baraka">Baraka (man)</SelectItem>
            </SelectContent>
          </Select>
        </Field>
        <label className="flex items-end gap-2 pb-2 text-sm"><input type="checkbox" checked={reels && !noRec} disabled={noRec} onChange={(e) => setReels(e.target.checked)} />Also make reels (slower)</label>
      </div>
      <div className="mt-4 flex flex-wrap items-center gap-3">
        <Button className="rounded-none" disabled={running} onClick={() => void run()}>{running ? "Rendering…" : "Render today’s top stories"}</Button>
        <p className="text-xs text-muted-foreground">Each reel takes about 9 seconds to record in real time. Keep this tab open and the screen on.{noRec && " This browser cannot record video, so only pictures will be made."}</p>
      </div>
      {rows.length > 0 && (
        <ol className="mt-4 divide-y divide-border border border-border text-sm" aria-live="polite">
          {rows.map((r) => (
            <li key={r.plan.n} className="flex flex-wrap items-center gap-x-3 gap-y-1 px-3 py-2">
              <span className="font-bold text-muted-foreground">{r.plan.n}</span>
              <span className="min-w-0 flex-1 basis-48 truncate">{r.plan.title}</span>
              <span className={r.state === "failed" ? "text-destructive" : r.state === "done" ? "text-secondary" : "text-muted-foreground"}>{r.state === "failed" ? r.note : `${LABEL[r.state]}${r.note ? ` (${r.note})` : ""}`}</span>
              {r.state === "reel" && <span className="h-1.5 w-24 bg-muted"><span className="block h-1.5 bg-primary" style={{ width: `${Math.round(progress * 100)}%` }} /></span>}
            </li>
          ))}
        </ol>
      )}
    </Section>
  );
}
