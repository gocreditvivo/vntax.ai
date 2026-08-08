/**
 * The single Supabase client for the app.
 *
 * One instance, module-scoped. Creating a second client in the same tab means
 * two independent token-refresh timers racing on the same storage key, which
 * produces intermittent "Invalid Refresh Token" sign-outs that are extremely
 * hard to reproduce.
 *
 * `getSupabase()` returns null when the project is not configured. Callers must
 * handle that — the app runs in three environments where no project exists:
 * unit tests, the static preview build, and a fresh clone before `.env.local`.
 * A throwing getter would make all three crash on import.
 */

import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { envState } from './env';
import type { Database } from '../types/database';

export type TypedSupabase = SupabaseClient<Database>;

/** Storage key is namespaced so VNTax cannot collide with a sibling app on the same origin. */
const STORAGE_KEY = 'vntax.auth.session';

let client: TypedSupabase | null = null;

function create(): TypedSupabase | null {
  if (!envState.configured) return null;

  return createClient<Database>(envState.env.url, envState.env.publishableKey, {
    auth: {
      // Refresh in the background so a taxpayer mid-way through categorising a
      // year of transactions is never bounced to the login screen.
      autoRefreshToken: true,
      persistSession: true,
      storageKey: STORAGE_KEY,
      // The app uses HashRouter. Supabase's implicit flow returns tokens in the
      // URL fragment, which collides with hash-based routing. PKCE keeps the
      // fragment clean and is the stronger flow regardless.
      flowType: 'pkce',
      detectSessionInUrl: true,
    },
    global: {
      headers: { 'x-application-name': 'vntax-web' },
    },
    db: { schema: 'public' },
  });
}

export function getSupabase(): TypedSupabase | null {
  if (client === null) client = create();
  return client;
}

/**
 * Test seam. Vitest module state persists across files in a worker, so a suite
 * that stubs the client needs a way to drop the cached instance.
 */
export function __resetSupabaseForTests(): void {
  client = null;
}

/**
 * `numeric(14,2)` arrives from PostgREST as a **string**, not a number.
 * `"1200.50" + 100` is `"1200.50100"`. In a tax product that silent coercion
 * produces a wrong deduction total with no error anywhere. Every monetary
 * column must pass through here.
 */
export function parseNumeric(value: unknown): number {
  if (typeof value === 'number') return Number.isFinite(value) ? value : 0;
  if (typeof value === 'string') {
    const n = Number.parseFloat(value);
    return Number.isFinite(n) ? n : 0;
  }
  return 0;
}
