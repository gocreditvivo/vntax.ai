/**
 * Deterministic synthetic fixtures. Same seed → same data, so tests and
 * screenshots are stable.
 *
 * NOTHING HERE IS REAL. Account numbers use reserved ranges, vendors are
 * fictional, phones are 555, domains are example.com. A test asserts no
 * real-format SSN or EIN appears anywhere in the repo.
 */
import type {
  Alert, Business, BusinessDocument, Connection, DeductionGroup, FinancialAccount,
  Locality, QuarterlyEstimate, Receipt, RestaurantMetrics, SalonMetrics,
  SharingGrant, Transaction, User,
} from '../types';

// ─── deterministic PRNG (mulberry32) ───────────────────────────────────────
export function rng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const pick = <T,>(r: () => number, xs: readonly T[]): T => xs[Math.floor(r() * xs.length)];
const money = (r: () => number, lo: number, hi: number) =>
  Math.round((lo + r() * (hi - lo)) * 100) / 100;

// ─── localities ────────────────────────────────────────────────────────────
// The distinction that matters: two businesses four miles apart file with
// entirely different authorities.
export const LOCALITIES: Locality[] = [
  {
    id: 'loc_falls_church_city',
    label: 'City of Falls Church',
    state: 'VA',
    county: null,
    city: 'Falls Church',
    filingAuthorities: {
      mealsTax: 'City of Falls Church',
      salesTax: 'Virginia Department of Taxation',
      businessLicense: 'City of Falls Church',
      tangibleProperty: 'City of Falls Church',
    },
  },
  {
    id: 'loc_fairfax_county',
    label: 'Fairfax County',
    state: 'VA',
    county: 'Fairfax',
    city: null,
    filingAuthorities: {
      mealsTax: 'Fairfax County',
      salesTax: 'Virginia Department of Taxation',
      businessLicense: 'Fairfax County',
      tangibleProperty: 'Fairfax County',
    },
  },
];

// ─── users ─────────────────────────────────────────────────────────────────
export const USERS: User[] = [
  { id: 'u_owner_rest', email: 'dung@example.com', phone: '(703) 555-0142',
    displayName: 'Dũng Nguyễn', locale: 'vi', mfaEnabled: true, createdAt: '2026-01-08T14:02:00Z' },
  { id: 'u_owner_salon', email: 'lan@example.com', phone: '(703) 555-0198',
    displayName: 'Lan Trần', locale: 'vi', mfaEnabled: true, createdAt: '2026-01-11T16:20:00Z' },
  { id: 'u_manager', email: 'manager@example.com', phone: '(703) 555-0155',
    displayName: 'Minh Phạm', locale: 'vi', mfaEnabled: true, createdAt: '2026-02-02T09:00:00Z' },
  { id: 'u_cpa', email: 'cpa@example.com', phone: '(703) 555-0177',
    displayName: 'Hoa Lê, CPA', locale: 'en', mfaEnabled: true, createdAt: '2026-03-01T11:00:00Z' },
];

// ─── businesses ────────────────────────────────────────────────────────────
export const BUSINESSES: Business[] = [
  {
    id: 'biz_pho',
    legalName: 'Phở Bình Minh LLC',
    dbaName: 'Phở Bình Minh',
    industry: 'restaurant',
    entityType: 's_corporation',
    address: { line1: '6763 Wilson Blvd', line2: null, city: 'Falls Church',
               state: 'VA', postalCode: '22044', localityId: 'loc_falls_church_city' },
    phone: '(703) 555-0101', email: 'info@example.com',
    startedYear: 2014, locationCount: 1, accountingMethod: 'cash',
    fiscalYearEndMonth: 12, employeeCount: 6, contractorCount: 0,
    hasEIN: true, salesTaxRegistered: true,
    payrollProvider: 'Synthetic Payroll Co', merchantProcessor: 'Synthetic POS',
    deliveryPlatforms: ['Synthetic Delivery A', 'Synthetic Delivery B', 'Synthetic Delivery C'],
    handlesCash: true, priorYearReturnAvailable: true,
    createdAt: '2026-01-08T14:05:00Z',
  },
  {
    id: 'biz_lotus',
    legalName: 'Lotus Nails & Spa LLC',
    dbaName: 'Lotus Nails & Spa',
    industry: 'nail_salon',
    entityType: 'single_member_llc',
    address: { line1: '8320 Arlington Blvd', line2: 'Suite 210', city: 'Fairfax',
               state: 'VA', postalCode: '22031', localityId: 'loc_fairfax_county' },
    phone: '(703) 555-0102', email: 'hello@example.com',
    startedYear: 2019, locationCount: 1, accountingMethod: 'cash',
    fiscalYearEndMonth: 12, employeeCount: 4, contractorCount: 3,
    hasEIN: true, salesTaxRegistered: null,   // open question: are services taxable in VA?
    payrollProvider: 'Synthetic Payroll Co', merchantProcessor: 'Synthetic POS',
    deliveryPlatforms: [], handlesCash: true, priorYearReturnAvailable: false,
    createdAt: '2026-01-11T16:25:00Z',
  },
];

