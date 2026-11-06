import { canManageScope, scopeLabel, scopesFor, type Access } from "@/lib/regions";

/** "Working on: Kenya". Everything below that is region-aware (ads, content rules, banner, social board) follows this choice. */
export function RegionBar({ access, scope, onScope }: { access: Access; scope: string; onScope: (s: string) => void }) {
  const options = scopesFor(access);
  if (options.length === 0) {
    return (
      <p className="mt-4 border border-dashed border-foreground p-3 text-sm">
        You have staff access but no regions yet, so you can't change anything. Ask an admin to give you the regions you look after (Team tab).
      </p>
    );
  }
  return (
    <div className="mt-4 flex flex-wrap items-center gap-3 border border-border bg-muted/40 p-3 text-sm">
      <label className="flex items-center gap-2 font-semibold">
        Working on
        <select value={canManageScope(access, scope) ? scope : options[0]} onChange={(e) => onScope(e.target.value)} className="border border-foreground bg-background px-2 py-1.5 font-normal">
          {options.map((o) => <option key={o} value={o}>{scopeLabel(o)}</option>)}
        </select>
      </label>
      <span className="text-xs text-muted-foreground">
        {options.length === 1 ? "These are the settings for your region." : "Ads, content rules, the banner and the social board follow this choice. Themes and the AdSense account stay site-wide."}
      </span>
    </div>
  );
}
