import { editionOf, EDITIONS } from "./editions";

/** "*" is the whole site: settings and ads that are not tied to one region. */
export const ALL = "*";

export type Access = { isAdmin: boolean; regions: string[] };

/** Admins, and staff given "*", manage every region and the site-wide settings. */
export const manageAll = (a: Access): boolean => a.isAdmin || a.regions.includes(ALL);

/** What this person may pick as "working on" in the admin: the whole site only if they manage everything. */
export function scopesFor(a: Access): string[] {
  if (manageAll(a)) return [ALL, ...EDITIONS.map((e) => e.code)];
  return EDITIONS.map((e) => e.code).filter((c) => a.regions.includes(c));
}

export const canManageScope = (a: Access, scope: string): boolean => (scope === ALL ? manageAll(a) : manageAll(a) || a.regions.includes(scope));

/** Can they change something shown in these editions? An empty list means everywhere, which needs the whole site. */
export const canManageEditions = (a: Access, editions: readonly string[]): boolean =>
  manageAll(a) || (editions.length > 0 && editions.every((e) => a.regions.includes(e)));

export const scopeLabel = (scope: string): string => (scope === ALL ? "Whole site (all regions)" : `${editionOf(scope).flag} ${editionOf(scope).name}`);

/** Where an ad or board item is shown, in words. */
export const editionsLabel = (editions: readonly string[]): string =>
  editions.length === 0 ? "Everywhere" : editions.map((c) => editionOf(c).name).join(", ");
