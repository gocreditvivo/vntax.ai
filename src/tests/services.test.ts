/**
 * Phase 3 — service, workflow, isolation, and state-machine tests.
 * Complements suite.test.ts (design-level invariants).
 */
import { describe, it, expect, beforeEach } from 'vitest';

import {
  categorizationService, configureServices, deductionService, documentService,
  exportService, industryService, quarterlyService, readAudit, receiptRepository,
  resetStore, sharingService, transactionRepository, _resetAuditForTests,
  type Caller,
} from '../services';
import { toState } from '../state/useAsync';
import { maskAccountNumber } from '../security/permissions';
import { isExportable } from '../types';
import { db } from '../services/store';

// ─── callers ───────────────────────────────────────────────────────────────

const REST = 'biz_pho';
const SALON = 'biz_lotus';

const owner = (businessId = REST): Caller => ({ userId: 'u_owner', role: 'owner', businessId });
const manager = (businessId = REST): Caller => ({ userId: 'u_manager', role: 'manager', businessId });
const bookkeeper = (businessId = REST): Caller => ({ userId: 'u_book', role: 'bookkeeper', businessId });
const admin = (businessId = REST): Caller => ({ userId: 'u_admin', role: 'admin', businessId });

beforeEach(() => {
  resetStore();
  _resetAuditForTests();
  configureServices({ latencyMs: 0, failWith: undefined, blockedBy: undefined });
});

// ═══════════════════════════════════════════════════════════════════════════

describe('state machine — every service result maps to a UI state', () => {
  it('a successful non-empty result is success', () => {
    expect(toState({ ok: true, data: [1, 2] }).status).toBe('success');
  });

  it('a successful empty array is empty, not success', () => {
    expect(toState({ ok: true, data: [] }).status).toBe('empty');
  });

  it('a permission_denied error becomes permission_denied, not error', () => {
    const s = toState({ ok: false, error: { kind: 'permission_denied', message: 'x' } });
    expect(s.status).toBe('permission_denied');
  });

  it('a blocked error becomes blocked, not error', () => {
    const s = toState({ ok: false, error: { kind: 'blocked', message: 'x' } });
    expect(s.status).toBe('blocked');
  });

  it('every other error becomes error', () => {
    (['not_found', 'validation', 'conflict', 'network', 'unknown'] as const).forEach((kind) => {
      expect(toState({ ok: false, error: { kind, message: 'x' } }).status).toBe('error');
    });
  });

  it('all six states are reachable', () => {
    const seen = new Set([
      'loading',
      toState({ ok: true, data: [1] }).status,
      toState({ ok: true, data: [] }).status,
      toState({ ok: false, error: { kind: 'network', message: '' } }).status,
      toState({ ok: false, error: { kind: 'blocked', message: '' } }).status,
      toState({ ok: false, error: { kind: 'permission_denied', message: '' } }).status,
    ]);
    expect(seen).toEqual(new Set([
      'loading', 'success', 'empty', 'error', 'blocked', 'permission_denied',
    ]));
  });
});

describe('fault injection reaches the UI as the right state', () => {
  it('an injected network fault yields error', async () => {
    const r = await transactionRepository.list(owner(), {}, { failWith: 'network' });
    expect(r.ok).toBe(false);
    expect(toState(r).status).toBe('error');
  });

  it('an injected block yields blocked', async () => {
    const r = await transactionRepository.list(owner(), {}, { blockedBy: 'sync_failed' });
    expect(toState(r).status).toBe('blocked');
  });

  it('a filter with no matches yields empty', async () => {
    const r = await transactionRepository.list(owner(), { search: 'zzzz-no-such-merchant' });
    expect(r.ok).toBe(true);
    expect(toState(r).status).toBe('empty');
  });
});

