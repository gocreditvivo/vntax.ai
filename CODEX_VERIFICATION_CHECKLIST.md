# CODEX_VERIFICATION_CHECKLIST.md

Independent verification of the VN Tax Phase 3 package.

Each item states the **exact command**, the **expected result**, and — where a
claim is made — **how to falsify it**. Items marked ⚠ could not be run in the
build environment (no network) and are unverified by Claude.

---

## 1. Clean install ⚠

```bash
unzip vntax-app-complete.zip && cd vntax-app-complete
node --version          # expect >= 20.19.0
npm install
```

- [ ] Completes without `ERESOLVE`
- [ ] `package-lock.json` is generated — **commit it**
- [ ] `npm audit` — record the output

**On the missing lockfile.** It is absent because it cannot be generated without
registry access, and fabricating one would ship absent or invented integrity
hashes — a supply-chain hazard, not a formality. Mitigations shipped instead:

- every dependency, devDependency and override pinned **exactly** (0 caret ranges)
- `.npmrc` with `save-exact=true` and `engine-strict=true`
- `engines.node >= 20.19.0`

With exact pins the lockfile produced by `npm install` is reproducible by anyone
running the same command against the same registry.

**Archive determinism** is verified: `tools/pack.sh` normalises mtimes, sorts
entries and strips platform extras. Packing twice produces a byte-identical ZIP
(SHA-256 recorded in `BUILD_RESULTS.txt` §12).

> Not run by Claude: the build sandbox has no registry access. `npm install`
> failed there with HTTP 403; the verbatim output is in `BUILD_RESULTS.txt` §1.

---

## 2. Typecheck

```bash
npm run typecheck
```

- [ ] Exit 0, no errors

**Revision 3 note.** 24 compiler errors were found and fixed, using a local
React declaration (`tools/react-shim.d.ts`) so `.tsx` could be checked offline.
Reproduce that check without installing anything:

```bash
npx tsc --noEmit -p tsconfig.offline.json     # expect exit 0
```

That config runs `--strict --noUnusedLocals --noUnusedParameters` across every
`.tsx` and both test files. `tsconfig.json` excludes the shim, so
`npm run typecheck` uses the real `@types/react`.

Partial verification that WAS performed offline:

```bash
npx tsc --noEmit -p tsconfig.check.json    # exit 0
```

covering `src/types`, `src/security`, `src/mocks`, and both locale files under
`--strict --noUnusedLocals --noUnusedParameters`. Every `.tsx` also transpiles
with zero syntax errors. What remains unverified is the TSX against real
`@types/react`.

**Specifically re-check** (both were defects in earlier revisions):

- [ ] No file imports `React` without using `React.*`:
  ```bash
  for f in $(find src -name "*.tsx"); do
    grep -q "^import React" "$f" && [ "$(grep -c 'React\.' "$f")" -eq 0 ] && echo "UNUSED: $f"
  done
  ```
  Expect no output. Files that legitimately need it: `router.tsx`, `ui.tsx`,
  `layouts/index.tsx`, `i18n/index.tsx`, `main.tsx`, `states.tsx`.

- [ ] `src/i18n/vi.ts` compiles against `Dict`. The `Widen<T>` type in `en.ts`
  preserves key structure while allowing different string values. Delete a key
  from `vi.ts` — the build must fail.

---

## 3. Tests

```bash
npm run test
```

- [ ] 27 suites, 134 tests, 0 failures
- [ ] `src/tests/suite.test.ts` — 74 (design invariants)
- [ ] `src/tests/services.test.ts` — 60 (behaviour)

> Verified offline against a minimal stand-in for the Vitest API, which proved
> collection and passes. The stand-in is NOT in the archive. If `vitest run`
> collects zero tests, that is a regression worth reporting.

**Falsification checks** — each should turn a passing test red:

- [ ] Remove `authorize()` from `categorizationService.confirm` → permission
      tests fail
- [ ] Change `scopeTo()` to return all rows → isolation tests fail
- [ ] Drop the `isExportable` filter in `exportService.build` → export-gate tests fail
- [ ] Delete a `recordAudit()` call → audit tests fail
- [ ] Add `"guaranteed deduction"` to either locale → compliance tests fail

---

## 3b. Lint ⚠

```bash
npm run lint          # eslint src --max-warnings 0
npm run verify        # typecheck + lint + test + build
```

- [ ] Exit 0

`eslint.config.js` encodes architectural boundaries as rules: features may not
import from other features, the tax engine may not import React or perform I/O,
and `consistent-type-imports` prevents the type-only-import defect from
recurring. Not run by Claude — eslint is not installable offline.

---

## 4. Production build ⚠

```bash
npm run build
```

- [ ] Exit 0
- [ ] `dist/` produced
- [ ] `npm run preview` serves it
- [ ] No secrets in the bundle:
  ```bash
  grep -rIE "sk_live|api[_-]?key|BEGIN (RSA|PRIVATE)|service_role" dist/ || echo CLEAN
  ```

---

## 5. Route behaviour

```bash
npm run dev     # http://localhost:5173
```

Routes use `HashRouter`, so paths are `/#/app/...`.

- [ ] `/` — bilingual homepage, language switch flips every string
- [ ] `/#/auth/sign-up` → `/#/onboarding/language`
- [ ] Onboarding runs language → owner → business → industry → entity →
      connections → complete
