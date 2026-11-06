import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { Pencil, Plus, Trash2, Upload } from "lucide-react";
import { deleteAd, getSiteSettings, listAds, saveAd, saveSetting } from "@/lib/manage.functions";
import { AD_PLACEMENTS, placementLabel } from "@/lib/ads";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Field, Section, errMsg, toLocalInput, useAction } from "./shared";
import { ALL, canManageEditions, canManageScope, editionsLabel, manageAll, type Access } from "@/lib/regions";
import { EDITIONS } from "@/lib/editions";

type Ad = Awaited<ReturnType<typeof listAds>>[number];
type Draft = {
  id?: string; title: string; kind: "banner" | "adsense"; image_url: string; link_url: string; adsense_slot: string; placement: string;
  active: boolean; starts: string; ends: string; priority: number; sponsor: string; alt_text: string; editions: string[];
};
const blank: Draft = { title: "", kind: "banner", image_url: "", link_url: "", adsense_slot: "", placement: "home_top", active: true, starts: "", ends: "", priority: 0, sponsor: "", alt_text: "", editions: [] };

function status(a: Ad) {
  const now = Date.now();
  if (!a.active) return { label: "Paused", tone: "secondary" as const };
  if (a.starts_at && Date.parse(a.starts_at) > now) return { label: "Scheduled", tone: "outline" as const };
  if (a.ends_at && Date.parse(a.ends_at) <= now) return { label: "Ended", tone: "outline" as const };
  return { label: "Live", tone: "default" as const };
}

function toDraft(a: Ad): Draft {
  return {
    id: a.id, title: a.title, kind: a.kind === "adsense" ? "adsense" : "banner", image_url: a.image_url ?? "", link_url: a.link_url ?? "",
    adsense_slot: a.adsense_slot ?? "", placement: a.placement, active: a.active, starts: toLocalInput(a.starts_at), ends: toLocalInput(a.ends_at),
    priority: a.priority, sponsor: a.sponsor ?? "", alt_text: a.alt_text ?? "", editions: a.editions ?? [],
  };
}

