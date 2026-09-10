# VNTax production-readiness record

Checkpoint: 2026-08-15.

## Current conclusion

The repository is a verified release candidate for a **controlled product
preview** and for the local 2026 Washington, DC payroll worksheet. It is not
evidence that the complete bookkeeping platform is ready to accept customer
financial records.

The distinction is enforced in code, not left to deployment instructions:

| Runtime mode | Evidence-based behavior |
|---|---|
| Locked production default | Missing Supabase configuration blocks signup, onboarding, and all app routes. Synthetic fixtures are not shown. |
| Live limited | Supabase authentication and business creation may run. Fixture-backed ledger features are unavailable to a real account. A restaurant account may use the local payroll worksheet, which states that it does not save employee data. |
| Explicit synthetic demo | Requires `VITE_ENABLE_SYNTHETIC_DEMO=true` at build time. Every app screen and the scripted guide carry a persistent synthetic-data warning. Signup is unavailable, so the synthetic build does not collect account identity. |

## Capability truth table

| Capability | Current implementation | Release treatment |
|---|---|---|
| Email/password authentication | Supabase client, profile and accepted-membership hydration | Requires deployed environment variables, redirect configuration, and live recovery walkthrough |
| Business creation | `create_business` security-definer RPC with ownership from `auth.uid()` | Requires live migration and RLS verification in the target project |
| Synthetic guide | Authored fictional script; no model, OCR, upload, reminder, storage, or staff-review request | Explicit synthetic demo only |
| 2026 DC weekly payroll | Local calculation and CSV review; no server persistence | Locally verified; still requires human payroll/tax and Vietnamese-language review before customer release |
| Transactions and categorization | In-memory fictional fixtures | Synthetic demo only |
| Banking and card connections | Fictional connection records | Disabled for real accounts |
| Receipt reading and matching | Simulated fixture actions; no file bytes | Disabled for real accounts |
| Documents and exports | In-memory fixture workflow | Disabled for real accounts |
| Professional sharing | Client-side fixture service and permission mirror | Disabled for real accounts |
| Quarterly tax estimate | Unapproved fixture ruleset | Planning demo only; cannot execute as a production determination |
| Billing and money movement | Not installed | Unavailable |

## Supabase project isolation blocker

The project historically documented as dedicated VNTax
(`rcmcqcinndypoupgjezi`) is also the TrinityAI relay project. Its publishable
browser key can anonymously select `relay_messages`. It is therefore forbidden
in `src/lib/env.ts` and must not be used for VNTax customer production.

Production requires a genuinely separate VNTax Supabase project. The original
core schema, RLS, and hardening migrations must be exported through an approved
admin workflow and committed in reproducible order before later incremental
migrations are applied. The current checkout cannot bootstrap a fresh project.
The completed source audit and safe acquisition procedure are recorded in
`docs/SCHEMA_RECOVERY_AUDIT.md`.

## Verification commands

Default production bundle:

```powershell
npm.cmd run verify
npm.cmd run preview -- --host 127.0.0.1 --port 4176
npm.cmd run qa:runtime
```

Explicit synthetic demo review:

```powershell
$env:VITE_ENABLE_SYNTHETIC_DEMO='true'
npm.cmd run build
Remove-Item Env:VITE_ENABLE_SYNTHETIC_DEMO
npm.cmd run preview -- --host 127.0.0.1 --port 4176
npm.cmd run qa:local
```

Rebuild and re-run `qa:runtime` without the demo variable before packaging a
production candidate. A demo bundle is never the production artifact.

Every build emits `dist/vntax-build-manifest.json`, and `npm.cmd run verify`
finishes with a locked-release preflight. The preflight validates the exact
artifact surface, source-map and privileged-secret absence, asset hashes, and
the Vercel header policy. Live-limited and synthetic candidates must be checked
with their explicit expected surface. See `docs/VNTAX_DEPLOYMENT_RUNBOOK.md`.

## Current verification evidence

- Default production build: 204/204 application tests, 10/10 RLS-verifier and schema-contract safety
  tests, TypeScript, zero-warning lint, production bundle, and dependency audit
  pass locally.
- Locked-runtime Chrome check: homepage states the account boundary; signup and
  `/app` routes render the locked state; no fixture business or fixture feature
  navigation appears.
- Explicit-demo Chrome check: desktop, mobile, English payroll, Vietnamese
  transition state, CSV rate/remittance evidence, signup fail-closed, persistent
  guide/onboarding warnings, no fake connection action, no browser errors, and
  no horizontal overflow.
- Deployment header policy: Vercel config denies framing, MIME sniffing, camera,
  microphone, and geolocation; sets HSTS, opener/resource isolation, and a CSP
  limited to same-origin app assets, Google Fonts, and Supabase HTTPS/WebSocket
  connections. These headers still require verification on the deployed URL.
- Release artifact preflight: the exact build must declare its surface in a
  generated manifest and match the approval target. The preflight also rejects
  emitted source maps, service credentials/private keys, and weakened required
  header directives. This is local structural evidence; deployed behavior must
  still be checked independently.
- Runner-only note: on this Windows host, system Chrome did not acknowledge one
  Playwright `browser.close()` request within five seconds after the locked-mode
  assertions and screenshots were complete. The test process and exact local
  preview PIDs were cleaned up; this is not evidence about deployed behavior.
- Read-only anonymous RLS probe: `profiles`, `businesses`, `memberships`,
  `transactions`, `receipts`, `business_documents`, `sharing_grants`,
  `audit_events`, `connections`, `financial_accounts`, `export_packages`,
  `quarterly_estimates`, and `tax_identities` each returned zero rows through
  the publishable browser key. This proves only anonymous non-enumeration; it
  does not replace an authenticated two-user isolation test.

- Manual threat review remediation: password recovery now completes at its
  routed destination; stale auth hydration cannot overwrite a newer auth
  event; sign-out removes namespaced browser auth state even on network
  failure; identity retry re-reads identity; active business selection and
  membership hydration fail closed; payroll CSV text neutralizes spreadsheet
  formulas; and `shares_business_with()` now requires accepted memberships on
  both sides. The SQL correction remains structural-only until applied and
  exercised in the dedicated project.

## Gates before complete-platform production

1. Implement live tenant-scoped repositories for transactions, receipts,
   documents, exports, connections, and sharing; enforce authorization in the
   database or server, not only in React.
2. Add a reproducible baseline schema migration, then apply the complete
   target-project migrations and run authenticated two-user
   RLS isolation tests, including revoked membership and expired professional
   grants. The current migration folder contains incremental changes that refer
   to pre-existing tables/functions and cannot bootstrap a fresh project.
   Do this in a dedicated VNTax project, not the shared TrinityAI relay project.
3. Install private object storage, ownership policies, file-type and size
   validation, malware controls, retention/deletion, and recovery procedures
   before accepting receipts or tax documents.
4. Contract and verify any banking, OCR, notification, analytics, or payment
   vendors; publish accurate consent, privacy, security, cancellation, and
   data-sharing terms before collecting customer information or money.
5. Approve each production tax ruleset with named accountable review. Keep
   unsupported or stale years fail-closed.
6. Complete qualified native Vietnamese review of customer and tax-critical
   wording, accessibility testing, mobile recovery/error walkthroughs, and
   incident-response ownership.
7. Verify the deployed preview, headers, source maps, secrets, monitoring,
   backups, restore procedure, and rollback before named release approval.

Passing unit tests or returning HTTP 200 does not close these gates.
