# VNTax manual security review

Date: 2026-08-15
Scope: local branch `april-inspired-redesign`; controlled-preview runtime only.

## Evidence boundary

The configured automated deep-scan engine failed before discovery started. It
produced no findings report and is not counted as a clean scan. This document
records a manual, threat-driven source review and the verification run after
remediation.

No production deployment, Supabase mutation, customer record, credential,
payment, or release approval was used. The historical TrinityAI relay project
remains explicitly forbidden as a VNTax customer-data project.

## Remediated findings

| Finding | Risk before remediation | Local remediation | Evidence |
|---|---|---|---|
| Password-reset destination had no completion route | A reset email linked to `/#/auth/reset`, but the app could not accept and save a new password | Added a translated, guarded reset route, confirmation validation, session check, password update, and local sign-out after completion | Recovery success, mismatch, and expired-session tests |
| Stale identity hydration could win an auth race | A slow user-A profile request could finish after sign-out or user-B sign-in and restore stale identity state | Added monotonically increasing auth generations to supersede old identity work | Delayed identity plus `SIGNED_OUT` regression test |
| Local sign-out could survive a network failure in browser storage | The installed Supabase client returns before `_removeSession()` when its server sign-out fails; a reload on a shared device could restore the session | Always remove the namespaced VNTax session and PKCE verifier in `finally` | Simulated fetch failure with direct storage assertions |
| Identity retry did not retry identity | The visible retry action incremented only the business-row nonce and could not recover from a transient profile/membership error | Retry now calls `refreshIdentity()` and separately keeps the business retry nonce | Transient profile failure/recovery test |
| Strict Mode cleanup permanently marked auth unmounted in development | React lifecycle replay could leave the mounted guard false and freeze auth hydration | Reset the mounted guard during every effect setup | Strict Mode authentication regression test |
| Active-business and membership reads relied only on downstream RLS | An over-broad policy response or arbitrary client selection could be amplified into confusing or unsafe client state | Filter memberships by authenticated user, discard mismatched rows, reject unheld business IDs, and refuse to synthesize a fallback role | Auth and configured-account suite |
| Payroll CSV allowed spreadsheet formula interpretation | User-controlled business or worker text beginning with formula characters could execute when opened in spreadsheet software | Force risky string cells to text before RFC-style CSV quoting; numeric cells remain numeric | Formula-prefix and negative-number unit tests |
| Shared-business helper counted pending invitations | `shares_business_with()` did not require either membership to be accepted | Added a forward-only migration requiring `accepted_at` on both joined rows, an empty search path, and explicit grants | Static SQL safety test; live verification still pending |

## Verification after remediation

- `npm.cmd run verify`: passed.
- TypeScript: passed.
- ESLint with zero warnings: passed.
- Application tests: 204/204 passed.
- RLS verifier and schema-contract safety tests: 10/10 passed.
- Production build: passed; no source-map file emitted.
- Dependency audit: zero reported vulnerabilities at the configured threshold.
- Locked-runtime Chrome boundary: HTTP 200; app and auth routes failed closed;
  fixture businesses/navigation absent; no browser errors or horizontal
  overflow.
- Known build warning: the single JavaScript chunk is 648.03 kB minified
  (187.84 kB gzip). This is a performance warning, not proof of a security
  failure.

## Unclosed production gates

1. Provision a separate VNTax Supabase project. Do not use the TrinityAI relay.
2. Recover and commit the authoritative baseline schema; the available SQL is
   incremental and cannot bootstrap a new project.
3. Apply the migration chain and run the authenticated two-user RLS verifier,
   including pending invitation, revoked membership, and expired-grant cases.
4. Verify email confirmation and recovery redirects on the deployed domain;
   enable leaked-password protection and review Supabase secure-password-change
   policy in the target project.
5. Keep all ledger, receipt, document, export, bank-connection, sharing,
   billing, and filing workflows disabled until live tenant repositories,
   storage controls, vendors, disclosures, and accountable tax review exist.
6. Verify deployed headers, monitoring, backup/restore, rollback, mobile
   recovery, accessibility, and qualified native Vietnamese wording before a
   named release approval.

This review improves the controlled preview. It does not establish that the
complete bookkeeping platform is ready for customer financial records.
