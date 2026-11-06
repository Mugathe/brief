import { Link, useRouterState } from "@tanstack/react-router";
import { LEGAL } from "@/lib/legal";
import { useT } from "@/lib/use-edition";
import { reopenPrivacyChoices } from "@/lib/consent";

/** Site-wide footer with the legal pages. Hidden in the staff area. */
export function SiteFooter() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const { t } = useT();
  if (pathname.startsWith("/admin") || pathname.startsWith("/auth")) return null;
  return (
    <footer className="mt-10 border-t border-border py-8 text-xs text-muted-foreground">
      <div className="mx-auto flex max-w-6xl flex-col gap-3 px-4">
        <nav aria-label="Legal" className="flex flex-wrap gap-x-5 gap-y-2 font-semibold uppercase tracking-wider text-foreground">
          <Link to="/terms" className="hover:text-primary">{t("foot.terms")}</Link>
          <Link to="/privacy" className="hover:text-primary">{t("foot.privacy")}</Link>
        <button type="button" onClick={reopenPrivacyChoices} className="hover:text-primary">{t("consent.choices")}</button>
          <Link to="/editorial" className="hover:text-primary">{t("foot.editorial")}</Link>
          <a href={`mailto:${LEGAL.email}?subject=${encodeURIComponent(t("foot.report"))}`} className="hover:text-primary">{t("foot.report")}</a>
          <Link to="/auth" className="hover:text-primary">{t("foot.staff")}</Link>
        </nav>
        <p>{t("foot.disclaimer")}</p>
        <p>© {new Date().getFullYear()} {LEGAL.owner}. {t("foot.info", { brand: LEGAL.brand })}</p>
      </div>
    </footer>
  );
}