export function AdsTab({ access, scope }: { access: Access; scope: string }) {
  // The AdSense account, the master switch and rotation speed are site-wide: only people who manage everything change them.
  const canEdit = manageAll(access);
  const canCreate = canManageScope(access, scope);
  const adsQ = useQuery({ queryKey: ["ads"], queryFn: () => listAds() });
  const setQ = useQuery({ queryKey: ["settings"], queryFn: () => getSiteSettings() });
  const [draft, setDraft] = useState<Draft | null>(null);
  const [uploading, setUploading] = useState(false);
  const [client, setClient] = useState<string | null>(null);

  const save = useAction(saveAd, "Ad saved", ["ads"]);
  const remove = useAction(deleteAd, "Ad deleted", ["ads"]);
  const saveSet = useAction(saveSetting, "Settings saved", ["settings"]);

  const adsense = setQ.data?.adsense ?? { client: "", enabled: true };
  const clientValue = client ?? adsense.client;

  const submit = () => {
    if (!draft) return;
    if (!manageAll(access) && draft.editions.length === 0) { toast.error("Choose at least one region for this ad."); return; }
    const { starts, ends, ...rest } = draft;
    save.mutate(
      { ...rest, starts_at: starts ? new Date(starts).toISOString() : null, ends_at: ends ? new Date(ends).toISOString() : null },
      { onSuccess: () => setDraft(null) },
    );
  };

  const upload = async (file: File) => {
    if (!file.type.startsWith("image/")) { toast.error("Choose an image file"); return; }
    if (file.size > 2 * 1024 * 1024) { toast.error("Image must be under 2 MB"); return; }
    setUploading(true);
    try {
      const path = `${Date.now()}-${file.name.replace(/[^a-zA-Z0-9._-]/g, "_")}`;
      const { error } = await supabase.storage.from("ad-images").upload(path, file, { contentType: file.type });
      if (error) throw error;
      const { data } = supabase.storage.from("ad-images").getPublicUrl(path);
      setDraft((d) => (d ? { ...d, image_url: data.publicUrl } : d));
      toast.success("Image uploaded");
    } catch (e) { toast.error(errMsg(e)); } finally { setUploading(false); }
  };

  const toggle = async (a: Ad) => {
    const { starts: _s, ends: _e, ...rest } = toDraft(a);
    save.mutate({ ...rest, starts_at: a.starts_at, ends_at: a.ends_at, active: !a.active });
  };

  return (
    <div className="space-y-6">
      <Section title="Ad network and master switch" hint={canEdit ? "Paste your Google AdSense publisher ID to enable AdSense slots. Turning the switch off hides every ad immediately. These settings are site-wide." : "Site-wide settings, managed by admins."}>
        <div className="flex flex-wrap items-end gap-4">
          <div className="min-w-64 flex-1">
            <Field label="AdSense publisher ID" hint="Looks like ca-pub-1234567890123456">
              <Input className="rounded-none" value={clientValue} disabled={!canEdit} onChange={(e) => setClient(e.target.value)} placeholder="ca-pub-…" />
            </Field>
          </div>
          <Button className="rounded-none" disabled={!canEdit || saveSet.isPending} onClick={() => saveSet.mutate({ key: "adsense", value: { client: clientValue.trim(), enabled: adsense.enabled } })}>Save ID</Button>
          <label className="flex items-center gap-2 text-sm font-semibold">
            <Switch checked={adsense.enabled} disabled={!canEdit} onCheckedChange={(v) => saveSet.mutate({ key: "adsense", value: { client: adsense.client, enabled: v } })} />
            Ads shown on site
          </label>
        </div>
        <div className="mt-4 flex flex-wrap items-center gap-3 border-t border-border pt-4 text-sm">
          <span className="font-semibold">Rotate sponsor banners every</span>
          <Select value={String(setQ.data?.rotationSeconds ?? 6)} disabled={!canEdit} onValueChange={(v) => saveSet.mutate({ key: "ad_rotation", value: { seconds: Number(v) } })}>
            <SelectTrigger className="w-28 rounded-none"><SelectValue /></SelectTrigger>
            <SelectContent>{[4, 6, 8, 10, 15, 20].map((n) => <SelectItem key={n} value={String(n)}>{n} seconds</SelectItem>)}</SelectContent>
          </Select>
          <span className="text-xs text-muted-foreground">Banners in the same spot take turns. They pause on hover and when the page is hidden. Google AdSense units never rotate (Google's rules), so they stay still.</span>
        </div>
      </Section>

      <Section
        title={scope === ALL ? "Ads and sponsors (all regions)" : `Ads and sponsors for ${EDITIONS.find((e) => e.code === scope)?.name ?? scope}`}
        hint="Highest priority wins a placement; equal priorities rotate. Dates use your local time. Ads marked Everywhere also run in this region; only admins change those."
        action={canCreate ? <Button className="rounded-none" onClick={() => setDraft({ ...blank, editions: scope === ALL ? [] : [scope] })}><Plus className="mr-1 h-4 w-4" />New ad</Button> : null}
      >
        {adsQ.isLoading ? <p className="text-sm text-muted-foreground">Loading…</p> : !(adsQ.data ?? []).length ? <p className="text-sm text-muted-foreground">No ads yet. Create your first sponsor banner or AdSense slot.</p> : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr className="border-b text-left text-[11px] uppercase tracking-wider text-muted-foreground"><th className="py-2">Ad</th><th>Placement</th><th>Shown in</th><th>Schedule</th><th>Priority</th><th>Status</th><th /></tr></thead>
              <tbody>
                {(adsQ.data ?? []).filter((a) => scope === ALL || a.editions.length === 0 || a.editions.includes(scope)).map((a) => {
                  const st = status(a);
                  const mine = canManageEditions(access, a.editions);
                  return (
                    <tr key={a.id} className="border-b border-border/60 align-middle">
                      <td className="py-2">
                        <div className="flex items-center gap-3">
                          {a.image_url ? <img src={a.image_url} alt="" className="h-10 w-16 border object-cover" /> : <span className="grid h-10 w-16 place-items-center border text-[10px] uppercase text-muted-foreground">{a.kind}</span>}
                          <div><p className="font-semibold">{a.title}</p><p className="text-xs text-muted-foreground">{a.sponsor ?? (a.kind === "adsense" ? `AdSense slot ${a.adsense_slot}` : "No sponsor name")}</p></div>
                        </div>
                      </td>
                      <td className="text-muted-foreground">{placementLabel(a.placement)}</td>
                      <td className="text-xs text-muted-foreground">{editionsLabel(a.editions)}</td>
                      <td className="text-xs text-muted-foreground">{a.starts_at ? new Date(a.starts_at).toLocaleDateString() : "Now"} → {a.ends_at ? new Date(a.ends_at).toLocaleDateString() : "No end"}</td>
                      <td className="tabular-nums">{a.priority}</td>
                      <td><Badge variant={st.tone}>{st.label}</Badge></td>
                      <td className="whitespace-nowrap text-right">
                        {mine && (
                          <>
                            <Switch checked={a.active} onCheckedChange={() => void toggle(a)} aria-label="Active" />
                            <Button variant="ghost" size="icon" onClick={() => setDraft(toDraft(a))} aria-label="Edit"><Pencil className="h-4 w-4" /></Button>
                            <Button variant="ghost" size="icon" onClick={() => { if (confirm(`Delete "${a.title}"? Its statistics stay in analytics.`)) remove.mutate({ id: a.id }); }} aria-label="Delete"><Trash2 className="h-4 w-4 text-destructive" /></Button>
                          </>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Section>

      <Dialog open={!!draft} onOpenChange={(o) => { if (!o) setDraft(null); }}>
        <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto rounded-none">
          <DialogHeader><DialogTitle>{draft?.id ? "Edit ad" : "New ad"}</DialogTitle></DialogHeader>
          {draft && (
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Title (internal)"><Input className="rounded-none" value={draft.title} onChange={(e) => setDraft({ ...draft, title: e.target.value })} /></Field>
              <Field label="Sponsor name (shown to readers)"><Input className="rounded-none" value={draft.sponsor} onChange={(e) => setDraft({ ...draft, sponsor: e.target.value })} /></Field>
              <Field label="Type">
                <Select value={draft.kind} onValueChange={(v) => setDraft({ ...draft, kind: v as Draft["kind"] })}>
                  <SelectTrigger className="rounded-none"><SelectValue /></SelectTrigger>
                  <SelectContent><SelectItem value="banner">Sponsor banner (image)</SelectItem><SelectItem value="adsense">Google AdSense slot</SelectItem></SelectContent>
                </Select>
              </Field>
              <Field label="Placement">
                <Select value={draft.placement} onValueChange={(v) => setDraft({ ...draft, placement: v })}>
                  <SelectTrigger className="rounded-none"><SelectValue /></SelectTrigger>
                  <SelectContent>{AD_PLACEMENTS.map((p) => <SelectItem key={p.id} value={p.id}>{p.label}</SelectItem>)}</SelectContent>
                </Select>
              </Field>
              {draft.kind === "banner" ? (
                <>
                  <div className="sm:col-span-2">
                    <Field label="Banner image" hint="Upload (max 2 MB) or paste a link. Wide banners around 970×250 or 728×90 work best.">
                      <div className="flex gap-2">
                        <Input className="rounded-none" value={draft.image_url} onChange={(e) => setDraft({ ...draft, image_url: e.target.value })} placeholder="https://…" />
                        <label className="inline-flex cursor-pointer items-center gap-1 border border-input px-3 text-sm font-medium hover:bg-accent">
                          <Upload className="h-4 w-4" />{uploading ? "…" : "Upload"}
                          <input type="file" accept="image/*" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) void upload(f); e.target.value = ""; }} />
                        </label>
                      </div>
                    </Field>
                    {draft.image_url && <img src={draft.image_url} alt="Preview" className="mt-2 max-h-32 border object-contain" />}
                  </div>
                  <Field label="Click-through link"><Input className="rounded-none" value={draft.link_url} onChange={(e) => setDraft({ ...draft, link_url: e.target.value })} placeholder="https://sponsor.co.ke" /></Field>
                  <Field label="Image description (accessibility)"><Input className="rounded-none" value={draft.alt_text} onChange={(e) => setDraft({ ...draft, alt_text: e.target.value })} /></Field>
                </>
              ) : (
                <Field label="AdSense ad slot ID" hint="From AdSense → Ads → By ad unit"><Input className="rounded-none" value={draft.adsense_slot} onChange={(e) => setDraft({ ...draft, adsense_slot: e.target.value })} placeholder="1234567890" /></Field>
              )}
              <div className="sm:col-span-2">
                <Field label="Show in" hint="Readers see this ad only in these regions. AdSense chooses which ads to fill an AdSense slot using the page and the reader's location, so a region's own slot (with its own custom channel in AdSense) is how you keep AdSense relevant per region.">
                  <div className="flex flex-wrap gap-x-4 gap-y-2 text-sm">
                    {manageAll(access) && (
                      <label className="flex items-center gap-1.5 font-semibold"><input type="checkbox" checked={draft.editions.length === 0} onChange={(e) => setDraft({ ...draft, editions: e.target.checked ? [] : [scope === ALL ? "world" : scope] })} />Everywhere</label>
                    )}
                    {EDITIONS.filter((e) => manageAll(access) || access.regions.includes(e.code)).map((e) => (
                      <label key={e.code} className={`flex items-center gap-1.5 ${draft.editions.length === 0 ? "opacity-40" : ""}`}>
                        <input type="checkbox" disabled={draft.editions.length === 0} checked={draft.editions.includes(e.code)} onChange={(ev) => setDraft({ ...draft, editions: ev.target.checked ? [...draft.editions, e.code] : draft.editions.filter((x) => x !== e.code) })} />
                        {e.flag} {e.name}
                      </label>
                    ))}
                  </div>
                </Field>
              </div>
              <Field label="Starts (optional)"><Input type="datetime-local" className="rounded-none" value={draft.starts} onChange={(e) => setDraft({ ...draft, starts: e.target.value })} /></Field>
              <Field label="Ends (optional)"><Input type="datetime-local" className="rounded-none" value={draft.ends} onChange={(e) => setDraft({ ...draft, ends: e.target.value })} /></Field>
              <Field label="Priority (-100 to 100)" hint="Higher shows first"><Input type="number" className="rounded-none" value={draft.priority} onChange={(e) => setDraft({ ...draft, priority: Math.max(-100, Math.min(100, Math.round(Number(e.target.value) || 0))) })} /></Field>
              <label className="flex items-center gap-2 pt-6 text-sm font-semibold"><Switch checked={draft.active} onCheckedChange={(v) => setDraft({ ...draft, active: v })} />Active</label>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" className="rounded-none" onClick={() => setDraft(null)}>Cancel</Button>
            <Button className="rounded-none" disabled={save.isPending || !draft?.title.trim()} onClick={submit}>{save.isPending ? "Saving…" : "Save ad"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
