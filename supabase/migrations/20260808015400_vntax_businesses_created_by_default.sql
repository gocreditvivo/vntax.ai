-- The businesses insert policy requires created_by = auth.uid(). Defaulting
-- the column server-side satisfies that without the browser ever supplying
-- the value, which is what makes authorship unforgeable: the policy rejects
-- any explicit created_by that is not the caller, and the default covers
-- omission. Idempotent.
alter table public.businesses alter column created_by set default auth.uid();
