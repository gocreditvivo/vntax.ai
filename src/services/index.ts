/**
 * Public service surface. Features import from here and nowhere deeper —
 * swapping the in-memory store for HTTP changes only these modules.
 */
export * from './core';
export { db, resetStore } from './store';
export { transactionRepository, categorizationService, receiptRepository } from './transactions';
export {
  deductionService, quarterlyService, industryService,
  documentService, exportService, sharingService, readAudit,
} from './domain';