// ─── connections & accounts ────────────────────────────────────────────────
export const CONNECTIONS: Connection[] = [
  { id: 'cx_pho_bank', businessId: 'biz_pho', kind: 'bank', institutionName: 'Synthetic Community Bank',
    status: 'sync_completed', lastSyncAt: '2026-07-18T06:00:00Z',
    lastSuccessfulSyncAt: '2026-07-18T06:00:00Z', failureReason: null, providerRef: 'prov_a1' },
  { id: 'cx_pho_pos', businessId: 'biz_pho', kind: 'payment_processor', institutionName: 'Synthetic POS',
    status: 'sync_completed', lastSyncAt: '2026-07-18T06:02:00Z',
    lastSuccessfulSyncAt: '2026-07-18T06:02:00Z', failureReason: null, providerRef: 'prov_a2' },
  // Seeded failure — a stale connection produces a silently incomplete year-end package.
  { id: 'cx_pho_delivery', businessId: 'biz_pho', kind: 'delivery_platform',
    institutionName: 'Synthetic Delivery B', status: 'sync_failed',
    lastSyncAt: '2026-07-12T06:00:00Z', lastSuccessfulSyncAt: '2026-06-30T06:00:00Z',
    failureReason: 'auth_expired', providerRef: 'prov_a3' },
  { id: 'cx_lotus_bank', businessId: 'biz_lotus', kind: 'bank', institutionName: 'Synthetic Community Bank',
    status: 'sync_completed', lastSyncAt: '2026-07-18T06:00:00Z',
    lastSuccessfulSyncAt: '2026-07-18T06:00:00Z', failureReason: null, providerRef: 'prov_b1' },
  { id: 'cx_lotus_card', businessId: 'biz_lotus', kind: 'credit_card', institutionName: 'Synthetic Card',
    status: 'expired', lastSyncAt: '2026-07-01T06:00:00Z',
    lastSuccessfulSyncAt: '2026-07-01T06:00:00Z', failureReason: 'reauth_required', providerRef: 'prov_b2' },
];

export const ACCOUNTS: FinancialAccount[] = [
  { id: 'ac_pho_1', connectionId: 'cx_pho_bank', businessId: 'biz_pho',
    name: 'Business Checking', maskedNumber: '****4021', type: 'checking', currency: 'USD', active: true },
  { id: 'ac_pho_2', connectionId: 'cx_pho_pos', businessId: 'biz_pho',
    name: 'Card Settlements', maskedNumber: '****7788', type: 'processor', currency: 'USD', active: true },
  { id: 'ac_lotus_1', connectionId: 'cx_lotus_bank', businessId: 'biz_lotus',
    name: 'Business Checking', maskedNumber: '****3310', type: 'checking', currency: 'USD', active: true },
  { id: 'ac_lotus_2', connectionId: 'cx_lotus_card', businessId: 'biz_lotus',
    name: 'Business Card', maskedNumber: '****9142', type: 'credit', currency: 'USD', active: true },
];

// ─── transaction generation ────────────────────────────────────────────────
type Vendor = readonly [name: string, line: string, categoryKey: string];

const REST_VENDORS: readonly Vendor[] = [
  ['Synthetic Food Wholesale', 'COGS', 'food_purchases'],
  ['Synthetic Produce Co', 'COGS', 'food_purchases'],
  ['Synthetic Beverage Dist', 'COGS', 'beverage_purchases'],
  ['Synthetic Packaging Supply', '22', 'packaging'],
  ['Synthetic Utilities', '25', 'utilities'],
  ['Synthetic Property Mgmt', '20b', 'rent'],
  ['Synthetic Delivery A', '10', 'delivery_fees'],
  ['Synthetic Delivery B', '10', 'delivery_fees'],
  ['Synthetic POS Fees', '10', 'merchant_fees'],
  ['Synthetic Hood Cleaning', '21', 'repairs'],
  ['Synthetic Pest Control', '21', 'repairs'],
  ['Synthetic Linen Service', '27a', 'linen'],
  ['Synthetic Waste Removal', '27a', 'waste'],
  ['Synthetic Insurance Group', '15', 'insurance'],
] as const;

