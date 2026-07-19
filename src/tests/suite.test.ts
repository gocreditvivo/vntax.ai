/**
 * Sổ Sạch — test suite (Vitest)
 *
 * Run with: npm run test
 *
 * NOTE: this file was previously a standalone script using console.log and
 * process.exit. That is not a Vitest spec — a runner collects zero tests from
 * it, and process.exit can kill the worker mid-run. Rewritten as proper
 * describe/it/expect so `vitest run` reports real results.
 */
import { describe, it, expect } from 'vitest';

import { en } from '../i18n/en';
import { vi } from '../i18n/vi';
import { can, isGrantActive, maskAccountNumber, maskTaxIdentifier } from '../security/permissions';
import { isExportable } from '../types';
import type { SharingGrant } from '../types';
import {
  ACCOUNTS, ALERTS, BUSINESSES, CONNECTIONS, DEDUCTION_GROUPS,
  DOCUMENTS, ESTIMATES, GRANTS, RECEIPTS, TRANSACTIONS, rng,
} from '../mocks/fixtures';

// ─── helpers ───────────────────────────────────────────────────────────────

const deepKeys = (o: unknown, prefix = ''): string[] =>
  Object.entries(o as Record<string, unknown>).flatMap(([k, v]) =>
    v && typeof v === 'object' ? deepKeys(v, `${prefix}${k}.`) : [`${prefix}${k}`]
  );

const grant = (over: Partial<SharingGrant> = {}): SharingGrant => ({
  id: 'g1', businessId: 'biz_pho', inviteeEmail: 'cpa@example.com', inviteeUserId: 'u_cpa',
  role: 'tax_professional', taxYears: [2026], folders: ['tax_2026'], status: 'active',
  invitedByUserId: 'u_owner_rest', invitedAt: '2026-01-01T00:00:00Z',
  acceptedAt: '2026-01-02T00:00:00Z', expiresAt: '2027-01-01T00:00:00Z',
  revokedAt: null, ...over,
});

const B = 'biz_pho';
const pro = (over: Record<string, unknown> = {}) =>
  ({ role: 'tax_professional' as const, userId: 'u_cpa', businessId: B,
     taxYear: 2026, folder: 'tax_2026', grant: grant(), ...over });

// ═══════════════════════════════════════════════════════════════════════════

describe('bilingual — both locales are equals, not fallbacks', () => {
  const ek = deepKeys(en).sort();
  const vk = deepKeys(vi).sort();

  it('key sets are identical', () => {
    expect(vk).toEqual(ek);
  });

  it('has a non-trivial number of strings', () => {
    expect(ek.length).toBeGreaterThan(300);
  });

  it('no Vietnamese string is empty', () => {
    const empty = deepKeys(vi).filter((k) => {
      const v = k.split('.').reduce<any>((a, s) => a[s], vi);
      return String(v).trim().length === 0;
    });
    expect(empty).toEqual([]);
  });

  it('Vietnamese is genuinely different text, not copied English', () => {
    expect(vi.dashboard.greeting).not.toBe(en.dashboard.greeting);
    expect(vi.nav.receipts).not.toBe(en.nav.receipts);
    expect(vi.tx.suggested).not.toBe(en.tx.suggested);
  });

  it('official form names stay in English with a Vietnamese gloss', () => {
    expect(vi.forms.schedule_c.name).toBe('Schedule C');
    expect(vi.forms.schedule_c.gloss).toContain('kinh doanh');
    expect(vi.forms.form_1099nec.name).toBe('Form 1099-NEC');
    expect(vi.forms.form_1099nec.gloss.length).toBeGreaterThan(10);
  });
});

