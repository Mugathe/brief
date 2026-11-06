import { EDITIONS, type Lang } from "./editions";
import { canonLang } from "./i18n";
import type { ConsentMode } from "./consent";

/** Remembers a visitor's own choices between visits: which edition, and which language. Read on the server, written when they use the pickers. */
export const EDITION_COOKIE = "brief_edition";
export const LANG_COOKIE = "brief_lang";

type Session = { edition: string; lang: Lang | null; consent: ConsentMode };
let session: Session | undefined;
/** What the visitor chose or was placed in this session (browser only), so moving between pages does not ask the server again. */
export const sessionVisitor = (): Session | undefined => session;
export const setSessionVisitor = (v: Session): void => { if (typeof window !== "undefined") session = { ...v }; };

const keep = (name: string, value: string) => { if (typeof document !== "undefined") document.cookie = `${name}=${value}; path=/; max-age=31536000; samesite=lax`; };

/** Called when the visitor picks an edition: keeps it for a year and for the rest of this session. */
export function rememberEdition(code: string): void {
  if (!EDITIONS.some((e) => e.code === code)) return;
  if (session) session.edition = code;
  keep(EDITION_COOKIE, code);
}

/** Called when the visitor picks a language for the pages and the bulletin. */
export function rememberLang(lang: string): void {
  const l = canonLang(lang);
  if (!l) return;
  if (session) session.lang = l;
  keep(LANG_COOKIE, l);
}
