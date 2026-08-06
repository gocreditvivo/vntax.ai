# VNTax — Supabase Handoff for Codex

**Status: the database is already built. Do not create tables or write new migrations.**

Applied on 2026-08-06 to the dedicated `vntax-ai` Supabase project. Three migrations are live:
`vntax_core_schema`, `vntax_row_level_security`, `vntax_harden_functions`.

The repo `gocreditvivo/vntax.ai` was **not** touched — no commits, no branches, no pushes. All remaining work is client-side.

---

## Connection

| Item | Value |
|---|---|
| Project ref | `rcmcqcinndypoupgjezi` |
| API URL | `https://rcmcqcinndypoupgjezi.supabase.co` |
| Publishable key | see `VITE_SUPABASE_PUBLISHABLE_KEY` (not committed — this repo is public) |
| Region | us-east-1 |
| Postgres | 17 |

This is VNTax's own project. Taxpayer data is deliberately isolated from Credit Vivo and Linh. Do not point VNTax at `gocreditvivo's Project` (`gykmlrctdzyzoobsmfqw`).

Env vars to add to `.env.local` and Vercel:

```
VITE_SUPABASE_URL=https://rcmcqcinndypoupgjezi.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=<publishable key from the Supabase dashboard>
```

The publishable key is safe in the browser. RLS is what protects the data. **Never put the service role key in client code.**

---

## Tables

All business-scoped tables carry a `business_id uuid` foreign key to `businesses`.

| Table | Purpose | Notes |
|---|---|---|
| `profiles` | App profile per auth user | PK = `auth.users.id`. Auto-created on signup. |
| `localities` | Reference data | Filing authorities per address-level locality. Read-only to clients. |
| `businesses` | Business records | `created_by` defaults to `auth.uid()`. |
| `memberships` | User ↔ business ↔ role | Unique on `(user_id, business_id)`. |
| `tax_identities` | EIN / SSN tokens | Separate table, owner-only policy. Never join into ordinary reads. |
| `connections` | Bank, processor, payroll links | `provider_ref` only; credentials never stored. |
| `financial_accounts` | Accounts under a connection | `masked_number` only. |
| `receipts` | Uploaded receipts | `extracted` and `match` are jsonb. |
| `transactions` | Ledger | `suggested` and `confirmed` are separate jsonb columns. |
| `business_documents` | Uploaded docs | Core columns + `payload` jsonb. |
| `deduction_groups` | Planning output | Unique on `(business_id, tax_year, category_key)`. |
| `quarterly_estimates` | Planning output | Unique on `(business_id, tax_year)`. |
| `alerts` | Owner alerts | |
| `export_packages` | Export jobs | |
| `sharing_grants` | Scoped professional access | `expires_at` is NOT NULL and must be in the future. There is no permanent grant. |
| `audit_events` | Append-only log | Insert and select only. No update or delete policy exists. |

`waitlist` predates this work and is untouched.

### Product invariants now enforced in the database

- `transactions.suggested` and `transactions.confirmed` are different columns. A suggestion can never be silently read as a confirmation.
- `sharing_grants` has a check constraint requiring `expires_at > created_at`.
- `audit_events` has no UPDATE or DELETE policy, so the trail cannot be rewritten from the client.
- `tax_identities` is readable only by `owner` and `admin` — a bookkeeper or tax professional cannot see EIN or SSN tokens.

---

## Naming: this is the main gotcha

Postgres columns are **snake_case**. `src/types/index.ts` is **camelCase**. A mapping layer is required in both directions.

| TS field | Column |
|---|---|
| `businessId` | `business_id` |
| `postedAt` | `posted_at` |
| `merchantRaw` | `merchant_raw` |
| `merchantNormalized` | `merchant_normalized` |
| `descriptionRaw` | `description_raw` |
| `businessPurpose` | `business_purpose` |
| `receiptId` | `receipt_id` |
| `auditTrail` | `audit_trail` |
| `uploadedByUserId` | `uploaded_by_user_id` |
| `duplicateOfReceiptId` | `duplicate_of_receipt_id` |
| `maskedNumber` | `masked_number` |
| `legalName` / `dbaName` | `legal_name` / `dba_name` |
| `entityType` | `entity_type` |
| `accountingMethod` | `accounting_method` |

Two more conversions to handle:

- **IDs are `uuid`, not the fixture string format.** Fixtures use `u_owner_rest`, `rc_new_1`, etc. Real rows use generated UUIDs. Anything that builds an ID by string concatenation needs to stop doing that.
- **`amount` is `numeric(14,2)`**, which PostgREST returns as a **string**. Parse it, or every arithmetic operation silently concatenates.

Run `generate_typescript_types` against the project and commit the result rather than hand-writing row types.

---

## Row-level security

RLS is enabled on every table. Policies are keyed on membership through four SECURITY DEFINER helpers:

| Function | Returns true for |
|---|---|
| `role_in_business(uuid)` | the caller's role in that business, or null |
| `is_member_of(uuid)` | any accepted membership |
| `can_write_business(uuid)` | `owner`, `manager`, `bookkeeper`, `admin` |
| `can_admin_business(uuid)` | `owner`, `admin` |

Standard pattern per business-scoped table: **select** requires `is_member_of`, **insert/update/delete** require `can_write_business`. A `tax_professional` therefore reads but never writes, which matches the permissions model in `src/security/permissions.ts`.

`anon` has `EXECUTE` revoked on all helpers. `authenticated` keeps it, because RLS policy expressions evaluate as the calling role.

### What this means for the client

- Every query must carry an authenticated session. An unauthenticated client sees zero rows, not an error.
- A membership row must exist and have `accepted_at` set. A NULL `accepted_at` means invited-but-not-joined, and reads return nothing.
- Do not re-filter by `business_id` for security — the database already does it. Keep the filter for query efficiency, but treat RLS as the boundary.

---

## Triggers already in place

- **`on_auth_user_created`** — inserts a `profiles` row on signup, reading `display_name` and `locale` from `raw_user_meta_data`. Pass those in `options.data` on `signUp` and the profile is populated automatically. Do not insert into `profiles` manually on signup.
- **`on_business_created`** — inserts an `owner` membership for `created_by`, atomically. Do not insert the owner membership manually; you will race the trigger.
- **`touch_updated_at`** — maintains `updated_at` on the mutable tables.

---

## Remaining client work

1. `src/lib/supabase.ts` — create the client from the env vars. `@supabase/supabase-js@^2` is the right dependency.
2. **Replace `src/app/auth.ts`.** It currently writes the literal string `demo_session` into `localStorage` and `isAuthenticated()` just checks that the key exists. Replace with a real session: `getSession`, `onAuthStateChange`, and a provider so the guard in `App.tsx:45` reads live session state.
3. **Wire the real forms.** `SignUp` and `Login` in `src/features/marketing/screens.tsx` currently ignore their inputs entirely and call `setSession()` on click. They need controlled inputs, `signUp` / `signInWithPassword`, error states, and a loading state.
4. **Build the `Caller` from the session, not from fixtures.** `App.tsx` hardcodes `u_owner_rest` and picks a business out of `BUSINESSES`. Replace with the signed-in user's id and their membership role for the selected business.
5. **Persistence.** The service layer in `src/services/` reads and mutates the in-memory `db()` from `src/services/store.ts`, which reseeds from fixtures on every load. The architecture already calls this out as the intended seam. Two viable approaches:
   - **Hydrate + write-through** — load a business's rows into the store on sign-in, then mirror each mutation to Supabase. Smallest diff, keeps all existing sync service code and tests intact.
   - **Full async repositories** — replace `db()` access with Supabase queries inside each service. Cleaner long-term, much larger diff.

   Either way, keep a no-op persistence adapter as the default so `src/tests/` keeps running against fixtures without network.
6. **Then, and only then, OCR.** Azure Document Intelligence for W-2/1099, Veryfi for receipts. Wiring OCR before persistence lands would write extraction results into a store that resets on refresh — the exact failure this work was ordered to prevent.

---

## Verification

`get_advisors` reports no missing-RLS errors. Remaining notices are informational warnings about SECURITY DEFINER helpers being callable by signed-in users, which is required for the policies to evaluate.

Suggested smoke test once auth is wired: create two accounts, create a business under each, and confirm account A receives zero rows when querying account B's `business_id`. If A sees anything, stop and fix RLS before going further.
