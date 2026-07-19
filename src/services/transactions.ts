/**
 * Transaction repository, receipt repository, and categorization service.
 *
 * The product boundary is enforced here: a suggestion is never a confirmation,
 * and only a role permitted to confirm can create one.
 */
import type { Receipt, Transaction, TransactionFlag } from '../types';
import { isExportable } from '../types';
import {
  authorize, err, recordAudit, run, scopeTo,
  type Caller, type Result, type ServiceOptions,
} from './core';
import { db } from './store';

// ═══ transaction repository ════════════════════════════════════════════════

export interface TransactionQuery {
  filter?: 'all' | 'needs_review' | 'confirmed' | 'missing_receipt' | 'flagged';
  search?: string;
  limit?: number;
}

export const transactionRepository = {
  async list(
    caller: Caller,
    query: TransactionQuery = {},
    opts: ServiceOptions = {}
  ): Promise<Result<Transaction[]>> {
    const auth = authorize(caller, 'transactions', 'view');
    if (!auth.ok) return auth;

    return run(() => {
      let rows = scopeTo(db().transactions, caller.businessId);

      switch (query.filter) {
        case 'needs_review':    rows = rows.filter((t) => !t.confirmed); break;
        case 'confirmed':       rows = rows.filter((t) => Boolean(t.confirmed)); break;
        case 'missing_receipt': rows = rows.filter((t) => !t.receiptId); break;
        case 'flagged':         rows = rows.filter((t) => t.flags.length > 0); break;
      }

      if (query.search) {
        const q = query.search.toLowerCase();
        rows = rows.filter(
          (t) =>
            (t.merchantNormalized ?? '').toLowerCase().includes(q) ||
            t.merchantRaw.toLowerCase().includes(q)
        );
      }

      rows = [...rows].sort((a, b) => b.postedAt.localeCompare(a.postedAt));
      return query.limit ? rows.slice(0, query.limit) : rows;
    }, opts);
  },

  async get(caller: Caller, id: string, opts: ServiceOptions = {}): Promise<Result<Transaction>> {
    const auth = authorize(caller, 'transactions', 'view');
    if (!auth.ok) return auth;

    const scoped = scopeTo(db().transactions, caller.businessId);
    const row = scoped.find((t) => t.id === id);
    // A record in another business is reported as not_found, never as forbidden.
    // Distinguishing the two would leak that it exists.
    if (!row) return err('not_found', 'error.not_found', id);
    return run(() => row, opts);
  },

  async summary(caller: Caller, opts: ServiceOptions = {}) {
    const auth = authorize(caller, 'transactions', 'view');
    if (!auth.ok) return auth;

    return run(() => {
      const rows = scopeTo(db().transactions, caller.businessId);
      const income = rows.filter((t) => t.amount > 0 && t.classification === 'income');
      const expense = rows.filter((t) => t.amount < 0);
      return {
        total: rows.length,
        confirmed: rows.filter((t) => t.confirmed).length,
        unconfirmed: rows.filter((t) => !t.confirmed).length,
        missingReceipts: rows.filter((t) => !t.receiptId).length,
        flagged: rows.filter((t) => t.flags.length > 0).length,
        exportable: rows.filter(isExportable).length,
        incomeTotal: Math.round(income.reduce((s, t) => s + t.amount, 0) * 100) / 100,
        expenseTotal: Math.round(expense.reduce((s, t) => s + Math.abs(t.amount), 0) * 100) / 100,
      };
    }, opts);
  },
};

// ═══ categorization service ════════════════════════════════════════════════

