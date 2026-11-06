/**
 * Details shown on the Terms, Privacy and Editorial pages. Set them in .env (see .env.example);
 * anything left unset shows as [bracketed text] so you can spot what still needs filling in.
 */
const v = (k: string, fallback: string) => ((import.meta.env[k] as string | undefined) ?? "").trim() || fallback;

export const LEGAL = {
  brand: v("VITE_BRAND_NAME", "Brief"),
  owner: v("VITE_LEGAL_NAME", "[registered business name]"),
  address: v("VITE_LEGAL_ADDRESS", "[registered address], Kenya"),
  email: v("VITE_CONTACT_EMAIL", "[contact email]"),
  updated: "10 October 2026",
};
export const needsLegalDetails = () => [LEGAL.owner, LEGAL.address, LEGAL.email].some((x) => x.startsWith("["));
