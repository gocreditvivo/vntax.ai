/**
 * Sổ Sạch — domain model
 * ---------------------------------------------------------------------------
 * The single source of truth for shapes. Features import from here; nothing
 * here imports from features.
 *
 * Product boundary encoded in these types:
 *   - a Transaction is exportable only when `confirmed` is non-null
 *   - a suggestion always carries confidence and is never the same field as
 *     a confirmation
 *   - every sharing grant has an expiry; there is no permanent grant
 */

// ─── shared ────────────────────────────────────────────────────────────────

export type Locale = 'en' | 'vi';
export type ISODate = string;      // YYYY-MM-DD
export type ISODateTime = string;  // RFC 3339
export type Money = number;        // USD; negative = money out

/** The one status vocabulary. No synonyms elsewhere. */
export type Status =
  | 'not_started' | 'in_progress' | 'waiting_customer' | 'waiting_system'
  | 'needs_review' | 'action_required' | 'blocked' | 'failed'
  | 'completed' | 'archived';

/** An extracted or inferred value, always with its own confidence. */
export interface Field<T> {
  value: T | null;
  confidence: number;   // 0..1
  corrected: boolean;   // customer changed it
}

export interface AuditRef {
  eventId: string;
  at: ISODateTime;
  actorUserId: string;
  action: string;
}

// ─── identity & access ─────────────────────────────────────────────────────

export type Role = 'owner' | 'manager' | 'bookkeeper' | 'tax_professional' | 'admin';

export interface User {
  id: string;
  email: string;
  phone: string | null;
  displayName: string;
  locale: Locale;
  mfaEnabled: boolean;
  createdAt: ISODateTime;
}

export interface Membership {
  userId: string;
  businessId: string;
  role: Role;
  invitedByUserId: string | null;
  acceptedAt: ISODateTime | null;
  /** Non-null only for tax_professional. Scoped, expiring access. */
  grantId: string | null;
}

// ─── business ──────────────────────────────────────────────────────────────

export type Industry = 'restaurant' | 'nail_salon';

export type EntityType =
  | 'sole_proprietor' | 'single_member_llc' | 'multi_member_llc'
  | 'partnership' | 's_corporation' | 'c_corporation' | 'unknown';

export type AccountingMethod = 'cash' | 'accrual' | 'unknown';

/**
 * Locality is resolved from the exact street address, never from the county.
 * A business in the City of Falls Church files with different authorities than
 * one two miles away in Fairfax County.
 */
export interface Locality {
  id: string;
  label: string;
  state: string;
  county: string | null;
  city: string | null;
  filingAuthorities: {
    mealsTax: string | null;
    salesTax: string | null;
    businessLicense: string | null;
    tangibleProperty: string | null;
  };
}

export interface Address {
  line1: string;
  line2: string | null;
  city: string;
  state: string;
  postalCode: string;
  localityId: string;
}

export interface Business {
  id: string;
  legalName: string;
  dbaName: string | null;
  industry: Industry;
  entityType: EntityType;
  address: Address;
  phone: string | null;
  email: string | null;
  startedYear: number | null;
  locationCount: number;
  accountingMethod: AccountingMethod;
  fiscalYearEndMonth: number | null;
  employeeCount: number | null;
  contractorCount: number | null;
  hasEIN: boolean;
  salesTaxRegistered: boolean | null;
  payrollProvider: string | null;
  merchantProcessor: string | null;
  deliveryPlatforms: string[];
  handlesCash: boolean;
  priorYearReturnAvailable: boolean | null;
  createdAt: ISODateTime;
}

/**
 * Separate table, separate access control, vault-tokenized.
 * Never joined into ordinary business queries.
 */
export interface TaxIdentity {
  businessId: string;
  einToken: string | null;
  ownerSsnToken: string | null;
  lastVerifiedAt: ISODateTime | null;
}

// ─── connections & accounts ────────────────────────────────────────────────

export type ConnectionKind =
  | 'bank' | 'credit_card' | 'payment_processor'
  | 'delivery_platform' | 'payroll' | 'bookkeeping_import';

