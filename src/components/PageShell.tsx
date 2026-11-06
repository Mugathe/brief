import { Link } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { EditionPicker } from "@/components/EditionPicker";
import { useT } from "@/lib/use-edition";

const serif = { fontFamily: "'Fraunces', serif" };

/** Shared look for the Trending and Trails pages. `picker` adds the edition (country) switcher for pages that follow ?e=. */
export function PageShell({ kicker, title, accent, intro, action, picker, children }: { kicker: string; title: string; accent: string; intro: string; action?: ReactNode; picker?: boolean; children: ReactNode }) {
  const { e, t } = useT();
  return (
    <div className="min-h-screen bg-background text-foreground" style={{ fontFamily: "'IBM Plex Sans', sans-serif" }}>
      <div className="flex h-1.5"><div className="flex-1 bg-foreground" /><div className="flex-1 bg-primary" /><div className="flex-1 bg-secondary" /></div>
      <header className="border-b-2 border-foreground">
        <div className="mx-auto max-w-6xl px-4 py-8">
          <div className="flex flex-wrap items-center justify-between gap-3 text-xs font-semibold uppercase tracking-wider">
            <Link to="/" search={{ e }} className="hover:text-primary">{t("nav.allStories")}</Link>
            <nav className="flex flex-wrap items-center gap-4">
              {picker && <EditionPicker />}
              <Link to="/trending" search={{ e }} className="hover:text-primary">{t("nav.trending")}</Link>
              <Link to="/trails" search={{ e }} className="hover:text-primary">{t("nav.trails")}</Link>
              <Link to="/manifestos" className="hover:text-primary">{t("nav.manifestoKe")}</Link>
            </nav>
          </div>
          <div className="mt-6 grid gap-6 md:grid-cols-[1fr_auto] md:items-end">
            <div>
              <p className="text-xs font-bold uppercase tracking-widest text-secondary">{kicker}</p>
              <h1 className="mt-2 text-5xl font-black leading-none md:text-6xl" style={serif}>{title} <span className="text-primary">{accent}</span></h1>
              <p className="mt-4 max-w-3xl text-base text-muted-foreground">{intro}</p>
            </div>
            {action}
          </div>
        </div>
      </header>
      {children}
    </div>
  );
}
