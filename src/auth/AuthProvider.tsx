/**
 * Live session state for the whole app.
 *
 * Two failure modes this is written specifically to avoid:
 *
 * 1. **The login flash.** A user refreshing on /app/transactions must not see
 *    the login screen for 200ms while `getSession()` resolves. Hence an
 *    explicit `loading` status that is distinct from `signed_out`, and a guard
 *    that renders neither screen until the status is known.
 *
 * 2. **The onAuthStateChange deadlock.** Supabase serialises auth callbacks;
 *    awaiting another Supabase call *inside* the callback can deadlock the
 *    client. Identity loading is therefore deferred out of the callback frame
 *    rather than awaited in it. This is documented Supabase guidance, and the
 *    resulting hang is intermittent and very hard to diagnose after the fact.
 */

import {
  createContext, useCallback, useContext, useEffect, useMemo, useRef, useState,
} from 'react';
import type { ReactNode } from 'react';
import type { Session } from '@supabase/supabase-js';
import { getSupabase } from '../lib/supabase';
import { envState } from '../lib/env';
import type { Membership, Role } from '../types';
import {
  loadIdentity, signIn as doSignIn, signOut as doSignOut, signUp as doSignUp,
  type AuthResult, type Identity, type SignUpInput, type SignUpOutcome,
} from './session';

export type AuthStatus =
  /** Project not configured — tests, preview builds, fresh clones. */
  | 'unconfigured'
  /** Restoring a persisted session. Render neither app nor login. */
  | 'loading'
  | 'signed_out'
  | 'signed_in';

export interface AuthValue {
  status: AuthStatus;
  session: Session | null;
  identity: Identity | null;
  /** The business whose data the app is currently showing. */
  activeBusinessId: string | null;
  /** The signed-in user's role in the active business, or null if none. */
  activeRole: Role | null;
  memberships: Membership[];
  /** True when signed in but not yet a member of any business. */
  needsOnboarding: boolean;
  setActiveBusinessId: (id: string) => void;
  signUp: (input: SignUpInput) => Promise<AuthResult<SignUpOutcome>>;
  signIn: (email: string, password: string) => Promise<AuthResult<Session>>;
  signOut: () => Promise<void>;
  /** Re-reads profile and memberships. Call after creating a business. */
  refreshIdentity: () => Promise<void>;
}

const AuthContext = createContext<AuthValue | null>(null);

/** Remembering the last business avoids re-picking on every visit. */
const ACTIVE_BUSINESS_KEY = 'vntax.activeBusinessId';

function readStoredBusinessId(): string | null {
  try {
    return window.localStorage.getItem(ACTIVE_BUSINESS_KEY);
  } catch {
    return null;
  }
}

function writeStoredBusinessId(id: string | null): void {
  try {
    if (id) window.localStorage.setItem(ACTIVE_BUSINESS_KEY, id);
    else window.localStorage.removeItem(ACTIVE_BUSINESS_KEY);
  } catch {
    /* private browsing: preference simply does not persist */
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const configured = envState.configured;

  const [status, setStatus] = useState<AuthStatus>(configured ? 'loading' : 'unconfigured');
  const [session, setSession] = useState<Session | null>(null);
  const [identity, setIdentity] = useState<Identity | null>(null);
  const [activeBusinessId, setActive] = useState<string | null>(null);

  /** Guards against setState after unmount, and against stale async writes. */
  const mounted = useRef(true);
  useEffect(() => () => { mounted.current = false; }, []);

  const applyIdentity = useCallback((next: Identity | null) => {
    if (!mounted.current) return;
    setIdentity(next);

    if (!next) {
      setActive(null);
      return;
    }

    // Only ever select a business the user actually holds a membership in. A
    // stale localStorage value from a revoked membership must not be honoured,
    // or the app would query rows RLS then returns empty and render a
    // confusingly blank dashboard.
    setActive((current) => {
      const ids = next.memberships.map((m) => m.businessId);
      if (current && ids.includes(current)) return current;
      const stored = readStoredBusinessId();
      if (stored && ids.includes(stored)) return stored;
      return ids[0] ?? null;
    });
  }, []);

  const hydrate = useCallback(async (next: Session | null) => {
    if (!next?.user) {
      if (mounted.current) {
        setSession(null);
        applyIdentity(null);
        setStatus('signed_out');
      }
      return;
    }

    if (mounted.current) setSession(next);
    const result = await loadIdentity(next.user);
    if (!mounted.current) return;

    // A failed identity load is not a failed sign-in. The session is valid; the
    // profile read failed, most likely transiently. Staying signed in with a
    // null identity lets the UI show a retry instead of ejecting the user.
    applyIdentity(result.ok ? result.data : null);
    setStatus('signed_in');
  }, [applyIdentity]);

  useEffect(() => {
    if (!configured) return;
    const supabase = getSupabase();
    if (!supabase) return;

    let cancelled = false;

    void (async () => {
      const { data } = await supabase.auth.getSession();
      if (cancelled) return;
      await hydrate(data.session ?? null);
    })();

    const { data: subscription } = supabase.auth.onAuthStateChange((event, next) => {
      // TOKEN_REFRESHED fires on a timer. Re-reading the profile on every
      // refresh would issue needless queries and could reset in-flight UI, so
      // only the token itself is updated.
      if (event === 'TOKEN_REFRESHED') {
        if (mounted.current) setSession(next ?? null);
        return;
      }

      // Deferred deliberately: awaiting a Supabase query inside this callback
      // can deadlock the client. See the note at the top of this file.
      queueMicrotask(() => { void hydrate(next ?? null); });
    });

    return () => {
      cancelled = true;
      subscription.subscription.unsubscribe();
    };
  }, [configured, hydrate]);

  const setActiveBusinessId = useCallback((id: string) => {
    setActive(id);
    writeStoredBusinessId(id);
  }, []);

  const signOut = useCallback(async () => {
    await doSignOut();
    // Cleared eagerly rather than waiting for the SIGNED_OUT event, so the UI
    // never shows tax data for one frame after the user asked to leave.
    writeStoredBusinessId(null);
    if (mounted.current) {
      setSession(null);
      applyIdentity(null);
      setStatus('signed_out');
    }
  }, [applyIdentity]);

  const refreshIdentity = useCallback(async () => {
    const current = session;
    if (!current?.user) return;
    const result = await loadIdentity(current.user);
    if (result.ok) applyIdentity(result.data);
  }, [session, applyIdentity]);

  const value = useMemo<AuthValue>(() => {
    const memberships = identity?.memberships ?? [];
    const activeRole =
      memberships.find((m) => m.businessId === activeBusinessId)?.role ?? null;

    return {
      status,
      session,
      identity,
      activeBusinessId,
      activeRole,
      memberships,
      needsOnboarding: status === 'signed_in' && identity !== null && memberships.length === 0,
      setActiveBusinessId,
      signUp: doSignUp,
      signIn: doSignIn,
      signOut,
      refreshIdentity,
    };
  }, [status, session, identity, activeBusinessId, setActiveBusinessId, signOut, refreshIdentity]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}
