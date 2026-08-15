# Authentication and data isolation

This document records what was built, what was verified, and — more usefully —
the things that went wrong and why the fix is what it is.

## Configuration

Two environment variables, both safe to expose in the browser:

```
VITE_SUPABASE_URL=https://<dedicated-vntax-project-ref>.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=<dedicated VNTax publishable key>
```

`src/lib/env.ts` inspects the key at startup and **throws if it looks like a
service-role or secret key** — either the `sb_secret_` prefix or a JWT whose
`role` claim is `service_role`. A service-role key bypasses row-level security
entirely, so pasting one into a `VITE_` variable would publish unrestricted
database access inside the JavaScript bundle. This is the single worst mistake
available in a Supabase frontend, it is easy to make while debugging, and it
now fails loudly instead of silently working.

The historical host `rcmcqcinndypoupgjezi.supabase.co` is explicitly refused.
It is the shared TrinityAI relay project, and its publishable key can select
`relay_messages`. A public VNTax bundle must never expose that shared project as
though it were a dedicated customer boundary.

## Runtime modes

- Missing or forbidden database configuration enters `locked` mode. Signup,
  onboarding, and application routes fail closed.
- A separately configured Supabase project enters `live_limited` mode. Only
  authentication, business setup, and the local restaurant payroll worksheet
  are exposed; fixture ledger features cannot mount.
- Fictional fixtures require an explicit
  `VITE_ENABLE_SYNTHETIC_DEMO=true` build and carry a persistent warning.

## Session handling

- `src/auth/session.ts` — sign up, sign in, sign out, password reset, identity
  loading. Returns discriminated `AuthResult<T>` values; no throwing.
- `src/auth/AuthProvider.tsx` — holds status, session and identity.

Behaviours worth knowing:

| Decision | Reason |
| --- | --- |
| `loading` is a distinct status from `signed_out` | Otherwise a user refreshing a page they are signed into sees the login form flash before the session restores. There is a test for this. |
| Identity loading is deferred with `queueMicrotask` | Awaiting a Supabase query inside the `onAuthStateChange` callback deadlocks the client. |
| `TOKEN_REFRESHED` updates the token only | Re-reading the profile on every hourly refresh is wasted work and a flicker source. |
| A failed identity load does not sign the user out | A transient network error is not an authentication failure. The user sees a retry, not a logout. |
| An unrecognised membership role is dropped | Unknown authority grants no membership access. It is never promoted or treated as a readable role. |
| Sign-out clears the local session even if the network call fails | These businesses share back-office computers. Leaving a session alive because a request timed out is a real exposure. |
| Sign-in collapses "no such user" and "wrong password" | Distinguishing them turns the login form into an account-enumeration oracle. |

## The two real bugs found during verification

Both were found by running against the live database. Neither would have been
caught by unit tests alone.

### 1. Every business creation failed, but wrote a row anyway

`supabase-js` sends `.insert().select()` as `INSERT ... RETURNING`. PostgreSQL
checks the RETURNING projection against the table's **SELECT** policy, and does
so **before** AFTER-INSERT triggers fire. The SELECT policy is
`is_member_of(id)`; the owner membership is created by the
`on_business_created` AFTER trigger. So at the moment the read-back is
authorised, the caller is not yet a member of the row they just created:

```
new row violates row-level security policy for table "businesses"
```

The insert itself succeeded. Only the read-back failed. That combination is the
dangerous part — the obvious "fix" of dropping `.select()` would silently leave
an orphaned business row behind on every retry.

Fixed with `public.create_business()`, a `SECURITY DEFINER` function that does
the insert and the membership in one transaction and returns the row once both
exist. `created_by` and the owner role are read from `auth.uid()` inside the
function and are not parameters, so neither can be forged by the browser.

### 2. The authorisation primitives were callable over the public API

`is_member_of`, `can_write_business`, `can_admin_business`, `role_in_business`
and `shares_business_with` lived in `public`, so PostgREST served each one at
`/rest/v1/rpc/<name>`. Any signed-in user could call the functions that decide
what they are allowed to do.

Revoking `EXECUTE` does not work — policy expressions run as the calling role
and need it. Verified: revoking it made every table read fail with
`permission denied for function is_member_of`.

Fixed by moving all five into a `private` schema that PostgREST does not serve.
`ALTER FUNCTION ... SET SCHEMA` preserves function identity, so all 52
dependent policies followed automatically rather than being hand-rewritten —
which matters, because rewriting 52 security policies by hand is precisely how
isolation bugs get introduced.

## Historical verification and current verifier

The prior handoff records a 38/38 run against the historical database. That is
a historical assertion, not current release evidence, and it does not approve
the shared relay project for customer production.

`tools/rls-smoke-test.mjs` now performs current checks using two
separate accounts and **only the publishable key** — the same key the browser
holds. Using a service-role key here would prove nothing, since it bypasses RLS
by design. The script asserts the tokens carry `role=authenticated` before it
trusts any result.

Covered:

- Both directions of cross-account reads on all 13 business-scoped tables
- Cross-account update, transaction insert and document insert — all rejected
- Privilege escalation: account A attempting to grant itself membership of B
- The anonymous key alone reading `businesses`, and calling `create_business`
- All five authorisation RPCs returning HTTP 404
- `create_business` rejecting an out-of-range industry
- The profile and owner-membership triggers firing
- Each account reading back its own newly created business

The current tool deliberately has no built-in emails or passwords and never
writes to `auth.users`. Create two confirmed disposable users through an
approved dashboard/admin workflow, confirm each sees zero businesses, and set:

```powershell
$env:SUPABASE_URL='https://<dedicated-vntax-project-ref>.supabase.co'
$env:SUPABASE_PUBLISHABLE_KEY='<publishable key>'
$env:RLS_EMAIL_A='<disposable account A>'
$env:RLS_PASSWORD_A='<unique password A>'
$env:RLS_EMAIL_B='<disposable account B>'
$env:RLS_PASSWORD_B='<unique password B>'
$env:RLS_ALLOW_MUTATION='DELETE-DISPOSABLE-RLS-DATA'
npm.cmd run verify:rls
```

The verifier creates one tagged business per account, checks both directions
across every business-scoped table, probes cross-account writes and private RPC
exposure, and deletes both businesses in `finally`. Failed cleanup fails the
run and prints only the non-secret run ID for approved admin cleanup. Delete the
two auth users after the run.

The fixed credentials formerly present in this repository were tested on
2026-08-15; both returned `400 invalid_credentials` and issued no token. They
were removed from the current tree, but Git history should still be treated as
public and those values must never be reused.

## Known scope limits

- Only identity and `businesses` are wired to live data. Fixture-backed
  transaction, receipt, document, connection, export, and sharing screens are
  unavailable in `live_limited` mode rather than relying on UUID mismatch.
- Address `localityId` is left empty rather than guessed. Filing authorities are
  address-level, and asserting a jurisdiction we have not resolved would be
  worse than showing it as unresolved.

## Outstanding, needs a dashboard click

**Leaked password protection is disabled.** Supabase can check new passwords
against HaveIBeenPwned. It is off, and it cannot be enabled from SQL or the
management tools available here.

Authentication → Policies → enable "Leaked password protection".
