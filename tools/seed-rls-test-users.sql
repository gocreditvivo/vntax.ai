-- Provisions two confirmed test accounts for the RLS isolation test.
--
-- Why this exists: the project has email confirmation enabled (correctly), so
-- a script cannot complete a real sign-up without a mailbox. These rows are
-- written the same way GoTrue writes them, with email_confirmed_at set, so the
-- accounts then authenticate through the ordinary password grant and receive
-- ordinary user JWTs. Nothing about the RLS test is privileged: every read and
-- write in the test is made with those user tokens and the publishable key.
--
-- The `on_auth_user_created` trigger fires on these inserts, so profile
-- creation is exercised for real rather than stubbed.

insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password,
  email_confirmed_at, created_at, updated_at,
  raw_app_meta_data, raw_user_meta_data, is_sso_user, is_anonymous
)
values
  ('00000000-0000-0000-0000-000000000000', gen_random_uuid(), 'authenticated', 'authenticated',
   'rls-a@rls-test.vntax.ai', extensions.crypt('RlsTestPassword-A-2026', extensions.gen_salt('bf')),
   now(), now(), now(),
   '{"provider":"email","providers":["email"]}'::jsonb,
   '{"display_name":"Owner A","locale":"vi"}'::jsonb, false, false),
  ('00000000-0000-0000-0000-000000000000', gen_random_uuid(), 'authenticated', 'authenticated',
   'rls-b@rls-test.vntax.ai', extensions.crypt('RlsTestPassword-B-2026', extensions.gen_salt('bf')),
   now(), now(), now(),
   '{"provider":"email","providers":["email"]}'::jsonb,
   '{"display_name":"Owner B","locale":"en"}'::jsonb, false, false)
on conflict (id) do nothing;

-- GoTrue's password grant requires a matching identity row.
insert into auth.identities (id, user_id, provider_id, provider, identity_data, created_at, updated_at)
select gen_random_uuid(), u.id, u.id::text, 'email',
       jsonb_build_object('sub', u.id::text, 'email', u.email, 'email_verified', true),
       now(), now()
from auth.users u
where u.email in ('rls-a@rls-test.vntax.ai', 'rls-b@rls-test.vntax.ai')
  and not exists (
    select 1 from auth.identities i where i.user_id = u.id and i.provider = 'email'
  );

select u.id, u.email, u.email_confirmed_at is not null as confirmed,
       p.display_name, p.locale
from auth.users u
left join public.profiles p on p.id = u.id
where u.email like '%@rls-test.vntax.ai'
order by u.email;
