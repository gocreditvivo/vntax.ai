/**
 * Sổ Sạch — permission matrix
 * ---------------------------------------------------------------------------
 * The matrix from ARCHITECTURE.md §5, as data.
 *
 * IMPORTANT: this module is mirrored on the client for UI affordances only.
 * Hiding a button is a courtesy. The boundary is the identical check running
 * server-side on every request. A client-side pass means nothing.
 */

import type { Role, SharingGrant } from '../types';

export type Resource =
  | 'business' | 'ownership' | 'connections' | 'transactions' | 'receipts'
  | 'deductions' | 'quarterly' | 'documents' | 'tax_identity' | 'exports'
  | 'sharing' | 'team' | 'security' | 'billing' | 'audit' | 'support';

export type Action =
  | 'view' | 'edit' | 'delete' | 'create' | 'link' | 'unlink'
  | 'categorize' | 'confirm' | 'upload' | 'request' | 'download'
  | 'grant' | 'revoke' | 'manage' | 'transfer' | 'act';

/**
 * 'scoped'  — permitted only within an active SharingGrant
 * 'masked'  — permitted, but sensitive fields are redacted
 * 'limited' — a reduced projection (admin sees status, not content)
 */
export type Permission = true | false | 'scoped' | 'masked' | 'limited';

type Matrix = Record<Role, Partial<Record<Resource, Partial<Record<Action, Permission>>>>>;

export const MATRIX: Matrix = {
  owner: {
    business:     { view: true, edit: true, delete: true },
    ownership:    { transfer: true },
    connections:  { view: true, link: true, unlink: true },
    transactions: { view: true, categorize: true, confirm: true },
    receipts:     { view: true, upload: true },
    deductions:   { view: true, confirm: true },
    quarterly:    { view: true },
    documents:    { view: true, upload: true, request: true, delete: true },
    tax_identity: { view: true },
    exports:      { create: true, download: true },
    sharing:      { grant: true, revoke: true },
    team:         { manage: true },
    security:     { manage: true },
    billing:      { manage: true },
    audit:        { view: true },
  },

  manager: {
    business:     { view: true },
    connections:  { view: 'masked' },
    transactions: { view: true, categorize: true, confirm: false },
    receipts:     { view: true, upload: true },
    deductions:   { view: true, confirm: false },
    documents:    { view: true, upload: true, request: true },
  },

  // Prepares, never confirms. Keeps "customer confirmation required" honest.
  bookkeeper: {
    business:     { view: 'scoped' },
    connections:  { view: 'masked' },
    transactions: { view: true, categorize: true, confirm: false },
    receipts:     { view: true, upload: true },
    deductions:   { view: true, confirm: false },
    quarterly:    { view: true },
    documents:    { view: true, upload: true, request: true },
    exports:      { create: true, download: true },
  },

  // Everything gated on an active, unexpired, unrevoked grant.
  tax_professional: {
    business:     { view: 'scoped' },
    transactions: { view: 'scoped' },
    receipts:     { view: 'scoped' },
    deductions:   { view: 'scoped' },
    quarterly:    { view: 'scoped' },
    documents:    { view: 'scoped', request: true },
    tax_identity: { view: 'scoped' },
    exports:      { download: 'scoped' },
  },

  // No default path to customer tax detail.
  admin: {
    business:     { view: 'limited' },
    connections:  { view: 'limited' },
    audit:        { view: 'limited' },
    support:      { act: true },
  },
};

export interface AccessContext {
  role: Role;
  userId: string;
  businessId: string;
  /** Required for tax_professional and grant-scoped bookkeeper access. */
  grant?: SharingGrant | null;
  taxYear?: number;
  folder?: string;
  now?: Date;
}

/** A grant is only usable while accepted, unrevoked, and unexpired. */
export function isGrantActive(g: SharingGrant | null | undefined, now = new Date()): boolean {
  if (!g) return false;
  if (g.status === 'revoked' || g.status === 'expired') return false;
  if (g.revokedAt) return false;
  if (new Date(g.expiresAt) <= now) return false;
  return g.status === 'active' || g.status === 'accepted';
}

/**
 * The single authorization decision. Server-side this is the boundary;
 * client-side it decides whether to render a control.
 */
export function can(
  ctx: AccessContext,
  resource: Resource,
  action: Action
): { allowed: boolean; masked: boolean; reason?: string } {
  const perm = MATRIX[ctx.role]?.[resource]?.[action];

  if (perm === undefined || perm === false) {
    return { allowed: false, masked: false, reason: 'not_permitted_for_role' };
  }

  if (perm === true) return { allowed: true, masked: false };
  if (perm === 'masked') return { allowed: true, masked: true };
  if (perm === 'limited') return { allowed: true, masked: true };

  // 'scoped' — requires an active grant covering this business, year, folder
  const now = ctx.now ?? new Date();
  if (!isGrantActive(ctx.grant, now)) {
    return { allowed: false, masked: false, reason: 'no_active_grant' };
  }
  const g = ctx.grant!;
  if (g.businessId !== ctx.businessId) {
    return { allowed: false, masked: false, reason: 'grant_business_mismatch' };
  }
  if (ctx.taxYear != null && !g.taxYears.includes(ctx.taxYear)) {
    return { allowed: false, masked: false, reason: 'grant_year_not_shared' };
  }
  if (ctx.folder != null && g.folders.length > 0 && !g.folders.includes(ctx.folder)) {
    return { allowed: false, masked: false, reason: 'grant_folder_not_shared' };
  }
  return { allowed: true, masked: false };
}

// ─── masking ───────────────────────────────────────────────────────────────

/**
 * Account numbers show the LAST four only. Never the leading digits.
 * Anything shorter than five characters is fully masked.
 */
export function maskAccountNumber(raw: string): string {
  const digits = raw.replace(/\D/g, '');
  if (digits.length < 5) return '****';
  return `****${digits.slice(-4)}`;
}

/** Identifiers are tokenized at rest; this is display-only defence in depth. */
export function maskTaxIdentifier(raw: string): string {
  const digits = raw.replace(/\D/g, '');
  if (digits.length < 4) return '***-**-****';
  return `***-**-${digits.slice(-4)}`;
}

/** Strip anything a professional should not receive with an export. */
export function redactForGrant<T extends Record<string, unknown>>(
  obj: T,
  fields: (keyof T)[]
): T {
  const out = { ...obj };
  for (const f of fields) (out as Record<string, unknown>)[f as string] = null;
  return out;
}