const SALON_VENDORS: readonly Vendor[] = [
  ['Synthetic Nail Supply', '22', 'nail_supplies'],
  ['Synthetic Beauty Wholesale', '22', 'nail_supplies'],
  ['Synthetic Gel Products', '22', 'gel_products'],
  ['Synthetic Property Mgmt', '20b', 'rent'],
  ['Synthetic Utilities', '25', 'utilities'],
  ['Synthetic POS Fees', '10', 'merchant_fees'],
  ['Synthetic Booking Software', '27a', 'booking_software'],
  ['Synthetic Laundry Service', '27a', 'laundry'],
  ['Synthetic Equipment Repair', '21', 'repairs'],
  ['Synthetic Insurance Group', '15', 'insurance'],
  ['Synthetic Cosmetology Board', '23', 'licenses'],
];

function makeTransactions(businessId: string, accountId: string, seed: number, count: number) {
  const r = rng(seed);
  const isRest = businessId === 'biz_pho';
  const vendors = isRest ? REST_VENDORS : SALON_VENDORS;
  const out: Transaction[] = [];

  for (let i = 0; i < count; i++) {
    const [vendor, line, categoryKey] = pick(r, vendors);
    const month = 1 + Math.floor(r() * 7);
    const day = 1 + Math.floor(r() * 28);
    const postedAt = `2026-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    const amount = -money(r, isRest ? 180 : 60, isRest ? 4200 : 900);
    const confidence = Math.round((0.55 + r() * 0.44) * 100) / 100;

    // Most are confirmed; a deliberate tail is left unconfirmed so the export
    // completeness warning has something real to report.
    const confirmedShare = r();
    const isConfirmed = confirmedShare > 0.28;
    const corrected = isConfirmed && r() > 0.85;
    const hasReceipt = r() > 0.35;

    out.push({
      id: `tx_${businessId}_${i}`,
      businessId, accountId, postedAt, amount, currency: 'USD',
      merchantRaw: `${vendor.toUpperCase()} #${1000 + Math.floor(r() * 8999)}`,
      merchantNormalized: vendor,
      descriptionRaw: `PURCHASE ${vendor.toUpperCase()}`,
      classification: 'expense',
      scope: 'business',
      suggested: {
        categoryKey, scheduleCLine: line === 'COGS' ? null : line,
        confidence, source: confidence > 0.8 ? 'rules' : 'model',
        explanationKey: `explain.${categoryKey}`,
      },
      confirmed: isConfirmed
        ? { categoryKey, scheduleCLine: line === 'COGS' ? null : line,
            confirmedByUserId: isRest ? 'u_owner_rest' : 'u_owner_salon',
            confirmedAt: `${postedAt}T18:00:00Z`, corrected }
        : null,
      splits: [],
      businessPurpose: null,
      receiptId: hasReceipt ? `rc_${businessId}_${i}` : null,
      flags: [
        ...(hasReceipt ? [] : ['missing_receipt' as const]),
        ...(confidence < 0.65 ? [] : []),
      ],
      status: isConfirmed ? 'confirmed' : confidence < 0.65 ? 'needs_review' : 'suggested',
      notes: null,
      auditTrail: [],
    });
  }

  // ── deliberate edge cases ──
  out.push({
    id: `tx_${businessId}_dup_a`, businessId, accountId, postedAt: '2026-05-14',
    amount: -1284.5, currency: 'USD',
    merchantRaw: 'SYNTHETIC FOOD WHOLESALE #4410', merchantNormalized: 'Synthetic Food Wholesale',
    descriptionRaw: 'PURCHASE SYNTHETIC FOOD WHOLESALE', classification: 'expense', scope: 'business',
    suggested: { categoryKey: 'food_purchases', scheduleCLine: null, confidence: 0.94,
                 source: 'rules', explanationKey: 'explain.food_purchases' },
    confirmed: null, splits: [], businessPurpose: null, receiptId: null,
    flags: ['possible_duplicate', 'missing_receipt'], status: 'needs_review',
    notes: null, auditTrail: [],
  });
  out.push({
    id: `tx_${businessId}_dup_b`, businessId, accountId, postedAt: '2026-05-14',
    amount: -1284.5, currency: 'USD',
    merchantRaw: 'SYNTHETIC FOOD WHOLESALE #4410', merchantNormalized: 'Synthetic Food Wholesale',
    descriptionRaw: 'PURCHASE SYNTHETIC FOOD WHOLESALE', classification: 'expense', scope: 'business',
    suggested: { categoryKey: 'food_purchases', scheduleCLine: null, confidence: 0.94,
                 source: 'rules', explanationKey: 'explain.food_purchases' },
    confirmed: null, splits: [], businessPurpose: null, receiptId: null,
    flags: ['possible_duplicate', 'missing_receipt'], status: 'needs_review',
    notes: null, auditTrail: [],
  });
  out.push({
    id: `tx_${businessId}_transfer`, businessId, accountId, postedAt: '2026-04-02',
    amount: 8000, currency: 'USD',
    merchantRaw: 'ONLINE TRANSFER FROM SAVINGS', merchantNormalized: 'Internal transfer',
    descriptionRaw: 'ONLINE TRANSFER', classification: 'transfer', scope: 'unknown',
    suggested: { categoryKey: 'transfer', scheduleCLine: null, confidence: 0.72,
                 source: 'rules', explanationKey: 'explain.transfer' },
    confirmed: null, splits: [], businessPurpose: null, receiptId: null,
    flags: ['possible_transfer'], status: 'needs_review', notes: null, auditTrail: [],
  });
  out.push({
    id: `tx_${businessId}_cash`, businessId, accountId, postedAt: '2026-06-20',
    amount: 12400, currency: 'USD',
    merchantRaw: 'CASH DEPOSIT', merchantNormalized: 'Cash deposit',
    descriptionRaw: 'BRANCH DEPOSIT', classification: 'income', scope: 'business',
    suggested: { categoryKey: 'cash_sales', scheduleCLine: null, confidence: 0.61,
                 source: 'model', explanationKey: 'explain.cash_sales' },
    confirmed: null, splits: [], businessPurpose: null, receiptId: null,
    flags: ['large_cash', 'requires_business_purpose'], status: 'needs_review',
    notes: null, auditTrail: [],
  });
  out.push({
    id: `tx_${businessId}_lowconf`, businessId, accountId, postedAt: '2026-03-11',
    amount: -412.9, currency: 'USD',
    merchantRaw: 'SQ *UNKNOWN MERCHANT 88', merchantNormalized: null,
    descriptionRaw: 'SQ *UNKNOWN MERCHANT 88', classification: 'expense', scope: 'unknown',
    suggested: { categoryKey: 'uncategorized', scheduleCLine: null, confidence: 0.41,
                 source: 'model', explanationKey: 'explain.uncategorized' },
    confirmed: null, splits: [], businessPurpose: null, receiptId: null,
    flags: ['unrecognized_merchant', 'missing_receipt'], status: 'needs_review',
    notes: null, auditTrail: [],
  });

  return out;
}

