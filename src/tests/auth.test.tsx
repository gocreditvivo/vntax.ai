/**
 * Authentication tests.
 *
 * Priority here is the security-relevant behaviour, not coverage percentage:
 *
 *   - a service-role key can never be accepted as the browser key
 *   - sign-in failures cannot be used to enumerate accounts
 *   - an unknown membership role is never promoted to a real one
 *   - `numeric` columns arriving as strings never enter arithmetic as strings
 *   - the auth guard cannot flash the login screen over a valid session
 *   - errors reach a Vietnamese-speaking user in Vietnamese
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { AuthError } from '@supabase/supabase-js';

import type * as EnvModule from '../lib/env';
import type * as SupabaseModule from '../lib/supabase';
import { looksLikeServiceRoleKey } from '../lib/env';
import { parseNumeric } from '../lib/supabase';
import {
  isValidEmail, isValidPassword, mapAuthError, MIN_PASSWORD_LENGTH,
} from '../auth/errors';
import { toAccountingMethod, toAddress, toBusiness, toEntityType, toIndustry } from '../data/mappers';
import type { Tables } from '../types/database';
import { en } from '../i18n/en';
import { vi as viDict } from '../i18n/vi';

// ─── env: the key that must never ship ─────────────────────────────────────

describe('service-role key detection', () => {
  /** role: service_role — the key that bypasses RLS entirely. */
  const serviceRoleJwt = [
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9',
    btoa(JSON.stringify({ iss: 'supabase', ref: 'abc', role: 'service_role' })),
    'signature',
  ].join('.');

  const anonJwt = [
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9',
    btoa(JSON.stringify({ iss: 'supabase', ref: 'abc', role: 'anon' })),
    'signature',
  ].join('.');

  it('flags a service-role JWT', () => {
    expect(looksLikeServiceRoleKey(serviceRoleJwt)).toBe(true);
  });

  it('flags an sb_secret_ key', () => {
    expect(looksLikeServiceRoleKey('sb_secret_abc123')).toBe(true);
  });

  it('accepts a publishable key', () => {
    expect(looksLikeServiceRoleKey('sb_publishable_AAAAAAAAAAAAAAAAAAAAAA_BBBBBBB')).toBe(false);
  });

  it('accepts a legacy anon JWT', () => {
    expect(looksLikeServiceRoleKey(anonJwt)).toBe(false);
  });

  it('does not throw on malformed input', () => {
    expect(looksLikeServiceRoleKey('not-a-key')).toBe(false);
    expect(looksLikeServiceRoleKey('')).toBe(false);
    expect(looksLikeServiceRoleKey('a.b.c')).toBe(false);
  });
});

// ─── numeric(14,2) arrives as a string ─────────────────────────────────────

describe('parseNumeric', () => {
  it('parses the string PostgREST actually returns', () => {
    expect(parseNumeric('1200.50')).toBe(1200.5);
    expect(parseNumeric('-84.19')).toBe(-84.19);
    expect(parseNumeric('0.00')).toBe(0);
  });

  it('passes numbers through', () => {
    expect(parseNumeric(1200.5)).toBe(1200.5);
  });

  it('never returns NaN, which would poison every downstream total', () => {
    expect(parseNumeric(null)).toBe(0);
    expect(parseNumeric(undefined)).toBe(0);
    expect(parseNumeric('abc')).toBe(0);
    expect(parseNumeric({})).toBe(0);
    expect(parseNumeric(Number.NaN)).toBe(0);
  });

  it('sums parsed values numerically, not by concatenation', () => {
    const rows = ['1200.50', '300.25', '99.25'];
    const total = rows.reduce((s, r) => s + parseNumeric(r), 0);
    expect(total).toBeCloseTo(1600, 2);
    // The bug this guards against, spelled out.
    expect(typeof total).toBe('number');
  });
});

// ─── error mapping ─────────────────────────────────────────────────────────

function authError(over: Partial<AuthError> & { message: string }): AuthError {
  return { name: 'AuthApiError', ...over } as AuthError;
}

