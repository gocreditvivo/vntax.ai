/**
 * Service layer — core primitives.
 *
 * Every service returns Result<T>. Nothing throws across a service boundary,
 * so screens render a state rather than crash.
 *
 * Two invariants are enforced HERE rather than in the UI, because the UI is a
 * courtesy and this is the boundary:
 *   1. Cross-business access is impossible — every read is scoped by businessId.
 *   2. Permission is checked before data is touched, not after.
 */
import type { AuditEvent, Role, SharingGrant } from '../types';
import { can, isGrantActive, type Action, type Resource } from '../security/permissions';

// ─── result ────────────────────────────────────────────────────────────────

export type ErrorKind =
  | 'not_found'
  | 'permission_denied'
  | 'blocked'
  | 'validation'
  | 'conflict'
  | 'network'
  | 'unknown';

export interface ServiceError {
  kind: ErrorKind;
  /** i18n key where one exists; plain text otherwise. Never a raw stack. */
  message: string;
  detail?: string;
}

export type Result<T> =
  | { ok: true; data: T }
  | { ok: false; error: ServiceError };

export const ok = <T,>(data: T): Result<T> => ({ ok: true, data });
export const err = (kind: ErrorKind, message: string, detail?: string): Result<never> =>
  ({ ok: false, error: { kind, message, detail } });

// ─── caller identity ───────────────────────────────────────────────────────

export interface Caller {
  userId: string;
  role: Role;
  businessId: string;
  grant?: SharingGrant | null;
  taxYear?: number;
  folder?: string;
}

/** Guard used at the top of every service method that touches data. */
export function authorize(
  caller: Caller,
  resource: Resource,
  action: Action
): Result<{ masked: boolean }> {
  const verdict = can(
    {
      role: caller.role,
      userId: caller.userId,
      businessId: caller.businessId,
      grant: caller.grant,
      taxYear: caller.taxYear,
      folder: caller.folder,
    },
    resource,
    action
  );
  if (!verdict.allowed) {
    return err('permission_denied', `permission.${verdict.reason ?? 'denied'}`,
               `${caller.role} cannot ${action} ${resource}`);
  }
  return ok({ masked: verdict.masked });
}

// ─── audit log (append-only) ───────────────────────────────────────────────

const auditLog: AuditEvent[] = [];
let auditSeq = 0;

export function recordAudit(
  caller: Caller,
  action: string,
  resourceType: string,
  resourceId: string,
  metadata: Record<string, string | number | boolean | null> = {}
): AuditEvent {
  const evt: AuditEvent = {
    id: `ae_${String(++auditSeq).padStart(6, '0')}`,
    businessId: caller.businessId,
    actorUserId: caller.userId,
    action,
    resourceType,
    resourceId,
    at: new Date().toISOString(),
    metadata: { role: caller.role, ...metadata },
  };
  auditLog.push(evt);
  return evt;
}

/** Read-only view. There is deliberately no update or delete path. */
export function readAudit(businessId?: string): readonly AuditEvent[] {
  return businessId ? auditLog.filter((e) => e.businessId === businessId) : [...auditLog];
}

export function _resetAuditForTests(): void {
  auditLog.length = 0;
  auditSeq = 0;
}

// ─── isolation helper ──────────────────────────────────────────────────────

/**
 * The only way records leave the store. Filtering by businessId here means a
 * service cannot forget to scope a query — there is no unscoped accessor.
 */
export function scopeTo<T extends { businessId: string }>(
  rows: readonly T[],
  businessId: string
): T[] {
  return rows.filter((r) => r.businessId === businessId);
}

// ─── simulated latency and fault injection ─────────────────────────────────

export interface ServiceOptions {
  /** Simulated latency in ms. 0 in tests. */
  latencyMs?: number;
  /** Force a failure — used to exercise error states in tests and demos. */
  failWith?: ErrorKind;
  /** Force an empty result — used to exercise empty states. */
  forceEmpty?: boolean;
  /** Simulate a stale connection blocking the operation. */
  blockedBy?: string;
}

let defaults: ServiceOptions = { latencyMs: 0 };

export function configureServices(o: ServiceOptions): void {
  defaults = { ...defaults, ...o };
}

export function getServiceDefaults(): ServiceOptions {
  return { ...defaults };
}

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

/** Wraps a service body with latency, fault injection, and error containment. */
export async function run<T>(
  fn: () => T | Promise<T>,
  opts: ServiceOptions = {}
): Promise<Result<T>> {
  const o = { ...defaults, ...opts };
  if (o.latencyMs) await sleep(o.latencyMs);

  if (o.blockedBy) {
    return err('blocked', 'error.blocked', o.blockedBy);
  }
  if (o.failWith) {
    return err(o.failWith, `error.${o.failWith}`, 'injected fault');
  }
  try {
    return ok(await fn());
  } catch (e) {
    return err('unknown', 'error.unknown', e instanceof Error ? e.message : String(e));
  }
}

// ─── grant resolution ──────────────────────────────────────────────────────

export function resolveGrant(
  grants: readonly SharingGrant[],
  businessId: string,
  userId: string,
  now = new Date()
): SharingGrant | null {
  return (
    grants.find(
      (g) => g.businessId === businessId && g.inviteeUserId === userId && isGrantActive(g, now)
    ) ?? null
  );
}
