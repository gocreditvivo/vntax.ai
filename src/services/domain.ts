/**
 * Deduction suggestion, quarterly estimate, export, professional sharing,
 * and document services.
 *
 * Three product rules live here, not in the UI:
 *   - a deduction is always "possible", never decided
 *   - an estimate is planning output, never a filed result
 *   - only confirmed transactions can enter an export
 */
import type {
  BusinessDocument, DeductionGroup, ExportFormat, ExportPackage,
  QuarterlyEstimate, RestaurantMetrics, SalonMetrics, SharingGrant, Transaction,
} from '../types';
import { isExportable } from '../types';
import {
  authorize, err, readAudit, recordAudit, resolveGrant, run, scopeTo,
  type Caller, type Result, type ServiceOptions,
} from './core';
import { db } from './store';
import { RESTAURANT_METRICS, SALON_METRICS } from '../mocks/fixtures';

// ═══ deduction suggestion service ══════════════════════════════════════════

export const deductionService = {
  /**
   * Groups CONFIRMED transactions by category. Unconfirmed ones are excluded —
   * a deduction cannot rest on a suggestion the customer never accepted.
   */
  async suggest(caller: Caller, taxYear = 2026, opts: ServiceOptions = {}): Promise<Result<DeductionGroup[]>> {
    const auth = authorize(caller, 'deductions', 'view');
    if (!auth.ok) return auth;

    return run(() => {
      const txs = scopeTo(db().transactions, caller.businessId).filter(
        (t) => t.confirmed && t.scope === 'business'
      );

      const byCategory = new Map<string, Transaction[]>();
      for (const t of txs) {
        const key = t.confirmed!.categoryKey;
        byCategory.set(key, [...(byCategory.get(key) ?? []), t]);
      }

      const REVIEW_RECOMMENDED = ['equipment', 'repairs', 'rent', 'kitchen_equip', 'contract_labor'];

      return [...byCategory.entries()]
        .map(([categoryKey, group]): DeductionGroup => {
          const missing = group.filter((g) => !g.receiptId).length;
          return {
            id: `dg_${caller.businessId}_${categoryKey}`,
            businessId: caller.businessId,
            taxYear,
            categoryKey,
            scheduleCLine: group[0].confirmed!.scheduleCLine,
            transactionIds: group.map((g) => g.id),
            total: Math.round(group.reduce((s, g) => s + Math.abs(g.amount), 0) * 100) / 100,
            receiptsAttached: group.length - missing,
            receiptsMissing: missing,
            customerConfirmed: false,
            explanationKey: `explain.${categoryKey}`,
            professionalReviewRecommended: REVIEW_RECOMMENDED.includes(categoryKey),
            needsMoreInformation: missing > 2 ? ['receipts'] : [],
            status: missing > 2 ? 'needs_review' : 'not_started',
          };
        })
        .sort((a, b) => b.total - a.total);
    }, opts);
  },

  /** The customer attests these were business expenses. Only the owner may. */
  async confirmGroup(
    caller: Caller,
    groupId: string,
    opts: ServiceOptions = {}
  ): Promise<Result<{ groupId: string; confirmed: true }>> {
    const auth = authorize(caller, 'deductions', 'confirm');
    if (!auth.ok) return auth;

    return run(() => {
      recordAudit(caller, 'deduction.confirm', 'deduction_group', groupId);
      return { groupId, confirmed: true as const };
    }, opts);
  },
};

// ═══ quarterly estimate service ════════════════════════════════════════════

export const quarterlyService = {
  /**
   * PLANNING ONLY. Delegates every figure to the tax engine's output shape and
   * carries the ruleset status through, so the UI can show what is unverified.
   */
  async estimate(
    caller: Caller,
    taxYear = 2026,
    opts: ServiceOptions = {}
  ): Promise<Result<QuarterlyEstimate>> {
    const auth = authorize(caller, 'quarterly', 'view');
    if (!auth.ok) return auth;

    const existing = scopeTo(db().estimates, caller.businessId).find((e) => e.taxYear === taxYear);
    if (!existing) return err('not_found', 'error.no_estimate', String(taxYear));
    return run(() => existing, opts);
  },

  /** Scenario modelling. Scales the SE component; never re-derives tax law. */
  async scenario(
    caller: Caller,
    incomeChangePct: number,
    opts: ServiceOptions = {}
  ): Promise<Result<{ base: number; adjusted: number; delta: number }>> {
    const auth = authorize(caller, 'quarterly', 'view');
    if (!auth.ok) return auth;

    const est = scopeTo(db().estimates, caller.businessId)[0];
    if (!est) return err('not_found', 'error.no_estimate');

    return run(() => {
      const base = est.selfEmploymentComponent;
      const adjusted = Math.round(base * (1 + incomeChangePct / 100) * 100) / 100;
      return { base, adjusted, delta: Math.round((adjusted - base) * 100) / 100 };
    }, opts);
  },
};

