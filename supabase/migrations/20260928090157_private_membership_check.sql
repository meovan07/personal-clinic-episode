-- Move the membership check out of the API-exposed `public` schema, per Supabase's security guidance:
-- SECURITY DEFINER functions in `public` are callable by anyone through the Data API.
create schema if not exists private;
grant usage on schema private to authenticated;

create or replace function private.is_member()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (select 1 from public.members where user_id = (select auth.uid()));
$$;
revoke execute on function private.is_member() from public, anon;
grant execute on function private.is_member() to authenticated;

-- Recreate every policy against the private function. `(select ...)` lets Postgres evaluate it once per query.
do $$
declare t text;
begin
  foreach t in array array['people', 'cases', 'visits', 'documents', 'document_files', 'test_catalog',
                           'observations', 'medications', 'action_items', 'ai_summaries']
  loop
    execute format('drop policy "members only" on public.%I', t);
    execute format(
      'create policy "members only" on public.%I for all to authenticated using ((select private.is_member())) with check ((select private.is_member()))',
      t);
  end loop;
end $$;

drop policy "members can see members" on public.members;
create policy "members can see members" on public.members
  for select to authenticated using ((select private.is_member()));

drop policy "members read documents" on storage.objects;
drop policy "members upload documents" on storage.objects;
drop policy "members delete documents" on storage.objects;
create policy "members read documents" on storage.objects
  for select to authenticated using (bucket_id = 'documents' and (select private.is_member()));
create policy "members upload documents" on storage.objects
  for insert to authenticated with check (bucket_id = 'documents' and (select private.is_member()));
create policy "members delete documents" on storage.objects
  for delete to authenticated using (bucket_id = 'documents' and (select private.is_member()));

drop function public.is_member();
