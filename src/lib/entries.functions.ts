import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { rowToAspirant, type EntryRow } from "./entries";
import type { Aspirant } from "./manifestos";

const COLS = "id,slug,name,office,region,affiliation,status,status_note,evidence_state,overview,priorities,gaps,sources,pillars,published,reviewed_at,updated_at,candidate_statement,origin";
const OLD_COLS = "id,slug,name,office,region,affiliation,status,overview,priorities,gaps,sources,published,updated_at";

/** Reads published entries, tolerating a database that has not had the newest setup SQL yet. */
async function readEntries(slug?: string): Promise<EntryRow[]> {
  const { publicClient } = await import("./public-client.server");
  const sb = publicClient();
  const run = async (cols: string) => {
    const q = sb.from("aspirant_entries").select(cols).eq("published", true);
    return slug ? await q.eq("slug", slug) : await q.order("name");
  };
  let res = await run(COLS);
  if (res.error) res = await run(OLD_COLS);
  if (res.error) { console.error("[entries] could not load:", res.error.message); return []; }
  return (res.data as unknown as Partial<EntryRow>[]).map((r) => ({ status_note: "", evidence_state: "Not yet assessed", pillars: [], reviewed_at: null, candidate_statement: {}, origin: "editorial", ...r })) as EntryRow[];
}

export const getPublishedEntries = createServerFn({ method: "GET" }).handler(async (): Promise<Aspirant[]> => {
  try { return (await readEntries()).map(rowToAspirant); } catch (e) { console.error("entries failed", e); return []; }
});

export const getPublishedEntry = createServerFn({ method: "GET" })
  .inputValidator((d) => z.object({ slug: z.string().max(100) }).parse(d))
  .handler(async ({ data }): Promise<Aspirant | null> => {
    const rows = await readEntries(data.slug);
    return rows[0] ? rowToAspirant(rows[0]) : null;
  });
