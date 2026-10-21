'use client';

import { createContext, useCallback, useContext, useMemo, useState } from 'react';
import { LANG_COOKIE, locale, serverMsg, tr, verdictText, type Lang } from '@/lib/aiI18n';
import type { Verdict } from '@/lib/aiShared';

type Ctx = {
  lang: Lang;
  setLang: (l: Lang) => void;
  /** An interface phrase in the chosen language. */
  t: (s: string, vars?: Record<string, string | number>) => string;
  /** A message the server wrote in English. */
  msg: (s: string) => string;
  verdict: (v: Verdict) => ReturnType<typeof verdictText>;
  locale: string;
};

const Lang = createContext<Ctx | null>(null);

/** The EN / ES choice for the whole AI Reviewer. It is kept in a cookie, so the server renders the right language on the first paint. */
export function LangProvider({ initial, children }: { initial: Lang; children: React.ReactNode }) {
  const [lang, set] = useState<Lang>(initial);
  const setLang = useCallback((l: Lang) => {
    set(l);
    document.cookie = `${LANG_COOKIE}=${l}; path=/; max-age=31536000; samesite=lax`;
  }, []);
  const value = useMemo<Ctx>(() => ({
    lang, setLang,
    t: (s, vars) => tr(lang, s, vars),
    msg: (s) => serverMsg(lang, s),
    verdict: (v) => verdictText(lang, v),
    locale: locale(lang),
  }), [lang, setLang]);
  return <Lang.Provider value={value}>{children}</Lang.Provider>;
}

export function useLang() {
  const c = useContext(Lang);
  if (!c) throw new Error('useLang needs a LangProvider');
  return c;
}

/** EN | ES switch for the page header. */
export function LangToggle() {
  const { lang, setLang, t } = useLang();
  return (
    <div className="ai-lang" role="group" aria-label={t('Language')}>
      {(['en', 'es'] as const).map((l) => (
        <button key={l} className={lang === l ? 'on' : ''} aria-pressed={lang === l} onClick={() => setLang(l)}>{l.toUpperCase()}</button>
      ))}
    </div>
  );
}
