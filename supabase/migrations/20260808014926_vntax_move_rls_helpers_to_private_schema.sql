-- Moves the RLS helper functions out of the API-exposed schema.
--
-- These five functions must be SECURITY DEFINER: they read `memberships` from
-- inside the policies that protect `memberships`, so an invoker-rights version
-- would recurse. But because they lived in `public`, PostgREST exposed every
-- one of them at /rest/v1/rpc/<name>, letting any signed-in user call the
-- authorisation primitives directly and probe what they are permitted to do.
--
-- Revoking EXECUTE is not an option: policy expressions are evaluated as the
-- calling role and require it. Verified empirically -- revoking EXECUTE on
-- is_member_of made every table read fail with
-- "permission denied for function is_member_of".
--
-- Moving them to a schema PostgREST does not serve keeps the policies working
-- while removing the API surface. ALTER FUNCTION ... SET SCHEMA preserves the
-- function identity, so all 52 dependent policies follow automatically. That
-- matters: hand-rewriting 52 security policies is exactly how isolation bugs
-- get introduced.

create schema if not exists private;

revoke all on schema private from public;
grant usage on schema private to authenticated, service_role;

alter function public.role_in_business(uuid)     set schema private;
alter function public.is_member_of(uuid)         set schema private;
alter function public.can_write_business(uuid)   set schema private;
alter function public.can_admin_business(uuid)   set schema private;
alter function public.shares_business_with(uuid) set schema private;

-- The bodies still name `public.role_in_business`, which no longer exists.
-- CREATE OR REPLACE keeps the same function identity, so the relocated
-- policies stay valid.
create or replace function private.role_in_business(b uuid)
returns text language sql stable security definer set search_path to 'public'
as $function$
  select m.role from public.memberships m
  where m.business_id = b and m.user_id = auth.uid() and m.accepted_at is not null
  limit 1
$function$;

create or replace function private.is_member_of(b uuid)
returns boolean language sql stable security definer set search_path to 'public'
as $function$ select private.role_in_business(b) is not null $function$;

create or replace function private.can_write_business(b uuid)
returns boolean language sql stable security definer set search_path to 'public'
as $function$ select private.role_in_business(b) in ('owner','manager','bookkeeper','admin') $function$;

create or replace function private.can_admin_business(b uuid)
returns boolean language sql stable security definer set search_path to 'public'
as $function$ select private.role_in_business(b) in ('owner','admin') $function$;

create or replace function private.shares_business_with(other uuid)
returns boolean language sql stable security definer set search_path to 'public'
as $function$
  select exists (
    select 1 from public.memberships a
    join public.memberships b on a.business_id = b.business_id
    where a.user_id = auth.uid() and b.user_id = other
  )
$function$;

-- anon must never reach the authorisation primitives.
revoke all on function private.role_in_business(uuid)     from public, anon;
revoke all on function private.is_member_of(uuid)         from public, anon;
revoke all on function private.can_write_business(uuid)   from public, anon;
revoke all on function private.can_admin_business(uuid)   from public, anon;
revoke all on function private.shares_business_with(uuid) from public, anon;

grant execute on function private.role_in_business(uuid)     to authenticated;
grant execute on function private.is_member_of(uuid)         to authenticated;
grant execute on function private.can_write_business(uuid)   to authenticated;
grant execute on function private.can_admin_business(uuid)   to authenticated;
grant execute on function private.shares_business_with(uuid) to authenticated;
