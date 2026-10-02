-- Phase 8: chat assistant memory.
-- Short-term: conversations (threads + messages), private to the member who started them.
-- Compaction: older messages of a long thread are folded into `summary`; `summarized_count`
--   is how many of the oldest messages that summary covers.
-- Long-term: facts and preferences the assistant was told to keep, shared by both members.

create table public.chat_threads (
  id uuid primary key,
  created_by uuid not null default auth.uid() references auth.users on delete cascade,
  title text,
  summary text,
  summarized_count int not null default 0 check (summarized_count >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index on public.chat_threads (created_by, updated_at desc);

-- One row per AI SDK UI message; `parts` is the message's parts array as the client renders it.
create table public.chat_messages (
  id text primary key,
  thread_id uuid not null references public.chat_threads on delete cascade,
  seq bigint generated always as identity,
  role text not null check (role in ('user', 'assistant', 'system')),
  parts jsonb not null,
  created_at timestamptz not null default now()
);
create index on public.chat_messages (thread_id, seq);

create table public.agent_memories (
  id uuid primary key default gen_random_uuid(),
  -- Who the fact is about; null for things about the household or how to answer.
  person_id uuid references public.people on delete cascade,
  content text not null check (char_length(content) between 1 and 500),
  created_by uuid default auth.uid() references auth.users on delete set null,
  source_thread_id uuid references public.chat_threads on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index on public.agent_memories (person_id);

alter table public.chat_threads enable row level security;
alter table public.chat_messages enable row level security;
alter table public.agent_memories enable row level security;

create policy "own threads" on public.chat_threads
  for all to authenticated
  using ((select private.is_member()) and created_by = (select auth.uid()))
  with check ((select private.is_member()) and created_by = (select auth.uid()));

create policy "messages of own threads" on public.chat_messages
  for all to authenticated
  using (
    (select private.is_member())
    and exists (select 1 from public.chat_threads t where t.id = thread_id and t.created_by = (select auth.uid()))
  )
  with check (
    (select private.is_member())
    and exists (select 1 from public.chat_threads t where t.id = thread_id and t.created_by = (select auth.uid()))
  );

create policy "members only" on public.agent_memories
  for all to authenticated
  using ((select private.is_member()))
  with check ((select private.is_member()));
