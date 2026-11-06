import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Trash2 } from "lucide-react";
import { deleteSocial, listSocial, saveSocial } from "@/lib/social.functions";
import { PLATFORMS, platformLabel } from "@/lib/social";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useAction } from "./shared";
import { ALL, canManageEditions, canManageScope, type Access } from "@/lib/regions";
import { editionOf } from "@/lib/editions";

/** The editors' board of what is trending on social platforms. Each item is for one region, or for everywhere. */
export function SocialPanel({ canEdit, access, scope }: { canEdit: boolean; access: Access; scope: string }) {
  const q = useQuery({ queryKey: ["social-admin"], queryFn: () => listSocial() });
  const save = useAction(saveSocial, "Added to the board", ["social-admin"]);
  const del = useAction(deleteSocial, "Removed", ["social-admin"]);
  const [f, setF] = useState({ platform: "tiktok", topic: "", note: "", url: "", days: 3 });
  const now = Date.now();
  const canAdd = canEdit && canManageScope(access, scope);
  const shown = (q.data ?? []).filter((i) => scope === ALL || (i.edition ?? "*") === "*" || i.edition === scope);
  return (
    <div className="space-y-4">
      <p className="text-xs text-muted-foreground">TikTok, Instagram and most platforms offer no public feed of what is trending in Kenya, so note what you see on their own trending pages. Items show on the Trending page and expire by themselves. Keep notes factual, and link to the platform’s page for the topic.</p>
      {canAdd && (
        <div className="grid gap-2 sm:grid-cols-[9rem_1fr_1fr]">
          <Select value={f.platform} onValueChange={(v) => setF({ ...f, platform: v })}>
            <SelectTrigger className="rounded-none"><SelectValue /></SelectTrigger>
            <SelectContent>{PLATFORMS.map((p) => <SelectItem key={p.id} value={p.id}>{p.label}</SelectItem>)}</SelectContent>
          </Select>
          <Input className="rounded-none" placeholder="Topic or hashtag, e.g. #NairobiFloods" value={f.topic} onChange={(e) => setF({ ...f, topic: e.target.value })} />
          <Input className="rounded-none" placeholder="What is it about? (optional)" value={f.note} onChange={(e) => setF({ ...f, note: e.target.value })} />
          <Input className="rounded-none sm:col-span-2" placeholder="Link to the topic on the platform (optional)" value={f.url} onChange={(e) => setF({ ...f, url: e.target.value })} />
          <div className="flex gap-2">
            <Select value={String(f.days)} onValueChange={(v) => setF({ ...f, days: Number(v) })}>
              <SelectTrigger className="w-32 rounded-none"><SelectValue /></SelectTrigger>
              <SelectContent>{[1, 3, 7, 14].map((d) => <SelectItem key={d} value={String(d)}>{d} day{d > 1 ? "s" : ""}</SelectItem>)}</SelectContent>
            </Select>
            <Button className="rounded-none" disabled={save.isPending || f.topic.trim().length < 2} onClick={() => save.mutate({ ...f, edition: scope }, { onSuccess: () => setF({ ...f, topic: "", note: "", url: "" }) })}>Add</Button>
          </div>
        </div>
      )}
      <ul className="divide-y divide-border">
        {shown.map((i) => {
          const live = Date.parse(i.expires_at) > now;
          return (
            <li key={i.id} className="flex items-center gap-3 py-2 text-sm">
              <Badge variant="secondary">{platformLabel(i.platform)}</Badge>
              <span className="min-w-0 flex-1"><span className="font-semibold">{i.topic}</span>{i.note && <span className="text-muted-foreground"> · {i.note}</span>}</span>
              <span className="text-xs text-muted-foreground">{(i.edition ?? "*") === "*" ? "Everywhere" : editionOf(i.edition).name}</span>
              <span className="text-xs text-muted-foreground">{live ? `until ${new Date(i.expires_at).toLocaleDateString("en-GB")}` : "expired"}</span>
              {canEdit && canManageEditions(access, (i.edition ?? "*") === "*" ? [] : [i.edition!]) && <Button variant="ghost" size="icon" aria-label="Remove" onClick={() => del.mutate({ id: i.id })}><Trash2 className="h-4 w-4 text-destructive" /></Button>}
            </li>
          );
        })}
        {shown.length === 0 && <li className="py-2 text-sm text-muted-foreground">Nothing on the board yet.</li>}
      </ul>
    </div>
  );
}
