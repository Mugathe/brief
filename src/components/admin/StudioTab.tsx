import { useEffect, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Field, Section, errMsg } from "./shared";
import { shareTags } from "@/lib/share";
import { StudioAuto } from "./StudioAuto";
import { StudioQueue } from "./StudioQueue";
import { StudioService } from "./StudioService";
import { saveStudioPost } from "@/lib/studio-db";
import { getStudioVoice } from "@/lib/studio.functions";
import { briefPath, dayKey } from "@/lib/studio-feed";
import { useSiteUrl } from "@/lib/site-url";
import { WORLD } from "@/lib/editions";
import {
  FORMATS, base64ToArrayBuffer, canvasToBlob, drawCard, drawOverlay, extensionOf, loadStudioFonts, makeCardVideo, makeOverlayVideo,
  recordingSupported, shareOrDownload, type CardInput, type Format, type OverlayInput, type Track,
} from "@/lib/studio";

type Result = { blob: Blob; url: string; name: string; isVideo: boolean };
const today = () => new Date().toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });
const host = () => (typeof window === "undefined" ? "" : window.location.host);

/** Quote cards, animated cards with sound, and the lower-third over a video. Everything is made in this browser. */
export function StudioTab({ scope, canEdit }: { scope: string; canEdit: boolean }) {
  const edition = scope === "*" ? WORLD : scope;
  const site = useSiteUrl();
  const qc = useQueryClient();
  const [mode, setMode] = useState<"auto" | "card" | "overlay">("auto");
  const [format, setFormat] = useState<Format>("square");
  const [card, setCard] = useState<CardInput>({ quote: "", speaker: "", role: "", category: "News", url: host() });
  const [ov, setOv] = useState<OverlayInput>({ lead: "", highlight: "", credit: "", date: today(), url: host() });
  const [trackKind, setTrackKind] = useState<"none" | "pad" | "news" | "file">("news");
  const [audioFile, setAudioFile] = useState<File | null>(null);
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [seconds, setSeconds] = useState(8);
  const [voice, setVoice] = useState<"off" | "amani" | "baraka">("off");
  const [busy, setBusy] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);
  const [result, setResult] = useState<Result | null>(null);
  const [fontsReady, setFontsReady] = useState(false);
  const canvas = useRef<HTMLCanvasElement>(null);
  const { w, h } = FORMATS[format];
  const track: Track = trackKind === "file" && audioFile ? { kind: "file", file: audioFile } : trackKind === "pad" ? { kind: "pad" } : trackKind === "news" ? { kind: "news" } : { kind: "none" };

  useEffect(() => { void loadStudioFonts().then(() => setFontsReady(true)); }, []);
  useEffect(() => () => { if (result) URL.revokeObjectURL(result.url); }, [result]);

  // The preview is the finished picture; while a video records, the recorder draws on this same canvas.
  useEffect(() => {
    const c = canvas.current, ctx = c?.getContext("2d");
    if (!c || !ctx || busy) return;
    c.width = w; c.height = h;
    if (mode === "card") drawCard(ctx, w, h, card);
    else {
      const bg = ctx.createLinearGradient(0, 0, w, h);
      bg.addColorStop(0, "#6b7280"); bg.addColorStop(1, "#1f2937");
      ctx.fillStyle = bg; ctx.fillRect(0, 0, w, h);
      drawOverlay(ctx, w, h, ov);
    }
  }, [mode, format, card, ov, fontsReady, busy, w, h]);

  const keep = (blob: Blob, base: string, isVideo: boolean) => {
    setResult({ blob, url: URL.createObjectURL(blob), name: `${base}.${isVideo ? extensionOf(blob) : "png"}`, isVideo });
  };
  const run = async (label: string, job: () => Promise<void>) => {
    if (!canvas.current) return;
    setBusy(label); setProgress(0); setResult(null);
    try { await job(); } catch (e) { toast.error(errMsg(e)); } finally { setBusy(null); }
  };

  const cardReady = card.quote.trim().length > 3 && card.speaker.trim().length > 1;
  const overlayReady = ov.lead.trim().length + ov.highlight.trim().length > 3;
  const readBrief = `Read the Brief: ${site}${briefPath(edition)}`;
  const caption = mode === "card" ? `“${card.quote.trim()}” — ${card.speaker.trim()}\n\n${readBrief}\n${shareTags(card.category)}` : `${ov.lead.trim()} ${ov.highlight.trim()}\n\n${readBrief}\n${shareTags()}`;
  const saveDraft = () => {
    if (!result) return;
    const q = mode === "card";
    saveStudioPost({
      edition, day: dayKey(), storyKey: `manual-${Date.now().toString(36)}`, kind: result.isVideo ? "video" : "image", style: q ? "quote" : "overlay",
      title: q ? card.quote.trim() : `${ov.lead.trim()} ${ov.highlight.trim()}`.trim(), category: q ? card.category : "News", caption, link: briefPath(edition), blob: result.blob,
    }).then(() => { toast.success("Saved. Publish it from the review list below."); return qc.invalidateQueries({ queryKey: ["studio-posts", edition] }); }).catch((e) => toast.error(errMsg(e)));
  };

  const makeImage = () => run("Making the image…", async () => {
    const c = canvas.current!; c.width = w; c.height = h;
    const ctx = c.getContext("2d")!;
    if (mode === "card") drawCard(ctx, w, h, card);
    else { ctx.clearRect(0, 0, w, h); drawOverlay(ctx, w, h, ov); } // transparent, for any video editor
    keep(await canvasToBlob(c), mode === "card" ? "brief-quote" : "brief-overlay", false);
  });
  const makeVideo = () => run("Recording… keep this tab open", async () => {
    const c = canvas.current!; c.width = w; c.height = h;
    let spoken: ArrayBuffer | undefined;
    if (mode === "card" && voice !== "off") {
      const text = `${card.speaker.trim() ? `${card.speaker.trim()} said: ` : ""}${card.quote.trim()}`; // a narrator reads it, and says whose words they are
      spoken = base64ToArrayBuffer((await getStudioVoice({ data: { edition, text, voice } })).audio);
    }
    const blob = mode === "card"
      ? await makeCardVideo(c, card, track, seconds, setProgress, spoken)
      : await makeOverlayVideo(c, videoFile!, ov, track, setProgress);
    keep(blob, mode === "card" ? "brief-quote-video" : "brief-video", true);
  });

  const noRec = !recordingSupported();
  const modeTabs = (
    <div className="flex flex-wrap gap-2">
            {([["auto", "Top stories (automatic)"], ["card", "Quote card (manual)"], ["overlay", "Video with overlay (manual)"]] as const).map(([k, label]) => (
              <button key={k} onClick={() => { setMode(k); setResult(null); if (k === "overlay" && format === "square") setFormat("landscape"); }} className={`border px-3 py-1.5 text-xs font-bold uppercase tracking-wide ${mode === k ? "border-foreground bg-foreground text-background" : "border-border text-muted-foreground hover:border-foreground"}`}>{label}</button>
            ))}
          </div>
  );
  if (mode === "auto") {
    return (
      <div className="space-y-6">
        {modeTabs}
        <StudioService canConfigure={canEdit && scope === "*"} />
        <StudioAuto edition={edition} />
        <StudioQueue edition={edition} canEdit={canEdit} />
      </div>
    );
  }
  return (
    <div className="space-y-6">
    {modeTabs}
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,22rem)]">
      <div className="space-y-6">
        <Section title="Studio" hint="Make a quote card, or put the Brief lower-third on your own video. It is made in this browser and goes nowhere until you save it for review or share it.">
          <div className="grid gap-3">
            {mode === "card" ? (
              <>
                <Field label="Quote" hint="Use the exact words that were said. Do not tidy or shorten them in a way that changes the meaning.">
                  <Textarea className="rounded-none" rows={4} maxLength={400} value={card.quote} onChange={(e) => setCard({ ...card, quote: e.target.value })} />
                </Field>
                <div className="grid gap-3 sm:grid-cols-2">
                  <Field label="Who said it"><Input className="rounded-none" value={card.speaker} onChange={(e) => setCard({ ...card, speaker: e.target.value })} /></Field>
                  <Field label="Their role (optional)"><Input className="rounded-none" value={card.role} onChange={(e) => setCard({ ...card, role: e.target.value })} /></Field>
                  <Field label="Category"><Input className="rounded-none" value={card.category} onChange={(e) => setCard({ ...card, category: e.target.value })} /></Field>
                  <Field label="Address shown"><Input className="rounded-none" value={card.url} onChange={(e) => setCard({ ...card, url: e.target.value })} /></Field>
                </div>
              </>
            ) : (
              <>
                <div className="grid gap-3 sm:grid-cols-2">
                  <Field label="Headline, white part"><Input className="rounded-none" value={ov.lead} onChange={(e) => setOv({ ...ov, lead: e.target.value })} /></Field>
                  <Field label="Headline, yellow part"><Input className="rounded-none" value={ov.highlight} onChange={(e) => setOv({ ...ov, highlight: e.target.value })} /></Field>
                  <Field label="Credit line" hint="For example: Video: Your Name"><Input className="rounded-none" value={ov.credit} onChange={(e) => setOv({ ...ov, credit: e.target.value })} /></Field>
                  <Field label="Date"><Input className="rounded-none" value={ov.date} onChange={(e) => setOv({ ...ov, date: e.target.value })} /></Field>
                  <Field label="Address shown"><Input className="rounded-none" value={ov.url} onChange={(e) => setOv({ ...ov, url: e.target.value })} /></Field>
                </div>
                <Field label="Your video" hint="Only use footage you filmed or have the right to publish. Up to 3 minutes; recording takes as long as the video plays.">
                  <Input className="rounded-none" type="file" accept="video/*" onChange={(e) => setVideoFile(e.target.files?.[0] ?? null)} />
                </Field>
              </>
            )}
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Shape">
                <Select value={format} onValueChange={(v) => setFormat(v as Format)}>
                  <SelectTrigger className="rounded-none"><SelectValue /></SelectTrigger>
                  <SelectContent>{(Object.keys(FORMATS) as Format[]).map((k) => <SelectItem key={k} value={k}>{FORMATS[k].label}</SelectItem>)}</SelectContent>
                </Select>
              </Field>
              <Field label="Soundtrack">
                <Select value={trackKind} onValueChange={(v) => setTrackKind(v as "none" | "pad" | "news" | "file")}>
                  <SelectTrigger className="rounded-none"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="news">News bulletin theme (built in, free to use)</SelectItem>
                    <SelectItem value="pad">Soft background (built in, free to use)</SelectItem>
                    <SelectItem value="file">My own audio file</SelectItem>
                    <SelectItem value="none">No music</SelectItem>
                  </SelectContent>
                </Select>
              </Field>
              {trackKind === "file" && (
                <Field label="Audio file" hint="Only music you own or are licensed to use. Facebook and YouTube mute or block videos with other people's songs.">
                  <Input className="rounded-none" type="file" accept="audio/*" onChange={(e) => setAudioFile(e.target.files?.[0] ?? null)} />
                </Field>
              )}
              {mode === "card" && (
                <Field label="Voice-over" hint="A narrator reads the quote and says who said it.">
                  <Select value={voice} onValueChange={(v) => setVoice(v as "off" | "amani" | "baraka")}>
                    <SelectTrigger className="rounded-none"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="off">None</SelectItem>
                      <SelectItem value="amani">Amani (woman)</SelectItem>
                      <SelectItem value="baraka">Baraka (man)</SelectItem>
                    </SelectContent>
                  </Select>
                </Field>
              )}
              {mode === "card" && (
                <Field label={`Length: ${seconds} seconds`}>
                  <input type="range" min={5} max={20} value={seconds} onChange={(e) => setSeconds(Number(e.target.value))} className="w-full" />
                </Field>
              )}
            </div>
          </div>
          <div className="mt-5 flex flex-wrap gap-2">
            <Button className="rounded-none" disabled={!!busy || (mode === "card" ? !cardReady : !overlayReady)} onClick={() => void makeImage()}>{mode === "card" ? "Make image" : "Make overlay image (transparent)"}</Button>
            <Button className="rounded-none" variant="secondary" disabled={!!busy || noRec || (mode === "card" ? !cardReady : !overlayReady || !videoFile || (trackKind === "file" && !audioFile))} onClick={() => void makeVideo()}>{mode === "card" ? "Make animated video" : "Make video with overlay"}</Button>
          </div>
          {noRec && <p className="mt-2 text-xs text-destructive">This browser cannot record video. Use Chrome on Android or desktop.</p>}
          {busy && (
            <div className="mt-3 text-sm" role="status">
              <p>{busy}</p>
              <div className="mt-1 h-1.5 bg-muted"><div className="h-1.5 bg-primary" style={{ width: `${Math.round(progress * 100)}%` }} /></div>
            </div>
          )}
        </Section>

        {result && (
          <Section title="Ready" hint={result.isVideo && result.name.endsWith(".webm") ? "This browser made a WebM file. YouTube takes it; Facebook and Instagram prefer MP4, so use Chrome 126 or newer, or convert it (for example with HandBrake) first." : undefined}>
            <div className="flex flex-wrap gap-2">
              <Button className="rounded-none" onClick={() => void shareOrDownload(result.blob, result.name, caption).then((r) => r === "downloaded" && toast.success("Saved to your downloads"))}>Share to Facebook, WhatsApp, YouTube…</Button>
              <Button asChild variant="outline" className="rounded-none"><a href={result.url} download={result.name}>Download</a></Button>
              {canEdit && <Button variant="secondary" className="rounded-none" onClick={saveDraft}>Save for review</Button>}
              <Button variant="outline" className="rounded-none" onClick={() => void navigator.clipboard.writeText(caption).then(() => toast.success("Caption copied"))}>Copy caption</Button>
            </div>
          </Section>
        )}
      </div>

      <div className="space-y-3 lg:sticky lg:top-4 lg:self-start">
        <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">{result ? "Result" : "Preview"}</p>
        {result?.isVideo ? (
          <video src={result.url} controls playsInline className="w-full border border-border bg-black" />
        ) : result ? (
          <img src={result.url} alt="Finished image" className="w-full border border-border bg-[repeating-conic-gradient(#ddd_0_25%,#fff_0_50%)] bg-[length:20px_20px]" />
        ) : null}
        <canvas ref={canvas} className={result ? "hidden" : "h-auto w-full border border-border"} />
        {result && <Button variant="ghost" size="sm" className="rounded-none" onClick={() => setResult(null)}>Back to editing</Button>}
      </div>
    </div>
    <StudioQueue edition={edition} canEdit={canEdit} />
    </div>
  );
}