export type ConnectionStatus =
  | 'not_connected' | 'connecting' | 'connected'
  | 'sync_in_progress' | 'sync_completed' | 'sync_failed'
  | 'expired' | 'auth_required' | 'revoked'
  | 'disconnected' | 'duplicate_detected';

export interface Connection {
  id: string;
  businessId: string;
  kind: ConnectionKind;
  institutionName: string;
  status: ConnectionStatus;
  lastSyncAt: ISODateTime | null;
  lastSuccessfulSyncAt: ISODateTime | null;
  failureReason: string | null;
  /** Provider handle only. Credentials never reach this application. */
  providerRef: string;
}

export interface FinancialAccount {
  id: string;
  connectionId: string;
  businessId: string;
  name: string;
  /** Masked at rest and in transit: "****1234". Leading digits withheld. */
  maskedNumber: string;
  type: 'checking' | 'savings' | 'credit' | 'processor' | 'other';
  currency: 'USD';
  active: boolean;
}

// ─── transactions ──────────────────────────────────────────────────────────

export type TransactionClassification =
  'income' | 'expense' | 'transfer' | 'refund' | 'unknown';

export type TransactionScope = 'business' | 'personal' | 'mixed' | 'unknown';

export type TransactionStatus =
  | 'imported' | 'normalizing' | 'suggested' | 'needs_review'
  | 'confirmed' | 'excluded' | 'superseded';

export type TransactionFlag =
  | 'possible_duplicate' | 'possible_transfer' | 'missing_receipt'
  | 'unusual_amount' | 'unrecognized_merchant' | 'large_cash'
  | 'requires_business_purpose';

/** What the system proposes. Never the same field as what the customer confirms. */
export interface SuggestedCategorization {
  categoryKey: string;
  scheduleCLine: string | null;
  confidence: number;
  source: 'rules' | 'model' | 'history';
  explanationKey: string;
}

/** What the customer decided. Presence of this object makes a row exportable. */
export interface ConfirmedCategorization {
  categoryKey: string;
  scheduleCLine: string | null;
  confirmedByUserId: string;
  confirmedAt: ISODateTime;
  /** True when the customer changed the suggestion — the training signal. */
  corrected: boolean;
}

export interface TransactionSplit {
  id: string;
  amount: Money;
  categoryKey: string;
  scheduleCLine: string | null;
  businessPurpose: string | null;
}

export interface Transaction {
  id: string;
  businessId: string;
  accountId: string;
  postedAt: ISODate;
  amount: Money;
  currency: 'USD';

  merchantRaw: string;
  merchantNormalized: string | null;
  descriptionRaw: string;

  classification: TransactionClassification;
  scope: TransactionScope;

  suggested: SuggestedCategorization | null;
  confirmed: ConfirmedCategorization | null;

  splits: TransactionSplit[];
  businessPurpose: string | null;
  receiptId: string | null;
  flags: TransactionFlag[];
  status: TransactionStatus;
  notes: string | null;
  auditTrail: AuditRef[];
}

/** The export gate, in one place. */
export const isExportable = (t: Transaction): boolean =>
  t.confirmed !== null && t.status === 'confirmed' && t.scope !== 'personal';

// ─── receipts ──────────────────────────────────────────────────────────────

export type ReceiptStatus =
  | 'uploaded' | 'processing' | 'extracted' | 'matched' | 'unmatched'
  | 'duplicate' | 'unreadable' | 'needs_info' | 'confirmed' | 'archived';

export interface ReceiptExtraction {
  merchant: Field<string>;
  date: Field<ISODate>;
  subtotal: Field<Money>;
  tax: Field<Money>;
  tip: Field<Money>;
  total: Field<Money>;
  paymentMethod: Field<string>;
  /** For matching only. Masked on display. */
  last4: Field<string>;
}

export interface ReceiptMatch {
  transactionId: string;
  confidence: number;
  method: 'exact' | 'fuzzy' | 'manual';
  matchedAt: ISODateTime;
}

export interface Receipt {
  id: string;
  businessId: string;
  storageKey: string;
  pageCount: number;
  uploadedAt: ISODateTime;
  uploadedByUserId: string;
  extracted: ReceiptExtraction | null;
  match: ReceiptMatch | null;
  status: ReceiptStatus;
  businessPurpose: string | null;
  duplicateOfReceiptId: string | null;
}

