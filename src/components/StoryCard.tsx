import { shareQuoteCard, signedShareText, waLink } from "@/lib/share";
import type { Lang } from "@/lib/editions";
import { categoryLabel, dateLocale, t } from "@/lib/i18n";
import { useLang } from "@/lib/use-edition";

/** One story, as the home page, the trails and the world strip all show it. */
export type Story = { id: string | number; title: string; link: string; source: string; category: string; platform: string; summary: string; published: number };

/** "5m ago", "3h ago", "2d ago" in the reader's language; for anything older than two weeks, the date. */
export function when(time: number, referenceTime: number = Date.now(), lang: Lang = "en"): string {
  const m = Math.max(1, Math.round((referenceTime - time) / 60000));
  if (m < 60) return t(lang, "ago.min", { n: m });
  const h = Math.round(m / 60);
  if (h < 48) return t(lang, "ago.hour", { n: h });
  const d = Math.round(h / 24);
  if (d <= 14) return t(lang, "ago.day", { n: d });
  const sameYear = new Date(time).getFullYear() === new Date(referenceTime).getFullYear();
  return new Date(time).toLocaleDateString(dateLocale(lang), { day: "numeric", month: "short", ...(sameYear ? {} : { year: "numeric" }) });
}

const dateOf = (time: number, lang: Lang) => new Date(time).toLocaleDateString(dateLocale(lang), { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });

/** `dateOnly` shows the publication date instead of "3h ago": for the archive, where stories are old and pages are cached. */
export function StoryMeta({ i, referenceTime, dateOnly = false }: { i: Pick<Story, "category" | "source" | "platform" | "published">; referenceTime: number; dateOnly?: boolean }) {
  const lang = useLang();
  return (
    <div className="flex flex-wrap items-center gap-2 text-[11px] uppercase tracking-wider">
      <span className="bg-accent px-1.5 py-0.5 font-semibold text-accent-foreground">{categoryLabel(lang, i.category)}</span>
      <span className="font-semibold">{i.source}</span>
      <span className="text-muted-foreground">{i.platform ? `· ${i.platform} ` : ""}· {dateOnly ? dateOf(i.published, lang) : when(i.published, referenceTime, lang)}</span>
    </div>
  );
}

export function ShareRow({ i }: { i: Pick<Story, "title" | "link" | "source" | "category"> }) {
  const lang = useLang();
  return (
    <div className="mt-2 flex gap-3 text-xs font-semibold">
      <a href={waLink(signedShareText(`*${i.title}*`, i.link, i.category))} target="_blank" rel="noreferrer" className="text-secondary hover:underline">{t(lang, "common.whatsapp")}</a>
      <button onClick={() => shareQuoteCard(i.title, i.source, i.category)} className="text-muted-foreground hover:text-primary">{t(lang, "common.quoteCard")}</button>
    </div>
  );
}

/** The standard story card: category, outlet and age, headline, two lines of summary, and share buttons. */
export function StoryCard({ i, referenceTime, fresh = false, dateOnly = false }: { i: Story; referenceTime: number; fresh?: boolean; dateOnly?: boolean }) {
  const lang = useLang();
  return (
    <div className="border-t border-border pt-3">
      <a href={i.link} target="_blank" rel="noreferrer noopener" data-track="story_click" data-track-target={i.link} className="group block">
        <StoryMeta i={i} referenceTime={referenceTime} dateOnly={dateOnly} />
        <h3 className="mt-1.5 text-lg font-semibold leading-snug group-hover:text-primary" style={{ fontFamily: "'Fraunces', serif" }}>
          {fresh && <span className="me-2 bg-primary px-1.5 py-0.5 align-middle font-sans text-[10px] font-bold uppercase text-primary-foreground">{t(lang, "common.new")}</span>}
          {i.title}
        </h3>
        {i.summary && <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{i.summary}</p>}
      </a>
      <ShareRow i={i} />
    </div>
  );
}
