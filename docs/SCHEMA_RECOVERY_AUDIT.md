# VNTax business-schema recovery audit

Date: 2026-08-15

## Result

No authoritative, executable baseline migration for the current VNTax
business-bookkeeping schema was found in the repository, any current public
GitHub branch, local Git history, unreachable Git objects, or the inspected
local recovery packet. Do not substitute the similarly named recovery SQL.

## Evidence inspected

- The public repository branch inventory contained seven branches at the time
  of review. Recursive GitHub trees for every branch contained, at most, the
  four incremental migrations dated 2026-08-08. None contained the original
  `vntax_core_schema`, `vntax_row_level_security`, or
  `vntax_harden_functions` migration.
- Local history shows that commit `1e07eb5` added only `CODEX_HANDOFF.md` and
  asserted that those migrations had already been applied. Commit `da262c2`
  later added generated database types and the four incremental migrations,
  but not the baseline. A full local object check found no recoverable missing
  migration blob.
- The local recovery packet at
  `2026-08-12/referenced-chatgpt-conversation-this-is-an/linh-recovery-review`
  contains migrations named for VNTax, but they define a different individual
  return product (`taxpayers`, `tax_returns`, `documents`, `income_sources`,
  and related tables). The current application contract is the business
  bookkeeping model (`businesses`, `memberships`, `transactions`, `receipts`,
  and related tables). The recovery SQL is therefore not a baseline for this
  checkout.
- `src/types/database.ts` is useful structural evidence for the historical
  business schema, but it does not contain executable constraints, grants,
  policies, triggers, function bodies, or migration order. It cannot safely be
  converted into a claimed authoritative migration.

## Safe acquisition path

1. Through an approved Supabase admin workflow, create a schema-only export of
   the historical VNTax business objects. Do not export rows or credentials.
2. Review the export against an explicit VNTax object allowlist. The historical
   project is shared with the TrinityAI relay, so unrelated relay objects must
   not enter the dedicated VNTax project.
3. Preserve extensions, enum/domain definitions, tables, constraints, indexes,
   grants, RLS enablement and policies, triggers, and function bodies in a
   reproducible ordered migration set.
4. Apply the baseline and the four later incremental migrations to a disposable
   dedicated VNTax project first.
5. Run `npm run verify:rls`. Before it creates any disposable business, the
   verifier now asks PostgREST for every table and column in the generated
   business-schema contract with `limit=0`. A missing table or column stops the
   run before mutation. This structural preflight supplements, but does not
   replace, the bidirectional RLS, trigger, RPC-exposure, and cleanup checks.
6. Regenerate `src/types/database.ts` from the dedicated project and review any
   difference before a production release decision.

## Limit of this audit

This audit proves where the baseline was not found and rejects one incompatible
candidate. It does not prove that the historical shared database is clean,
that an eventual export is complete, or that a dedicated project is isolated.
Those require authorized admin access and live verification.
