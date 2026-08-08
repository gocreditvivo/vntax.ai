/**
 * Environment access, validated once at module load.
 *
 * Why this file exists instead of reading `import.meta.env` inline:
 *
 * 1. A missing Supabase URL must fail loudly at startup, not silently at the
 *    first query. A tax product that appears to accept a signup and quietly
 *    drops the account is worse than one that refuses to boot.
 * 2. Tests and the static preview build run without any Supabase project.
 *    They need a defined, inspectable "not configured" state rather than a
 *    thrown error at import time.
 *
 * The publishable key is deliberately safe to ship to the browser. Row-level
 * security is the boundary, not key secrecy. The service-role key must never
 * appear in this file, in any `VITE_`-prefixed variable, or anywhere else in
 * client code — `VITE_` variables are inlined into the public bundle.
 */

export interface SupabaseEnv {
  url: string;
  publishableKey: string;
}

export type EnvState =
  | { configured: true; env: SupabaseEnv }
  | { configured: false; reason: string };

/** Reads Vite env without assuming `import.meta.env` exists (node, tests). */
function readRaw(key: string): string {
  try {
    const source = import.meta.env as Record<string, string | undefined> | undefined;
    return (source?.[key] ?? '').trim();
  } catch {
    return '';
  }
}

/**
 * A URL typo silently produces DNS failures that look like network flakiness.
 * Validating the shape here turns a confusing runtime symptom into a clear
 * startup message.
 */
function validate(url: string, key: string): EnvState {
  if (!url && !key) {
    return { configured: false, reason: 'VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY are not set' };
  }
  if (!url) return { configured: false, reason: 'VITE_SUPABASE_URL is not set' };
  if (!key) return { configured: false, reason: 'VITE_SUPABASE_PUBLISHABLE_KEY is not set' };

  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return { configured: false, reason: `VITE_SUPABASE_URL is not a valid URL: ${url}` };
  }
  if (parsed.protocol !== 'https:') {
    return { configured: false, reason: 'VITE_SUPABASE_URL must use https' };
  }

  // Catch the single most damaging misconfiguration: a service-role key pasted
  // into the publishable slot, which would ship god-mode credentials to every
  // browser and make RLS irrelevant.
  if (looksLikeServiceRoleKey(key)) {
    throw new Error(
      'VITE_SUPABASE_PUBLISHABLE_KEY appears to contain a service-role key. ' +
        'Service-role keys bypass row-level security and must never be exposed to the browser. ' +
        'Use the publishable key (sb_publishable_…) instead.'
    );
  }

  return { configured: true, env: { url, publishableKey: key } };
}

/** Decodes a JWT payload without verifying it — shape inspection only. */
export function looksLikeServiceRoleKey(key: string): boolean {
  if (key.startsWith('sb_publishable_')) return false;
  if (key.startsWith('sb_secret_')) return true;

  const parts = key.split('.');
  if (parts.length !== 3) return false;
  try {
    const json = atob(parts[1].replace(/-/g, '+').replace(/_/g, '/'));
    const claims = JSON.parse(json) as { role?: unknown };
    return claims.role === 'service_role';
  } catch {
    return false;
  }
}

export const envState: EnvState = validate(
  readRaw('VITE_SUPABASE_URL'),
  readRaw('VITE_SUPABASE_PUBLISHABLE_KEY')
);

export const isSupabaseConfigured = envState.configured;
