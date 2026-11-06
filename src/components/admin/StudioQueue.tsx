import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Section, errMsg } from "./shared";
import { deleteStudioPosts, groupPosts, listStudioPosts, setStudioStatus, type StudioGroup, type StudioPost } from "@/lib/studio-db";
import { getSocialStatus, postStudioSocial } from "@/lib/studio.functions";
import { shareOrDownload } from "@/lib/studio";

/** Everything the Studio has made for this edition. Nothing reaches the home page until an editor publishes it here. */
export function StudioQueue({ edition, canEdit }: { edition: string; canEdit: boolean }) {
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ["studio-posts", edition], queryFn: () => listStudioPosts(edition) });
  const groups = groupPosts(q.data ?? []);
  const drafts = groups.filter((g) => g.status === "draft");
  const refresh = () => qc.invalidateQueries({ queryKey: ["studio-posts", edition] });
  const status = useMutation({
    mutationFn: ({ gs, s }: { gs: StudioGroup[]; s: "draft" | "published" }) => setStudioStatus(gs.flatMap((g) => g.posts.map((p) => p.id)), s),
    onSuccess: async (_d, v) => { toast.success(v.s === "published" ? "Published to the home page" : "Taken off the home page"); await refresh(); },
    onError: (e) => toast.error(errMsg(e)),
  });
  const remove = useMutation({
    mutationFn: (g: StudioGroup) => deleteStudioPosts(g.posts),
    onSuccess: async () => { toast.success("Deleted"); await refresh(); },
    onError: (e) => toast.error(errMsg(e)),
  });
  const social = useQuery({ queryKey: ["social-status"], queryFn: () => getSocialStatus(), retry: false });
  const post = useMutation({
    mutationFn: (v: { id: number; target: "facebook" | "youtube" }) => postStudioSocial({ data: { ...v, again: false } }),
    onSuccess: async (_d, v) => { toast.success(`Posted to ${v.target === "facebook" ? "Facebook" : "YouTube"}`); await refresh(); },
    onError: (e) => toast.error(errMsg(e)),
  });
  const postButtons = (p: StudioPost) => (["facebook", "youtube"] as const).filter((t) => t === "facebook" || p.kind === "video").map((t) => {
    const name = t === "facebook" ? "Facebook" : "YouTube", done = p.shared?.[t];
    const what = p.kind === "image" ? "photo" : "reel";
    return (
      <Button key={`${p.id}-${t}`} size="sm" variant="outline" className="rounded-none" disabled={!!done || post.isPending || !social.data?.[t]} title={social.data?.[t] ? undefined : `${name} is not set up on the server yet`} onClick={() => post.mutate({ id: p.id, target: t })}>
        {done ? `✓ ${what} on ${name}` : `${name} ${what}`}
      </Button>
    );
  });
  const share = async (url: string, name: string, caption: string) => {
    try {
      const blob = await (await fetch(url)).blob();
      await shareOrDownload(blob, name, caption);
    } catch (e) { toast.error(errMsg(e)); }
  };

  return (
    <Section
      title="Review and publish"
      hint="Look at each one, then publish it to the home page. Drafts are visible only to staff. Rendering a story again replaces it and puts it back to draft."
      action={canEdit && drafts.length > 1 ? <Button size="sm" className="rounded-none" disabled={status.isPending} onClick={() => status.mutate({ gs: drafts, s: "published" })}>Publish all {drafts.length} drafts</Button> : undefined}
    >
      {q.isLoading && <p className="text-sm text-muted-foreground">Loading…</p>}
      {q.isError && <p className="text-sm text-destructive">{errMsg(q.error)}. Has the 0012 section of supabase-setup.sql been run?</p>}
      {q.data && groups.length === 0 && <p className="text-sm text-muted-foreground">Nothing made yet for this edition.</p>}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {groups.map((g) => (
          <article key={g.key} className="flex min-w-0 flex-col border border-border">
            <div className="grid grid-cols-2 gap-px bg-border">
              {g.image && <img src={g.image.media_url} alt={g.title} loading="lazy" className="aspect-square w-full bg-muted object-cover" />}
              {g.video && <video src={g.video.media_url} poster={g.image?.media_url} controls playsInline preload="none" className="aspect-[9/16] max-h-full w-full bg-black object-cover" />}
            </div>
            <div className="flex flex-1 flex-col gap-2 p-3">
              <div className="flex items-center gap-2">
                <Badge variant={g.status === "published" ? "default" : "secondary"}>{g.status === "published" ? "On the home page" : "Draft"}</Badge>
                <span className="text-[11px] font-bold uppercase tracking-wider text-primary">{g.category}</span>
              </div>
              <h3 className="text-sm font-bold leading-snug">{g.title}</h3>
              <div className="mt-auto flex flex-wrap gap-1.5 pt-1">
                {canEdit && (g.status === "draft"
                  ? <Button size="sm" className="rounded-none" disabled={status.isPending} onClick={() => status.mutate({ gs: [g], s: "published" })}>Publish</Button>
                  : <Button size="sm" variant="outline" className="rounded-none" disabled={status.isPending} onClick={() => status.mutate({ gs: [g], s: "draft" })}>Unpublish</Button>)}
                <Button size="sm" variant="outline" className="rounded-none" onClick={() => void navigator.clipboard.writeText(g.caption).then(() => toast.success("Caption copied, with the link to the Brief"))}>Copy caption</Button>
                {g.image && <Button size="sm" variant="outline" className="rounded-none" onClick={() => void share(g.image!.media_url, `brief-${g.key}.png`, g.caption)}>Share image</Button>}
                {g.video && <Button size="sm" variant="outline" className="rounded-none" onClick={() => void share(g.video!.media_url, `brief-${g.key}.${g.video!.mime.includes("mp4") ? "mp4" : "webm"}`, g.caption)}>Share reel</Button>}
                {canEdit && g.status === "published" && g.posts.flatMap(postButtons)}
                {canEdit && <Button size="sm" variant="ghost" className="rounded-none text-destructive" disabled={remove.isPending} onClick={() => { if (window.confirm("Delete this for good?")) remove.mutate(g); }}>Delete</Button>}
              </div>
            </div>
          </article>
        ))}
      </div>
    </Section>
  );
}