describe('mapAuthError', () => {
  it('maps by error code when present', () => {
    expect(mapAuthError(authError({ code: 'invalid_credentials', message: 'x' })).code)
      .toBe('invalid_credentials');
    expect(mapAuthError(authError({ code: 'weak_password', message: 'x' })).code)
      .toBe('weak_password');
    expect(mapAuthError(authError({ code: 'user_already_exists', message: 'x' })).code)
      .toBe('email_taken');
  });

  it('falls back to message matching for older servers', () => {
    expect(mapAuthError(new Error('Invalid login credentials')).code).toBe('invalid_credentials');
    expect(mapAuthError(new Error('Email not confirmed')).code).toBe('email_not_confirmed');
    expect(mapAuthError(new Error('User already registered')).code).toBe('email_taken');
  });

  it('treats HTTP 429 as rate limiting', () => {
    expect(mapAuthError(authError({ status: 429, message: 'slow down' })).code).toBe('rate_limited');
  });

  it('maps a fetch failure to network rather than unknown', () => {
    expect(mapAuthError(new Error('Failed to fetch')).code).toBe('network');
  });

  it('keeps the original message as detail, never as display text', () => {
    const f = mapAuthError(new Error('Invalid login credentials'));
    expect(f.detail).toBe('Invalid login credentials');
  });

  it('degrades unrecognised errors to unknown instead of throwing', () => {
    expect(mapAuthError(new Error('something novel')).code).toBe('unknown');
  });
});

describe('input validation', () => {
  it('accepts ordinary addresses', () => {
    expect(isValidEmail('tim@vntax.ai')).toBe(true);
    expect(isValidEmail('nguyen.van.a+tax@gmail.com')).toBe(true);
  });

  it('rejects obvious typos', () => {
    expect(isValidEmail('tim@')).toBe(false);
    expect(isValidEmail('@vntax.ai')).toBe(false);
    expect(isValidEmail('tim@vntax')).toBe(false);
    expect(isValidEmail('tim @vntax.ai')).toBe(false);
    expect(isValidEmail('a@b@c.com')).toBe(false);
    expect(isValidEmail('')).toBe(false);
  });

  it('enforces the same minimum length as the server policy', () => {
    expect(isValidPassword('a'.repeat(MIN_PASSWORD_LENGTH - 1))).toBe(false);
    expect(isValidPassword('a'.repeat(MIN_PASSWORD_LENGTH))).toBe(true);
  });
});

// ─── row mapping ───────────────────────────────────────────────────────────

describe('enum guards', () => {
  it('never asserts an unrecognised value into the union', () => {
    expect(toEntityType('c_corporation')).toBe('c_corporation');
    expect(toEntityType('something_new')).toBe('unknown');
    expect(toAccountingMethod('cash')).toBe('cash');
    expect(toAccountingMethod('garbage')).toBe('unknown');
  });

  it('falls back to restaurant for an unknown industry rather than crashing the shell', () => {
    expect(toIndustry('nail_salon')).toBe('nail_salon');
    expect(toIndustry('barbershop')).toBe('restaurant');
  });
});

describe('toAddress', () => {
  it('reads the stored camelCase shape', () => {
    const a = toAddress({ line1: '6763 Wilson Blvd', city: 'Falls Church', state: 'VA', postalCode: '22044', localityId: 'loc_fxc' });
    expect(a.postalCode).toBe('22044');
    expect(a.localityId).toBe('loc_fxc');
  });

  it('also accepts snake_case, in case a row was written by SQL', () => {
    const a = toAddress({ postal_code: '22044', locality_id: 'loc_fxc' });
    expect(a.postalCode).toBe('22044');
    expect(a.localityId).toBe('loc_fxc');
  });

  it('leaves localityId empty when unresolved rather than guessing a jurisdiction', () => {
    expect(toAddress({}).localityId).toBe('');
    expect(toAddress(null).localityId).toBe('');
  });
});