export const TRANSACTIONS: Transaction[] = [
  ...makeTransactions('biz_pho', 'ac_pho_1', 20260101, 64),
  ...makeTransactions('biz_lotus', 'ac_lotus_1', 20260202, 48),
];

// ─── receipts ──────────────────────────────────────────────────────────────
function makeReceipts(businessId: string, seed: number): Receipt[] {
  const r = rng(seed);
  const txs = TRANSACTIONS.filter((t) => t.businessId === businessId && t.receiptId);
  const out: Receipt[] = txs.slice(0, 26).map((t, i) => {
    const conf = Math.round((0.7 + r() * 0.3) * 100) / 100;
    return {
      id: t.receiptId!,
      businessId,
      storageKey: `synthetic/receipts/${t.receiptId}.jpg`,
      pageCount: 1,
      uploadedAt: `${t.postedAt}T19:12:00Z`,
      uploadedByUserId: businessId === 'biz_pho' ? 'u_owner_rest' : 'u_owner_salon',
      extracted: {
        merchant: { value: t.merchantNormalized, confidence: conf, corrected: false },
        date: { value: t.postedAt, confidence: 0.97, corrected: false },
        subtotal: { value: Math.abs(t.amount) * 0.93, confidence: 0.9, corrected: false },
        tax: { value: Math.abs(t.amount) * 0.07, confidence: 0.88, corrected: false },
        tip: { value: 0, confidence: 0.99, corrected: false },
        total: { value: Math.abs(t.amount), confidence: 0.98, corrected: false },
        paymentMethod: { value: 'card', confidence: 0.92, corrected: false },
        last4: { value: '4021', confidence: 0.85, corrected: false },
      },
      match: { transactionId: t.id, confidence: 0.96, method: i % 7 === 0 ? 'manual' : 'exact',
               matchedAt: `${t.postedAt}T19:13:00Z` },
      status: 'matched',
      businessPurpose: null,
      duplicateOfReceiptId: null,
    };
  });

  // ── deliberate edge cases ──
  out.push({
    id: `rc_${businessId}_unreadable`, businessId,
    storageKey: 'synthetic/receipts/unreadable.jpg', pageCount: 1,
    uploadedAt: '2026-06-02T20:41:00Z',
    uploadedByUserId: businessId === 'biz_pho' ? 'u_owner_rest' : 'u_owner_salon',
    extracted: null, match: null, status: 'unreadable',
    businessPurpose: null, duplicateOfReceiptId: null,
  });
  // Confident total, unreadable merchant — the common real-world case.
  out.push({
    id: `rc_${businessId}_partial`, businessId,
    storageKey: 'synthetic/receipts/partial.jpg', pageCount: 1,
    uploadedAt: '2026-06-09T21:02:00Z',
    uploadedByUserId: businessId === 'biz_pho' ? 'u_owner_rest' : 'u_owner_salon',
    extracted: {
      merchant: { value: null, confidence: 0.22, corrected: false },
      date: { value: '2026-06-09', confidence: 0.95, corrected: false },
      subtotal: { value: 168.4, confidence: 0.94, corrected: false },
      tax: { value: 10.1, confidence: 0.91, corrected: false },
      tip: { value: 0, confidence: 0.99, corrected: false },
      total: { value: 178.5, confidence: 0.97, corrected: false },
      paymentMethod: { value: 'card', confidence: 0.9, corrected: false },
      last4: { value: '4021', confidence: 0.8, corrected: false },
    },
    match: null, status: 'unmatched', businessPurpose: null, duplicateOfReceiptId: null,
  });
  out.push({
    id: `rc_${businessId}_multipage`, businessId,
    storageKey: 'synthetic/receipts/multipage.pdf', pageCount: 3,
    uploadedAt: '2026-05-22T18:30:00Z',
    uploadedByUserId: businessId === 'biz_pho' ? 'u_owner_rest' : 'u_owner_salon',
    extracted: {
      merchant: { value: 'Synthetic Equipment Co', confidence: 0.93, corrected: false },
      date: { value: '2026-05-22', confidence: 0.96, corrected: false },
      subtotal: { value: 4210.0, confidence: 0.92, corrected: false },
      tax: { value: 252.6, confidence: 0.9, corrected: false },
      tip: { value: 0, confidence: 0.99, corrected: false },
      total: { value: 4462.6, confidence: 0.95, corrected: false },
      paymentMethod: { value: 'card', confidence: 0.9, corrected: false },
      last4: { value: '9142', confidence: 0.82, corrected: false },
    },
    match: null, status: 'needs_info', businessPurpose: null, duplicateOfReceiptId: null,
  });
  out.push({
    id: `rc_${businessId}_dup`, businessId,
    storageKey: 'synthetic/receipts/dup.jpg', pageCount: 1,
    uploadedAt: '2026-05-14T20:00:00Z',
    uploadedByUserId: businessId === 'biz_pho' ? 'u_owner_rest' : 'u_owner_salon',
    extracted: {
      merchant: { value: 'Synthetic Food Wholesale', confidence: 0.95, corrected: false },
      date: { value: '2026-05-14', confidence: 0.97, corrected: false },
      subtotal: { value: 1200.0, confidence: 0.93, corrected: false },
      tax: { value: 84.5, confidence: 0.9, corrected: false },
      tip: { value: 0, confidence: 0.99, corrected: false },
      total: { value: 1284.5, confidence: 0.98, corrected: false },
      paymentMethod: { value: 'card', confidence: 0.9, corrected: false },
      last4: { value: '4021', confidence: 0.85, corrected: false },
    },
    match: null, status: 'duplicate',
    businessPurpose: null, duplicateOfReceiptId: `rc_${businessId}_0`,
  });
  return out;
}

