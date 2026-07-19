# Sổ Sạch — Architecture Checkpoint

**Phase 1 deliverable. Read this before any deep coding.**

Tax automation and business-finance organization software for Vietnamese restaurant
and nail salon owners.

> We organize your business finances and help you prepare for tax time.
> We do not provide legal, accounting, or professional tax advice.

---

## 0. What this document decides

Twenty-two decisions that constrain everything built afterward. Where a decision is
still open it is listed in §22 rather than guessed at.

Three constraints drive most of the architecture:

1. **The product is software, not a firm.** No mandatory professional step anywhere in
   the customer journey. Professional involvement is invited, scoped, and revocable.
2. **No figure reaching a customer may originate from AI.** Categories are suggested;
   numbers are computed by a deterministic, versioned, approval-gated engine.
3. **Locality is an address, not a county.** A business in the City of Falls Church
   files with different authorities than one two miles away in Fairfax County. This is
   in the data model from the first table, not retrofitted.

---

## 1. Route map

```
/                                     marketing shell
  /restaurants                        industry landing
  /nail-salons                        industry landing
  /vi                                 Vietnamese entry (locale-first, not a translation page)
  /features
  /how-it-works
  /automation
  /receipts
  /quarterly-taxes
  /security
  /pricing                            placeholder
  /faq
  /contact

/auth                                 minimal shell, no app chrome
  /login
  /sign-up
  /verify
  /reset

/onboarding                           stepper shell, progress persisted server-side
  /language
  /owner
  /business
  /industry
  /entity
  /connections
  /complete

/app                                  authenticated shell
  /dashboard
  /transactions
  /transactions/:id
  /transactions/bulk
  /connections
  /receipts
  /receipts/upload
  /receipts/queue
  /receipts/:id
  /deductions
  /quarterly
  /documents
  /documents/:id
  /exports
  /exports/:id
  /alerts
  /messages
  /settings
  /settings/security
  /settings/team
  /settings/billing                   placeholder

/app/restaurant                       mounted only when industry = restaurant
  /dashboard
  /expenses

/app/salon                            mounted only when industry = nail_salon
  /dashboard
  /expenses
  /contractors                        W-9 tracker
  /tips
  /sales-tax

/app/collaboration
  /invite
  /permissions
  /shared
  /comments
  /access-history

/admin                                separate shell, separate auth boundary
  /overview
  /businesses
  /sync-failures
  /processing-failures
  /support
  /system-health
```

**Industry routes are mounted conditionally**, not hidden with CSS. A salon owner's
bundle never contains restaurant screens and their router has no restaurant paths.

---

## 2. Screen inventory

| Group | Screens |
|---|---|
| Marketing | 13 |
| Auth | 4 |
| Onboarding | 7 |
| Core app | 19 |
| Restaurant | 2 |
| Salon | 5 |
| Collaboration | 5 |
| Admin | 6 |
| **Total** | **61** |

Every core-app screen has four defined states: **loading**, **empty**, **populated**,
**error**. Empty states are designed, not afterthoughts — a new customer sees empty
states before anything else, and that is their first impression of the product.

---

## 3. Component architecture

```
src/
  app/                    shell, providers, router, error boundaries
  routes/                 route definitions only, no logic
  layouts/                MarketingLayout, AuthLayout, OnboardingLayout,
                          AppLayout, AdminLayout
  components/             primitives shared across features
    ui/                   Button, Field, Select, Sheet, Dialog, Toast,
                          Table, Tabs, Badge, Progress, Money, DateText
    patterns/             StatusChip, ConfidenceBar, EmptyState, ErrorState,
                          LoadingState, ConfirmBar, MaskedAccount, LocaleSwitch,
                          DisclosureNote, TraceViewer
  features/
    marketing/ onboarding/ business-profile/ banking/ transactions/
    receipts/ deductions/ quarterly-tax/ documents/ exports/
    restaurant/ nail-salon/ collaboration/ alerts/ settings/ admin/
  services/               typed adapters — the only place I/O happens
  state/                  machines + stores
  types/                  domain models
  mocks/                  deterministic seeded fixtures
  i18n/en/  i18n/vi/
  security/               permission matrix, masking, redaction
  tax-engine/             deterministic, isolated, no React
  tests/
```

