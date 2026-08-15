import { useEffect, useState } from 'react';
import type { ReactElement } from 'react';
import { I18nProvider, useI18n } from '../i18n';
import { Link, NavProvider, useNav } from './router';
import { AuthProvider, useAuth } from '../auth/AuthProvider';
import type { AuthStatus } from '../auth/AuthProvider';
import { AppLayout, AuthLayout } from '../layouts';
import { Card, LoadingState } from '../components/ui';
import { BUSINESSES } from '../mocks/fixtures';
import { getBusiness } from '../data/businesses';
import { sharingService, type Caller } from '../services';
import type { Business, Industry, Locale, Role } from '../types';
import type { RuntimeMode } from '../lib/env';
import { Home, SignUp, Login, Onboarding } from '../features/marketing/screens';
import { ChatGuide } from '../features/chat/ChatGuide';
import { Payroll } from '../features/payroll/screens';
import { Dashboard, Transactions, Receipts, Connections } from '../features/dashboard/screens';
import {
  Deductions, Quarterly, Documents, ExportCenter, Sharing,
  RestaurantDashboard, SalonDashboard,
} from '../features/deductions/screens';

/**
 * Public routes render identically in every mode: no session is required to
 * read the marketing site, and the auth screens must be reachable precisely
 * when there is no session.
 */
function ProductUnavailable() {
  const { t } = useI18n();
  return (
    <AuthLayout>
      <Card className="p-7 text-center">
        <h1 className="display-section text-2xl text-content-primary">{t.states.productUnavailableTitle}</h1>
        <p className="mt-3 text-sm text-content-muted">{t.states.productUnavailableBody}</p>
        <Link to="/" className="mt-6 inline-flex rounded-full bg-jade-700 px-5 py-3 font-semibold text-white hover:bg-jade-800">
          {t.common.back}
        </Link>
      </Card>
    </AuthLayout>
  );
}

function LivePilotStatus({ industry }: { industry: Industry }) {
  const { t } = useI18n();
  return (
    <Card className="p-7">
      <p className="text-xs font-semibold uppercase tracking-wide text-amber-800">{t.states.livePilotLabel}</p>
      <h1 className="display-section mt-2 text-2xl text-content-primary">{t.states.livePilotTitle}</h1>
      <p className="mt-3 max-w-2xl text-content-muted">{t.states.livePilotBody}</p>
      {industry === 'restaurant' && (
        <Link to="/app/payroll" className="mt-6 inline-flex rounded-full bg-jade-700 px-5 py-3 font-semibold text-white hover:bg-jade-800">
          {t.nav.payroll}
        </Link>
      )}
    </Card>
  );
}

function SyntheticGuide() {
  const { t } = useI18n();
  return (
    <div className="min-h-screen bg-cream px-4 py-8">
      <p className="mx-auto mb-4 max-w-md rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950">
        {t.states.demoBanner}
      </p>
      <ChatGuide onComplete={() => {}} />
    </div>
  );
}

function publicRoute(path: string, demoIndustry: Industry, status: AuthStatus): ReactElement | null {
  if (path === '/' || path.startsWith('/#')) return <Home />;
  if ((status === 'unconfigured' || status === 'demo') && path.startsWith('/auth/')) {
    return <ProductUnavailable />;
  }
  if (path === '/auth/sign-up') return <SignUp />;
  if (path === '/auth/login') return <Login />;
  if (path === '/guide') {
    return status === 'demo' ? <SyntheticGuide /> : <ProductUnavailable />;
  }
  if (path.startsWith('/onboarding/')) {
    if (status === 'unconfigured') return <ProductUnavailable />;
    if (status === 'loading') return <SessionLoading />;
    if (status === 'signed_out') return <Login />;
    return <Onboarding step={path.split('/')[2] ?? 'language'} fallbackIndustry={demoIndustry} />;
  }
  return null;
}

/** Full-page holding state while a persisted session is restored. */
function SessionLoading() {
  const { t } = useI18n();
  return (
    <div className="flex min-h-screen items-center justify-center bg-cream px-5">
      <LoadingState label={t.common.loading} />
    </div>
  );
}

