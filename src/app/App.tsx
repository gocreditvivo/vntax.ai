import { useState } from 'react';
import { I18nProvider } from '../i18n';
import { NavProvider, useNav } from './router';
import { isAuthenticated } from './auth';
import { AppLayout } from '../layouts';
import { BUSINESSES } from '../mocks/fixtures';
import { sharingService, type Caller } from '../services';
import type { Industry, Locale, Role } from '../types';
import { Home, SignUp, Login, Onboarding } from '../features/marketing/screens';
import { ChatGuide } from '../features/chat/ChatGuide';
import { Dashboard, Transactions, Receipts, Connections } from '../features/dashboard/screens';
import {
  Deductions, Quarterly, Documents, ExportCenter, Sharing,
  RestaurantDashboard, SalonDashboard,
} from '../features/deductions/screens';

/** Routes carrying the app shell. Industry routes mount conditionally. */
function Routed({ industry, role, forcedState }: { industry: Industry; role: Role; forcedState?: 'loading' | 'error' }) {
  const { path } = useNav();
  const business = BUSINESSES.find((b) => b.industry === industry)!;

  // One caller identity flows to every service call. A professional's grant is
  // resolved live, so a revoked grant takes effect on the next request.
  const caller: Caller =
    role === 'tax_professional'
      ? sharingService.buildProfessionalCaller('u_cpa', business.id, 2026, 'tax_2026')
      : { userId: role === 'owner' ? 'u_owner_rest' : 'u_manager', role, businessId: business.id };

  // public + auth + onboarding render without the app shell
  if (path === '/' || path.startsWith('/#')) return <Home />;
  if (path === '/auth/sign-up') return <SignUp />;
  if (path === '/auth/login') return <Login />;
  if (path === '/guide') {
    return (
      <div className="flex min-h-screen items-center justify-center bg-cream px-4 py-8">
        <ChatGuide onComplete={() => {}} />
      </div>
    );
  }
  if (path.startsWith('/onboarding/')) {
    return <Onboarding step={path.split('/')[2] ?? 'language'} onIndustry={() => {}} />;
  }

  // Auth guard — any /app/* route requires a session.
  if (path.startsWith('/app/') && !isAuthenticated()) {
    return <Login />;
  }

  const screen = (() => {
    if (path.startsWith('/app/transactions')) return <Transactions business={business} caller={caller} state={forcedState} />;
    if (path.startsWith('/app/receipts')) return <Receipts business={business} caller={caller} />;
    if (path.startsWith('/app/deductions')) return <Deductions caller={caller} />;
    if (path.startsWith('/app/quarterly')) return <Quarterly caller={caller} />;
    if (path.startsWith('/app/documents')) return <Documents caller={caller} />;
    if (path.startsWith('/app/exports')) return <ExportCenter caller={caller} />;
    if (path.startsWith('/app/connections')) return <Connections business={business} caller={caller} />;
    if (path.startsWith('/app/collaboration')) return <Sharing caller={caller} />;
    // Industry routes mount only for the matching industry — a salon build
    // contains no restaurant screens.
    if (path.startsWith('/app/restaurant') && industry === 'restaurant') return <RestaurantDashboard caller={caller} />;
    if (path.startsWith('/app/salon') && industry === 'nail_salon') return <SalonDashboard caller={caller} />;
    return <Dashboard business={business} />;
  })();

  return (
    <AppLayout industry={industry} businessName={business.dbaName ?? business.legalName}>
      {screen}
    </AppLayout>
  );
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
  industry?: Industry;
  role?: Role;
  forcedState?: 'loading' | 'error';
  onNavigate?: (to: string) => void;
}) {
  const [ind] = useState<Industry>(industry);
  return (
    <I18nProvider initial={initialLocale}>
      <NavProvider initialPath={initialPath} onNavigate={onNavigate}>
        <Routed industry={ind} role={role} forcedState={forcedState} />
      </NavProvider>
    </I18nProvider>
  );
}
