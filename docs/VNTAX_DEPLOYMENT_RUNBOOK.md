# VNTax controlled-release deployment runbook

Date: 2026-08-15

This runbook prepares a release; it does not authorize one. Tim remains the
named release approver. A green local build is not evidence that the Supabase
schema, email delivery, monitoring, backups, or deployed customer boundary are
working.

## Release surfaces

Every build emits `dist/vntax-build-manifest.json`. The release preflight reads
that artifact instead of inferring the build mode from source code.

| Surface | Intended use | Required preflight |
|---|---|---|
| `locked` | Public holding page with all account and app routes closed | `npm.cmd run preflight:release` |
| `live_limited` | Approved account/business pilot plus local DC payroll only | `node tools/release-preflight.mjs --expect live_limited` |
| `synthetic_demo` | Explicit fictional walkthrough; never the production artifact | `node tools/release-preflight.mjs --expect synthetic_demo` |

The preflight verifies the declared runtime surface, absence of ambiguous
Supabase/demo configuration, no emitted source maps, no service credentials or
private keys, asset hashes, and the required Vercel security-header policy.

## Pre-deploy approval checklist

- [ ] Exact branch, commit, diff, and rollback commit recorded.
- [ ] `npm.cmd ci` succeeds using the committed lockfile on the release runner.
- [ ] `npm.cmd run verify` passes on the exact candidate commit.
- [ ] CI results and dependency audit reviewed by a named human.
- [ ] Target surface in the build manifest matches the approved release scope.
- [ ] For `live_limited`, a dedicated VNTax Supabase project is named and the
      shared TrinityAI relay project is absent from deployment variables.
- [ ] Baseline plus incremental migrations are reproducible and tested on a
      disposable project before production application.
- [ ] Two ordinary users pass the authenticated RLS verifier, including
      cross-user reads/writes, revoked membership, pending invitation, expired
      grant, and cleanup checks.
- [ ] Email confirmation and password recovery redirects pass on staging.
- [ ] Leaked-password protection and secure password-change policy are reviewed.
- [ ] Qualified tax/payroll and native Vietnamese reviewers approve the exact
      customer-facing rules and wording in scope.
- [ ] Privacy, security, consent, data-sharing, cancellation, and support terms
      match the enabled capabilities.
- [ ] Monitoring owners, escalation channel, backup owner, restore procedure,
      and rollback operator are named.
- [ ] Tim gives fresh approval for the exact deployment target and surface.

## Staging and deployment

1. Deploy the exact candidate to staging without production customer data.
2. Verify actual response headers, TLS, asset caching, and absence of source maps.
3. Walk through desktop and mobile signup, confirmation, login, recovery,
   sign-out, business creation, membership selection, and the approved payroll
   path. Confirm all other live workflows remain unavailable.
4. Run the two-user RLS verifier against disposable staging accounts.
5. Record error-rate and latency baselines for authentication, profile,
   membership, business, and payroll-page requests. Production cannot proceed
   without explicit numeric alert thresholds derived from this baseline.
6. Obtain final deployment approval, deploy, and repeat the smoke tests without
   creating or viewing real customer financial records.
7. Monitor the agreed metrics continuously through the approved observation
   window; record the deployment ID and observations.

## Immediate rollback or shutdown triggers

Disable the release immediately if any of these occurs:

- one user can observe or modify another user's business or membership data;
- a service-role/secret credential, tax identifier, or customer financial data
  appears in a browser bundle, URL, client log, or monitoring event;
- the runtime surface differs from the approved build manifest;
- synthetic businesses or fixture workflows appear in a live-limited build;
- authentication, recovery, RLS, or membership checks fail open;
- required security headers are absent or materially weaker on the deployed URL;
- an unapproved tax calculation, filing, payment, banking, receipt, document,
  export, sharing, billing, or advice workflow becomes reachable.

Operational error-rate and latency rollback thresholds remain intentionally
unset until staging produces a measured baseline and the monitoring owner
approves them. Their absence is a release blocker, not permission to deploy.

## Rollback evidence

After rollback, record the deployment ID, UTC start/end, triggering symptom,
affected surface, rollback commit/deployment, smoke-test result, data-exposure
assessment, and owner of follow-up work. Do not claim recovery from a successful
deployment command alone; verify the live runtime surface and affected routes.
