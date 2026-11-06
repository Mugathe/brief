import { ArrowUpRight } from "lucide-react";
import type { ManifestoSource } from "@/lib/manifestos";

export const hostOf = (url: string) => {
  try { return new URL(url).hostname.replace(/^www\./, ""); } catch { return url; }
};

/** Numbered, fully visible list of where every claim on a profile came from. */
export function SourceList({ sources }: { sources: ManifestoSource[] }) {
  if (!sources.length) {
    return <p className="border-l-4 border-primary pl-3 text-sm font-semibold">No sources are linked to this profile. Treat everything here as unverified.</p>;
  }
  return (
    <ol className="grid gap-3 md:grid-cols-2">
      {sources.map((s, n) => (
        <li key={s.url} id={`source-${n + 1}`} className="flex gap-3 border border-border p-3">
          <span className="grid h-6 w-6 shrink-0 place-items-center bg-foreground text-xs font-bold text-background">{n + 1}</span>
          <div className="min-w-0 text-sm">
            <span className={`inline-block px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider ${s.kind === "Candidate or party" ? "bg-accent text-accent-foreground" : "bg-secondary text-secondary-foreground"}`}>
              {s.kind === "Candidate or party" ? "From the candidate or party" : "Independent reporting"}
            </span>
            <a href={s.url} target="_blank" rel="noreferrer noopener" className="mt-1 flex items-start gap-1 font-semibold hover:text-primary">
              <span>{s.title}</span><ArrowUpRight className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            </a>
            <p className="text-xs text-muted-foreground">{[s.publisher, s.date].filter(Boolean).join(" · ")}</p>
            <p className="truncate text-xs text-muted-foreground" title={s.url}>{hostOf(s.url)}</p>
          </div>
        </li>
      ))}
    </ol>
  );
}

/** One-line source summary for list cards. */
export function SourceSummary({ sources }: { sources: ManifestoSource[] }) {
  if (!sources.length) return <p className="text-[11px] font-semibold text-primary">No sources linked</p>;
  const publishers = [...new Set(sources.map((s) => s.publisher).filter(Boolean))];
  return (
    <p className="text-[11px] text-muted-foreground">
      <span className="font-bold uppercase tracking-wider text-foreground">{sources.length} source{sources.length === 1 ? "" : "s"}</span>
      {publishers.length ? ` · ${publishers.slice(0, 3).join(", ")}${publishers.length > 3 ? " +" + (publishers.length - 3) : ""}` : ""}
    </p>
  );
}
