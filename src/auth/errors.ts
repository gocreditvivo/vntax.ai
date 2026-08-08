/**
 * Auth error taxonomy.
 *
 * Supabase returns English prose in `error.message`. Rendering that directly
 * would show English errors to a Vietnamese-speaking owner on a Vietnamese
 * page — the exact failure this product exists to avoid. So every error is
 * mapped to a stable code, and the code is translated in the UI.
 *
 * The mapping is also a security boundary. On sign-in we deliberately collapse
 * "no such user" and "wrong password" into one `invalid_credentials` code, so
 * the form cannot be used to enumerate which emails have accounts.
 */

import type { AuthError } from '@supabase/supabase-js';

export type AuthErrorCode =
  | 'invalid_credentials'
  | 'email_not_confirmed'
  | 'email_taken'
  | 'weak_password'
  | 'invalid_email'
  | 'rate_limited'
  | 'required_fields'
  | 'network'
  | 'not_configured'
  | 'unknown';

export interface AuthFailure {
  code: AuthErrorCode;
  /** Original message, for logs and support. Never rendered to the user. */
  detail?: string;
}

export const failure = (code: AuthErrorCode, detail?: string): AuthFailure => ({ code, detail });

/**
 * Supabase error codes are more stable than messages, so they are checked
 * first; message matching is the fallback for older server versions.
 */
export function mapAuthError(error: AuthError | Error): AuthFailure {
  const detail = error.message;
  const code = (error as AuthError).code ?? '';
  const status = (error as AuthError).status ?? 0;
  const message = detail.toLowerCase();

  switch (code) {
    case 'invalid_credentials':
      return failure('invalid_credentials', detail);
    case 'email_not_confirmed':
      return failure('email_not_confirmed', detail);
    case 'user_already_exists':
    case 'email_exists':
      return failure('email_taken', detail);
    case 'weak_password':
      return failure('weak_password', detail);
    case 'validation_failed':
      return failure('invalid_email', detail);
    case 'over_request_rate_limit':
    case 'over_email_send_rate_limit':
      return failure('rate_limited', detail);
  }

  if (status === 429) return failure('rate_limited', detail);

  if (message.includes('invalid login credentials')) return failure('invalid_credentials', detail);
  if (message.includes('email not confirmed')) return failure('email_not_confirmed', detail);
  if (message.includes('already registered') || message.includes('already been registered')) {
    return failure('email_taken', detail);
  }
  if (message.includes('password should be')) return failure('weak_password', detail);
  if (message.includes('invalid email')) return failure('invalid_email', detail);
  if (message.includes('failed to fetch') || message.includes('networkerror')) {
    return failure('network', detail);
  }

  return failure('unknown', detail);
}

// ─── client-side validation ────────────────────────────────────────────────

/**
 * Deliberately permissive. The server is the authority on deliverability; this
 * only catches obvious typos before a round trip. An over-strict regex rejects
 * valid addresses and is a real support burden.
 */
export function isValidEmail(email: string): boolean {
  const trimmed = email.trim();
  if (trimmed.length < 3 || trimmed.length > 320) return false;
  if (/\s/.test(trimmed)) return false;
  const at = trimmed.indexOf('@');
  if (at < 1 || at !== trimmed.lastIndexOf('@')) return false;
  const domain = trimmed.slice(at + 1);
  return domain.includes('.') && !domain.startsWith('.') && !domain.endsWith('.');
}

/**
 * Minimum 8 characters. This mirrors the Supabase project setting; keeping the
 * client rule identical means the user is told before the round trip rather
 * than after. If the project policy tightens, change both.
 */
export const MIN_PASSWORD_LENGTH = 8;

export function isValidPassword(password: string): boolean {
  return password.length >= MIN_PASSWORD_LENGTH;
}