// ─── documents ─────────────────────────────────────────────────────────────

export type DocumentKind =
  | 'prior_year_return' | 'bank_statement' | 'card_statement'
  | 'payroll_report' | 'w2' | 'form_1099' | 'w9' | 'k1'
  | 'sales_tax_report' | 'merchant_statement' | 'delivery_statement'
  | 'business_license' | 'permit' | 'lease' | 'insurance'
  | 'equipment_invoice' | 'loan_statement' | 'vehicle_record'
  | 'mileage_log' | 'entity_document' | 'ein_letter'
  | 'formation_record' | 'depreciation_schedule' | 'retirement_record'
  | 'health_insurance_record' | 'inventory_record' | 'other';

export type DocumentStatus =
  | 'not_requested' | 'requested' | 'uploaded' | 'processing'
  | 'needs_review' | 'accepted' | 'rejected' | 'expired'
  | 'missing' | 'shared' | 'exported';

export interface DownloadEvent {
  at: ISODateTime;
  byUserId: string;
  viaGrantId: string | null;
  ip: string | null;
}

export interface BusinessDocument {
  id: string;
  businessId: string;
  taxYear: number | null;
  kind: DocumentKind;
  label: string;
  storageKey: string;
  status: DocumentStatus;
  requestedByUserId: string | null;
  requestedAt: ISODateTime | null;
  uploadedAt: ISODateTime | null;
  acceptedAt: ISODateTime | null;
  rejectionReason: string | null;
  expiresAt: ISODate | null;
  retentionClass: 'standard' | 'extended' | 'permanent';
  sharedWithGrantIds: string[];
  downloadLog: DownloadEvent[];
  notes: string | null;
}

// ─── possible deductions ───────────────────────────────────────────────────

/**
 * Wording is load-bearing. "Possible", never "guaranteed".
 * The product organizes evidence; it does not decide eligibility.
 */
export interface DeductionGroup {
  id: string;
  businessId: string;
  taxYear: number;
  categoryKey: string;
  scheduleCLine: string | null;
  transactionIds: string[];
  total: Money;
  receiptsAttached: number;
  receiptsMissing: number;
  customerConfirmed: boolean;
  explanationKey: string;
  professionalReviewRecommended: boolean;
  needsMoreInformation: string[];
  status: Status;
}

// ─── quarterly planning ────────────────────────────────────────────────────

export interface EstimateTraceLine {
  ruleId: string;
  label: string;
  value: number | string | boolean;
  sourceReference: string;
  ruleStatus: 'verified' | 'unverified' | 'partial';
}

/**
 * Planning only. Never presented as a filed result or a final liability.
 * Produced solely by the tax engine.
 */
export interface QuarterlyEstimate {
  id: string;
  businessId: string;
  taxYear: number;
  quarter: 1 | 2 | 3 | 4;
  estimatedNetProfit: Money;
  selfEmploymentComponent: Money;
  federalPlanningRange: { low: Money; high: Money } | null;
  statePlaceholder: Money | null;
  paymentsMade: Money;
  remainingEstimate: Money;
  nextDueDate: ISODate | null;
  rulesetVersion: string;
  rulesetStatus: string;
  trace: EstimateTraceLine[];
  warnings: string[];
  unsupported: string[];
  computedAt: ISODateTime;
}

// ─── alerts ────────────────────────────────────────────────────────────────

export type AlertKind =
  | 'uncategorized_transactions' | 'missing_receipts' | 'receipt_mismatch'
  | 'duplicate_expense' | 'unusual_expense' | 'large_cash_deposit'
  | 'large_cash_withdrawal' | 'unrecognized_merchant' | 'missing_w9'
  | 'possible_1099_requirement' | 'payroll_report_missing'
  | 'tip_report_missing' | 'sales_tax_reminder' | 'quarterly_due'
  | 'license_renewal' | 'document_request' | 'account_disconnected'
  | 'sync_failed' | 'tax_year_package_incomplete'
  | 'professional_question_pending' | 'export_ready';

export type AlertSeverity = 'info' | 'attention' | 'urgent';