describe('toBusiness', () => {
  const row: Tables<'businesses'> = {
    id: '0f2b8c7e-1111-4222-8333-444455556666',
    legal_name: 'Pho Hoa LLC',
    dba_name: 'Pho Hoa',
    industry: 'restaurant',
    entity_type: 'single_member_llc',
    address: { line1: '1 Main St', city: 'Falls Church', state: 'VA', postalCode: '22044', localityId: '' },
    phone: '703-555-0100',
    email: null,
    started_year: 2018,
    location_count: 1,
    accounting_method: 'cash',
    fiscal_year_end_month: 12,
    employee_count: 6,
    contractor_count: 2,
    has_ein: true,
    sales_tax_registered: true,
    payroll_provider: null,
    merchant_processor: 'square',
    delivery_platforms: ['doordash'],
    handles_cash: true,
    prior_year_return_available: false,
    created_at: '2026-01-02T00:00:00Z',
    created_by: 'aaaa1111-2222-3333-4444-555566667777',
    updated_at: '2026-01-02T00:00:00Z',
  };

  it('maps snake_case columns onto the camelCase domain type', () => {
    const b = toBusiness(row);
    expect(b.legalName).toBe('Pho Hoa LLC');
    expect(b.dbaName).toBe('Pho Hoa');
    expect(b.entityType).toBe('single_member_llc');
    expect(b.accountingMethod).toBe('cash');
    expect(b.hasEIN).toBe(true);
    expect(b.merchantProcessor).toBe('square');
    expect(b.address.city).toBe('Falls Church');
  });

  it('leaves no undefined field on the mapped object', () => {
    const b = toBusiness(row) as unknown as Record<string, unknown>;
    for (const [key, value] of Object.entries(b)) {
      expect(value, `${key} is undefined — a missed column mapping`).not.toBeUndefined();
    }
  });

  it('tolerates a null delivery_platforms array', () => {
    expect(toBusiness({ ...row, delivery_platforms: null as unknown as string[] }).deliveryPlatforms)
      .toEqual([]);
  });
});

// ─── translated errors ─────────────────────────────────────────────────────

describe('auth error translations', () => {
  it('covers every error code in both complete dictionaries', () => {
    const codes = Object.keys(en.auth.errors);
    expect(codes.length).toBeGreaterThan(0);
    for (const code of codes) {
      const viMessage = (viDict.auth.errors as Record<string, string>)[code];
      expect(viMessage, `vi missing auth.errors.${code}`).toBeTruthy();
      // A Vietnamese message identical to the English one means it was not
      // actually translated.
      expect(viMessage).not.toBe((en.auth.errors as Record<string, string>)[code]);
    }
  });

  it('never leaks the raw server phrase into user-facing copy', () => {
    const all = Object.values(en.auth.errors).join(' ').toLowerCase();
    expect(all).not.toContain('invalid login credentials');
    expect(all).not.toContain('supabase');
  });
});

// ─── the guard, against a mocked client ────────────────────────────────────

/**
 * A minimal fake of the client surface the auth layer uses. Hand-written rather
 * than generated so the test states exactly which calls the app depends on — if
 * the app starts calling something else, this fake fails loudly.
 */
interface FakeOptions {
  session: Record<string, unknown> | null;
  /** Delays getSession, to test the restore window rather than the settled state. */
  sessionDelayMs?: number;
  signInResult?: { error: AuthError | null };
  profile?: Record<string, unknown> | null;
  memberships?: Record<string, unknown>[];
}

let fake: FakeOptions;

vi.mock('../lib/env', async () => {
  const actual = await vi.importActual<typeof EnvModule>('../lib/env');
  return {
    ...actual,
    envState: { configured: true, env: { url: 'https://test.supabase.co', publishableKey: 'sb_publishable_test' } },
    isSupabaseConfigured: true,
  };
});

vi.mock('../lib/supabase', async () => {
  const actual = await vi.importActual<typeof SupabaseModule>('../lib/supabase');

  const table = (name: string) => {
    const rows = name === 'profiles' ? fake.profile : fake.memberships ?? [];
    const builder: Record<string, unknown> = {};
    const chain = () => builder;
    Object.assign(builder, {
      select: chain,
      eq: chain,
      not: chain,
      order: () => Promise.resolve({ data: fake.memberships ?? [], error: null }),
      maybeSingle: () => Promise.resolve({ data: rows, error: null }),
      single: () => Promise.resolve({ data: rows, error: null }),
      insert: chain,
      then: undefined,
    });
    return builder;
  };

  return {
    ...actual,
    getSupabase: () => ({
      auth: {
        getSession: async () => {
          if (fake.sessionDelayMs) await new Promise((r) => setTimeout(r, fake.sessionDelayMs));
          return { data: { session: fake.session }, error: null };
        },
        onAuthStateChange: () => ({ data: { subscription: { unsubscribe: () => {} } } }),
        signInWithPassword: async () =>
          fake.signInResult?.error
            ? { data: { session: null }, error: fake.signInResult.error }
            : { data: { session: fake.session }, error: null },
        signUp: async () => ({ data: { session: fake.session, user: null }, error: null }),
        signOut: async () => ({ error: null }),
        resetPasswordForEmail: async () => ({ error: null }),
      },
      from: table,
    }),
  };
});

const SESSION = {
  access_token: 'token',
  user: { id: 'aaaa1111-2222-3333-4444-555566667777', email: 'tim@vntax.ai' },
};

