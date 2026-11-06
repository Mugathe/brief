import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Check } from "lucide-react";
import { getSiteSettings, saveSetting } from "@/lib/manage.functions";
import { THEMES, type BannerSettings } from "@/lib/site-types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Field, Section, useAction } from "./shared";
import { ALL, canManageScope, manageAll, type Access } from "@/lib/regions";
import { editionOf } from "@/lib/editions";

/** The theme is site-wide. The banner can be set for the whole site or for one region, which shows it instead of the site-wide one. */
export function SiteTab({ access, scope }: { access: Access; scope: string }) {
  const region = scope === ALL ? undefined : scope;
  const canEdit = canManageScope(access, scope);
  const canTheme = manageAll(access);
  const q = useQuery({ queryKey: ["settings", scope], queryFn: () => getSiteSettings({ data: { region } }) });
  const save = useAction(saveSetting, "Saved. Visitors see it within a minute.", ["settings"]);
  const [banner, setBanner] = useState<BannerSettings | null>(null);
  if (!q.data) return <p className="py-16 text-center text-muted-foreground">Loading…</p>;
  const b = banner ?? q.data.banner;

  return (
    <div className="space-y-6">
      <Section title="Celebration and mood theme" hint={canTheme ? "Recolours the whole public site, in every region. Switch back to the default when the occasion ends." : "The theme is site-wide, so only admins change it."}>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {THEMES.map((t) => {
            const on = q.data.theme === t.id;
            return (
              <button key={t.id} disabled={!canTheme || save.isPending} onClick={() => save.mutate({ key: "theme", value: { name: t.id } })}
                className={`border-2 p-3 text-left transition-colors ${on ? "border-foreground bg-accent" : "border-border hover:border-foreground"}`}>
                <span className="flex items-center justify-between font-bold">{t.label}{on && <Check className="h-4 w-4" />}</span>
                <span className="mt-1 block text-xs text-muted-foreground">{t.note}</span>
              </button>
            );
          })}
        </div>
      </Section>

      <Section title={region ? `Banner for ${editionOf(region).name}` : "Site-wide banner"} hint={region ? `Shown at the top of every page in ${editionOf(region).name}, instead of the site-wide banner, while it is switched on.` : "A strip across the top of every public page in every region: greetings, celebrations, or a security or outage notice."}>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2"><Field label="Message"><Input className="rounded-none" maxLength={240} disabled={!canEdit} value={b.text} onChange={(e) => setBanner({ ...b, text: e.target.value })} placeholder="Happy Mashujaa Day, Kenya!" /></Field></div>
          <Field label="Style">
            <Select value={b.level} disabled={!canEdit} onValueChange={(v) => setBanner({ ...b, level: v as BannerSettings["level"] })}>
              <SelectTrigger className="rounded-none"><SelectValue /></SelectTrigger>
              <SelectContent><SelectItem value="info">Information (dark)</SelectItem><SelectItem value="celebration">Celebration (green)</SelectItem><SelectItem value="alert">Alert (red)</SelectItem></SelectContent>
            </Select>
          </Field>
          <Field label="Link (optional)"><Input className="rounded-none" disabled={!canEdit} value={b.link} onChange={(e) => setBanner({ ...b, link: e.target.value })} placeholder="https://…" /></Field>
          <label className="flex items-center gap-2 text-sm font-semibold"><Switch checked={b.active} disabled={!canEdit} onCheckedChange={(v) => setBanner({ ...b, active: v })} />Show banner</label>
        </div>
        <Button className="mt-4 rounded-none" disabled={!canEdit || save.isPending} onClick={() => save.mutate({ key: "banner", region, value: b }, { onSuccess: () => setBanner(null) })}>Save banner</Button>
      </Section>
    </div>
  );
}
