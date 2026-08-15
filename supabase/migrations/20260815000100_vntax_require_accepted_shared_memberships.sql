-- Pending invitations are not authority.
--
-- The earlier shares_business_with() body joined membership rows without
-- requiring accepted_at. Any profile or collaboration policy depending on
-- that helper could therefore treat an invited-but-not-joined person as
-- sharing a business. Require both sides to hold accepted memberships.

create or replace function private.shares_business_with(other uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $function$
  select exists (
    select 1
    from public.memberships a
    join public.memberships b on a.business_id = b.business_id
    where a.user_id = auth.uid()
      and b.user_id = other
      and a.accepted_at is not null
      and b.accepted_at is not null
  )
$function$;

revoke all on function private.shares_business_with(uuid) from public, anon;
grant execute on function private.shares_business_with(uuid) to authenticated;