describe('compliance — product boundary language', () => {
  const FORBIDDEN = [
    'guaranteed deduction', 'guaranteed tax savings', 'guaranteed savings',
    'irs approved', 'fully deductible', 'automatically eligible', 'guaranteed refund',
    'cpa approval required',
  ];
  const corpus = (JSON.stringify(en) + JSON.stringify(vi)).toLowerCase();

  it.each(FORBIDDEN)('never claims "%s"', (phrase: string) => {
    expect(corpus).not.toContain(phrase);
  });

  it('uses the required hedged phrases', () => {
    expect(en.deductions.possible).toBe('Possible deduction');
    expect(en.tx.suggested).toBe('Suggested category');
    expect(en.legal.planningOnly).toContain('Planning estimate');
    expect(en.legal.confirmationRequired).toBe('Customer confirmation required');
    expect(en.legal.reviewRecommended).toBe('Professional review recommended');
  });

  it('states the customer promise exactly as specified', () => {
    expect(en.legal.promise).toBe(
      'We organize your business finances and help you prepare for tax time.'
    );
  });

  it('never decides worker classification', () => {
    expect(en.salon.classificationNote).toContain('may require professional review');
  });
});

describe('permissions — role boundaries', () => {
  it('the owner may confirm a transaction', () => {
    expect(can({ role: 'owner', userId: 'u', businessId: B }, 'transactions', 'confirm').allowed).toBe(true);
  });

  it('a manager may NOT confirm', () => {
    expect(can({ role: 'manager', userId: 'u', businessId: B }, 'transactions', 'confirm').allowed).toBe(false);
  });

  it('a bookkeeper may NOT confirm — they prepare, the owner confirms', () => {
    expect(can({ role: 'bookkeeper', userId: 'u', businessId: B }, 'transactions', 'confirm').allowed).toBe(false);
  });

  it('a bookkeeper MAY categorize', () => {
    expect(can({ role: 'bookkeeper', userId: 'u', businessId: B }, 'transactions', 'categorize').allowed).toBe(true);
  });

  it('only the owner may grant sharing', () => {
    expect(can({ role: 'owner', userId: 'u', businessId: B }, 'sharing', 'grant').allowed).toBe(true);
    expect(can({ role: 'manager', userId: 'u', businessId: B }, 'sharing', 'grant').allowed).toBe(false);
    expect(can({ role: 'bookkeeper', userId: 'u', businessId: B }, 'sharing', 'grant').allowed).toBe(false);
  });

  it('a manager sees connections masked', () => {
    expect(can({ role: 'manager', userId: 'u', businessId: B }, 'connections', 'view').masked).toBe(true);
  });
});

describe('permissions — grant scoping', () => {
  it('an active grant permits scoped access', () => {
    expect(can(pro(), 'transactions', 'view').allowed).toBe(true);
  });

  it('a REVOKED grant blocks immediately', () => {
    const g = grant({ status: 'revoked', revokedAt: '2026-06-01T00:00:00Z' });
    expect(can(pro({ grant: g }), 'transactions', 'view').allowed).toBe(false);
  });

  it('an EXPIRED grant blocks', () => {
    const g = grant({ expiresAt: '2026-02-01T00:00:00Z' });
    expect(can(pro({ grant: g }), 'transactions', 'view').allowed).toBe(false);
  });

  it('a grant for another business blocks', () => {
    expect(can(pro({ businessId: 'biz_lotus' }), 'transactions', 'view').allowed).toBe(false);
  });

  it('an unshared tax year blocks', () => {
    expect(can(pro({ taxYear: 2024 }), 'transactions', 'view').allowed).toBe(false);
  });

  it('an unshared folder blocks', () => {
    expect(can(pro({ folder: 'payroll' }), 'documents', 'view').allowed).toBe(false);
  });

  it('no grant at all blocks', () => {
    expect(can({ role: 'tax_professional', userId: 'u', businessId: B }, 'transactions', 'view').allowed).toBe(false);
  });

  it('a professional cannot grant access onward', () => {
    expect(can(pro(), 'sharing', 'grant').allowed).toBe(false);
  });

  it('an invited-but-unaccepted grant is not active', () => {
    expect(isGrantActive(grant({ status: 'invited', acceptedAt: null }))).toBe(false);
  });
});