**Feature module shape** — every feature folder is identical:

```
features/transactions/
  components/            feature-only components
  hooks/                 useTransactions, useCategorization
  machine.ts             lifecycle state machine
  api.ts                 calls services/, never fetch directly
  types.ts               feature-local types
  fixtures.ts            synthetic data for this feature
  index.ts               public surface — nothing else is importable
```

**Rules enforced by lint, not convention:**
- Features may not import from other features. Shared code moves up to `components/`
  or `services/`.
- Only `services/` performs I/O.
- `tax-engine/` may not import React, may not import `services/`, may not perform I/O.
- No hardcoded user-facing strings anywhere outside `i18n/`.

---

## 4. Status vocabulary

One vocabulary across the whole product. Nine values, no synonyms.

| Status | Meaning | Who unblocks it |
|---|---|---|
| `not_started` | Exists, untouched | — |
| `in_progress` | System or person is working | — |
| `waiting_customer` | Needs a customer decision | Customer |
| `waiting_system` | Processing, syncing, extracting | System |
| `needs_review` | Ready but unconfirmed | Customer |
| `action_required` | Something is wrong and must be fixed | Customer |
| `blocked` | Cannot proceed until a dependency clears | Depends |
| `failed` | Terminal error, retry available | Customer or support |
| `completed` | Done | — |
| `archived` | Retained, out of the way | — |

Every status is rendered as **icon + text label + accessible contrast**. Never colour
alone. Every status carries a plain-language explanation in both locales.

Entity-specific lifecycles (§7) map onto this vocabulary rather than inventing parallel ones.

---

## 5. Role model and permission matrix

Five roles. Permissions are `resource × action`, evaluated server-side on every
request. The client mirrors the matrix for UI affordances only — hiding a button is a
courtesy, not a control.

| Resource · Action | Owner | Manager | Bookkeeper | Tax Pro | Admin |
|---|---|---|---|---|---|
| business · view | ✓ | ✓ | scoped | scoped | limited |
| business · edit | ✓ | — | — | — | — |
| business · delete | ✓ | — | — | — | — |
| ownership · transfer | ✓ | — | — | — | — |
| connections · view | ✓ | masked | masked | — | status only |
| connections · link | ✓ | — | — | — | — |
| connections · unlink | ✓ | — | — | — | — |
| transactions · view | ✓ | ✓ | ✓ | shared only | — |
| transactions · categorize | ✓ | ✓ | ✓ | — | — |
| transactions · confirm | ✓ | ✓ | — | — | — |
| receipts · upload | ✓ | ✓ | ✓ | — | — |
| receipts · view | ✓ | ✓ | ✓ | shared only | — |
| deductions · view | ✓ | ✓ | ✓ | shared only | — |
| deductions · confirm | ✓ | — | — | — | — |
| quarterly · view | ✓ | — | ✓ | shared only | — |
| documents · request | ✓ | ✓ | ✓ | ✓ | — |
| documents · upload | ✓ | ✓ | ✓ | — | — |
| documents · view | ✓ | ✓ | ✓ | shared only | — |
| documents · delete | ✓ | — | — | — | — |
| tax_identity · view | ✓ | — | — | if shared | — |
| exports · create | ✓ | — | ✓ | — | — |
| exports · download | ✓ | — | ✓ | if shared | — |
| sharing · grant | ✓ | — | — | — | — |
| sharing · revoke | ✓ | — | — | — | — |
| team · manage | ✓ | — | — | — | — |
| security · settings | ✓ | — | — | — | — |
| billing · manage | ✓ | — | — | — | — |
| audit · view | ✓ | — | — | — | policy-scoped |
| support · act | — | — | — | — | ✓ |

