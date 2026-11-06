import { useRouteContext, useSearch } from "@tanstack/react-router";
import { canonEdition, DEFAULT_EDITION, editionOf, type Edition, type Lang } from "./editions";
import { inPlace, placeName, t as translate, type Key } from "./i18n";

/**
 * The edition being shown, and `e`, the one named in the address (undefined when the visitor has not picked one,
 * in which case their own region applies). Links should pass `e` along so the page they open matches this one.
 */
export function useEditionState(): { edition: Edition; e: string | undefined } {
  const search = useSearch({ strict: false }) as { e?: unknown };
  const ctx = useRouteContext({ strict: false }) as { visitorEdition?: string };
  const e = canonEdition(search.e);
  return { edition: editionOf(e ?? ctx.visitorEdition ?? DEFAULT_EDITION), e };
}

export const useEdition = (): Edition => useEditionState().edition;

/** The language of the pages: the one the visitor chose, otherwise the edition's own. */
export function useLang(): Lang {
  const ctx = useRouteContext({ strict: false }) as { visitorLang?: Lang | null };
  const edition = useEdition();
  return ctx.visitorLang ?? edition.lang;
}

/** Translation for the current language, plus the edition's name in that language ("Kenya" / "Kenia") and where it is ("au Kenya"). */
export function useT() {
  const { edition, e } = useEditionState();
  const lang = useLang();
  const place = placeName(edition, lang);
  const where = inPlace(edition, lang);
  return { lang, edition, e, place, where, t: (key: Key, vars?: Record<string, string | number>) => translate(lang, key, { place, where, ...vars }) };
}