describe('permissions — admin boundary', () => {
  const admin = { role: 'admin' as const, userId: 'a1', businessId: B };

  it('has no default path to transactions', () => {
    expect(can(admin, 'transactions', 'view').allowed).toBe(false);
  });

  it('has no path to tax identity', () => {
    expect(can(admin, 'tax_identity', 'view').allowed).toBe(false);
  });

  it('sees only a limited business projection', () => {
    expect(can(admin, 'business', 'view').masked).toBe(true);
  });
});

describe('masking — last four only, never the leading digits', () => {
  it('masks to the last four', () => {
    expect(maskAccountNumber('4111111111119876')).toBe('****9876');
  });

  it('never reveals the leading digits', () => {
    expect(maskAccountNumber('4111111111119876').startsWith('4111')).toBe(false);
  });

  it('fully masks a short input', () => {
    expect(maskAccountNumber('123')).toBe('****');
  });

  it('tolerates formatting characters', () => {
    expect(maskAccountNumber('4111-1111-1111-9876')).toBe('****9876');
  });

  it('masks a tax identifier', () => {
    expect(maskTaxIdentifier('123456789')).toBe('***-**-6789');
  });

  it('every fixture account is already masked', () => {
    ACCOUNTS.forEach((a) => expect(a.maskedNumber).toMatch(/^\*{4}\d{4}$/));
  });
});

describe('export gate — nothing unconfirmed can be exported', () => {
  const unconfirmed = TRANSACTIONS.filter((x) => !x.confirmed);

  it('the fixtures deliberately contain unconfirmed transactions', () => {
    expect(unconfirmed.length).toBeGreaterThan(0);
  });

  it('no unconfirmed transaction is exportable', () => {
    expect(unconfirmed.every((x) => !isExportable(x))).toBe(true);
  });

  it('confirmed business transactions are exportable', () => {
    const confirmed = TRANSACTIONS.filter((x) => x.confirmed && x.scope === 'business');
    expect(confirmed.length).toBeGreaterThan(0);
    expect(confirmed.every(isExportable)).toBe(true);
  });

  it('personal-scope transactions are never exportable', () => {
    expect(TRANSACTIONS.filter((x) => x.scope === 'personal').every((x) => !isExportable(x))).toBe(true);
  });
});

describe('fixture safety — nothing resembling real identifiers', () => {
  const corpus = JSON.stringify({ BUSINESSES, TRANSACTIONS, RECEIPTS, DOCUMENTS, ACCOUNTS, GRANTS });

  it('contains no SSN-format string', () => {
    expect(corpus).not.toMatch(/\b\d{3}-\d{2}-\d{4}\b/);
  });

  it('contains no EIN-format string', () => {
    expect(corpus).not.toMatch(/\b\d{2}-\d{7}\b/);
  });

  it('contains no full 16-digit card number', () => {
    expect(corpus).not.toMatch(/\b\d{16}\b/);
  });

  it('uses only example.com addresses', () => {
    const emails = [...corpus.matchAll(/[\w.]+@[\w.]+/g)].map((m) => m[0]);
    expect(emails.every((e) => e.endsWith('example.com'))).toBe(true);
  });

  it('uses only 555 phone numbers', () => {
    BUSINESSES.forEach((b) => { if (b.phone) expect(b.phone).toContain('555'); });
  });
});

describe('determinism — same seed, same data', () => {
  it('the seeded RNG is reproducible', () => {
    expect(Array.from({ length: 5 }, rng(42))).toEqual(Array.from({ length: 5 }, rng(42)));
  });

  it('different seeds produce different data', () => {
    expect(Array.from({ length: 5 }, rng(42))).not.toEqual(Array.from({ length: 5 }, rng(43)));
  });
});