describe('data isolation — no cross-business access is possible', () => {
  it('a restaurant caller never sees salon transactions', async () => {
    const r = await transactionRepository.list(owner(REST));
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.data.every((t) => t.businessId === REST)).toBe(true);
  });

  it('a salon caller never sees restaurant transactions', async () => {
    const r = await transactionRepository.list(owner(SALON));
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.data.every((t) => t.businessId === SALON)).toBe(true);
  });

  it('fetching another business record reports not_found, not forbidden', async () => {
    const salonTx = db().transactions.find((t) => t.businessId === SALON)!;
    const r = await transactionRepository.get(owner(REST), salonTx.id);
    expect(r.ok).toBe(false);
    // not_found rather than permission_denied — otherwise existence leaks.
    if (!r.ok) expect(r.error.kind).toBe('not_found');
  });

  it('confirming another business transaction fails', async () => {
    const salonTx = db().transactions.find((t) => t.businessId === SALON && !t.confirmed)!;
    const r = await categorizationService.confirm(owner(REST), salonTx.id);
    expect(r.ok).toBe(false);
  });

  it('receipts, documents and deductions are all scoped', async () => {
    const [rc, doc, ded] = await Promise.all([
      receiptRepository.list(owner(SALON)),
      documentService.list(owner(SALON)),
      deductionService.suggest(owner(SALON)),
    ]);
    if (rc.ok) expect(rc.data.every((x) => x.businessId === SALON)).toBe(true);
    if (doc.ok) expect(doc.data.every((x) => x.businessId === SALON)).toBe(true);
    if (ded.ok) expect(ded.data.every((x) => x.businessId === SALON)).toBe(true);
  });
});

describe('permissions at the service boundary, not just the UI', () => {
  it('a manager cannot confirm a transaction', async () => {
    const tx = db().transactions.find((t) => t.businessId === REST && !t.confirmed)!;
    const r = await categorizationService.confirm(manager(), tx.id);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.kind).toBe('permission_denied');
  });

  it('a bookkeeper cannot confirm a transaction', async () => {
    const tx = db().transactions.find((t) => t.businessId === REST && !t.confirmed)!;
    const r = await categorizationService.confirm(bookkeeper(), tx.id);
    expect(r.ok).toBe(false);
  });

  it('a bookkeeper CAN read transactions', async () => {
    expect((await transactionRepository.list(bookkeeper())).ok).toBe(true);
  });

  it('a manager cannot invite a professional', async () => {
    const r = await sharingService.invite(manager(), {
      email: 'x@example.com', taxYears: [2026], folders: ['tax_2026'],
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.kind).toBe('permission_denied');
  });

  it('an admin cannot read transactions', async () => {
    const r = await transactionRepository.list(admin());
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.kind).toBe('permission_denied');
  });

  it('a permission failure never leaks data alongside the error', async () => {
    const r = await transactionRepository.list(admin());
    expect(r.ok).toBe(false);
    expect(JSON.stringify(r)).not.toContain('Synthetic');
  });
});

describe('categorization workflow', () => {
  it('confirming records who confirmed and when', async () => {
    const tx = db().transactions.find((t) => t.businessId === REST && !t.confirmed && t.suggested)!;
    const r = await categorizationService.confirm(owner(), tx.id);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.data.confirmed).not.toBeNull();
      expect(r.data.confirmed!.confirmedByUserId).toBe('u_owner');
      expect(r.data.status).toBe('confirmed');
    }
  });

  it('accepting the suggestion is not marked as corrected', async () => {
    const tx = db().transactions.find((t) => t.businessId === REST && !t.confirmed && t.suggested)!;
    const r = await categorizationService.confirm(owner(), tx.id);
    if (r.ok) expect(r.data.confirmed!.corrected).toBe(false);
  });

  it('overriding the suggestion IS marked as corrected — the training signal', async () => {
    const tx = db().transactions.find((t) => t.businessId === REST && !t.confirmed && t.suggested)!;
    const r = await categorizationService.confirm(owner(), tx.id, {
      categoryKey: 'something_else', scheduleCLine: '27a',
    });
    if (r.ok) {
      expect(r.data.confirmed!.corrected).toBe(true);
      expect(r.data.confirmed!.categoryKey).toBe('something_else');
    }
  });

  it('bulk confirm emits one audit event per transaction, not one for the batch', async () => {
    const ids = db().transactions
      .filter((t) => t.businessId === REST && !t.confirmed && t.suggested)
      .slice(0, 4).map((t) => t.id);
    const r = await categorizationService.confirmMany(owner(), ids);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.data.confirmed.length).toBe(ids.length);
    const events = readAudit(REST).filter((e) => e.action === 'transaction.confirm');
    expect(events.length).toBe(ids.length);
  });

  it('excluding a transaction makes it non-exportable', async () => {
    const tx = db().transactions.find((t) => t.businessId === REST && t.confirmed)!;
    const r = await categorizationService.exclude(owner(), tx.id);
    expect(r.ok).toBe(true);
    if (r.ok) expect(isExportable(r.data)).toBe(false);
  });

  it('a business purpose is required, not optional whitespace', async () => {
    const tx = db().transactions.find((t) => t.businessId === REST)!;
    const bad = await categorizationService.setBusinessPurpose(owner(), tx.id, '   ');
    expect(bad.ok).toBe(false);
    if (!bad.ok) expect(bad.error.kind).toBe('validation');
  });
});