/**
 * Shown when the session is valid but the profile read failed, or when the
 * business row cannot be loaded.
 *
 * Signing the user out here would be wrong: their credentials are fine and a
 * forced sign-out on a transient network error, mid-way through a tax filing
 * session, loses unsaved context for no reason.
 */
function IdentityUnavailable({ onRetry }: { onRetry: () => void }) {
  const { t } = useI18n();
  const { signOut } = useAuth();
  return (
    <AuthLayout>
      <Card className="p-7 text-center">
        <h1 className="display-section mb-2 text-xl">{t.common.errorTitle}</h1>
        <p className="mb-6 text-sm text-content-muted">{t.auth.identityUnavailable}</p>
        <div className="flex flex-col gap-2">
          <button
            onClick={onRetry}
            className="rounded-sm bg-interactive-primary px-4 py-3 font-semibold text-interactive-contrast hover:bg-interactive-hover"
          >
            {t.common.retry}
          </button>
          <button onClick={() => void signOut()} className="px-4 py-2 text-sm text-content-muted underline">
            {t.common.signOut}
          </button>
        </div>
      </Card>
    </AuthLayout>
  );
}

/**
 * Loads the active business record for a signed-in user.
 *
 * Returns 'loading' until resolved so the shell never renders with a partially
 * populated business — a header reading "undefined" on a tax dashboard reads
 * as data loss to the person looking at it.
 */
function useActiveBusiness(activeBusinessId: string | null, nonce: number) {
  const [state, setState] = useState<
    { status: 'idle' | 'loading' } | { status: 'ready'; business: Business } | { status: 'error' }
  >({ status: activeBusinessId ? 'loading' : 'idle' });

  useEffect(() => {
    if (!activeBusinessId) {
      setState({ status: 'idle' });
      return;
    }

    let cancelled = false;
    setState({ status: 'loading' });

    void getBusiness(activeBusinessId).then((result) => {
      if (cancelled) return;
      if (result.ok && result.data) setState({ status: 'ready', business: result.data });
      else setState({ status: 'error' });
    });

    return () => { cancelled = true; };
  }, [activeBusinessId, nonce]);

  return state;
}

/**
 * Authenticated area. Reached only once the session status is known and the
 * user holds at least one accepted membership.
 */
function AppArea({
  business, forcedState,
}: { business: Business; forcedState?: 'loading' | 'error' }) {
  const { path } = useNav();
  const { identity, activeRole, activeBusinessId } = useAuth();

  // A signed-in user with no resolved role in the active business gets the
  // least privilege that still allows reading, never an assumed 'owner'.
  const role: Role = activeRole ?? 'tax_professional';
  const userId = identity?.userId ?? '';
  const businessId = activeBusinessId ?? business.id;

  const caller: Caller =
    role === 'tax_professional'
      ? sharingService.buildProfessionalCaller(userId, businessId, 2026, 'tax_2026')
      : { userId, role, businessId };

  return (
    <Shell business={business} caller={caller} path={path} mode="live_limited" forcedState={forcedState} />
  );
}

/** Route table for the app shell. Shared by live and demo modes. */
function Shell({
  business, caller, path, mode, forcedState,
}: {
  business: Business;
  caller: Caller;
  path: string;
  mode: Exclude<RuntimeMode, 'locked'>;
  forcedState?: 'loading' | 'error';
}) {
  const industry = business.industry;

  const screen = (() => {
    if (mode === 'live_limited') {
      if (path.startsWith('/app/payroll') && industry === 'restaurant') return <Payroll />;
      return <LivePilotStatus industry={industry} />;
    }
    if (path.startsWith('/app/transactions')) return <Transactions business={business} caller={caller} state={forcedState} />;
    if (path.startsWith('/app/receipts')) return <Receipts business={business} caller={caller} />;
    if (path.startsWith('/app/deductions')) return <Deductions caller={caller} />;
    if (path.startsWith('/app/quarterly')) return <Quarterly caller={caller} />;
    if (path.startsWith('/app/documents')) return <Documents caller={caller} />;
    if (path.startsWith('/app/exports')) return <ExportCenter caller={caller} />;
    if (path.startsWith('/app/connections')) return <Connections business={business} caller={caller} />;
    if (path.startsWith('/app/payroll')) return <Payroll />;
    if (path.startsWith('/app/collaboration')) return <Sharing caller={caller} />;
    // Industry routes mount only for the matching industry — a salon build
    // contains no restaurant screens.
    if (path.startsWith('/app/restaurant') && industry === 'restaurant') return <RestaurantDashboard caller={caller} />;
    if (path.startsWith('/app/salon') && industry === 'nail_salon') return <SalonDashboard caller={caller} />;
    return <Dashboard business={business} caller={caller} />;
  })();

  return (
    <AppLayout industry={industry} businessName={business.dbaName ?? business.legalName} mode={mode}>
      {screen}
    </AppLayout>
  );
}