// ═══ industry metrics ══════════════════════════════════════════════════════

export const industryService = {
  async restaurant(caller: Caller, opts: ServiceOptions = {}): Promise<Result<RestaurantMetrics>> {
    const auth = authorize(caller, 'business', 'view');
    if (!auth.ok) return auth;
    const biz = db().businesses.find((b) => b.id === caller.businessId);
    if (!biz) return err('not_found', 'error.not_found', caller.businessId);
    if (biz.industry !== 'restaurant') {
      return err('blocked', 'error.wrong_industry', biz.industry);
    }
    return run(() => RESTAURANT_METRICS, opts);
  },

  async salon(caller: Caller, opts: ServiceOptions = {}): Promise<Result<SalonMetrics>> {
    const auth = authorize(caller, 'business', 'view');
    if (!auth.ok) return auth;
    const biz = db().businesses.find((b) => b.id === caller.businessId);
    if (!biz) return err('not_found', 'error.not_found', caller.businessId);
    if (biz.industry !== 'nail_salon') {
      return err('blocked', 'error.wrong_industry', biz.industry);
    }
    return run(() => SALON_METRICS, opts);
  },
};

// ═══ document service ══════════════════════════════════════════════════════

export const documentService = {
  async list(caller: Caller, opts: ServiceOptions = {}): Promise<Result<BusinessDocument[]>> {
    const auth = authorize(caller, 'documents', 'view');
    if (!auth.ok) return auth;
    return run(() => scopeTo(db().documents, caller.businessId), opts);
  },

  async upload(
    caller: Caller,
    documentId: string,
    opts: ServiceOptions = {}
  ): Promise<Result<BusinessDocument>> {
    const auth = authorize(caller, 'documents', 'upload');
    if (!auth.ok) return auth;

    const doc = scopeTo(db().documents, caller.businessId).find((d) => d.id === documentId);
    if (!doc) return err('not_found', 'error.not_found', documentId);

    return run(() => {
      doc.status = 'uploaded';
      doc.uploadedAt = new Date().toISOString();
      doc.storageKey = `synthetic/docs/${documentId}.pdf`;
      recordAudit(caller, 'document.upload', 'document', documentId, { kind: doc.kind });
      return doc;
    }, opts);
  },
};

// ═══ export service ════════════════════════════════════════════════════════

export const exportService = {
  /**
   * Completeness is computed BEFORE the package is built and travels with it.
   * A package that quietly omits unconfirmed rows is worse than no package.
   */
  async completeness(caller: Caller, opts: ServiceOptions = {}) {
    const auth = authorize(caller, 'exports', 'create');
    if (!auth.ok) return auth;

    return run(() => {
      const txs = scopeTo(db().transactions, caller.businessId);
      return {
        unconfirmedTransactions: txs.filter((t) => !t.confirmed).length,
        missingReceipts: txs.filter((t) => !t.receiptId).length,
        unresolvedAlerts: scopeTo(db().alerts, caller.businessId)
          .filter((a) => a.status !== 'completed' && a.status !== 'archived').length,
        missingDocuments: scopeTo(db().documents, caller.businessId)
          .filter((d) => d.status === 'missing' || d.status === 'requested').length,
      };
    }, opts);
  },

  async build(
    caller: Caller,
    taxYear = 2026,
    formats: ExportFormat[] = ['pdf', 'csv'],
    opts: ServiceOptions = {}
  ): Promise<Result<ExportPackage & { includedTransactionIds: string[] }>> {
    const auth = authorize(caller, 'exports', 'create');
    if (!auth.ok) return auth;

    const comp = await exportService.completeness(caller, { latencyMs: 0 });
    if (!comp.ok) return comp;

    return run(() => {
      // THE EXPORT GATE. Only confirmed, business-scope rows are included.
      const included = scopeTo(db().transactions, caller.businessId).filter(isExportable);

      const pkg: ExportPackage & { includedTransactionIds: string[] } = {
        id: `ex_${caller.businessId}_${Date.now()}`,
        businessId: caller.businessId,
        taxYear,
        createdAt: new Date().toISOString(),
        createdByUserId: caller.userId,
        contents: {
          businessProfile: true, incomeSummary: true, expenseSummary: true,
          categorizedTransactions: true, receiptIndex: true, missingReceipts: true,
          possibleDeductions: true, payrollSummary: true, contractorSummary: true,
          tipsSummary: true, salesTaxSummary: true, quarterlyPayments: true,
          accountList: true, documentChecklist: true, unresolvedQuestions: true,
          customerNotes: true, auditSummary: true,
        },
        formats,
        completeness: comp.data,
        status: 'completed',
        sharedWithGrantIds: [],
        storageKey: `synthetic/exports/${caller.businessId}-${taxYear}.zip`,
        includedTransactionIds: included.map((t) => t.id),
      };

      db().exports.push(pkg);
      // Audit is REQUIRED for exports.
      recordAudit(caller, 'export.create', 'export', pkg.id, {
        taxYear,
        transactionsIncluded: included.length,
        unconfirmedExcluded: comp.data.unconfirmedTransactions,
        formats: formats.join(','),
      });
      return pkg;
    }, opts);
  },

  async list(caller: Caller, opts: ServiceOptions = {}): Promise<Result<ExportPackage[]>> {
    const auth = authorize(caller, 'exports', 'download');
    if (!auth.ok) return auth;
    return run(() => scopeTo(db().exports, caller.businessId), opts);
  },

  async download(caller: Caller, exportId: string, opts: ServiceOptions = {}): Promise<Result<{ url: string }>> {
    const auth = authorize(caller, 'exports', 'download');
    if (!auth.ok) return auth;

    const pkg = scopeTo(db().exports, caller.businessId).find((e) => e.id === exportId);
    if (!pkg) return err('not_found', 'error.not_found', exportId);

    return run(() => {
      recordAudit(caller, 'export.download', 'export', exportId, { taxYear: pkg.taxYear });
      return { url: `signed://${pkg.storageKey}?expires=900` };
    }, opts);
  },
};