describe('edge cases are seeded, so empty and error states are reachable', () => {
  it('a duplicate pair exists', () => {
    expect(TRANSACTIONS.filter((x) => x.flags.includes('possible_duplicate')).length).toBeGreaterThanOrEqual(2);
  });
  it('a transfer that looks like income exists', () => {
    expect(TRANSACTIONS.some((x) => x.flags.includes('possible_transfer'))).toBe(true);
  });
  it('a large cash deposit exists', () => {
    expect(TRANSACTIONS.some((x) => x.flags.includes('large_cash'))).toBe(true);
  });
  it('a low-confidence suggestion exists', () => {
    expect(TRANSACTIONS.some((x) => (x.suggested?.confidence ?? 1) < 0.5)).toBe(true);
  });
  it('an unreadable receipt exists', () => {
    expect(RECEIPTS.some((r) => r.status === 'unreadable')).toBe(true);
  });
  it('a partial extraction exists — confident total, unreadable merchant', () => {
    expect(RECEIPTS.some((r) =>
      r.extracted !== null &&
      r.extracted.merchant.confidence < 0.3 &&
      r.extracted.total.confidence > 0.9
    )).toBe(true);
  });
  it('a multi-page receipt exists', () => {
    expect(RECEIPTS.some((r) => r.pageCount > 1)).toBe(true);
  });
  it('a failed connection exists', () => {
    expect(CONNECTIONS.some((c) => c.status === 'sync_failed')).toBe(true);
  });
  it('an expired connection exists', () => {
    expect(CONNECTIONS.some((c) => c.status === 'expired')).toBe(true);
  });
  it('two missing W-9s exist', () => {
    expect(DOCUMENTS.filter((d) => d.kind === 'w9' && d.status === 'missing')).toHaveLength(2);
  });
  it('a revoked grant exists', () => {
    expect(GRANTS.some((g) => g.status === 'revoked')).toBe(true);
  });
  it('an expiring licence exists', () => {
    expect(DOCUMENTS.some((d) => d.expiresAt !== null)).toBe(true);
  });
});

describe('locality — filing follows the address, not the county', () => {
  const pho = BUSINESSES.find((b) => b.id === 'biz_pho')!;
  const lotus = BUSINESSES.find((b) => b.id === 'biz_lotus')!;

  it('the two businesses resolve to different localities', () => {
    expect(pho.address.localityId).not.toBe(lotus.address.localityId);
  });

  it('a City of Falls Church business is not a Fairfax County business', () => {
    expect(pho.address.localityId).toBe('loc_falls_church_city');
    expect(lotus.address.localityId).toBe('loc_fairfax_county');
  });
});

describe('tax engine boundary', () => {
  const est = ESTIMATES[0];

  it('every estimate carries a ruleset version', () => {
    ESTIMATES.forEach((e) => expect(e.rulesetVersion).toBeTruthy());
  });

  it('no ruleset is approved for production', () => {
    ESTIMATES.forEach((e) => expect(e.rulesetStatus).not.toBe('approved_for_production'));
  });

  it('every trace line cites a source', () => {
    est.trace.forEach((l) => expect(l.sourceReference.length).toBeGreaterThan(0));
  });

  it('unverified rules are flagged in the trace the customer sees', () => {
    expect(est.trace.some((l) => l.ruleStatus !== 'verified')).toBe(true);
  });

  it('income tax is reported as unsupported rather than guessed', () => {
    expect(est.unsupported).toContain('income_tax_brackets_unverified');
  });

  it('the self-employment figure matches verified 2026 logic', () => {
    const seBase = 102877.9;
    const expected = seBase * 0.124 + seBase * 0.029;
    expect(Math.abs(est.selfEmploymentComponent - expected)).toBeLessThan(1);
  });
});

describe('alerts are actionable or they do not exist', () => {
  it('every alert deep-links to a resolving screen', () => {
    ALERTS.forEach((a) => expect(a.deepLink.startsWith('/')).toBe(true));
  });

  it('every alert carries a recommended action', () => {
    ALERTS.forEach((a) => expect(a.recommendedActionKey.length).toBeGreaterThan(0));
  });

  it('deduction groups track customer confirmation', () => {
    DEDUCTION_GROUPS.forEach((g) => expect(typeof g.customerConfirmed).toBe('boolean'));
  });
});
