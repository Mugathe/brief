import { useLoaderData, useRouterState } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { getConsent, PRIVACY_CHOICES_EVENT, setConsent } from "@/lib/consent";
import { installClickTracking, recordView, setConsentMode } from "@/lib/tracker";
import { useRouteContext } from "@tanstack/react-router";
import { bannerFor } from "@/lib/ads";
import { useEdition, useT } from "@/lib/use-edition";

const LEVEL: Record<string, string> = {
  info: "bg-foreground text-background",
  celebration: "bg-secondary text-secondary-foreground",
  alert: "bg-primary text-primary-foreground",
};

/** Site-wide announcement banner plus anonymous visit tracking. */
export function SiteChrome() {
  const site = useLoaderData({ from: "__root__" });
  const edition = useEdition().code;
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  const { t } = useT();
  const { visitorConsent } = useRouteContext({ strict: false }) as { visitorConsent?: "optin" | "optout" };
  // The rule for this reader's country must be known before the first visit is counted, so it is set in render, not in an effect.
  if (visitorConsent) setConsentMode(visitorConsent);

  useEffect(() => installClickTracking(), []);
  useEffect(() => { recordView(pathname); }, [pathname]);

  const [askConsent, setAskConsent] = useState(false);
  useEffect(() => { setAskConsent(getConsent() === "unset"); }, []);
  // The footer's "Privacy choices" asks again.
  useEffect(() => {
    const again = () => setAskConsent(true);
    window.addEventListener(PRIVACY_CHOICES_EVENT, again);
    return () => window.removeEventListener(PRIVACY_CHOICES_EVENT, again);
  }, []);
  const answer = (c: "granted" | "declined") => { setConsent(c); setAskConsent(false); };
  const staffArea = pathname.startsWith("/admin") || pathname.startsWith("/auth");

  const b = bannerFor(site.banner, site.regionalBanners, edition);
  const btn = "border border-foreground px-4 py-1.5 font-semibold hover:bg-muted"; // equal weight: declining must be as easy as accepting
  const notice = askConsent && !staffArea ? (
    <div role="dialog" aria-label={t("consent.label")} className="fixed inset-x-0 bottom-0 z-50 border-t-2 border-foreground bg-background p-4 shadow-lg">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 text-sm">
        <p className="max-w-3xl">{t("consent.text")} <Link to="/privacy" className="underline">{t("consent.privacy")}</Link></p>
        <div className="flex gap-2">
          <button onClick={() => answer("declined")} className={btn}>{t("consent.decline")}</button>
          <button onClick={() => answer("granted")} className={btn}>{t("consent.accept")}</button>
        </div>
      </div>
    </div>
  ) : null;
  if (!b.active || !b.text || staffArea) return notice;
  const inner = <span className="mx-auto block max-w-6xl px-4 py-2 text-center text-sm font-semibold">{b.text}</span>;
  return (
    <>
      <div role={b.level === "alert" ? "alert" : "status"} className={LEVEL[b.level] ?? LEVEL["info"]}>
        {b.link ? <a href={b.link} target="_blank" rel="noreferrer" className="block hover:underline">{inner}</a> : inner}
      </div>
      {notice}
    </>
  );
}