**Bookkeeper cannot confirm.** They prepare; the owner confirms. That boundary keeps
the "customer confirmation required" promise honest.

**Tax professional access** is scoped to `(business_id, tax_year, folders[])` with an
expiry timestamp. There is no "all customers" grant. Access appears in the customer's
access history the moment it is used.

**Admin has no default path to customer tax detail.** Support actions that require it
produce an audit event and are time-boxed.

---

## 6. Domain data model

Core entities and the relationships that matter. Full TypeScript in `types/index.ts`.

```
User ──< Membership >── Business
                          │
                          ├── BusinessProfile      industry, entity, address, locality
                          ├── TaxIdentity          tokenized, separate table, separate access
                          ├── Connection ──< Account ──< Transaction
                          │                                  │
                          │                                  ├── Categorization (suggested + confirmed)
                          │                                  ├── ReceiptMatch
                          │                                  └── Split[]
                          ├── Receipt ──< ExtractedField
                          ├── Document
                          ├── DeductionGroup ──< Transaction (many-to-many)
                          ├── QuarterlyEstimate    engine output + trace
                          ├── Alert
                          ├── ExportPackage
                          ├── SharingGrant ──< AccessEvent
                          └── AuditEvent           append-only
```

**Three fields carrying unusual weight:**

`business_profile.locality_id` — resolved from the exact street address, never from the
county. Drives which meals tax, which BPOL authority, which filing portal.

`transaction.confirmed_by_user_id` — nullable. While null, the categorization is a
suggestion and cannot enter an export. This single field is the wall between an AI
suggestion and a customer-facing figure.

`sharing_grant.expires_at` — non-nullable. There is no permanent grant. A professional
who needs longer asks again, and the customer sees the request.

---

## 7. State machines

Four lifecycles get explicit machines. Everything else is derived state.

### Transaction

```
imported
  → normalizing            merchant cleanup, transfer/refund/duplicate detection
  → suggested              AI proposes category + confidence
  → needs_review           low confidence, or an anomaly rule fired
  → confirmed              customer accepted or corrected     ← only exportable state
  → excluded               personal, transfer, or duplicate
  → superseded             replaced by a corrected import
```

Guards: `suggested → confirmed` requires an explicit customer action. There is no
auto-advance, no timeout that confirms, no bulk action that skips the confirm event.
Bulk categorization emits one confirm event per transaction so the audit trail stays
per-record.

### Receipt

```
uploaded
  → processing             extraction
  → extracted
      → matched            linked to exactly one transaction
      → unmatched          queued for manual match
      → duplicate          same merchant + date + total already present
      → unreadable         extraction failed or confidence below floor
  → needs_info             extraction succeeded but business purpose missing
  → confirmed
  → archived
```

### Document

```
not_requested → requested → uploaded → processing → needs_review
  → accepted | rejected → expired | shared | exported
```

### Connection

```
not_connected → connecting → connected
  → sync_in_progress → sync_completed | sync_failed
  → expired | auth_required | revoked | disconnected
  → duplicate_detected
```

Connection failures are **loud**. A silently stale connection produces a silently
incomplete year-end package, which is the worst failure mode in the product.

---

## 8. Transaction model

