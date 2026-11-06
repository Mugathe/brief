export type Window = { after: string; before: string };
export type Row = { link: string; title: string; summary: string; source: string; platform: string; category: string; published_at: string };
export function monthWindows(from: string, to: string | Date): Window[];
export function splitWindow(w: Window): [Window, Window] | null;
export function buildQuery(base: string, sites: string[], w: Window, addKenya?: boolean): string;
export function rssUrl(q: string): string;
export function parseRss(xml: string, now?: number): Row[];
export function runBackfill(o: {
  query: string; sites?: string[]; from: string; to: string | Date; addKenya?: boolean; delayMs?: number; state?: { done: string[] };
  fetchText: (url: string) => Promise<string>; write: (rows: Row[]) => Promise<void>; log?: (s: string) => void; sleep?: (ms: number) => Promise<void>;
  saveState?: (s: { done: string[] }) => void; cap?: number;
}): Promise<{ requests: number; rows: number; windows: number; skipped: number; capped: number }>;
export function parseArgs(argv: string[]): Record<string, string | boolean | string[]> & { _: string[] };