export const RECEIPTS: Receipt[] = [
  ...makeReceipts('biz_pho', 30260101),
  ...makeReceipts('biz_lotus', 30260202),
];

// ─── documents ─────────────────────────────────────────────────────────────
export const DOCUMENTS: BusinessDocument[] = [
  { id: 'doc_1', businessId: 'biz_pho', taxYear: 2025, kind: 'prior_year_return',
    label: '2025 business return', storageKey: 'synthetic/docs/1.pdf', status: 'accepted',
    requestedByUserId: null, requestedAt: null, uploadedAt: '2026-02-10T10:00:00Z',
    acceptedAt: '2026-02-11T09:00:00Z', rejectionReason: null, expiresAt: null,
    retentionClass: 'permanent', sharedWithGrantIds: [], downloadLog: [], notes: null },
  { id: 'doc_2', businessId: 'biz_pho', taxYear: 2026, kind: 'business_license',
    label: 'Business licence — City of Falls Church', storageKey: 'synthetic/docs/2.pdf',
    status: 'accepted', requestedByUserId: null, requestedAt: null,
    uploadedAt: '2026-03-02T10:00:00Z', acceptedAt: '2026-03-02T12:00:00Z',
    rejectionReason: null, expiresAt: '2026-09-30', retentionClass: 'standard',
    sharedWithGrantIds: [], downloadLog: [], notes: null },
  { id: 'doc_3', businessId: 'biz_pho', taxYear: 2026, kind: 'payroll_report',
    label: 'Q2 payroll summary', storageKey: '', status: 'requested',
    requestedByUserId: 'u_cpa', requestedAt: '2026-07-08T14:00:00Z', uploadedAt: null,
    acceptedAt: null, rejectionReason: null, expiresAt: null, retentionClass: 'standard',
    sharedWithGrantIds: [], downloadLog: [], notes: null },
  { id: 'doc_4', businessId: 'biz_pho', taxYear: 2026, kind: 'sales_tax_report',
    label: 'June sales-tax filing', storageKey: '', status: 'missing',
    requestedByUserId: null, requestedAt: null, uploadedAt: null, acceptedAt: null,
    rejectionReason: null, expiresAt: null, retentionClass: 'standard',
    sharedWithGrantIds: [], downloadLog: [], notes: null },
  { id: 'doc_5', businessId: 'biz_lotus', taxYear: 2026, kind: 'w9',
    label: 'W-9 — Thảo P.', storageKey: '', status: 'missing',
    requestedByUserId: 'u_owner_salon', requestedAt: '2026-06-01T10:00:00Z',
    uploadedAt: null, acceptedAt: null, rejectionReason: null, expiresAt: null,
    retentionClass: 'extended', sharedWithGrantIds: [], downloadLog: [], notes: null },
  { id: 'doc_6', businessId: 'biz_lotus', taxYear: 2026, kind: 'w9',
    label: 'W-9 — Khanh L.', storageKey: '', status: 'missing',
    requestedByUserId: 'u_owner_salon', requestedAt: '2026-06-01T10:00:00Z',
    uploadedAt: null, acceptedAt: null, rejectionReason: null, expiresAt: null,
    retentionClass: 'extended', sharedWithGrantIds: [], downloadLog: [], notes: null },
  { id: 'doc_7', businessId: 'biz_lotus', taxYear: 2026, kind: 'business_license',
    label: 'Salon establishment licence', storageKey: 'synthetic/docs/7.pdf',
    status: 'accepted', requestedByUserId: null, requestedAt: null,
    uploadedAt: '2026-01-20T10:00:00Z', acceptedAt: '2026-01-21T10:00:00Z',
    rejectionReason: null, expiresAt: '2026-08-31', retentionClass: 'standard',
    sharedWithGrantIds: [], downloadLog: [], notes: null },
];

