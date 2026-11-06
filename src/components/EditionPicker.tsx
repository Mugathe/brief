import { useNavigate, useRouter } from "@tanstack/react-router";
import { EDITIONS } from "@/lib/editions";
import { editionLabel, LANGS } from "@/lib/i18n";
import { useT } from "@/lib/use-edition";
import { rememberEdition, rememberLang } from "@/lib/visitor-edition";

/** Switches the page to another country (or the world), or to another language, and remembers the choice for next time. */
export function EditionPicker({ className = "" }: { className?: string }) {
  const { edition, lang, t } = useT();
  const navigate = useNavigate();
  const router = useRouter();
  const pickEdition = (code: string) => {
    rememberEdition(code);
    // The page decides its own search shape, so this one call is loosely typed: it only ever sets "e".
    void navigate({ to: ".", search: ((prev: Record<string, unknown>) => ({ ...prev, e: code })) as never });
  };
  const pickLang = (code: string) => {
    rememberLang(code);
    void router.invalidate(); // re-read the language everywhere, including the bulletin
  };
  const select = "border border-foreground bg-background px-2 py-1 text-xs font-semibold normal-case tracking-normal text-foreground";
  return (
    <span className={`inline-flex flex-wrap items-center gap-2 ${className}`}>
      <label className="inline-flex items-center gap-1">
        <span className="sr-only">{t("pick.edition")}</span>
        <select value={edition.code} onChange={(e) => pickEdition(e.target.value)} className={select}>
          {EDITIONS.map((e) => <option key={e.code} value={e.code}>{editionLabel(e, lang)}</option>)}
        </select>
      </label>
      <label className="inline-flex items-center gap-1">
        <span className="sr-only">{t("pick.language")}</span>
        <select value={lang} onChange={(e) => pickLang(e.target.value)} className={select} lang={lang}>
          {LANGS.map((l) => <option key={l.code} value={l.code} lang={l.code}>{l.name}</option>)}
        </select>
      </label>
    </span>
  );
}
