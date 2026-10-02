-- Each member can change their own display name (the greeting and the assistant use it), and nothing else:
-- only their own row, and only the display_name column.

create policy "members update own name" on public.members
  for update to authenticated
  using ((select private.is_member()) and user_id = (select auth.uid()))
  with check ((select private.is_member()) and user_id = (select auth.uid()));

revoke update on public.members from authenticated;
grant update (display_name) on public.members to authenticated;

alter table public.members
  add constraint members_display_name_length check (char_length(btrim(display_name)) between 1 and 40);