// ─── deduction groups ──────────────────────────────────────────────────────
function deductionGroups(businessId: string): DeductionGroup[] {
  const txs = TRANSACTIONS.filter((t) => t.businessId === businessId && t.confirmed);
  const byCat = new Map<string, Transaction[]>();
  for (const t of txs) {
    const k = t.confirmed!.categoryKey;
    byCat.set(k, [...(byCat.get(k) ?? []), t]);
  }
  return [...byCat.entries()]
    .map(([categoryKey, group], i) => ({
      id: `dg_${businessId}_${i}`,
      businessId, taxYear: 2026, categoryKey,
      scheduleCLine: group[0].confirmed!.scheduleCLine,
      transactionIds: group.map((g) => g.id),
      total: Math.round(group.reduce((s, g) => s + Math.abs(g.amount), 0) * 100) / 100,
      receiptsAttached: group.filter((g) => g.receiptId).length,
      receiptsMissing: group.filter((g) => !g.receiptId).length,
      customerConfirmed: i % 3 !== 0,
      explanationKey: `explain.${categoryKey}`,
      professionalReviewRecommended: ['equipment', 'repairs', 'rent'].includes(categoryKey),
      needsMoreInformation: group.filter((g) => !g.receiptId).length > 2 ? ['receipts'] : [],
      status: (i % 3 !== 0 ? 'completed' : 'needs_review') as DeductionGroup['status'],
    }))
    .sort((a, b) => b.total - a.total);
}

export const DEDUCTION_GROUPS: DeductionGroup[] = [
  ...deductionGroups('biz_pho'),
  ...deductionGroups('biz_lotus'),
];

