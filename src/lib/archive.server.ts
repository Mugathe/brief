import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import type { NewsItem } from "./news.server";

export type ArchiveRun = { at: number; sent: number; error?: string };
let lastRun: ArchiveRun | null = null;

/** History needs the server-side key: only the server may write to the archive. */
export function archiveConfigured(): boolean {
  return !!(process.env["SUPABASE_URL"] && process.env["SUPABASE_SERVICE_ROLE_KEY"]);
}
export const lastArchiveRun = () => lastRun;

let lastPurge = 0;
/** Applies the retention rules (see migration 0006). At most once a day per server instance. Never throws. */
export async function purgeOldRecords(): Promise<unknown> {
  if (!archiveConfigured() || Date.now() - lastPurge < 24 * 3600_000) return null;
  lastPurge = Date.now();
  try {
    const { data, error } = await writer().rpc("purge_old_records");
    if (error) throw new Error(error.message);
    return data;
  } catch (e) { console.error("[retention] clean-up failed:", e instanceof Error ? e.message : e); return null; }
}

function writer() {
  return createClient<Database>(process.env["SUPABASE_URL"]!, process.env["SUPABASE_SERVICE_ROLE_KEY"]!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

/** Saves headlines to the permanent archive, tagged with the edition (country) they were found in. Already-known links are skipped. Never throws. */
export async function archiveStories(items: NewsItem[], edition: string): Promise<{ configured: boolean; sent: number; error?: string }> {
  if (!archiveConfigured()) return { configured: false, sent: 0 };
  const horizon = Date.now() + 24 * 3600_000;
  const rows = items
    .filter((i) => i.link.length <= 1000 && i.title.length >= 3 && i.published > 0 && i.published < horizon)
    .map((i) => ({
      link: i.link,
      title: i.title.slice(0, 400),
      summary: i.summary.slice(0, 600),
      source: i.source.slice(0, 120),
      platform: i.platform.slice(0, 60),
      category: i.category.slice(0, 60),
      edition,
      published_at: new Date(i.published).toISOString(),
    }));
  try {
    const sb = writer();
    for (let n = 0; n < rows.length; n += 200) {
      const { error } = await sb.from("news_archive").upsert(rows.slice(n, n + 200), { onConflict: "link", ignoreDuplicates: true });
      if (error) throw new Error(error.message);
    }
    lastRun = { at: Date.now(), sent: rows.length };
    return { configured: true, sent: rows.length };
  } catch (e) {
    const error = e instanceof Error ? e.message : String(e);
    console.error("[archive] could not save headlines:", error);
    lastRun = { at: Date.now(), sent: 0, error };
    return { configured: true, sent: 0, error };
  }
}
