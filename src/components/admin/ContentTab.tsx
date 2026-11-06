import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { EyeOff, Pin, PinOff, Undo2, X } from "lucide-react";
import { getSiteSettings, getStoryPicker, saveSetting } from "@/lib/manage.functions";
import { DEFAULT_EDITION, EDITIONS, editionOf } from "@/lib/editions";
import { ALL, canManageScope, type Access } from "@/lib/regions";
import type { ContentSettings } from "@/lib/site-types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Field, Section, lines, useAction } from "./shared";

/** Content rules for the whole site, or, when a region is chosen above, just for that region (added to the site-wide rules). */
export function ContentTab({ access, scope }: { access: Access; scope: string }) {
  const region = scope === ALL ? undefined : scope;
  const setQ = useQuery({ queryKey: ["settings", scope], queryFn: () => getSiteSettings({ data: { region } }) });
  const [edition, setEdition] = useState(region ?? DEFAULT_EDITION);
  useEffect(() => { if (region) setEdition(region); }, [region]);
  const storiesQ = useQuery({ queryKey: ["story-picker", edition], queryFn: () => getStoryPicker({ data: { edition } }), staleTime: 5 * 60_000 });
  const save = useAction(saveSetting, "Content rules saved", ["settings", "story-picker"]);
  const [search, setSearch] = useState("");
  const [source, setSource] = useState("");
  const [words, setWords] = useState<string | null>(null);

  const content = setQ.data?.content;
  if (!canManageScope(access, scope)) return <p className="py-16 text-center text-muted-foreground">You don't manage this region.</p>;
  if (!content) return <p className="py-16 text-center text-muted-foreground">Loading…</p>;

  const update = (patch: Partial<ContentSettings>) => save.mutate({ key: "content", region, value: { ...content, ...patch } });
  const stories = (storiesQ.data ?? []).filter((s) => !search || `${s.title} ${s.source}`.toLowerCase().includes(search.toLowerCase()));
  const titleOf = (link: string) => storiesQ.data?.find((s) => s.link === link)?.title ?? link;
  const wordText = words ?? content.blockedWords.join("\n");

  return (
    <div className="space-y-6">
      <p className="border-l-4 border-primary pl-3 text-sm text-muted-foreground">
        {region
          ? <>These rules apply only in <b>{editionOf(region).name}</b>, on top of the site-wide rules. Changes show within a minute. Obscene content is already filtered automatically.</>
          : <>These rules apply in every region. Changes show on the home page, the brief and the KOT buzz meter within a minute. Obscene content is already filtered automatically.</>}
      </p>

      <Section title="Hide or pin stories" hint="Pinned stories lead the home page (up to 10). Hidden stories disappear everywhere.">
        <div className="mb-3 flex flex-wrap gap-2">
          {region ? (
            <span className="grid h-10 place-items-center border border-input px-3 text-sm">{editionOf(region).flag} {editionOf(region).name}</span>
          ) : (
            <select value={edition} onChange={(e) => setEdition(e.target.value)} aria-label="Edition" className="h-10 border border-input bg-background px-2 text-sm">
              {EDITIONS.map((e) => <option key={e.code} value={e.code}>{e.flag} {e.name}</option>)}
            </select>
          )}
          <Input className="min-w-0 flex-1 rounded-none" placeholder="Search current stories…" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        {storiesQ.isLoading ? <p className="text-sm text-muted-foreground">Loading stories…</p> : (
          <ul className="max-h-96 divide-y divide-border overflow-y-auto border border-border">
            {stories.slice(0, 60).map((s) => {
              const hidden = content.hiddenLinks.includes(s.link);
              const pinned = content.pinnedLinks.includes(s.link);
              return (
                <li key={s.link} className="flex items-center gap-3 p-2 text-sm">
                  <div className="min-w-0 flex-1">
                    <p className={`truncate font-medium ${hidden ? "text-muted-foreground line-through" : ""}`}>{s.title}</p>
                    <p className="text-xs text-muted-foreground">{s.source}</p>
                  </div>
                  <Button size="sm" variant={pinned ? "default" : "outline"} className="rounded-none" disabled={save.isPending || (!pinned && content.pinnedLinks.length >= 10)}
                    onClick={() => update({ pinnedLinks: pinned ? content.pinnedLinks.filter((l) => l !== s.link) : [...content.pinnedLinks, s.link] })}>
                    {pinned ? <PinOff className="mr-1 h-3.5 w-3.5" /> : <Pin className="mr-1 h-3.5 w-3.5" />}{pinned ? "Unpin" : "Pin"}
                  </Button>
                  <Button size="sm" variant="outline" className="rounded-none" disabled={save.isPending}
                    onClick={() => update({ hiddenLinks: hidden ? content.hiddenLinks.filter((l) => l !== s.link) : [...content.hiddenLinks, s.link], pinnedLinks: content.pinnedLinks.filter((l) => l !== s.link) })}>
                    {hidden ? <Undo2 className="mr-1 h-3.5 w-3.5" /> : <EyeOff className="mr-1 h-3.5 w-3.5" />}{hidden ? "Restore" : "Hide"}
                  </Button>
                </li>
              );
            })}
          </ul>
        )}
        {(content.hiddenLinks.length > 0 || content.pinnedLinks.length > 0) && (
          <div className="mt-4 grid gap-4 md:grid-cols-2 text-sm">
            <div><p className="mb-1 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Pinned ({content.pinnedLinks.length})</p>
              {content.pinnedLinks.map((l) => <p key={l} className="truncate">{titleOf(l)}</p>)}</div>
            <div><p className="mb-1 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Hidden ({content.hiddenLinks.length})</p>
              {content.hiddenLinks.map((l) => (
                <p key={l} className="flex items-center gap-2 truncate"><span className="truncate">{titleOf(l)}</span>
                  <button aria-label="Restore" className="shrink-0 text-muted-foreground hover:text-primary" onClick={() => update({ hiddenLinks: content.hiddenLinks.filter((x) => x !== l) })}><Undo2 className="h-3.5 w-3.5" /></button></p>
              ))}</div>
          </div>
        )}
      </Section>

      <Section title="Blocked sources" hint="Every story from these outlets or channels is removed. Use the exact source name shown on a story.">
        <div className="flex gap-2">
          <Input className="rounded-none" value={source} onChange={(e) => setSource(e.target.value)} placeholder="e.g. Tuko" onKeyDown={(e) => { if (e.key === "Enter" && source.trim()) { update({ blockedSources: [...new Set([...content.blockedSources, source.trim()])] }); setSource(""); } }} />
          <Button className="rounded-none" disabled={!source.trim() || save.isPending} onClick={() => { update({ blockedSources: [...new Set([...content.blockedSources, source.trim()])] }); setSource(""); }}>Block</Button>
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          {content.blockedSources.length === 0 && <p className="text-sm text-muted-foreground">No sources blocked.</p>}
          {content.blockedSources.map((s) => (
            <span key={s} className="inline-flex items-center gap-1 border border-foreground px-2 py-1 text-sm">{s}
              <button aria-label={`Unblock ${s}`} onClick={() => update({ blockedSources: content.blockedSources.filter((x) => x !== s) })}><X className="h-3.5 w-3.5" /></button></span>
          ))}
        </div>
      </Section>

      <Section title="Extra blocked words and phrases" hint="One per line. Any story containing one of these (whole word or phrase, any case) is removed, in addition to the built-in filter.">
        <Field label="Blocked words"><Textarea className="min-h-32 rounded-none" value={wordText} onChange={(e) => setWords(e.target.value)} /></Field>
        <Button className="mt-3 rounded-none" disabled={save.isPending || words === null} onClick={() => { update({ blockedWords: [...new Set(lines(wordText))] }); setWords(null); }}>Save word list</Button>
      </Section>
    </div>
  );
}
