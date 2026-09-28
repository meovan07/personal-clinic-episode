-- LOCAL DEVELOPMENT ONLY (applied by `npx supabase db reset`, never to the hosted project).
-- Two test accounts: anh@example.test / em@example.test, password: test-password-123
do $$
declare
  u record;
begin
  for u in select * from (values
    ('11111111-1111-1111-1111-111111111111'::uuid, 'anh@example.test', 'Anh'),
    ('22222222-2222-2222-2222-222222222222'::uuid, 'em@example.test', 'Em')
  ) as t(id, email, display_name)
  loop
    insert into auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
                            raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
                            confirmation_token, email_change, email_change_token_new, recovery_token)
    values ('00000000-0000-0000-0000-000000000000', u.id, 'authenticated', 'authenticated', u.email,
            extensions.crypt('test-password-123', extensions.gen_salt('bf')), now(),
            '{"provider":"email","providers":["email"]}', '{}', now(), now(), '', '', '', '');
    insert into auth.identities (id, user_id, provider_id, identity_data, provider, created_at, updated_at)
    values (gen_random_uuid(), u.id, u.id::text,
            jsonb_build_object('sub', u.id::text, 'email', u.email, 'email_verified', true),
            'email', now(), now());
    insert into public.members (user_id, display_name) values (u.id, u.display_name);
  end loop;
end $$;
