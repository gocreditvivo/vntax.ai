/**
 * Row ↔ domain mapping.
 *
 * Postgres columns are snake_case; `src/types/index.ts` is camelCase. Without
 * an explicit layer here, every field access is a silent `undefined` — and in
 * this product a silent `undefined` on `entityType` or `accountingMethod`
 * changes which tax treatment a business is shown.
 *
 * Rules this file follows without exception:
 *   - every monetary value passes through `parseNumeric` (numeric → string)
 *   - every free-text enum column is validated against the union, never cast
 *   - an unrecognised enum value degrades to the type's explicit 'unknown'
 *     member rather than being asserted into a value it is not
 */

import type { Tables } from '../types/database';
import type {
  AccountingMethod, Address, Business, EntityType, Industry,
} from '../types';

// ─── enum guards ───────────────────────────────────────────────────────────

const INDUSTRIES: readonly Industry[] = ['restaurant', 'nail_salon'];

const ENTITY_TYPES: readonly EntityType[] = [
  'sole_proprietor', 'single_member_llc', 'multi_member_llc',
  'partnership', 's_corporation', 'c_corporation', 'unknown',
];

const ACCOUNTING_METHODS: readonly AccountingMethod[] = ['cash', 'accrual', 'unknown'];

function oneOf<T extends string>(allowed: readonly T[], value: string, fallback: T): T {
  return (allowed as readonly string[]).includes(value) ? (value as T) : fallback;
}

/**
 * Industry has no 'unknown' member, and it decides which screens mount. An
 * unrecognised value therefore falls back to 'restaurant' — the majority case
 * in this niche — rather than crashing the shell. The row is still wrong and
 * should be fixed at the source; this only prevents a blank page.
 */
export const toIndustry = (v: string): Industry => oneOf(INDUSTRIES, v, 'restaurant');
export const toEntityType = (v: string): EntityType => oneOf(ENTITY_TYPES, v, 'unknown');
export const toAccountingMethod = (v: string): AccountingMethod =>
  oneOf(ACCOUNTING_METHODS, v, 'unknown');

// ─── address ───────────────────────────────────────────────────────────────

/**
 * `businesses.address` is jsonb holding the `Address` shape verbatim. It is not
 * split into columns because locality resolution is address-level: the exact
 * street address decides the filing authorities, and the resolved `localityId`
 * belongs with the address it was resolved from.
 *
 * An empty `localityId` is meaningful — it marks an address whose filing
 * authorities have not been resolved yet, which the UI must not present as a
 * complete tax profile.
 */
export function toAddress(value: unknown): Address {
  const raw = (value ?? {}) as Record<string, unknown>;
  const str = (k: string): string => (typeof raw[k] === 'string' ? (raw[k] as string) : '');
  return {
    line1: str('line1'),
    line2: typeof raw.line2 === 'string' && raw.line2 ? (raw.line2 as string) : null,
    city: str('city'),
    state: str('state'),
    postalCode: str('postalCode') || str('postal_code'),
    localityId: str('localityId') || str('locality_id'),
  };
}

export function fromAddress(address: Address): Record<string, string | null> {
  return {
    line1: address.line1,
    line2: address.line2,
    city: address.city,
    state: address.state,
    postalCode: address.postalCode,
    localityId: address.localityId,
  };
}

// ─── business ──────────────────────────────────────────────────────────────

export function toBusiness(row: Tables<'businesses'>): Business {
  return {
    id: row.id,
    legalName: row.legal_name,
    dbaName: row.dba_name,
    industry: toIndustry(row.industry),
    entityType: toEntityType(row.entity_type),
    address: toAddress(row.address),
    phone: row.phone,
    email: row.email,
    startedYear: row.started_year,
    locationCount: row.location_count,
    accountingMethod: toAccountingMethod(row.accounting_method),
    fiscalYearEndMonth: row.fiscal_year_end_month,
    employeeCount: row.employee_count,
    contractorCount: row.contractor_count,
    hasEIN: row.has_ein,
    salesTaxRegistered: row.sales_tax_registered,
    payrollProvider: row.payroll_provider,
    merchantProcessor: row.merchant_processor,
    deliveryPlatforms: row.delivery_platforms ?? [],
    handlesCash: row.handles_cash,
    priorYearReturnAvailable: row.prior_year_return_available,
    createdAt: row.created_at,
  };
}