// ═══ professional sharing service ══════════════════════════════════════════

export const sharingService = {
  async list(caller: Caller, opts: ServiceOptions = {}): Promise<Result<SharingGrant[]>> {
    const auth = authorize(caller, 'sharing', 'grant');
    if (!auth.ok) return auth;
    return run(() => scopeTo(db().grants, caller.businessId), opts);
  },

  async invite(
    caller: Caller,
    input: { email: string; taxYears: number[]; folders: string[]; expiresInDays?: number },
    opts: ServiceOptions = {}
  ): Promise<Result<SharingGrant>> {
    const auth = authorize(caller, 'sharing', 'grant');
    if (!auth.ok) return auth;

    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(input.email)) {
      return err('validation', 'error.invalid_email', input.email);
    }
    if (input.taxYears.length === 0) return err('validation', 'error.no_tax_year_selected');

    const duplicate = scopeTo(db().grants, caller.businessId).find(
      (g) => g.inviteeEmail === input.email && (g.status === 'active' || g.status === 'invited')
    );
    if (duplicate) return err('conflict', 'error.already_invited', input.email);

    return run(() => {
      const days = input.expiresInDays ?? 365;
      const grant: SharingGrant = {
        id: `gr_${db().grants.length + 1}`,
        businessId: caller.businessId,
        inviteeEmail: input.email,
        inviteeUserId: null,
        role: 'tax_professional',
        taxYears: input.taxYears,
        folders: input.folders,
        status: 'invited',
        invitedByUserId: caller.userId,
        invitedAt: new Date().toISOString(),
        acceptedAt: null,
        // Non-nullable by design — there is no permanent grant.
        expiresAt: new Date(Date.now() + days * 86_400_000).toISOString(),
        revokedAt: null,
      };
      db().grants.push(grant);
      recordAudit(caller, 'sharing.invite', 'grant', grant.id, {
        invitee: input.email,
        taxYears: input.taxYears.join(','),
        expiresAt: grant.expiresAt,
      });
      return grant;
    }, opts);
  },

  async revoke(caller: Caller, grantId: string, opts: ServiceOptions = {}): Promise<Result<SharingGrant>> {
    const auth = authorize(caller, 'sharing', 'revoke');
    if (!auth.ok) return auth;

    const grant = scopeTo(db().grants, caller.businessId).find((g) => g.id === grantId);
    if (!grant) return err('not_found', 'error.not_found', grantId);
    if (grant.status === 'revoked') return err('conflict', 'error.already_revoked', grantId);

    return run(() => {
      grant.status = 'revoked';
      grant.revokedAt = new Date().toISOString();
      recordAudit(caller, 'sharing.revoke', 'grant', grantId, { invitee: grant.inviteeEmail });
      return grant;
    }, opts);
  },

  /** Builds a caller for an invited professional, resolving their live grant. */
  buildProfessionalCaller(
    userId: string,
    businessId: string,
    taxYear?: number,
    folder?: string
  ): Caller {
    return {
      userId,
      role: 'tax_professional',
      businessId,
      grant: resolveGrant(db().grants, businessId, userId),
      taxYear,
      folder,
    };
  },

  async accessHistory(caller: Caller, opts: ServiceOptions = {}) {
    const auth = authorize(caller, 'audit', 'view');
    if (!auth.ok) return auth;
    return run(
      () => readAudit(caller.businessId).filter((e) => e.resourceType === 'grant' || e.resourceType === 'export'),
      opts
    );
  },
};

export { readAudit };
