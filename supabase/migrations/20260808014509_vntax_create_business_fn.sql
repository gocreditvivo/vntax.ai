-- create_business(): atomic business creation.
--
-- Why an RPC instead of a plain insert from the client.
--
-- PostgreSQL evaluates the RETURNING projection of an INSERT against the
-- table's SELECT policy, and it does so *before* AFTER-INSERT row triggers
-- fire. The SELECT policy on businesses is is_member_of(id), and the owner
-- membership is created by the on_business_created AFTER trigger. So at the
-- instant RETURNING is authorised, the caller is not yet a member of the row
-- they just inserted, and the statement fails with 42501.
--
-- This was not theoretical. supabase-js sends .insert().select() as
-- `insert ... returning`, so every attempt to create a business from the
-- browser failed with "new row violates row-level security policy" -- while
-- the row itself was written. That combination is the dangerous part: the
-- obvious fix (drop the .select()) would leave an orphaned row behind on
-- every retry.
--
-- Security properties, deliberately:
--   * created_by and the owner membership come from auth.uid() inside the
--     function. Neither is a parameter, so a caller cannot attribute a
--     business to another user or grant itself a role on someone else's row.
--   * The function refuses to run without a session, so the anon key alone
--     cannot create rows.
--   * search_path is pinned, closing the standard SECURITY DEFINER
--     escalation where a caller shadows a referenced object.
--   * Enum-like text columns are validated in-function, so definer rights
--     cannot be used to smuggle in a value the table would otherwise reject.

create or replace function public.create_business(
  p_legal_name  text,
  p_dba_name    text default null,
  p_industry    text default 'restaurant',
  p_entity_type text default 'unknown',
  p_address     jsonb default '{}'::jsonb,
  p_phone       text default null
)
returns public.businesses
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_uid uuid := auth.uid();
  v_row public.businesses;
begin
  if v_uid is null then
    raise exception 'authentication required' using errcode = '42501';
  end if;

  if p_legal_name is null or btrim(p_legal_name) = '' then
    raise exception 'legal_name is required' using errcode = '22023';
  end if;

  if p_industry not in ('restaurant', 'nail_salon') then
    raise exception 'invalid industry' using errcode = '22023';
  end if;

  if p_entity_type not in ('sole_proprietor','single_member_llc','multi_member_llc','s_corporation','c_corporation','partnership','unknown') then
    raise exception 'invalid entity_type' using errcode = '22023';
  end if;

  insert into public.businesses (legal_name, dba_name, industry, entity_type, address, phone, created_by)
  values (btrim(p_legal_name), nullif(btrim(coalesce(p_dba_name,'')),''), p_industry, p_entity_type, coalesce(p_address,'{}'::jsonb), nullif(btrim(coalesce(p_phone,'')),''), v_uid)
  returning * into v_row;

  -- The AFTER trigger already creates this. ON CONFLICT DO NOTHING makes the
  -- function correct with or without the trigger, and removes the race
  -- between the two paths.
  insert into public.memberships (business_id, user_id, role, accepted_at)
  values (v_row.id, v_uid, 'owner', now())
  on conflict do nothing;

  return v_row;
end;
$$;
