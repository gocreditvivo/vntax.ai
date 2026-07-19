# CLAUDE_PHASE3_HANDOFF.md

**Sổ Sạch / VN Tax — Phase 3, Functional Integration Build**

---

## STATUS: SUBMITTED FOR VERIFICATION — NOT DELIVERED, NOT APPROVED

> Phase 3 is **not** complete. It is complete **when independent verification
> passes**, not when the package is handed over.
>
> An earlier revision of this document described Phase 3 as delivered. That was
> wrong, and Codex's 2026-07-19 report was right to reject it: `npm run
> typecheck`, `npm run build`, and `npm run lint` all failed on the submitted
> package. A build that does not compile is not a delivery, whatever the tests
> say.
>
> **Gates that remain open.** None of these can be closed in the build
> environment used to produce this package, which has no network access:
>
> | Gate | Status | Who closes it |
> |---|---|---|
> | `npm install` | not run here | verifier |
> | `npm run typecheck` | not run here | verifier |
> | `npm run test` (134) | passing under an offline runner | verifier confirms under real Vitest |
> | `npm run build` | not run here | verifier |
> | `npm run lint` | config added, not run | verifier |
> | `npm audit` | not run here | verifier |
> | `dist/` secret scan | requires a build | verifier |
> | `package-lock.json` | **cannot be generated offline** | verifier — see below |
> | Git commit SHA | package is a ZIP, not a repo | recipient, on receipt |
>
> Claude's claims about this package are limited to what was executed offline
> and recorded verbatim in `BUILD_RESULTS.txt`. Everything above is unverified
> by Claude and is asserted by nobody.

---

Phase 2 delivered screens. Phase 3 makes them an application: a service layer,
a state machine, enforced permissions, data isolation, and an audit trail.

The visual system is unchanged. No screen was redesigned.

---

## What changed

| | Phase 2 | Phase 3 |
|---|---|---|
| Data | screens imported fixtures directly | screens call services; fixtures are behind a store |
| States | `loading` / `error` props | six real states derived from service results |
| Permissions | UI affordances only | enforced at the service boundary before data is touched |
| Isolation | by convention | impossible to violate — `scopeTo()` is the only accessor |
| Audit | none | exports and sharing always write an append-only event |
| Actions | local `useState` | real service calls with success/failure feedback |
| Tests | 74, design-level | 134, including workflow, isolation, and state tests |

---

## Architecture added

```
src/services/
  core.ts          Result<T>, ServiceError, Caller, authorize(), audit, scopeTo(),
                   fault injection, latency simulation
  store.ts         in-memory store, deep-cloned from fixtures, resettable
  transactions.ts  transactionRepository, categorizationService, receiptRepository
  domain.ts        deductionService, quarterlyService, industryService,
                   documentService, exportService, sharingService
  index.ts         the public surface — features import from here only

src/state/
  useAsync.ts      toState(), useAsync(), useAction()

src/components/
  states.tsx       StateView, PermissionDenied, Blocked, ActionFeedback