/**
 * Explicit synthetic demo mode. Missing Supabase credentials alone never enter
 * this path; the build must opt in with VITE_ENABLE_SYNTHETIC_DEMO=true.
 */
function DemoArea({
  industry, role, path, forcedState,
}: {
  industry: Industry;
  role: Role;
  path: string;
  forcedState?: 'loading' | 'error';
}) {
  const business = BUSINESSES.find((b) => b.industry === industry) ?? BUSINESSES[0];
  const caller: Caller =
    role === 'tax_professional'
      ? sharingService.buildProfessionalCaller('u_cpa', business.id, 2026, 'tax_2026')
      : { userId: role === 'owner' ? 'u_owner_rest' : 'u_manager', role, businessId: business.id };

  return <Shell business={business} caller={caller} path={path} mode="synthetic_demo" forcedState={forcedState} />;
}

function Routed({
  demoIndustry, demoRole, forcedState,
}: { demoIndustry: Industry; demoRole: Role; forcedState?: 'loading' | 'error' }) {
  const { path, navigate } = useNav();
  const { status, activeBusinessId, needsOnboarding, identity } = useAuth();
  const [nonce, setNonce] = useState(0);
  const businessState = useActiveBusiness(activeBusinessId, nonce);

  const isAppRoute = path.startsWith('/app/');

  // A signed-in user with no business has nothing to show in the app shell, so
  // they are sent to onboarding rather than to an empty dashboard.
  useEffect(() => {
    if (isAppRoute && needsOnboarding) navigate('/onboarding/business');
  }, [isAppRoute, needsOnboarding, navigate]);

  const pub = publicRoute(path, demoIndustry, status);
  if (pub) return pub;

  if (!isAppRoute) return <Home />;

  if (status === 'demo') {
    return <DemoArea industry={demoIndustry} role={demoRole} path={path} forcedState={forcedState} />;
  }

  if (status === 'unconfigured') return <ProductUnavailable />;

  // Neither app nor login until the session is known — this is what prevents
  // the login screen flashing on refresh.
  if (status === 'loading') return <SessionLoading />;

  if (status === 'signed_out') return <Login />;

  if (needsOnboarding) return <SessionLoading />;

  // Session is valid but the profile read failed.
  if (identity === null) return <IdentityUnavailable onRetry={() => setNonce((n) => n + 1)} />;

  if (businessState.status === 'error') {
    return <IdentityUnavailable onRetry={() => setNonce((n) => n + 1)} />;
  }
  if (businessState.status !== 'ready') return <SessionLoading />;

  return <AppArea business={businessState.business} forcedState={forcedState} />;
}

export default function App({
  initialPath = '/',
  initialLocale = 'vi',
  industry = 'restaurant',
  role = 'owner',
  forcedState,
  onNavigate,
}: {
  initialPath?: string;
  initialLocale?: Locale;
  /** Demo-mode industry. Ignored once a real session supplies a business. */
  industry?: Industry;
  /** Demo-mode role. Ignored once a real session supplies a membership role. */
  role?: Role;
  forcedState?: 'loading' | 'error';
  onNavigate?: (to: string) => void;
}) {
  const [ind] = useState<Industry>(industry);
  return (
    <I18nProvider initial={initialLocale}>
      <AuthProvider>
        <NavProvider initialPath={initialPath} onNavigate={onNavigate}>
          <Routed demoIndustry={ind} demoRole={role} forcedState={forcedState} />
        </NavProvider>
      </AuthProvider>
    </I18nProvider>
  );
}