export interface AlertResolution {
  at: ISODateTime;
  byUserId: string;
  action: string;
  note: string | null;
}

export interface Alert {
  id: string;
  businessId: string;
  kind: AlertKind;
  severity: AlertSeverity;
  titleKey: string;
  explanationKey: string;
  recommendedActionKey: string;
  /** Every alert resolves somewhere. An alert with no path is a design defect. */
  deepLink: string;
  subjectRef: { type: string; id: string } | null;
  assignedUserId: string | null;
  dueDate: ISODate | null;
  status: Status;
  resolutionHistory: AlertResolution[];
  createdAt: ISODateTime;
}

// ─── exports ───────────────────────────────────────────────────────────────

export type ExportFormat =
  'pdf' | 'csv' | 'receipt_zip' | 'expense_report' | 'pro_package' | 'bookkeeping';

export interface ExportCompleteness {
  unconfirmedTransactions: number;
  missingReceipts: number;
  unresolvedAlerts: number;
  missingDocuments: number;
}

export interface ExportPackage {
  id: string;
  businessId: string;
  taxYear: number;
  createdAt: ISODateTime;
  createdByUserId: string;
  contents: Record<string, boolean>;
  formats: ExportFormat[];
  /** Always stated on the cover page. Never buried. */
  completeness: ExportCompleteness;
  status: Status;
  sharedWithGrantIds: string[];
  storageKey: string | null;
}

// ─── collaboration ─────────────────────────────────────────────────────────

export type GrantStatus =
  | 'not_connected' | 'invited' | 'accepted'
  | 'active' | 'expired' | 'revoked';

/** Scoped, expiring, revocable. There is no permanent grant. */
export interface SharingGrant {
  id: string;
  businessId: string;
  inviteeEmail: string;
  inviteeUserId: string | null;
  role: 'tax_professional' | 'bookkeeper';
  taxYears: number[];
  folders: string[];
  status: GrantStatus;
  invitedByUserId: string;
  invitedAt: ISODateTime;
  acceptedAt: ISODateTime | null;
  expiresAt: ISODateTime;
  revokedAt: ISODateTime | null;
}

export interface AccessEvent {
  id: string;
  grantId: string;
  businessId: string;
  at: ISODateTime;
  actorUserId: string;
  resourceType: string;
  resourceId: string;
  action: 'view' | 'download' | 'comment' | 'request';
}

export interface ProfessionalComment {
  id: string;
  businessId: string;
  grantId: string;
  authorUserId: string;
  subjectRef: { type: string; id: string } | null;
  body: string;
  createdAt: ISODateTime;
  resolvedAt: ISODateTime | null;
}

// ─── audit ─────────────────────────────────────────────────────────────────

/** Append-only. No update path exists. */
export interface AuditEvent {
  id: string;
  businessId: string | null;
  actorUserId: string;
  action: string;
  resourceType: string;
  resourceId: string;
  at: ISODateTime;
  metadata: Record<string, string | number | boolean | null>;
}

// ─── industry views ────────────────────────────────────────────────────────

/** Observations requiring attention. Never presented as accounting conclusions. */
export interface RestaurantMetrics {
  taxYear: number;
  grossSales: Money;
  foodCost: Money;
  beverageCost: Money;
  laborCost: Money;
  payroll: Money;
  tips: Money;
  rent: Money;
  utilities: Money;
  deliveryFees: Money;
  merchantFees: Money;
  operatingExpenses: Money;
  estimatedNetIncome: Money;
  uncategorizedCount: number;
  missingReceiptCount: number;
  vendorConcentration: { vendor: string; share: number }[];
}

export interface SalonMetrics {
  taxYear: number;
  serviceIncome: Money;
  productSales: Money;
  tips: Money;
  boothRentalIncome: Money;
  employeePayroll: Money;
  contractorPayments: Money;
  merchantFees: Money;
  supplyExpenses: Money;
  rent: Money;
  utilities: Money;
  operatingExpenses: Money;
  estimatedNetIncome: Money;
  missingW9Count: number;
  possible1099Count: number;
  uncategorizedCount: number;
  missingReceiptCount: number;
}
