/**
 * Business reads and writes against Supabase.
 *
 * Scope note: this is the only domain table wired to the database in this
 * change. Transactions, receipts and documents still read the in-memory store.
 * That is deliberate — the business record is required for the app shell to
 * render a real account at all, whereas ledger persistence is a larger change
 * that should not ride along with authentication.
 */

import { getSupabase } from '../lib/supabase';
import type { Address, Business, EntityType, Industry } from '../types';
import { fromAddress, toBusiness } from './mappers';

export type DataResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: string };

const ok = <T,>(data: T): DataResult<T> => ({ ok: true, data });
const fail = (error: string): DataResult<never> => ({ ok: false, error });

const NOT_CONFIGURED = 'Supabase is not configured';

export async function getBusiness(id: string): Promise<DataResult<Business | null>> {
  const supabase = getSupabase();
  if (!supabase) return fail(NOT_CONFIGURED);

  const { data, error } = await supabase
    .from('businesses')
    .select('*')
    .eq('id', id)
    .maybeSingle();

  if (error) return fail(error.message);
  return ok(data ? toBusiness(data) : null);
}

export async function listBusinesses(): Promise<DataResult<Business[]>> {
  const supabase = getSupabase();
  if (!supabase) return fail(NOT_CONFIGURED);

  // No business_id filter: RLS already restricts this to the caller's
  // memberships. Filtering here as well would be defence in depth against
  // nothing, since the database is the boundary.
  const { data, error } = await supabase
    .from('businesses')
    .select('*')
    .order('created_at', { ascending: true });

  if (error) return fail(error.message);
  return ok((data ?? []).map(toBusiness));
}

export interface CreateBusinessInput {
  legalName: string;
  dbaName?: string | null;
  industry: Industry;
  entityType: EntityType;
  address: Address;
  phone?: string | null;
}

/**
 * Creates a business and returns it.
 *
 * This calls the `create_business` database function rather than inserting
 * directly, and the reason is a real failure that a direct insert cannot avoid.
 *
 * PostgreSQL checks the RETURNING projection against the table's SELECT policy,
 * and it does so before AFTER-INSERT triggers run. The SELECT policy is
 * `is_member_of(id)` and the owner membership is created by an AFTER trigger,
 * so at the moment the read-back is authorised the caller is not yet a member
 * of their own new row. `supabase-js` always sends `.insert().select()` as
 * `insert ... returning`, so every attempt failed with 42501 — while the row
 * itself was written. Verified against the live database, not inferred.
 *
 * The function does the insert and the membership in one transaction and
 * returns the row once both exist. It also takes `created_by` and the owner
 * role from `auth.uid()` internally, so neither can be supplied — and therefore
 * neither can be forged — by the browser.
 */
export async function createBusiness(
  input: CreateBusinessInput
): Promise<DataResult<Business>> {
  const supabase = getSupabase();
  if (!supabase) return fail(NOT_CONFIGURED);

  const legalName = input.legalName.trim();
  if (!legalName) return fail('Legal name is required');

  const { data, error } = await supabase.rpc('create_business', {
    p_legal_name: legalName,
    // `undefined` rather than `null`: the function's defaults handle absence,
    // and PostgREST rejects a null for a non-nullable text parameter.
    p_dba_name: input.dbaName?.trim() || undefined,
    p_industry: input.industry,
    p_entity_type: input.entityType,
    p_address: fromAddress(input.address) as never,
    p_phone: input.phone?.trim() || undefined,
  });

  if (error) return fail(error.message);
  if (!data) return fail('Business was not returned by the server');
  return ok(toBusiness(data));
}
