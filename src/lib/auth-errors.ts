/** Turns the technical errors Supabase or Google send back into something a person can act on. */
export function explainAuthError(code: string, description: string): string {
  const d = `${code} ${description}`.toLowerCase();
  if (d.includes("missing oauth secret"))
    return "Google sign-in isn't finished on the database. In Supabase open Authentication, then Sign In / Providers, then Google, and fill in both the Client ID and the Client secret from Google Cloud.";
  if (d.includes("provider is not enabled") || d.includes("unsupported provider"))
    return "Google sign-in is switched off. In Supabase open Authentication, then Sign In / Providers, then Google, and turn it on.";
  if (d.includes("unable to exchange external code") || d.includes("invalid_client") || d.includes("unauthorized_client"))
    return "Google accepted you, but the database couldn't complete the sign-in. The Client ID or Client secret saved in Supabase is probably wrong, or has a stray space. Paste them again from Google Cloud.";
  if (d.includes("redirect") || d.includes("bad_oauth_callback") || d.includes("redirect_uri_mismatch"))
    return "The address you returned to isn't on the allowed list. In Supabase open Authentication, then URL Configuration, and add this site's address followed by /** (for example http://localhost:8080/**).";
  if (d.includes("otp_expired") || d.includes("expired"))
    return "That link has expired. Sign in below and choose “Resend confirmation” to get a new one.";
  if (d.includes("access_denied"))
    return "Sign-in was cancelled or Google didn't allow it. If your Google app is still in testing mode, add your account as a test user or publish the app.";
  return description || "Sign-in failed. Please try again.";
}

/** Reads an error Supabase put in the page address after a failed sign-in, then removes it from the address bar. */
export function takeAuthErrorFromUrl(): string | null {
  if (typeof window === "undefined") return null;
  const params = new URLSearchParams(window.location.hash.replace(/^#/, ""));
  new URLSearchParams(window.location.search).forEach((v, k) => { if (!params.has(k)) params.set(k, v); });
  const description = params.get("error_description");
  const code = params.get("error_code") ?? params.get("error") ?? "";
  if (!params.get("error") && !description) return null;
  window.history.replaceState(null, "", window.location.pathname);
  return explainAuthError(code, (description ?? "").replace(/\+/g, " "));
}

/** Asks the database (publicly) whether Google sign-in is switched on, before sending anyone away. */
export async function googleIsEnabled(): Promise<boolean | null> {
  try {
    const url = import.meta.env["VITE_SUPABASE_URL"] as string | undefined;
    const key = import.meta.env["VITE_SUPABASE_PUBLISHABLE_KEY"] as string | undefined;
    if (!url || !key) return null;
    const res = await fetch(`${url}/auth/v1/settings`, { headers: { apikey: key } });
    if (!res.ok) return null;
    const json = (await res.json()) as { external?: { google?: boolean } };
    return json.external?.google ?? null;
  } catch { return null; }
}
