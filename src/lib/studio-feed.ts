import type { Segment } from "./bulletin";
import type { CardInput } from "./studio";
import { shareTags } from "./share";

/** One top story of the day, ready to be turned into a card and a reel. */
export type StoryPlan = {
  n: number;
  key: string;
  title: string;
  category: string;
  summary: string;
  sources: string[];
  /** The outlets' own article links. They identify the story, so the same event is never made twice in a day even when the bulletin is reworded. */
  links: string[];
  /** Where every post about this story sends people: the story in the Read the Brief page. */
  path: string;
};

/** Today as YYYYMMDD in UTC, the same on every machine, so the browser and the server agree. */
export const dayKey = (d = new Date()) => d.toISOString().slice(0, 10).replace(/-/g, "");

const hash = (s: string) => {
  let h = 0x811c9dc5;
  for (const ch of s) { h ^= ch.codePointAt(0)!; h = Math.imul(h, 0x01000193) >>> 0; }
  return h.toString(36);
};

/** The Read the Brief page, scrolled to one story. */
export const briefPath = (edition: string, n?: number) => `/brief?e=${encodeURIComponent(edition)}${n ? `#story-${n}` : ""}`;

export const firstSentence = (s: string) => {
  const t = s.replace(/\s+/g, " ").trim();
  const m = t.match(/^.{20,260}?[.!?](?=\s|$)/);
  return (m ? m[0] : t.slice(0, 200)).trim();
};

/** The day's top stories, in the order the bulletin gives them (most important first). */
export function planStories(segments: Segment[], edition: string, day: string, max = 6): StoryPlan[] {
  return segments
    .filter((s) => s.kind === "story")
    .slice(0, max)
    .map((s, i) => {
      const links = [...new Set(s.sources.map((x) => x.link).filter(Boolean))].sort();
      return {
      n: i + 1,
      key: `${day}-${hash(links[0] ?? s.title.toLowerCase())}`,
      title: s.title.trim(),
      category: s.category || "News",
      summary: firstSentence(s.detail ?? s.script ?? ""),
      sources: [...new Set(s.sources.map((x) => x.name.trim()).filter(Boolean))].slice(0, 3),
      links: links.slice(0, 8),
      path: briefPath(edition, i + 1),
    };
    });
}

/** The card for a story. Nobody is quoted: it is the headline, with the outlets that reported it. */
export function headlineCard(p: StoryPlan, address: string): CardInput {
  return { kind: "headline", quote: p.title, speaker: p.sources.length ? `Reported by ${p.sources.join(", ")}` : "", role: "", category: p.category, url: address };
}

/** The words that go with a post. The link always leads to the story in the Brief. */
export function captionFor(p: Pick<StoryPlan, "title" | "summary" | "category">, site: string, path: string) {
  return [p.title, p.summary && p.summary !== p.title ? p.summary : "", `Read the Brief: ${site}${path}`, shareTags(p.category)].filter(Boolean).join("\n\n");
}

/** What a voice-over says: the headline, then the first sentence of the story. Short, so the reel stays short. */
export function voiceScript(p: { title: string; summary: string }) {
  const title = p.title.trim().replace(/[.!?\s]+$/, "");
  const extra = p.summary.trim() && p.summary.trim().toLowerCase() !== p.title.trim().toLowerCase() ? p.summary.trim() : "";
  const out = extra ? `${title}. ${extra}` : `${title}.`;
  return out.length <= 330 ? out : `${out.slice(0, 330).replace(/\s+\S*$/, "").replace(/[,;:\s]+$/, "")}.`;
}
