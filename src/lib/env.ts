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

/**
 * This project is the TrinityAI coordination relay, not a customer-data
 * boundary. Its publishable key can read relay_messages, so it must never be
 * compiled into VNTax. Keep this denial explicit even after a dedicated VNTax
 * project exists: a copied legacy environment variable must fail closed.
 */
const FORBIDDEN_SHARED_SUPABASE_HOSTS = new Set([
  'rcmcqcinndypoupgjezi.supabase.co',
]);

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
export function validateSupabaseEnv(url: string, key: string): EnvState {
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
  if (!parsed.hostname.endsWith('.supabase.co')) {
    return { configured: false, reason: 'VITE_SUPABASE_URL must identify an approved Supabase project' };
  }
  if (FORBIDDEN_SHARED_SUPABASE_HOSTS.has(parsed.hostname)) {
    return {
      configured: false,
      reason: 'The configured project is the shared TrinityAI relay and is forbidden for VNTax customer data',
    };
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

export const envState: EnvState = validateSupabaseEnv(
  readRaw('VITE_SUPABASE_URL'),
  readRaw('VITE_SUPABASE_PUBLISHABLE_KEY')
);

export const isSupabaseConfigured = envState.configured;

export type RuntimeMode = 'live_limited' | 'synthetic_demo' | 'locked';

/** Pure and testable: production must never infer demo access from missing credentials. */
export function resolveRuntimeMode(configured: boolean, demoEnabled: boolean): RuntimeMode {
  if (configured) return 'live_limited';
  return demoEnabled ? 'synthetic_demo' : 'locked';
}

/**
 * Synthetic fixtures require an explicit build-time opt-in. Tests opt in
 * automatically, but an ordinary production build with missing credentials is
 * locked. This prevents a Vercel env mistake from publishing a fake customer
 * dashboard as though it were a live account.
 */
export const syntheticDemoEnabled =
  readRaw('VITE_ENABLE_SYNTHETIC_DEMO') === 'true' || readRaw('MODE') === 'test';

export const runtimeMode: RuntimeMode = resolveRuntimeMode(
  envState.configured,
  syntheticDemoEnabled,
);