```ts
interface Transaction {
  id: string;
  businessId: string;
  accountId: string;
  postedAt: string;              // ISO date
  amount: number;                // negative = money out
  currency: 'USD';
  merchantRaw: string;
  merchantNormalized: string | null;
  descriptionRaw: string;

  classification: 'income' | 'expense' | 'transfer' | 'refund' | 'unknown';
  scope: 'business' | 'personal' | 'mixed' | 'unknown';

  suggested: {
    categoryKey: string;
    scheduleCLine: string | null;
    confidence: number;          // 0..1
    source: 'rules' | 'model' | 'history';
    explanation: string;
  } | null;

  confirmed: {
    categoryKey: string;
    scheduleCLine: string | null;
    confirmedByUserId: string;
    confirmedAt: string;
    corrected: boolean;          // true if it differed from the suggestion
  } | null;

  splits: TransactionSplit[];
  businessPurpose: string | null;
  receiptId: string | null;
  flags: TransactionFlag[];      // possible_duplicate, possible_transfer,
                                 // missing_receipt, unusual_amount, unrecognized_merchant
  status: TransactionStatus;
  notes: string | null;
  auditTrail: AuditRef[];
}
```

**Corrections are training signal.** `corrected: true` is the most valuable field in the
system — it is how categorization improves for this customer and for this industry
without anyone writing new rules by hand.

---

## 9. Receipt model

```ts
interface Receipt {
  id: string;
  businessId: string;
  storageKey: string;            // signed URL only, never a public path
  pageCount: number;
  uploadedAt: string;
  uploadedByUserId: string;

  extracted: {
    merchant: Field<string>;
    date: Field<string>;
    subtotal: Field<number>;
    tax: Field<number>;
    tip: Field<number>;
    total: Field<number>;
    paymentMethod: Field<string>;
    last4: Field<string>;        // for matching only, masked on display
  } | null;

  match: {
    transactionId: string;
    confidence: number;
    method: 'exact' | 'fuzzy' | 'manual';
    matchedAt: string;
  } | null;

  status: ReceiptStatus;
  businessPurpose: string | null;
  duplicateOfReceiptId: string | null;
}

interface Field<T> { value: T | null; confidence: number; corrected: boolean; }
```

Every extracted field carries its own confidence. A receipt where the total is certain
but the merchant is a guess is common, and the UI shows exactly which field is shaky
rather than flagging the whole receipt.

---

## 10. Document model

```ts
interface BusinessDocument {
  id: string;
  businessId: string;
  taxYear: number | null;
  kind: DocumentKind;            // 27 kinds — see types/index.ts
  storageKey: string;
  status: DocumentStatus;
  requestedByUserId: string | null;
  requestedAt: string | null;
  uploadedAt: string | null;
  acceptedAt: string | null;
  rejectionReason: string | null;
  expiresAt: string | null;      // licences, permits, insurance
  retentionClass: 'standard' | 'extended' | 'permanent';
  sharedWithGrantIds: string[];
  downloadLog: DownloadEvent[];
}
```

---

## 11. Alert model

```ts
interface Alert {
  id: string;
  businessId: string;
  kind: AlertKind;               // 21 kinds
  severity: 'info' | 'attention' | 'urgent';
  titleKey: string;              // i18n key, never a literal string
  explanationKey: string;
  recommendedActionKey: string;
  deepLink: string;              // the screen that resolves it
  subjectRef: { type: string; id: string } | null;
  assignedUserId: string | null;
  dueDate: string | null;
  status: AlertStatus;
  resolutionHistory: AlertResolution[];
}
```

Alerts are **actionable or they do not exist.** Every alert deep-links to the screen
that resolves it. An alert with no resolution path is a design defect.

Anomaly alerts ("food cost unusually high") are phrased as observations requiring
attention, never as accounting conclusions.

---

## 12. Export model

```ts
interface ExportPackage {
  id: string;
  businessId: string;
  taxYear: number;
  createdAt: string;
  createdByUserId: string;

  contents: {
    businessProfile: boolean;
    incomeSummary: boolean;
    expenseSummary: boolean;
    categorizedTransactions: boolean;
    receiptIndex: boolean;
    missingReceipts: boolean;
    possibleDeductions: boolean;
    payrollSummary: boolean;
    contractorSummary: boolean;
    tipsSummary: boolean;
    salesTaxSummary: boolean;
    quarterlyPayments: boolean;
    accountList: boolean;
    documentChecklist: boolean;
    unresolvedQuestions: boolean;
    customerNotes: boolean;
    auditSummary: boolean;
  };

  formats: ('pdf' | 'csv' | 'receipt_zip' | 'expense_report' | 'pro_package')[];
  completeness: {
    unconfirmedTransactions: number;
    missingReceipts: number;
    unresolvedAlerts: number;
    missingDocuments: number;
  };
  status: ExportStatus;
  sharedWithGrantIds: string[];
}
```

