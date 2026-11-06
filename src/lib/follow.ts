import { useCallback, useEffect, useState } from "react";

export type Followed = { key: string; title: string; query: string; slug: string | null; seen: string };
const KEY = "kp_follow";
const EVENT = "kp-follow-change";

function read(): Followed[] {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) ?? "[]");
    return Array.isArray(raw)
      ? raw.filter((x): x is Followed => !!x && typeof x.key === "string" && typeof x.query === "string" && typeof x.title === "string" && typeof x.seen === "string").slice(0, 20)
      : [];
  } catch { return []; }
}
function write(items: Followed[]) {
  try { localStorage.setItem(KEY, JSON.stringify(items.slice(0, 20))); window.dispatchEvent(new Event(EVENT)); } catch { /* storage unavailable */ }
}

/** Trails a visitor follows, kept privately in their own browser (no account needed). */
export function useFollowed() {
  const [items, setItems] = useState<Followed[]>([]);
  const [ready, setReady] = useState(false);
  useEffect(() => {
    const load = () => setItems(read());
    load(); setReady(true);
    window.addEventListener(EVENT, load); window.addEventListener("storage", load);
    return () => { window.removeEventListener(EVENT, load); window.removeEventListener("storage", load); };
  }, []);
  const follow = useCallback((f: Omit<Followed, "seen">) => write([{ ...f, seen: new Date().toISOString() }, ...read().filter((x) => x.key !== f.key)]), []);
  const unfollow = useCallback((key: string) => write(read().filter((x) => x.key !== key)), []);
  const markSeen = useCallback((key: string) => write(read().map((x) => (x.key === key ? { ...x, seen: new Date().toISOString() } : x))), []);
  return { items, ready, follow, unfollow, markSeen };
}

export const trailKey = (slug: string | null, query: string) => (slug ? `t:${slug}` : `q:${query.toLowerCase().trim()}`);