export const categorizationService = {
  /**
   * Confirm a suggested category, or correct it.
   * `corrected` is set automatically when the customer picks something else —
   * that flag is the training signal.
   */
  async confirm(
    caller: Caller,
    transactionId: string,
    override?: { categoryKey: string; scheduleCLine: string | null },
    opts: ServiceOptions = {}
  ): Promise<Result<Transaction>> {
    const auth = authorize(caller, 'transactions', 'confirm');
    if (!auth.ok) return auth;

    const row = scopeTo(db().transactions, caller.businessId).find((t) => t.id === transactionId);
    if (!row) return err('not_found', 'error.not_found', transactionId);
    if (row.status === 'excluded') return err('conflict', 'error.already_excluded', transactionId);

    const chosen = override ?? {
      categoryKey: row.suggested?.categoryKey ?? 'uncategorized',
      scheduleCLine: row.suggested?.scheduleCLine ?? null,
    };
    if (!override && !row.suggested) {
      return err('validation', 'error.no_suggestion_to_confirm', transactionId);
    }

    return run(() => {
      // `override` is captured before the closure so TS can narrow it.
      const wasCorrected = override !== undefined &&
                           override.categoryKey !== row.suggested?.categoryKey;
      row.confirmed = {
        categoryKey: chosen.categoryKey,
        scheduleCLine: chosen.scheduleCLine,
        confirmedByUserId: caller.userId,
        confirmedAt: new Date().toISOString(),
        corrected: wasCorrected,
      };
      row.status = 'confirmed';
      row.auditTrail.push({
        eventId: recordAudit(caller, 'transaction.confirm', 'transaction', row.id, {
          categoryKey: chosen.categoryKey,
          corrected: row.confirmed.corrected,
        }).id,
        at: row.confirmed.confirmedAt,
        actorUserId: caller.userId,
        action: 'confirm',
      });
      return row;
    }, opts);
  },

  /**
   * Bulk confirm. Emits ONE audit event per transaction so the trail stays
   * per-record — a bulk action is not a shortcut around accountability.
   */
  async confirmMany(
    caller: Caller,
    ids: string[],
    opts: ServiceOptions = {}
  ): Promise<Result<{ confirmed: string[]; skipped: { id: string; reason: string }[] }>> {
    const auth = authorize(caller, 'transactions', 'confirm');
    if (!auth.ok) return auth;

    return run(async () => {
      const confirmed: string[] = [];
      const skipped: { id: string; reason: string }[] = [];
      for (const id of ids) {
        const r = await categorizationService.confirm(caller, id, undefined, { latencyMs: 0 });
        if (r.ok) confirmed.push(id);
        else skipped.push({ id, reason: r.error.kind });
      }
      return { confirmed, skipped };
    }, opts);
  },

  async exclude(
    caller: Caller,
    transactionId: string,
    opts: ServiceOptions = {}
  ): Promise<Result<Transaction>> {
    const auth = authorize(caller, 'transactions', 'confirm');
    if (!auth.ok) return auth;

    const row = scopeTo(db().transactions, caller.businessId).find((t) => t.id === transactionId);
    if (!row) return err('not_found', 'error.not_found', transactionId);

    return run(() => {
      row.scope = 'personal';
      row.status = 'excluded';
      row.confirmed = null;
      recordAudit(caller, 'transaction.exclude', 'transaction', row.id);
      return row;
    }, opts);
  },

  async setBusinessPurpose(
    caller: Caller,
    transactionId: string,
    purpose: string,
    opts: ServiceOptions = {}
  ): Promise<Result<Transaction>> {
    const auth = authorize(caller, 'transactions', 'categorize');
    if (!auth.ok) return auth;
    if (!purpose.trim()) return err('validation', 'error.purpose_required');

    const row = scopeTo(db().transactions, caller.businessId).find((t) => t.id === transactionId);
    if (!row) return err('not_found', 'error.not_found', transactionId);

    return run(() => {
      row.businessPurpose = purpose.trim();
      row.flags = row.flags.filter((f) => f !== 'requires_business_purpose');
      return row;
    }, opts);
  },
};

// ═══ receipt repository ════════════════════════════════════════════════════

