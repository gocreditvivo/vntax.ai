# FALSIFICATION_EVIDENCE.md

Response to Codex remediation item 7:

> *Run the checklist's falsification tests to prove permission, isolation,
> export, audit, and prohibited-claim tests fail when controls are deliberately
> removed.*

Method: disable one control, run the full suite, record which tests turn red,
restore, confirm the baseline returns. A test that stays green when its control
is removed is theatre.

**Baseline: 134 passed, 0 failed.**

---

## Results

| # | Control disabled | Result | Tests turned red |
|---|---|---|---|
| 1 | `authorize()` removed from `categorizationService.confirm` | 132 / **2 red** | manager cannot confirm · bookkeeper cannot confirm |
| 2 | `scopeTo()` returns all rows | 127 / **7 red** | 5 isolation tests + export foreign-data test |
| 3 | `isExportable` filter dropped from `exportService.build` | 132 / **2 red** | only confirmed included · count grows on confirm |
| 4 | `recordAudit('export.create')` deleted | 133 / **1 red** | building an export writes an audit event |
| 5 | `'Possible deduction'` → `'Guaranteed deduction'` | 132 / **2 red** | never claims "guaranteed deduction" · required hedged phrases |
| 6 | first two guards removed from `isGrantActive()` | 134 / **0 red** | **see below — flawed falsification, not a test gap** |
| 6b | `isGrantActive()` forced to `return true` | 128 / **6 red** | revoked blocks · expired blocks · no grant blocks · unaccepted inactive · revocation immediate · uninvited business |
| 7 | masking returns leading digits instead of trailing | 130 / **4 red** | all four masking assertions |
| 8 | expiry check alone removed | 133 / **1 red** | an EXPIRED grant blocks |

**Restored: 134 passed, 0 failed.**

---

## Detail on #6 — reported because it initially looked like a test gap

Removing these two lines from `isGrantActive()` changed nothing:

```ts
if (g.status === 'revoked' || g.status === 'expired') return false;
if (g.revokedAt) return false;
```

The suite stayed fully green, which looks like a hole. It is not. The function
ends with:

```ts
return g.status === 'active' || g.status === 'accepted';
```

A revoked grant has `status === 'revoked'`, so that final line still rejects it.
The two removed lines are **redundant defence-in-depth**; deleting them does not
disable the control, so the falsification was incomplete rather than the tests
inadequate.

Forcing the function to `return true` — which genuinely disables it — turned
**six** tests red (#6b), including *"revoking access takes effect on the very
next request"*. Removing only the expiry check turned exactly one red (#8),
confirming the expiry assertion tests expiry specifically and not something else.

Reporting the intermediate result rather than only the one that worked, because
the sequence is the actual evidence.

---

## What this establishes

- Permission checks are enforced in the service layer, not just the UI.
- Business isolation is load-bearing — breaking `scopeTo()` breaks seven tests
  across three suites.
- The export gate is real: removing the `isExportable` filter is caught.
- Audit events are asserted individually; deleting one is caught.
- Prohibited-claim detection works on the actual locale content.
- Grant lifecycle is tested at the level of each individual guard.

## What it does not establish

These are **client-side, in-memory** controls. Falsification proves the tests
are meaningful, not that the controls are production security boundaries. Every
one must be re-implemented and re-tested server-side, as Codex states. Nothing
here changes the NO-GO on staging with real data.

---

## Reproducing

The offline runner used here is not shipped. On a networked machine:

```bash
npm install
npm run test                                   # expect 134 passed
# then, for each row above: apply the edit, re-run, revert
git stash          # or git checkout -- <file>
```

Each edit is small enough to apply by hand from the table.