describe('receipt workflow', () => {
  it('an uploaded receipt starts unmatched with per-field confidence', async () => {
    const r = await receiptRepository.upload(owner(), { name: 'photo.jpg' });
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.data.status).toBe('unmatched');
      expect(r.data.extracted!.total.confidence).toBeGreaterThan(0);
    }
  });

  it('matching clears the missing-receipt flag on the transaction', async () => {
    const up = await receiptRepository.upload(owner(), { name: 'photo.jpg' });
    const tx = db().transactions.find((t) => t.businessId === REST && !t.receiptId)!;
    if (up.ok) {
      const m = await receiptRepository.match(owner(), up.data.id, tx.id);
      expect(m.ok).toBe(true);
      const after = db().transactions.find((t) => t.id === tx.id)!;
      expect(after.receiptId).toBe(up.data.id);
      expect(after.flags).not.toContain('missing_receipt');
    }
  });

  it('a transaction cannot hold two receipts', async () => {
    const a = await receiptRepository.upload(owner(), { name: 'a.jpg' });
    const b = await receiptRepository.upload(owner(), { name: 'b.jpg' });
    const tx = db().transactions.find((t) => t.businessId === REST && !t.receiptId)!;
    if (a.ok && b.ok) {
      await receiptRepository.match(owner(), a.data.id, tx.id);
      const second = await receiptRepository.match(owner(), b.data.id, tx.id);
      expect(second.ok).toBe(false);
      if (!second.ok) expect(second.error.kind).toBe('conflict');
    }
  });

  it('suggested matches are ranked by confidence', async () => {
    const queue = await receiptRepository.queue(owner());
    if (queue.ok && queue.data.length) {
      const s = await receiptRepository.suggestMatches(owner(), queue.data[0].id);
      if (s.ok && s.data.length > 1) {
        expect(s.data[0].confidence).toBeGreaterThanOrEqual(s.data[1].confidence);
      }
    }
  });
});

describe('restaurant workflow', () => {
  it('a restaurant caller reaches restaurant metrics', async () => {
    const r = await industryService.restaurant(owner(REST));
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.data.grossSales).toBeGreaterThan(0);
  });

  it('a restaurant caller is BLOCKED from the salon view', async () => {
    const r = await industryService.salon(owner(REST));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.kind).toBe('blocked');
    expect(toState(r).status).toBe('blocked');
  });

  it('restaurant deduction groups include delivery commissions', async () => {
    const r = await deductionService.suggest(owner(REST));
    if (r.ok) {
      expect(r.data.some((g) => g.categoryKey === 'delivery_fees' || g.categoryKey === 'merchant_fees')).toBe(true);
    }
  });
});

describe('nail salon workflow', () => {
  it('a salon caller reaches salon metrics', async () => {
    const r = await industryService.salon(owner(SALON));
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.data.serviceIncome).toBeGreaterThan(0);
  });

  it('a salon caller is BLOCKED from the restaurant view', async () => {
    const r = await industryService.restaurant(owner(SALON));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.kind).toBe('blocked');
  });

  it('the salon has missing W-9s to act on', async () => {
    const r = await documentService.list(owner(SALON));
    if (r.ok) {
      expect(r.data.filter((d) => d.kind === 'w9' && d.status === 'missing').length).toBe(2);
    }
  });

  it('salon deduction groups include supplies', async () => {
    const r = await deductionService.suggest(owner(SALON));
    if (r.ok) expect(r.data.some((g) => g.categoryKey.includes('supplies'))).toBe(true);
  });
});