// ─── quarterly estimates (shape produced by the tax engine) ────────────────
export const ESTIMATES: QuarterlyEstimate[] = [
  {
    id: 'qe_pho_q3', businessId: 'biz_pho', taxYear: 2026, quarter: 3,
    estimatedNetProfit: 111400, selfEmploymentComponent: 15740.32,
    federalPlanningRange: { low: 14200, high: 19800 }, statePlaceholder: null,
    paymentsMade: 9000, remainingEstimate: 6740.32, nextDueDate: '2026-09-15',
    rulesetVersion: '0.1.0', rulesetStatus: 'approved_for_testing',
    trace: [
      { ruleId: 'schedule_c', label: 'Gross receipts', value: 612000,
        sourceReference: 'Schedule C Part I', ruleStatus: 'unverified' },
      { ruleId: 'schedule_c', label: 'Cost of goods sold (Part III)', value: -214200,
        sourceReference: 'Schedule C Part III', ruleStatus: 'unverified' },
      { ruleId: 'schedule_c', label: 'Net profit', value: 111400,
        sourceReference: 'Schedule C line 31', ruleStatus: 'unverified' },
      { ruleId: 'se_tax_2026', label: 'SE base (net × 0.9235)', value: 102877.9,
        sourceReference: 'IRS Schedule SE', ruleStatus: 'verified' },
      { ruleId: 'se_tax_2026', label: 'Social Security (12.4% on first $184,500)', value: 12756.86,
        sourceReference: 'IRS Schedule SE', ruleStatus: 'verified' },
      { ruleId: 'se_tax_2026', label: 'Medicare (2.9%, no cap)', value: 2983.46,
        sourceReference: 'IRS Schedule SE', ruleStatus: 'verified' },
      { ruleId: 'se_tax_2026', label: 'Total self-employment tax', value: 15740.32,
        sourceReference: 'IRS Schedule SE', ruleStatus: 'verified' },
    ],
    warnings: [],
    unsupported: ['income_tax_brackets_unverified'],
    computedAt: '2026-07-18T06:10:00Z',
  },
  {
    id: 'qe_lotus_q3', businessId: 'biz_lotus', taxYear: 2026, quarter: 3,
    estimatedNetProfit: 55200, selfEmploymentComponent: 7800.4,
    federalPlanningRange: { low: 5400, high: 8100 }, statePlaceholder: null,
    paymentsMade: 4200, remainingEstimate: 3600.4, nextDueDate: '2026-09-15',
    rulesetVersion: '0.1.0', rulesetStatus: 'approved_for_testing',
    trace: [
      { ruleId: 'schedule_c', label: 'Gross receipts', value: 198000,
        sourceReference: 'Schedule C Part I', ruleStatus: 'unverified' },
      { ruleId: 'schedule_c', label: 'Net profit', value: 55200,
        sourceReference: 'Schedule C line 31', ruleStatus: 'unverified' },
      { ruleId: 'se_tax_2026', label: 'SE base (net × 0.9235)', value: 50977.2,
        sourceReference: 'IRS Schedule SE', ruleStatus: 'verified' },
      { ruleId: 'se_tax_2026', label: 'Total self-employment tax', value: 7800.4,
        sourceReference: 'IRS Schedule SE', ruleStatus: 'verified' },
    ],
    warnings: [],
    unsupported: ['income_tax_brackets_unverified'],
    computedAt: '2026-07-18T06:10:00Z',
  },
];