- [ ] `/#/app/dashboard` — readiness, alerts, sync status, masked accounts
- [ ] `/#/app/transactions` — filters work; Confirm moves a row to confirmed
- [ ] `/#/app/receipts` — upload adds to the queue with per-field confidence
- [ ] `/#/app/deductions` — every group says "Possible deduction"
- [ ] `/#/app/quarterly` — trace table with `[unverified]` tags visible
- [ ] `/#/app/documents` — upload flips a missing document to uploaded
- [ ] `/#/app/exports` — completeness shown BEFORE the build button
- [ ] `/#/app/collaboration/sharing` — invite validates, revoke works

**Industry mounting** — a salon build must contain no restaurant screens:

- [ ] `/#/app/restaurant/dashboard` with `industry="nail_salon"` shows the
      blocked state, not restaurant data

---

## 6. Permissions

Run in a REPL or a scratch test:

```ts
import { categorizationService, exportService, sharingService } from './src/services';
const manager = { userId: 'u', role: 'manager', businessId: 'biz_pho' };
```

- [ ] `categorizationService.confirm(manager, id)` → `permission_denied`
- [ ] `exportService.build(manager)` → `permission_denied`
- [ ] `sharingService.invite(manager, ...)` → `permission_denied`
- [ ] Bookkeeper: `categorize` allowed, `confirm` denied
- [ ] Admin: `transactionRepository.list` denied
- [ ] Owner: all allowed

UI corroboration: `screenshots/tx-manager.jpg` (Confirm disabled),
`screenshots/denied.jpg` (admin).

---

## 7. Data isolation

- [ ] `transactionRepository.list({businessId:'biz_pho'})` returns only `biz_pho`
- [ ] Fetching a `biz_lotus` id as `biz_pho` → **`not_found`**, not
      `permission_denied` (returning the latter would leak existence)
- [ ] Confirming a foreign transaction fails
- [ ] `readAudit('biz_pho')` contains no `biz_lotus` events
- [ ] Export from `biz_pho` contains no `biz_lotus` ids

```bash
grep -rn "db()\." src/services/*.ts | grep -v scopeTo
```

Every data read should pass through `scopeTo`. Exceptions should be
single-record lookups already scoped, or `db().businesses` by id.

---

## 8. Masking

- [ ] Every `ACCOUNTS[].maskedNumber` matches `/^\*{4}\d{4}$/`
- [ ] `maskAccountNumber('4111111111119876') === '****9876'`
- [ ] Leading digits never appear — the classic inversion of this bug
- [ ] Short input → `****`
- [ ] No full account number anywhere:
  ```bash
  grep -rE "\b[0-9]{12,19}\b" src/ | grep -v test
  ```

---

## 9. Export safety

- [ ] `build()` includes only rows where `confirmed !== null`
- [ ] Excluded (personal-scope) rows never appear
- [ ] `completeness` reports non-zero `unconfirmedTransactions` on seed data
- [ ] Confirming more rows increases the included count
- [ ] An `export.create` audit event is written every time
- [ ] `export.download` writes a separate event

---

## 10. No hidden secrets

```bash
grep -rIE "sk_live|sk_test|api[_-]?key|secret|BEGIN (RSA|PRIVATE)|service_role|Bearer " src/ tools/
find . -name ".env*" -o -name "*.pem" -o -name "*.key"
grep -rE "\b[0-9]{3}-[0-9]{2}-[0-9]{4}\b" src/     # SSN format
grep -rE "\b[0-9]{2}-[0-9]{7}\b" src/              # EIN format
```

- [ ] All clean. The only expected hit is `type="password"` inputs in
      `features/marketing/screens.tsx` — those are form fields, not credentials.
- [ ] All fixture emails end `example.com`
- [ ] All fixture phones contain `555`

---

## 11. No unsupported tax claims

```bash
grep -riE "guaranteed (deduction|savings|refund)|irs approved|fully deductible|automatically eligible|cpa approval required|replace your (cpa|accountant)" src/
```

- [ ] No matches, in either locale
- [ ] Present and correct: `Possible deduction`, `Suggested category`,
      `Planning estimate`, `Customer confirmation required`,
      `Professional review recommended`
- [ ] `en.legal.promise` is exactly:
      *"We organize your business finances and help you prepare for tax time."*
- [ ] Disclosure present on marketing and in the footer
- [ ] Worker classification is never decided — only flagged for review
- [ ] Quarterly output is labelled a planning estimate and shows
      `[unverified]` on unconfirmed rules

---

## 12. Offline review (no toolchain)

```bash
open preview/home-vi.html
```

25 pre-rendered routes including all state variants. Screenshots in
`screenshots/` — 24 files, desktop and mobile.

- [ ] `preview/` and `tools/` are deleted before production. They are
      offline-review scaffolding, not product code.

---

## Summary of what Claude did and did not verify

| Check | Status |
|---|---|
| Archive integrity | ✅ verified |
| Strict typecheck, non-React modules | ✅ exit 0 |
| Transpile all `.tsx` | ✅ 0 syntax errors |
| Tests, 134 across 27 suites | ✅ 0 failures (offline runner) |
| SSR all 25 routes | ✅ 25/25 |
| Chromium render, desktop + mobile | ✅ 24 screenshots, 0 page errors |
| No unused React imports | ✅ verified |
| No secrets, no real identifiers | ✅ verified |
| `npm install` | ⚠ **not run** — no network |
| `npm audit` | ⚠ **not run** — no network |
| Full `npm run typecheck` | ⚠ **not run** — needs `@types/react` |
| `npm run build` | ⚠ **not run** — needs Vite |
| Lockfile | ⚠ **not generated** — would be invalid if fabricated |

Please report any failure in the ⚠ rows with its output.