**An export always states what is incomplete.** A package that quietly omits 40
unconfirmed transactions is worse than no package. Completeness counts appear on the
cover page of the PDF, not buried.

Only `confirmed` transactions enter an export. Unconfirmed ones appear in the
unresolved-questions section by count and category, never as figures.

---

## 13. Bilingual architecture

```
i18n/
  en/  common.json  marketing.json  onboarding.json  transactions.json
       receipts.json deductions.json quarterly.json documents.json
       exports.json alerts.json restaurant.json salon.json
       collaboration.json settings.json legal.json forms.json
  vi/  (identical namespace set)
```

- Locale chosen **before** account creation, persisted to the user profile, honoured on
  every subsequent visit including email.
- English and Vietnamese are **equal**. Neither is a fallback for the other. A missing
  key fails the build rather than silently rendering English to a Vietnamese customer.
- `forms.json` holds official form names, which stay in English with a Vietnamese gloss:

  ```json
  { "schedule_c": { "name": "Schedule C",
                    "gloss": "Mẫu khai lời hoặc lỗ từ hoạt động kinh doanh cá nhân" } }
  ```

- Numbers, currency, and dates via `Intl`, locale-aware.
- **Layouts sized for Vietnamese**, which typically runs longer than English. Buttons
  sized to the English string will wrap.
- Vietnamese copy is drafted by the team and **reviewed by a native speaker who knows
  the trades** before release. "Tiền thuê ghế" is how a booth renter says booth rent;
  a dictionary translation of "station rental fee" is not.

---

## 14. Tax-engine boundary

```
src/tax-engine/
  index.ts          public surface — four functions, nothing else
  types.ts
  calculator.ts     pure functions, no side effects
  rules/
    2026.json
  validators/       ruleset shape + approval status
  traces/           trace formatting
  tests/
```

**Public surface, complete:**

```ts
export function loadRuleset(taxYear: number, env: 'production' | 'testing'): Ruleset;
export function computeScheduleC(input: ScheduleCInput, rs: Ruleset): ScheduleCResult;
export function computeSelfEmploymentTax(net: number, status: FilingStatus, rs: Ruleset): SEResult;
export function computeQuarterlyEstimate(input: EstimateInput, rs: Ruleset): EstimateResult;
```

Every result carries `{ value, trace[], warnings[], unsupported[] }`.

**Ruleset fields** — exactly as specified:
`taxYear` · `version` · `effectiveDate` · `status` · `approvedBy` · `approvedDate` ·
`sourceReference` · `rules` · `limitations`

**Status ladder:** `draft` → `under_review` → `approved_for_testing` →
`approved_for_production` → `retired`

`loadRuleset(year, 'production')` **throws** unless status is `approved_for_production`.
This is enforced in code, not policy. Flipping the status is an expert's act recorded
with name and date, not a developer's commit.

**Unsupported scenarios return a reason, never a guess.** If a rate has a mid-year
change and no date is supplied, the engine refuses rather than picking one.

The exploratory engine already built implements the gate, the trace, and rules-as-data.
It converts to this structure. Its verified self-employment logic — 15.3% on 92.35% of
net, the $184,500 2026 Social Security wage base, the $400 threshold, the deductible
half — carries over intact.

---

## 15. AI boundary

**Permitted:**

| Use | Output | Constraint |
|---|---|---|
| Category suggestion | `categoryKey` + confidence | Labelled "Suggested", requires confirm |
| Receipt extraction | Fields + per-field confidence | Customer reviews before matching |
| Merchant normalization | Cleaned name | Reversible, raw value retained |
| Explanation | Plain-language text | General and educational only |
| Missing-item summary | Prose | Derived from system state, adds no figures |