```

### The seam

`store.ts` is the only module that holds data. Replacing it with HTTP calls
changes no feature code — services keep the same signatures, screens keep the
same hooks.

---

## The six states

`toState()` maps a `Result<T>` onto exactly one UI state:

| Result | State | Screen |
|---|---|---|
| pending | `loading` | skeleton |
| `ok`, non-empty | `success` | the content |
| `ok`, empty array/object | `empty` | designed empty state, not a blank list |
| `err(permission_denied)` | `permission_denied` | navy panel, "ask the owner" |
| `err(blocked)` | `blocked` | gold panel, retry offered |
| any other error | `error` | clay panel, retry offered |

`empty` is separate from `success` because an empty list needs a different
screen. `blocked` is separate from `error` because a blocked operation is
waiting on something, not broken.

Every screen renders through `<StateView>`, so a screen cannot silently omit a
state.

**Reachable in the UI:** `screenshots/tx-loading.jpg`, `tx-error.jpg`,
`denied.jpg`, `salon-blocked.jpg`.

---

## Enforcement moved out of the UI

### Permissions

`authorize()` runs at the top of every service method, before any data is read.

```ts
const auth = authorize(caller, 'transactions', 'confirm');
if (!auth.ok) return auth;          // returns permission_denied
```

A manager or bookkeeper calling `categorizationService.confirm()` gets
`permission_denied` from the service — hiding the button is a courtesy, not the
control.

### Data isolation

`scopeTo(rows, businessId)` is the only way records leave the store. There is
no unscoped accessor, so a service cannot forget to filter.

Requesting another business's record returns **`not_found`, never
`permission_denied`** — distinguishing the two would leak that the record
exists.

### Export gate

`exportService.build()` includes only rows passing `isExportable()`:
confirmed, business-scope, not excluded. Completeness is computed **before** the
package is built and travels with it.

### Audit

`recordAudit()` is called on export create, export download, sharing invite, and
sharing revoke. The log is append-only — there is no update or delete path, and
`readAudit()` returns a readonly view scoped by business.

---

## Product rules kept

- `Possible deduction` — `deductionService` never decides eligibility.
- `Suggested category` — `suggested` and `confirmed` are separate fields; a
  suggestion cannot become a confirmation without a customer action.
- `Planning estimate` — `quarterlyService` passes the ruleset status and
  `unsupported[]` through so the UI shows what is unverified.
- `Professional review recommended` — never "required".
- Worker classification is surfaced as a question, never answered.
- No claim to replace a CPA, tax preparer, attorney, enrolled agent, or e-file
  provider. A test asserts eight forbidden phrases appear in neither locale.

---

## Industry separation

`industryService.restaurant()` returns `blocked` for a salon caller and vice
versa. Industry routes mount conditionally in `App.tsx` — a salon build contains
no restaurant screens, and the service refuses even if a route is forced.

---

## Test coverage — 134 tests, 27 suites

| Suite group | Tests | Covers |
|---|---|---|
| State machine | 6 | all six states reachable, correct mapping |
| Fault injection | 3 | error, blocked, empty via injected faults |
| Data isolation | 5 | cross-business reads, writes, and lookups all fail |
| Service permissions | 6 | manager/bookkeeper/admin/professional boundaries |
| Categorization | 6 | confirm, correct-flag, bulk-per-record audit, exclude |
| Receipts | 4 | upload, match, double-match conflict, ranked suggestions |
| Restaurant workflow | 3 | metrics reachable, salon view blocked |
| Salon workflow | 4 | metrics reachable, restaurant view blocked, W-9s |
| Export gate | 5 | only confirmed, no foreign data, completeness reported |
| Audit | 5 | export + sharing recorded, scoped, actor and timestamp |
| Professional sharing | 8 | validation, expiry, revoke-takes-effect-immediately |
| Quarterly | 2 | planning status preserved, scenario scales only |
| Masking | 2 | stored data masked, leading digits never shown |
| Store isolation | 1 | mutations do not leak between tests |
| *(Phase 2 suites)* | 74 | bilingual, compliance, permissions, fixtures, locality |

Two assertions worth singling out:

**Revocation takes effect on the very next request.** The professional's grant
is resolved live per call, so revoking is not eventually-consistent.

**Bulk confirm emits one audit event per transaction.** A bulk action is not a
shortcut around per-record accountability.

---

## Honest limitations

1. **No network in the build environment.** `npm install`, `npm audit`,
   full `npm run typecheck`, and `npm run build` could not be executed. See
   `BUILD_RESULTS.txt`. Everything verifiable offline was run and passed.

2. **No lockfile.** `package-lock.json` cannot be generated without the
   registry, and fabricating one would ship invalid integrity hashes. Run
   `npm install` once and commit the lockfile it produces.

3. **Vitest was verified through a minimal offline stand-in** for its API,
   which proved collection and passes (134/134). The stand-in was deleted before
   packaging. `vitest run` is the real runner.

4. **Services are in-memory.** No HTTP, no persistence. `store.ts` is the seam.

5. **The tax engine is not expanded** — Phase 3 scope was integration. The
   quarterly service passes engine-shaped output through with its ruleset status
   intact.

6. **Vietnamese still needs native review.** Drafted in the familiar register
   (anh/chị). Trade vocabulary must be confirmed by a speaker who knows these
   businesses.

7. **Not built:** alerts screen, settings, admin shell, contractor/W-9 tracker,
   tip tracker, sales-tax tracker, transaction detail, receipt detail. Routes
   and types exist.

8. **Accessibility not formally audited.** Semantic HTML, keyboard-reachable
   controls, aria-labels, icon-plus-text status, and focus rings are in place.
   An axe pass is outstanding.

---

## Next

**Phase 3 closes when the verifier's six gates pass, not before.**

```bash
bash tools/collect-evidence.sh      # runs all six gates + dist secret scan
```

That script writes `EVIDENCE.txt` containing the verbatim output of install,
typecheck, test, build, lint, audit, and the `dist/` secret scan — the exact
artefacts the resubmission requires. It exits non-zero if any gate fails.

- Commit the generated `package-lock.json`.
- Replace `store.ts` with HTTP adapters; service signatures do not change.
- Move `authorize()` server-side; keep the client mirror for affordances.
- Native Vietnamese review of `src/i18n/vi.ts`.
- Build the remaining screens listed above.
