import { useEffect, useState } from "react";

/** Set VITE_SITE_URL (e.g. https://kenyapulse.co.ke) so shared links point at your own domain. */
const configured = ((import.meta.env["VITE_SITE_URL"] as string | undefined) ?? "").replace(/\/$/, "");

/** Your site's public address: the configured one, otherwise whatever domain the visitor is on. */
export function useSiteUrl(): string {
  const [url, setUrl] = useState(configured);
  useEffect(() => { if (!configured) setUrl(window.location.origin); }, []);
  return url;
}