describe('export gate', () => {
  it('only confirmed transactions are included', async () => {
    const r = await exportService.build(owner(REST));
    expect(r.ok).toBe(true);
    if (r.ok) {
      const included = new Set(r.data.includedTransactionIds);
      const wrong = db().transactions.filter((t) => included.has(t.id) && !t.confirmed);
      expect(wrong).toHaveLength(0);
    }
  });

  it('the package never contains another business data', async () => {
    const r = await exportService.build(owner(REST));
    if (r.ok) {
      const included = new Set(r.data.includedTransactionIds);
      const foreign = db().transactions.filter((t) => included.has(t.id) && t.businessId !== REST);
      expect(foreign).toHaveLength(0);
    }
  });

  it('completeness is reported, not hidden', async () => {
    const r = await exportService.build(owner(REST));
    if (r.ok) {
      expect(r.data.completeness.unconfirmedTransactions).toBeGreaterThan(0);
      expect(r.data.completeness).toHaveProperty('missingReceipts');
      expect(r.data.completeness).toHaveProperty('unresolvedAlerts');
      expect(r.data.completeness).toHaveProperty('missingDocuments');
    }
  });

  it('confirming more transactions increases the included count', async () => {
    const before = await exportService.build(owner(REST));
    const ids = db().transactions
      .filter((t) => t.businessId === REST && !t.confirmed && t.suggested)
      .slice(0, 5).map((t) => t.id);
    await categorizationService.confirmMany(owner(REST), ids);
    const after = await exportService.build(owner(REST));
    if (before.ok && after.ok) {
      expect(after.data.includedTransactionIds.length)
        .toBeGreaterThan(before.data.includedTransactionIds.length);
    }
  });

  it('a manager cannot build an export', async () => {
    const r = await exportService.build(manager(REST));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.kind).toBe('permission_denied');
  });
});

describe('audit — exports and sharing are always recorded', () => {
  it('building an export writes an audit event', async () => {
    await exportService.build(owner(REST));
    const events = readAudit(REST).filter((e) => e.action === 'export.create');
    expect(events).toHaveLength(1);
    expect(events[0].actorUserId).toBe('u_owner');
    expect(events[0].metadata).toHaveProperty('transactionsIncluded');
  });

  it('downloading an export writes a separate audit event', async () => {
    const built = await exportService.build(owner(REST));
    if (built.ok) {
      await exportService.download(owner(REST), built.data.id);
      expect(readAudit(REST).filter((e) => e.action === 'export.download')).toHaveLength(1);
    }
  });

  it('inviting and revoking are both audited', async () => {
    const inv = await sharingService.invite(owner(REST), {
      email: 'newcpa@example.com', taxYears: [2026], folders: ['tax_2026'],
    });
    expect(inv.ok).toBe(true);
    if (inv.ok) await sharingService.revoke(owner(REST), inv.data.id);
    const actions = readAudit(REST).map((e) => e.action);
    expect(actions).toContain('sharing.invite');
    expect(actions).toContain('sharing.revoke');
  });

  it('the audit log is scoped per business', async () => {
    await exportService.build(owner(REST));
    await exportService.build(owner(SALON));
    expect(readAudit(REST).every((e) => e.businessId === REST)).toBe(true);
    expect(readAudit(SALON).every((e) => e.businessId === SALON)).toBe(true);
  });

  it('audit entries carry an actor and a timestamp', async () => {
    await exportService.build(owner(REST));
    readAudit(REST).forEach((e) => {
      expect(e.actorUserId).toBeTruthy();
      expect(Number.isNaN(Date.parse(e.at))).toBe(false);
    });
  });
});

