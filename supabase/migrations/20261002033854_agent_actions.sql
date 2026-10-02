-- Phase 8b: audit log of every change the chat assistant made after the user approved it.
-- `before` is the row as it was (null for creates), so a change can be traced and undone by hand.
-- Append-only: members can read and add entries, nobody can edit or remove them through the API.

create table public.agent_actions (
  id uuid primary key default gen_random_uuid(),
  thread_id uuid references public.chat_threads on delete set null,
  user_id uuid default auth.uid() references auth.users on delete set null,
  tool text not null,
  input jsonb not null,
  before jsonb,
  result jsonb,
  created_at timestamptz not null default now()
);
create index on public.agent_actions (created_at desc);
create index on public.agent_actions (thread_id);

alter table public.agent_actions enable row level security;

create policy "members read" on public.agent_actions
  for select to authenticated
  using ((select private.is_member()));

create policy "members add own" on public.agent_actions
  for insert to authenticated
  with check ((select private.is_member()) and user_id = (select auth.uid()));