**Prohibited, enforced by architecture:**

- Producing or altering any number that reaches an estimate, dashboard, or export.
  `tax-engine/` does not import the AI service; the dependency cannot exist.
- Deciding deduction eligibility. AI groups and explains; the customer confirms and the
  wording stays "possible."
- Classifying a worker as employee or contractor. The product surfaces
  *"Worker classification may require professional review."*
- Inventing a rate, threshold, or due date. These come from the ruleset or not at all.
- Finalizing a categorization without a customer confirm event.

**Required labels in the UI:** `Suggested category` · `Possible deduction` ·
`Planning estimate` · `Customer confirmation required` · `Professional review recommended`

**Forbidden anywhere in the product:** `guaranteed deduction` · `guaranteed savings` ·
`IRS approved` · `fully deductible` · `automatically eligible`. A test asserts these
strings do not appear in any locale file.

---

## 16. API assumptions

All I/O behind typed adapters. Every adapter ships with a mock implementation first.

| Adapter | Responsibility | Notes |
|---|---|---|
| `AuthAdapter` | session, MFA, device history | MFA for every role including staff |
| `BankingAdapter` | link, sync, accounts, transactions | App never sees credentials |
| `ProcessorAdapter` | card processor and delivery-platform statements | Read-only |
| `PayrollAdapter` | payroll summaries | Read-only; not a payroll processor |
| `OcrAdapter` | receipt extraction | Returns per-field confidence |
| `StorageAdapter` | documents and receipts | Signed expiring URLs, download logged |
| `NotifyAdapter` | email and SMS | Locale-aware |
| `VaultAdapter` | tokenize/detokenize identifiers | Operational DB stores tokens only |

**Not built and explicitly out of scope for the initial release:** payments, filing,
e-file transmission, funds movement. The product never holds or moves customer money,
which keeps money-transmission licensing out of scope entirely — an architecture
decision, not a finance one.

---

## 17. Security boundary

| Control | Implementation |
|---|---|
| Authorization | Server-side on every request. Client mirror is UI only. |
| Sensitive identifiers | Vault-tokenized. Operational store holds tokens. |
| Documents & receipts | Encrypted at rest, signed expiring URLs, download logged. |
| Account numbers | `****1234`. Leading digits withheld — never the reverse. |
| MFA | Required for all roles including staff and admin. |
| Sessions | Expiry, device history, revocation. |
| Audit | Append-only: access, share, download, export, permission change. |
| Sharing | Scoped to business + tax year + folders, expiring, revocable. |
| Secrets | Server-side only. Never in client bundles or fixtures. |
| Deletion | Defined workflow with retention classes. |

**Never present in client code, fixtures, or test data:** real SSNs, real EINs, bank
credentials, full account numbers, tax returns, API secrets, tokens, service-role keys,
production customer data. A CI test scans the repo for real-format identifiers and fails
the build.

---

## 18. Mock-data strategy

Deterministic and seeded — the same seed produces the same data, so tests and
screenshots are stable across runs.

**Two complete synthetic businesses:**

*Phở Bình Minh* — restaurant, City of Falls Church, S-Corp, six W-2 employees, three
delivery platforms, monthly meals tax, monthly sales tax, one full year of transactions.

*Lotus Nails & Spa* — salon, Fairfax County, single-member LLC, four W-2 technicians and
three 1099 booth renters, two missing W-9s, card processor, one full year.

**Deliberate edge cases seeded into both:** a duplicate vendor payment, an inter-account
transfer that looks like income, a refund, an unreadable receipt, a receipt with a
confident total and an unreadable merchant, a multi-page receipt, an expired bank
connection, a failed sync, an expiring business licence, a large cash deposit, a
transaction with a 0.41 confidence suggestion, and forty unconfirmed transactions
sitting in front of a year-end export so the completeness warning has something to say.