export const receiptRepository = {
  async list(caller: Caller, opts: ServiceOptions = {}): Promise<Result<Receipt[]>> {
    const auth = authorize(caller, 'receipts', 'view');
    if (!auth.ok) return auth;
    return run(() => scopeTo(db().receipts, caller.businessId), opts);
  },

  async queue(caller: Caller, opts: ServiceOptions = {}): Promise<Result<Receipt[]>> {
    const auth = authorize(caller, 'receipts', 'view');
    if (!auth.ok) return auth;
    return run(
      () =>
        scopeTo(db().receipts, caller.businessId).filter((r) =>
          ['unmatched', 'unreadable', 'duplicate', 'needs_info'].includes(r.status)
        ),
      opts
    );
  },

  /** Simulates capture + extraction. Extraction confidence is always surfaced. */
  async upload(
    caller: Caller,
    file: { name: string; pageCount?: number },
    opts: ServiceOptions = {}
  ): Promise<Result<Receipt>> {
    const auth = authorize(caller, 'receipts', 'upload');
    if (!auth.ok) return auth;

    return run(() => {
      const id = `rc_new_${db().receipts.length + 1}`;
      const receipt: Receipt = {
        id,
        businessId: caller.businessId,
        storageKey: `synthetic/receipts/${id}.jpg`,
        pageCount: file.pageCount ?? 1,
        uploadedAt: new Date().toISOString(),
        uploadedByUserId: caller.userId,
        extracted: {
          merchant:      { value: 'Synthetic Supply Co', confidence: 0.88, corrected: false },
          date:          { value: new Date().toISOString().slice(0, 10), confidence: 0.95, corrected: false },
          subtotal:      { value: 184.2, confidence: 0.91, corrected: false },
          tax:           { value: 11.05, confidence: 0.89, corrected: false },
          tip:           { value: 0, confidence: 0.99, corrected: false },
          total:         { value: 195.25, confidence: 0.97, corrected: false },
          paymentMethod: { value: 'card', confidence: 0.9, corrected: false },
          last4:         { value: '4021', confidence: 0.82, corrected: false },
        },
        match: null,
        status: 'unmatched',
        businessPurpose: null,
        duplicateOfReceiptId: null,
      };
      db().receipts.push(receipt);
      recordAudit(caller, 'receipt.upload', 'receipt', id, { fileName: file.name });
      return receipt;
    }, opts);
  },

  /**
   * Match a receipt to a transaction. Exact when total and date agree,
   * fuzzy when only the total is close, manual when the customer picks.
   */
  async match(
    caller: Caller,
    receiptId: string,
    transactionId: string,
    method: 'exact' | 'fuzzy' | 'manual' = 'manual',
    opts: ServiceOptions = {}
  ): Promise<Result<Receipt>> {
    const auth = authorize(caller, 'receipts', 'upload');
    if (!auth.ok) return auth;

    const receipts = scopeTo(db().receipts, caller.businessId);
    const receipt = receipts.find((r) => r.id === receiptId);
    if (!receipt) return err('not_found', 'error.receipt_not_found', receiptId);

    const tx = scopeTo(db().transactions, caller.businessId).find((t) => t.id === transactionId);
    if (!tx) return err('not_found', 'error.not_found', transactionId);

    if (tx.receiptId && tx.receiptId !== receiptId) {
      return err('conflict', 'error.transaction_already_matched', transactionId);
    }

    return run(() => {
      const total = receipt.extracted?.total.value ?? null;
      const amountsAgree = total !== null && Math.abs(Math.abs(tx.amount) - total) < 0.02;

      receipt.match = {
        transactionId,
        confidence: amountsAgree ? 0.98 : 0.6,
        method: amountsAgree ? 'exact' : method,
        matchedAt: new Date().toISOString(),
      };
      receipt.status = 'matched';
      tx.receiptId = receiptId;
      tx.flags = tx.flags.filter((f: TransactionFlag) => f !== 'missing_receipt');
      recordAudit(caller, 'receipt.match', 'receipt', receiptId, { transactionId });
      return receipt;
    }, opts);
  },

  /** Candidate transactions for an unmatched receipt, best first. */
  async suggestMatches(
    caller: Caller,
    receiptId: string,
    opts: ServiceOptions = {}
  ): Promise<Result<{ transaction: Transaction; confidence: number }[]>> {
    const auth = authorize(caller, 'receipts', 'view');
    if (!auth.ok) return auth;

    const receipt = scopeTo(db().receipts, caller.businessId).find((r) => r.id === receiptId);
    if (!receipt) return err('not_found', 'error.receipt_not_found', receiptId);

    return run(() => {
      const total = receipt.extracted?.total.value;
      const date = receipt.extracted?.date.value;
      if (total == null) return [];

      return scopeTo(db().transactions, caller.businessId)
        .filter((t) => !t.receiptId)
        .map((t) => {
          const amountDelta = Math.abs(Math.abs(t.amount) - total);
          let confidence = amountDelta < 0.02 ? 0.95 : amountDelta < 2 ? 0.7 : 0.2;
          if (date && t.postedAt === date) confidence = Math.min(0.99, confidence + 0.04);
          return { transaction: t, confidence: Math.round(confidence * 100) / 100 };
        })
        .filter((c) => c.confidence > 0.5)
        .sort((a, b) => b.confidence - a.confidence)
        .slice(0, 5);
    }, opts);
  },
};
