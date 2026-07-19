/**
 * In-memory store.
 *
 * Deep-clones the fixtures on init so tests can mutate freely and reset to a
 * known state. This is the seam a real API replaces: swap this module for HTTP
 * calls and no feature code changes.
 */
import type {
  Alert, Business, BusinessDocument, Connection, DeductionGroup,
  ExportPackage, FinancialAccount, QuarterlyEstimate, Receipt,
  SharingGrant, Transaction, User,
} from '../types';
import {
  ACCOUNTS, ALERTS, BUSINESSES, CONNECTIONS, DEDUCTION_GROUPS, DOCUMENTS,
  ESTIMATES, GRANTS, RECEIPTS, TRANSACTIONS, USERS,
} from '../mocks/fixtures';

export interface Store {
  users: User[];
  businesses: Business[];
  connections: Connection[];
  accounts: FinancialAccount[];
  transactions: Transaction[];
  receipts: Receipt[];
  documents: BusinessDocument[];
  deductionGroups: DeductionGroup[];
  estimates: QuarterlyEstimate[];
  alerts: Alert[];
  grants: SharingGrant[];
  exports: ExportPackage[];
}

const clone = <T,>(x: T): T => JSON.parse(JSON.stringify(x)) as T;

function seed(): Store {
  return {
    users: clone(USERS),
    businesses: clone(BUSINESSES),
    connections: clone(CONNECTIONS),
    accounts: clone(ACCOUNTS),
    transactions: clone(TRANSACTIONS),
    receipts: clone(RECEIPTS),
    documents: clone(DOCUMENTS),
    deductionGroups: clone(DEDUCTION_GROUPS),
    estimates: clone(ESTIMATES),
    alerts: clone(ALERTS),
    grants: clone(GRANTS),
    exports: [],
  };
}

let store: Store = seed();

export const db = (): Store => store;

/** Restores the seeded state. Called between tests. */
export function resetStore(): void {
  store = seed();
}
