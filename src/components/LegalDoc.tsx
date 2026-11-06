import type { ReactNode } from "react";
import { LEGAL } from "@/lib/legal";
import { PageShell } from "@/components/PageShell";

export type LegalSection = { h: string; p?: string[]; ul?: string[]; after?: string[] };

export function LegalDoc({ kicker, title, accent, intro, sections, extra }: { kicker: string; title: string; accent: string; intro: string; sections: LegalSection[]; extra?: ReactNode }) {
  return (
    <PageShell kicker={kicker} title={title} accent={accent} intro={intro}>
      <main className="mx-auto max-w-3xl px-4 py-10">
        <p className="text-xs text-muted-foreground">Last updated {LEGAL.updated}</p>
        <nav aria-label="Contents" className="mt-4 border border-border p-4 text-sm">
          <p className="mb-2 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">On this page</p>
          <ol className="columns-1 gap-8 sm:columns-2">
            {sections.map((s, n) => <li key={s.h} className="break-inside-avoid py-0.5"><a href={`#s${n + 1}`} className="hover:text-primary hover:underline">{n + 1}. {s.h}</a></li>)}
          </ol>
        </nav>
        <div className="mt-8 space-y-8">
          {sections.map((s, n) => (
            <section key={s.h} id={`s${n + 1}`} className="scroll-mt-6">
              <h2 className="text-xl font-bold" style={{ fontFamily: "'Fraunces', serif" }}>{n + 1}. {s.h}</h2>
              {s.p?.map((t, i) => <p key={i} className="mt-3 leading-relaxed">{t}</p>)}
              {s.ul && <ul className="mt-3 list-disc space-y-1.5 pl-6 leading-relaxed">{s.ul.map((t, i) => <li key={i}>{t}</li>)}</ul>}
              {s.after?.map((t, i) => <p key={i} className="mt-3 leading-relaxed">{t}</p>)}
            </section>
          ))}
        </div>
        {extra}
      </main>
    </PageShell>
  );
}
