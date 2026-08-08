/**
 * Auth operations against Supabase, plus identity loading.
 *
 * This module is the only place in the app that talks to `supabase.auth`. It
 * returns discriminated results rather than throwing, matching the `Result`
 * convention already used across `src/services/`.
 *
 * It does NOT hold React state — that is `AuthProvider`'s job. Keeping the two
 * apart means the auth logic is testable without rendering anything.
 */

import type { Session, User as SupabaseUser } from '@supabase/supabase-js';
import { getSupabase } from '../lib/supabase';
import type { Locale, Membership, Role } from '../types';
import {
  failure, isValidEmail, isValidPassword, mapAuthError,
  type AuthFailure,
} from './errors';

export type AuthResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: AuthFailure };

const ok = <T,>(data: T): AuthResult<T> => ({ ok: true, data });
const fail = (e: AuthFailure): AuthResult<never> => ({ ok: false, error: e });

// ─── identity ──────────────────────────────────────────────────────────────

/** The app's own view of the signed-in person. Derived, never stored raw. */
export interface Identity {
  userId: string;
  email: string;
  displayName: string;
  locale: Locale;
  memberships: Membership[];
}

const ROLES: readonly Role[] = ['owner', 'manager', 'bookkeeper', 'tax_professional', 'admin'];

/**
 * `memberships.role` is `text` in Postgres, so an unrecognised value is
 * possible. It is dropped rather than coerced: silently treating an unknown
 * role as `owner` would be a privilege escalation, and treating it as a
 * readable role would still grant reads it may not be entitled to.
 */
function toRole(value: string): Role | null {
  return (ROLES as readonly string[]).includes(value) ? (value as Role) : null;
}

function toLocale(value: string | null | undefined): Locale {
  return value === 'vi' || value === 'es' || value === 'en' ? value : 'en';
}

/**
 * Loads the profile and accepted memberships for the signed-in user.
 *
 * Only memberships with `accepted_at` set are returned. An invited-but-not-
 * joined row grants nothing under RLS, so surfacing it in the UI would render
 * a business the user cannot actually read — an empty dashboard with no
 * explanation.
 */
export async function loadIdentity(user: SupabaseUser): Promise<AuthResult<Identity>> {
  const supabase = getSupabase();
  if (!supabase) return fail(failure('not_configured'));

  const [profileRes, membershipRes] = await Promise.all([
    supabase.from('profiles').select('id, email, display_name, locale').eq('id', user.id).maybeSingle(),
    supabase
      .from('memberships')
      .select('user_id, business_id, role, invited_by_user_id, accepted_at, grant_id')
      .not('accepted_at', 'is', null)
      .order('created_at', { ascending: true }),
  ]);

  if (profileRes.error) return fail(failure('unknown', profileRes.error.message));
  if (membershipRes.error) return fail(failure('unknown', membershipRes.error.message));

  const profile = profileRes.data;

  const memberships: Membership[] = (membershipRes.data ?? []).flatMap((row) => {
    const role = toRole(row.role);
    if (!role) return [];
    return [{
      userId: row.user_id,
      businessId: row.business_id,
      role,
      invitedByUserId: row.invited_by_user_id,
      acceptedAt: row.accepted_at,
      grantId: row.grant_id,
    }];
  });

  return ok({
    userId: user.id,
    email: profile?.email ?? user.email ?? '',
    // The trigger populates display_name from signup metadata, but a profile
    // created before that trigger existed may be blank. Fall back to the email
    // local part so the UI never renders an empty name.
    displayName: profile?.display_name || (user.email ?? '').split('@')[0] || '',
    locale: toLocale(profile?.locale),
    memberships,
  });
}

// ─── operations ────────────────────────────────────────────────────────────

export interface SignUpInput {
  email: string;
  password: string;
  displayName: string;
  phone?: string;
  locale: Locale;
}

/**
 * Result of a signup. `needsEmailConfirmation` is true when the project
 * requires confirmation, in which case there is no session yet and the UI must
 * say so instead of navigating into the app and showing an empty shell.
 */
export interface SignUpOutcome {
  session: Session | null;
  needsEmailConfirmation: boolean;
}

export async function signUp(input: SignUpInput): Promise<AuthResult<SignUpOutcome>> {
  const supabase = getSupabase();
  if (!supabase) return fail(failure('not_configured'));

  const email = input.email.trim().toLowerCase();
  const displayName = input.displayName.trim();

  if (!email || !input.password || !displayName) return fail(failure('required_fields'));
  if (!isValidEmail(email)) return fail(failure('invalid_email'));
  if (!isValidPassword(input.password)) return fail(failure('weak_password'));

  try {
    const { data, error } = await supabase.auth.signUp({
      email,
      password: input.password,
      options: {
        // `handle_new_user` reads these two keys out of raw_user_meta_data to
        // populate the profile row. Omitting them yields a blank profile that
        // nothing later repairs.
        data: {
          display_name: displayName,
          locale: input.locale,
          ...(input.phone?.trim() ? { phone: input.phone.trim() } : {}),
        },
      },
    });

    if (error) return fail(mapAuthError(error));

    // Supabase returns a user with an empty identities array when the email is
    // already registered, rather than an error — this is intentional, to avoid
    // leaking account existence. Surfacing it as a generic message keeps that
    // property while still telling the user to try signing in.
    if (data.user && data.user.identities?.length === 0) {
      return fail(failure('email_taken'));
    }

    return ok({ session: data.session, needsEmailConfirmation: data.session === null });
  } catch (e) {
    return fail(mapAuthError(e as Error));
  }
}

export async function signIn(emailRaw: string, password: string): Promise<AuthResult<Session>> {
  const supabase = getSupabase();
  if (!supabase) return fail(failure('not_configured'));

  const email = emailRaw.trim().toLowerCase();
  if (!email || !password) return fail(failure('required_fields'));

  try {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) return fail(mapAuthError(error));
    if (!data.session) return fail(failure('invalid_credentials'));
    return ok(data.session);
  } catch (e) {
    return fail(mapAuthError(e as Error));
  }
}

/**
 * Signs out locally even if the network call fails.
 *
 * On a shared device — a salon back office, a family restaurant counter — the
 * user pressing "sign out" and seeing it fail because the server was briefly
 * unreachable would leave the next person looking at someone's tax records.
 * The local session is cleared unconditionally.
 */
export async function signOut(): Promise<AuthResult<null>> {
  const supabase = getSupabase();
  if (!supabase) return ok(null);

  try {
    const { error } = await supabase.auth.signOut({ scope: 'local' });
    if (error) return fail(mapAuthError(error));
    return ok(null);
  } catch (e) {
    return fail(mapAuthError(e as Error));
  }
}

export async function getCurrentSession(): Promise<Session | null> {
  const supabase = getSupabase();
  if (!supabase) return null;
  const { data } = await supabase.auth.getSession();
  return data.session ?? null;
}

export async function sendPasswordReset(emailRaw: string): Promise<AuthResult<null>> {
  const supabase = getSupabase();
  if (!supabase) return fail(failure('not_configured'));

  const email = emailRaw.trim().toLowerCase();
  if (!isValidEmail(email)) return fail(failure('invalid_email'));

  try {
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      // HashRouter means the recovery route lives after the hash.
      redirectTo: `${window.location.origin}/#/auth/reset`,
    });
    if (error) return fail(mapAuthError(error));
    return ok(null);
  } catch (e) {
    return fail(mapAuthError(e as Error));
  }
}
