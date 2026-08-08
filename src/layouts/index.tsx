import type { ReactNode } from 'react';
import { useI18n } from '../i18n';
import { Link, useNav } from '../app/router';
import { useAuth } from '../auth/AuthProvider';
import type { Industry, Locale } from '../types';

/**
 * Sign-out control.
 *
 * Present in the app shell on every screen, not buried in a settings page.
 * These businesses run on shared back-office computers — a salon counter, a
 * restaurant office — and leaving a signed-in tax session open because signing
 * out took three clicks is a real exposure, not a hypothetical one.
 */
function SignOutButton() {
  const { t } = useI18n();
  const { status, signOut } = useAuth();

  // Hidden in demo mode: there is no session to end, and a control that does
  // nothing teaches users to distrust it.
  if (status !== 'signed_in') return null;

  return (
    <button
      onClick={() => void signOut()}
      className="rounded-full border border-line bg-white px-3 py-1.5 text-sm text-content-secondary hover:bg-cream"
    >
      {t.common.signOut}
    </button>
  );
}

export function LocaleSwitch({ compact = false }: { compact?: boolean }) {
  const { locale, setLocale, t } = useI18n();
  const next: Locale = locale === 'vi' ? 'en' : 'vi';
  return (
    <button
      onClick={() => setLocale(next)}
      aria-label={t.common.language}
      className="rounded-full border border-line bg-white px-3 py-1.5 text-sm text-content-secondary hover:bg-cream"
    >
      {compact ? (next === 'en' ? 'EN' : 'VI') : next === 'en' ? t.common.english : t.common.vietnamese}
    </button>
  );
}

export function MarketingLayout({ children }: { children: ReactNode }) {
  const { t } = useI18n();
  return (
    <div className="min-h-screen bg-white">
      <header className="sticky top-0 z-40 border-b border-line bg-white/95 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-5">
          <Link to="/" className="display-section text-xl text-jade-800">
            {t.common.appName}
          </Link>
          <nav className="flex items-center gap-3">
            <LocaleSwitch />
            <Link to="/auth/login" className="hidden text-sm text-ink-600 hover:text-ink-900 sm:inline">
              {t.common.signIn}
            </Link>
            <Link
              to="/auth/sign-up"
              className="rounded-full bg-interactive-primary px-4 py-2 text-sm font-semibold text-interactive-contrast hover:bg-interactive-hover"
            >
              {t.common.signUp}
            </Link>
          </nav>
        </div>
      </header>
      <main>{children}</main>
      <footer className="border-t border-line bg-surface-inverse px-5 py-10 text-sm text-white/70">
        <div className="mx-auto max-w-6xl">
          <div className="display-section text-lg text-white">{t.common.appName}</div>
          <p className="mt-3 max-w-2xl">{t.legal.disclosure}</p>
          <p className="mt-4 text-white/50">© 2026 {t.common.appName}</p>
        </div>
      </footer>
    </div>
  );
}

export function AuthLayout({ children }: { children: ReactNode }) {
  const { t } = useI18n();
  return (
    <div className="flex min-h-screen items-center justify-center bg-cream px-5 py-12">
      <div className="w-full max-w-md">
        <Link to="/" className="display-section mb-6 block text-center text-2xl text-jade-800">
          {t.common.appName}
        </Link>
        {children}
      </div>
    </div>
  );
}

export function OnboardingLayout({
  step, total, title, children,
}: { step: number; total: number; title: string; children: ReactNode }) {
  const { t } = useI18n();
  return (
    <div className="min-h-screen bg-cream">
      <header className="border-b border-line bg-white">
        <div className="mx-auto flex h-16 max-w-2xl items-center justify-between px-5">
          <span className="display-section text-lg text-jade-800">{t.common.appName}</span>
          <LocaleSwitch compact />
        </div>
      </header>
      <div className="mx-auto max-w-2xl px-5 py-10">
        <div className="mb-2 text-sm text-ink-500">
          {t.onboarding.step} {step} {t.common.of} {total}
        </div>
        <div className="mb-8 h-1.5 overflow-hidden rounded-full bg-ink-100">
          <div
            className="h-full bg-jade-600 transition-all"
            style={{ width: `${(step / total) * 100}%` }}
            role="progressbar"
            aria-valuenow={step}
            aria-valuemin={1}
            aria-valuemax={total}
          />
        </div>
        <h1 className="display-section mb-6 text-3xl text-content-primary">{title}</h1>
        {children}
      </div>
    </div>
  );
}

const NAV_ITEMS = (industry: Industry) => [
  { to: '/app/dashboard', key: 'dashboard' as const },
  { to: '/app/transactions', key: 'transactions' as const },
  { to: '/app/receipts', key: 'receipts' as const },
  { to: '/app/connections', key: 'connections' as const },
  { to: '/app/deductions', key: 'deductions' as const },
  { to: '/app/quarterly', key: 'quarterly' as const },
  ...(industry === 'restaurant'
    ? [{ to: '/app/restaurant/dashboard', key: 'restaurant' as const }]
    : [{ to: '/app/salon/dashboard', key: 'salon' as const }]),
  { to: '/app/documents', key: 'documents' as const },
  { to: '/app/exports', key: 'exports' as const },
  { to: '/app/collaboration/sharing', key: 'sharing' as const },
];

export function AppLayout({
  industry, businessName, children,
}: { industry: Industry; businessName: string; children: ReactNode }) {
  const { t } = useI18n();
  const { path } = useNav();
  const items = NAV_ITEMS(industry);

  return (
    <div className="min-h-screen bg-cream">
      <header className="sticky top-0 z-40 border-b border-line bg-white">
        <div className="flex h-16 items-center justify-between gap-4 px-5">
          <div className="flex items-center gap-3">
            <Link to="/app/dashboard" className="display-section text-lg text-jade-800">
              {t.common.appName}
            </Link>
            <span className="hidden text-sm text-ink-500 sm:inline">· {businessName}</span>
          </div>
          <div className="flex items-center gap-2">
            <LocaleSwitch compact />
            <SignOutButton />
          </div>
        </div>
      </header>

      <div className="mx-auto flex max-w-7xl gap-6 px-4 py-6">
        {/* Desktop sidebar */}
        <aside className="hidden w-56 shrink-0 lg:block">
          <nav className="sticky top-24 space-y-1">
            {items.map((it) => {
              const active = path.startsWith(it.to);
              return (
                <Link
                  key={it.to}
                  to={it.to}
                  className={
                    'block rounded-sm px-3 py-2.5 text-sm transition ' +
                    (active
                      ? 'bg-interactive-primary font-semibold text-interactive-contrast'
                      : 'text-ink-600 hover:bg-white')
                  }
                >
                  {t.nav[it.key]}
                </Link>
              );
            })}
          </nav>
        </aside>

        <main className="min-w-0 flex-1 pb-24 lg:pb-6">{children}</main>
      </div>

      {/* Mobile bottom bar — five most-used destinations */}
      <nav className="fixed inset-x-0 bottom-0 z-40 flex border-t border-line bg-white lg:hidden">
        {items.slice(0, 5).map((it) => {
          const active = path.startsWith(it.to);
          return (
            <Link
              key={it.to}
              to={it.to}
              className={
                'flex-1 px-1 py-3 text-center text-[11px] leading-tight ' +
                (active ? 'font-semibold text-jade-700' : 'text-ink-500')
              }
            >
              {t.nav[it.key]}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
