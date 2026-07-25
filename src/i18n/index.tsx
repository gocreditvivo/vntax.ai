import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import type { Locale } from '../types';
import { en, type Dict } from './en';
import { vi } from './vi';
import { es } from './es';
import { mergeDict } from './merge';

/**
 * English and Vietnamese are complete. Spanish is merged over English so any
 * untranslated key falls back rather than rendering blank. See merge.ts.
 */
const DICTS: Record<Locale, Dict> = {
  en,
  vi,
  es: mergeDict(en, es),
};

/** BCP 47 tags for Intl formatting and the document `lang` attribute. */
const TAGS: Record<Locale, string> = {
  en: 'en-US',
  vi: 'vi-VN',
  es: 'es-US', // US Spanish: US date and currency conventions, Spanish words.
};

/** Native names — a language menu should read in its own language. */
export const LOCALE_LABELS: Record<Locale, string> = {
  en: 'English',
  vi: 'Tiếng Việt',
  es: 'Español',
};

export const LOCALES: readonly Locale[] = ['en', 'vi', 'es'];

const STORAGE_KEY = 'vntax.locale';

function isLocale(v: unknown): v is Locale {
  return v === 'en' || v === 'vi' || v === 'es';
}

/**
 * Preference order: saved choice, then browser language, then English.
 * A returning Vietnamese-speaking user should not re-pick every visit.
 */
function detectLocale(fallback: Locale): Locale {
  if (typeof window === 'undefined') return fallback;

  try {
    const saved = window.localStorage.getItem(STORAGE_KEY);
    if (isLocale(saved)) return saved;
  } catch {
    // Private browsing can throw on storage access; fall through.
  }

  const nav = window.navigator?.language?.slice(0, 2).toLowerCase();
  if (nav === 'vi' || nav === 'es') return nav;

  return fallback;
}

interface I18nValue {
  locale: Locale;
  setLocale: (l: Locale) => void;
  t: Dict;
  money: (n: number) => string;
  date: (iso: string) => string;
  num: (n: number) => string;
  pct: (n: number) => string;
}

const I18nContext = createContext<I18nValue | null>(null);

export function I18nProvider({
  children,
  initial = 'en',
}: {
  children: ReactNode;
  initial?: Locale;
}) {
  const [locale, setLocaleState] = useState<Locale>(() => detectLocale(initial));

  // Screen readers switch voice on `lang`; without this a Spanish page is read
  // aloud with English pronunciation rules. Required for WCAG 3.1.2.
  useEffect(() => {
    if (typeof document !== 'undefined') {
      document.documentElement.lang = locale;
    }
  }, [locale]);

  const value = useMemo<I18nValue>(() => {
    const tag = TAGS[locale];

    const setLocale = (l: Locale) => {
      setLocaleState(l);
      try {
        window.localStorage.setItem(STORAGE_KEY, l);
      } catch {
        // Non-fatal: the choice simply will not persist.
      }
    };

    return {
      locale,
      setLocale,
      t: DICTS[locale],
      // Currency stays USD in every locale — the business operates in the US.
      money: (n) =>
        new Intl.NumberFormat(tag, {
          style: 'currency',
          currency: 'USD',
          maximumFractionDigits: 0,
        }).format(n),
      // Month-name format in all locales: these are US tax deadlines, and a
      // numeric-only date is ambiguous across these three languages.
      date: (iso) =>
        new Intl.DateTimeFormat(tag, { day: 'numeric', month: 'short', year: 'numeric' })
          .format(new Date(iso)),
      num: (n) => new Intl.NumberFormat(tag).format(n),
      pct: (n) =>
        new Intl.NumberFormat(tag, { style: 'percent', maximumFractionDigits: 0 }).format(n),
    };
  }, [locale]);

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n(): I18nValue {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error('useI18n must be used inside I18nProvider');
  return ctx;
}

/**
 * Official form names stay in English with a translated gloss.
 * Renders: "Schedule C — Mẫu khai lời hoặc lỗ từ hoạt động kinh doanh cá nhân"
 */
export function FormName({ id, showGloss = true }: { id: keyof Dict['forms']; showGloss?: boolean }) {
  const { t } = useI18n();
  const f = t.forms[id];
  return (
    <span>
      <span className="font-medium">{f.name}</span>
      {showGloss && <span className="text-ink-500"> — {f.gloss}</span>}
    </span>
  );
}