Fixtures are visibly synthetic: reserved-range account numbers, fictional vendors,
`555` phone numbers, `example.com` addresses.

---

## 19. Testing strategy

| Layer | Tool | Covers |
|---|---|---|
| Unit | Vitest | tax engine, permissions, masking, matching, machines |
| Component | Testing Library | states, confirm flows, empty and error states |
| E2E | Playwright | onboarding, categorize, receipt match, export, invite/revoke |
| Accessibility | axe + manual | WCAG AA, keyboard, screen reader, contrast |
| Security | custom CI | no secrets, no real identifiers, masking correctness |

**Tests that must exist and must fail loudly:**

- An unapproved ruleset cannot execute in production mode.
- A transaction cannot enter an export without `confirmed_by_user_id`.
- A revoked sharing grant blocks access immediately.
- One business's data never appears in another's queries.
- A manager cannot confirm; a bookkeeper cannot confirm.
- Forbidden marketing phrases appear in no locale file.
- Account masking never reveals leading digits.
- Every user-facing string resolves in both `en` and `vi`.
- Restaurant fixtures never load in a salon build.

---

## 20. Known unknowns

Things this architecture cannot decide and will not guess.

1. **Are nail services subject to Virginia sales tax, or only retail products?**
   Blocks the salon sales-tax tracker. Requires a written CPA answer.
2. **Falls Church City meals tax rate and filing portal.** Fairfax County's 4% is
   confirmed; the City levies its own and the rate is unconfirmed.
3. **2026 income tax brackets and standard deduction.** Unverified — the engine blocks
   income-tax computation until supplied.
4. **2026 standard mileage rate**, including whether the mid-year change is real.
5. **Schedule C line numbers** against the current official form.
6. **Current 1099-K and 1099-NEC reporting thresholds.**
7. **Which aggregator**, which OCR provider, which storage region.
8. **Whether Virginia requires tax-preparer registration** for a Maryland-based
   business. Affects positioning language even though the product does not prepare returns.
9. **Retention periods** by document class.
10. **Vietnamese register** — formal or familiar. Affects every string in the product.

---

## 21. Delivery plan

| Phase | Contents | Gate to next |
|---|---|---|
| 1 | This checkpoint | Founder decisions in §22 |
| 2 | Marketing, onboarding, dashboard, transactions, categorization, receipts, industry views, quarterly screen, documents, exports — synthetic data | Journey walkable end to end |
| 3 | Bulk categorization, merchant recognition, recurring detection, receipt matching, duplicate detection, missing-document alerts, W-9 tracker, tip tracker, sales-tax tracker | Automation demonstrable |
| 4 | Invitation, permissions, sharing, comments, requests, activity history | Grant/revoke provably enforced |
| 5 | Test suite, screenshots, responsive review, accessibility results, security checklist, known limitations, integration checklist | Handoff |

---

## 22. Founder decisions required

Blocking Phase 2:

1. **Product name.** `Sổ Sạch` proposed. Alternates: `Bàn Tính`, `vnBooks`.
2. **Pricing** — placeholder, or lock tiers now.
3. **Which industry gets automation depth first** — restaurant or salon.
4. **Sales-tax and payroll organization** — initial release or Phase 3.
5. **Admin shell** — in scope for this build or deferred.
6. **Vietnamese register** — formal (`quý khách`) or familiar (`anh/chị`). This changes
   every string and is expensive to reverse.
7. **Who reviews the Vietnamese copy.** Must be a person who knows these trades.

Not blocking, needed before launch:

8. Aggregator, OCR provider, storage region.
9. The CPA who answers §20 items 1–6.
10. The attorney who reviews positioning language and the customer promise.

---

*Not tax advice. This document describes software architecture. Tax treatment and
eligibility depend on individual facts and applicable law.*