// ─── alerts ────────────────────────────────────────────────────────────────
export const ALERTS: Alert[] = [
  { id: 'al_1', businessId: 'biz_pho', kind: 'sync_failed', severity: 'urgent',
    titleKey: 'alerts.sync_failed', explanationKey: 'alerts.sync_failed',
    recommendedActionKey: 'connections.reconnect', deepLink: '/app/connections',
    subjectRef: { type: 'connection', id: 'cx_pho_delivery' }, assignedUserId: null,
    dueDate: null, status: 'action_required', resolutionHistory: [],
    createdAt: '2026-07-12T06:05:00Z' },
  { id: 'al_2', businessId: 'biz_pho', kind: 'uncategorized_transactions', severity: 'attention',
    titleKey: 'alerts.uncategorized_transactions', explanationKey: 'alerts.uncategorized_transactions',
    recommendedActionKey: 'tx.confirmOrChange', deepLink: '/app/transactions',
    subjectRef: null, assignedUserId: null, dueDate: null, status: 'waiting_customer',
    resolutionHistory: [], createdAt: '2026-07-15T06:00:00Z' },
  { id: 'al_3', businessId: 'biz_pho', kind: 'duplicate_expense', severity: 'attention',
    titleKey: 'alerts.duplicate_expense', explanationKey: 'alerts.duplicate_expense',
    recommendedActionKey: 'tx.confirmOrChange', deepLink: '/app/transactions',
    subjectRef: { type: 'transaction', id: 'tx_biz_pho_dup_a' }, assignedUserId: null,
    dueDate: null, status: 'needs_review', resolutionHistory: [], createdAt: '2026-05-15T06:00:00Z' },
  { id: 'al_4', businessId: 'biz_pho', kind: 'license_renewal', severity: 'info',
    titleKey: 'alerts.license_renewal', explanationKey: 'alerts.license_renewal',
    recommendedActionKey: 'documents.title', deepLink: '/app/documents',
    subjectRef: { type: 'document', id: 'doc_2' }, assignedUserId: null,
    dueDate: '2026-09-30', status: 'not_started', resolutionHistory: [],
    createdAt: '2026-07-01T06:00:00Z' },
  { id: 'al_5', businessId: 'biz_pho', kind: 'large_cash_deposit', severity: 'attention',
    titleKey: 'alerts.large_cash_deposit', explanationKey: 'alerts.large_cash_deposit',
    recommendedActionKey: 'tx.addPurpose', deepLink: '/app/transactions',
    subjectRef: { type: 'transaction', id: 'tx_biz_pho_cash' }, assignedUserId: null,
    dueDate: null, status: 'waiting_customer', resolutionHistory: [],
    createdAt: '2026-06-21T06:00:00Z' },
  { id: 'al_6', businessId: 'biz_lotus', kind: 'missing_w9', severity: 'urgent',
    titleKey: 'alerts.missing_w9', explanationKey: 'alerts.missing_w9',
    recommendedActionKey: 'salon.contractorTracker', deepLink: '/app/salon/contractors',
    subjectRef: { type: 'document', id: 'doc_5' }, assignedUserId: null,
    dueDate: null, status: 'action_required', resolutionHistory: [],
    createdAt: '2026-06-01T10:05:00Z' },
  { id: 'al_7', businessId: 'biz_lotus', kind: 'possible_1099_requirement', severity: 'attention',
    titleKey: 'alerts.possible_1099_requirement', explanationKey: 'alerts.possible_1099_requirement',
    recommendedActionKey: 'salon.contractorTracker', deepLink: '/app/salon/contractors',
    subjectRef: null, assignedUserId: null, dueDate: null, status: 'needs_review',
    resolutionHistory: [], createdAt: '2026-07-05T06:00:00Z' },
  { id: 'al_8', businessId: 'biz_lotus', kind: 'account_disconnected', severity: 'urgent',
    titleKey: 'alerts.account_disconnected', explanationKey: 'alerts.account_disconnected',
    recommendedActionKey: 'connections.reconnect', deepLink: '/app/connections',
    subjectRef: { type: 'connection', id: 'cx_lotus_card' }, assignedUserId: null,
    dueDate: null, status: 'action_required', resolutionHistory: [],
    createdAt: '2026-07-01T06:10:00Z' },
];

// ─── sharing ───────────────────────────────────────────────────────────────
export const GRANTS: SharingGrant[] = [
  { id: 'gr_1', businessId: 'biz_pho', inviteeEmail: 'cpa@example.com',
    inviteeUserId: 'u_cpa', role: 'tax_professional', taxYears: [2026],
    folders: ['tax_2026', 'payroll'], status: 'active', invitedByUserId: 'u_owner_rest',
    invitedAt: '2026-03-01T10:00:00Z', acceptedAt: '2026-03-01T15:00:00Z',
    expiresAt: '2027-04-30T00:00:00Z', revokedAt: null },
  { id: 'gr_2', businessId: 'biz_pho', inviteeEmail: 'old-bookkeeper@example.com',
    inviteeUserId: null, role: 'bookkeeper', taxYears: [2025], folders: ['tax_2025'],
    status: 'revoked', invitedByUserId: 'u_owner_rest',
    invitedAt: '2025-02-01T10:00:00Z', acceptedAt: '2025-02-02T10:00:00Z',
    expiresAt: '2026-04-30T00:00:00Z', revokedAt: '2026-01-15T10:00:00Z' },
];

// ─── industry metrics ──────────────────────────────────────────────────────
export const RESTAURANT_METRICS: RestaurantMetrics = {
  taxYear: 2026, grossSales: 612000, foodCost: 190400, beverageCost: 23800,
  laborCost: 186000, payroll: 186000, tips: 41200, rent: 72000, utilities: 28400,
  deliveryFees: 48000, merchantFees: 14900, operatingExpenses: 61300,
  estimatedNetIncome: 111400, uncategorizedCount: 18, missingReceiptCount: 23,
  vendorConcentration: [
    { vendor: 'Synthetic Food Wholesale', share: 0.31 },
    { vendor: 'Synthetic Produce Co', share: 0.18 },
    { vendor: 'Synthetic Beverage Dist', share: 0.11 },
  ],
};

export const SALON_METRICS: SalonMetrics = {
  taxYear: 2026, serviceIncome: 171000, productSales: 12400, tips: 38600,
  boothRentalIncome: 14600, employeePayroll: 62000, contractorPayments: 48200,
  merchantFees: 6100, supplyExpenses: 19800, rent: 42000, utilities: 14200,
  operatingExpenses: 24900, estimatedNetIncome: 55200,
  missingW9Count: 2, possible1099Count: 3, uncategorizedCount: 11, missingReceiptCount: 14,
};
