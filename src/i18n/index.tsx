import { createContext, useContext, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import type { Locale } from '../types';
import { en, type Dict } from './en';
import { vi } from './vi';

const DICTS: Record<Locale, Dict> = { en, vi };

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
  initial = 'vi',
}: {
  children: ReactNode;
  initial?: Locale;
}) {
  const [locale, setLocale] = useState<Locale>(initial);

  const value = useMemo<I18nValue>(() => {
    const tag = locale === 'vi' ? 'vi-VN' : 'en-US';
    return {
      locale,
      setLocale,
      t: DICTS[locale],
      // Currency stays USD in both locales — the business operates in the US.
      money: (n) =>
        new Intl.NumberFormat(tag, {
          style: 'currency',
          currency: 'USD',
          maximumFractionDigits: 0,
        }).format(n),
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
 * Official form names stay in English with a Vietnamese gloss.
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