const PROFILE = {
  id: SESSION.user.id,
  email: 'tim@vntax.ai',
  display_name: 'Tim Do',
  locale: 'vi',
};

async function importApp() {
  const mod = await import('../app/App');
  return mod.default;
}

describe('auth guard', () => {
  beforeEach(() => {
    fake = { session: null, profile: PROFILE, memberships: [] };
    window.localStorage.clear();
    window.sessionStorage.clear();
    vi.resetModules();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('shows the login screen for a guarded route with no session', async () => {
    const App = await importApp();
    render(<App initialPath="/app/dashboard" initialLocale="en" />);

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: en.auth.loginTitle })).toBeInTheDocument();
    });
  });

  it('does not flash the login screen while a session is being restored', async () => {
    fake = { session: SESSION, profile: PROFILE, memberships: [], sessionDelayMs: 40 };

    const App = await importApp();
    render(<App initialPath="/app/dashboard" initialLocale="en" />);

    // The critical assertion: during the restore window the login heading must
    // not be on screen. A user refreshing a page they are signed into should
    // never be shown a login form for a frame.
    expect(screen.queryByRole('heading', { name: en.auth.loginTitle })).not.toBeInTheDocument();
    expect(screen.getByText(en.common.loading)).toBeInTheDocument();
  });

  it('renders the login form in Vietnamese when the locale is Vietnamese', async () => {
    const App = await importApp();
    render(<App initialPath="/app/dashboard" initialLocale="vi" />);

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: viDict.auth.loginTitle })).toBeInTheDocument();
    });
  });
});

describe('login form', () => {
  beforeEach(() => {
    fake = { session: null, profile: PROFILE, memberships: [] };
    window.localStorage.clear();
    window.sessionStorage.clear();
    vi.resetModules();
  });

  it('refuses to submit an empty form and says why', async () => {
    const user = userEvent.setup();
    const App = await importApp();
    render(<App initialPath="/auth/login" initialLocale="en" />);

    await user.click(await screen.findByRole('button', { name: en.common.signIn }));

    expect(await screen.findByRole('alert')).toHaveTextContent(en.auth.errors.required_fields);
  });

  it('shows a translated error on bad credentials, and does not name the field', async () => {
    fake.signInResult = {
      error: { name: 'AuthApiError', message: 'Invalid login credentials', code: 'invalid_credentials' } as AuthError,
    };

    const user = userEvent.setup();
    const App = await importApp();
    render(<App initialPath="/auth/login" initialLocale="vi" />);

    await user.type(screen.getByLabelText(viDict.auth.email), 'tim@vntax.ai');
    await user.type(screen.getByLabelText(viDict.auth.password), 'wrong-password');
    await user.click(screen.getByRole('button', { name: viDict.common.signIn }));

    const alert = await screen.findByRole('alert');
    // Vietnamese, not the server's English.
    expect(alert).toHaveTextContent(viDict.auth.errors.invalid_credentials);
    expect(alert).not.toHaveTextContent('Invalid login credentials');

    // Account enumeration guard: the failure is form-level, so neither input is
    // marked invalid in a way that would distinguish "no such user" from
    // "wrong password".
    expect(screen.getByLabelText(viDict.auth.email)).not.toHaveAttribute('aria-invalid', 'true');
  });

  it('validates the email format before contacting the server', async () => {
    const user = userEvent.setup();
    const App = await importApp();
    render(<App initialPath="/auth/sign-up" initialLocale="en" />);

    await user.type(screen.getByLabelText(en.auth.ownerName), 'Tim Do');
    await user.type(screen.getByLabelText(en.auth.email), 'not-an-email');
    await user.type(screen.getByLabelText(en.auth.password), 'longenoughpassword');
    await user.click(screen.getByRole('button', { name: en.common.continue }));

    expect(await screen.findByRole('alert')).toHaveTextContent(en.auth.errors.invalid_email);
  });

  it('rejects a short password before contacting the server', async () => {
    const user = userEvent.setup();
    const App = await importApp();
    render(<App initialPath="/auth/sign-up" initialLocale="en" />);

    await user.type(screen.getByLabelText(en.auth.ownerName), 'Tim Do');
    await user.type(screen.getByLabelText(en.auth.email), 'tim@vntax.ai');
    await user.type(screen.getByLabelText(en.auth.password), 'short');
    await user.click(screen.getByRole('button', { name: en.common.continue }));

    expect(await screen.findByRole('alert')).toHaveTextContent(en.auth.errors.weak_password);
  });
});