describe('professional sharing', () => {
  it('an invite is validated', async () => {
    const bad = await sharingService.invite(owner(), {
      email: 'not-an-email', taxYears: [2026], folders: [],
    });
    expect(bad.ok).toBe(false);
    if (!bad.ok) expect(bad.error.kind).toBe('validation');
  });

  it('a tax year must be chosen', async () => {
    const r = await sharingService.invite(owner(), {
      email: 'a@example.com', taxYears: [], folders: [],
    });
    expect(r.ok).toBe(false);
  });

  it('every grant expires — no permanent access is creatable', async () => {
    const r = await sharingService.invite(owner(), {
      email: 'b@example.com', taxYears: [2026], folders: ['tax_2026'],
    });
    if (r.ok) {
      expect(r.data.expiresAt).toBeTruthy();
      expect(new Date(r.data.expiresAt).getTime()).toBeGreaterThan(Date.now());
    }
  });

  it('a duplicate invite is rejected', async () => {
    await sharingService.invite(owner(), { email: 'c@example.com', taxYears: [2026], folders: [] });
    const again = await sharingService.invite(owner(), { email: 'c@example.com', taxYears: [2026], folders: [] });
    expect(again.ok).toBe(false);
    if (!again.ok) expect(again.error.kind).toBe('conflict');
  });

  it('an invited professional reads only what was shared', async () => {
    const pro = sharingService.buildProfessionalCaller('u_cpa', REST, 2026, 'tax_2026');
    const r = await transactionRepository.list(pro);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.data.every((t) => t.businessId === REST)).toBe(true);
  });

  it('revoking access takes effect on the very next request', async () => {
    const pro = sharingService.buildProfessionalCaller('u_cpa', REST, 2026, 'tax_2026');
    expect((await transactionRepository.list(pro)).ok).toBe(true);

    const grant = db().grants.find((g) => g.inviteeUserId === 'u_cpa' && g.businessId === REST)!;
    await sharingService.revoke(owner(REST), grant.id);

    const after = sharingService.buildProfessionalCaller('u_cpa', REST, 2026, 'tax_2026');
    const r = await transactionRepository.list(after);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.kind).toBe('permission_denied');
  });

  it('a professional cannot reach a business they were not invited to', async () => {
    const pro = sharingService.buildProfessionalCaller('u_cpa', SALON, 2026, 'tax_2026');
    const r = await transactionRepository.list(pro);
    expect(r.ok).toBe(false);
  });

  it('a professional cannot build an export', async () => {
    const pro = sharingService.buildProfessionalCaller('u_cpa', REST, 2026, 'tax_2026');
    const r = await exportService.build(pro);
    expect(r.ok).toBe(false);
  });
});

describe('quarterly planning stays planning', () => {
  it('an estimate carries its ruleset status through the service', async () => {
    const r = await quarterlyService.estimate(owner(REST));
    if (r.ok) {
      expect(r.data.rulesetStatus).not.toBe('approved_for_production');
      expect(r.data.unsupported.length).toBeGreaterThan(0);
    }
  });

  it('a scenario scales the estimate without re-deriving tax law', async () => {
    const r = await quarterlyService.scenario(owner(REST), 10);
    if (r.ok) expect(r.data.adjusted).toBeCloseTo(r.data.base * 1.1, 1);
  });
});

describe('masking is applied to stored data, not just display', () => {
  it('no account in the store holds a full number', () => {
    db().accounts.forEach((a) => {
      expect(a.maskedNumber).toMatch(/^\*{4}\d{4}$/);
      expect(a.maskedNumber.length).toBeLessThanOrEqual(8);
    });
  });

  it('masking never exposes leading digits', () => {
    expect(maskAccountNumber('4111111111119876')).toBe('****9876');
  });
});

describe('store isolation between tests', () => {
  it('mutations do not leak across resets', async () => {
    const tx = db().transactions.find((t) => t.businessId === REST && !t.confirmed)!;
    await categorizationService.confirm(owner(), tx.id);
    expect(db().transactions.find((t) => t.id === tx.id)!.confirmed).not.toBeNull();
    resetStore();
    expect(db().transactions.find((t) => t.id === tx.id)!.confirmed).toBeNull();
  });
});
