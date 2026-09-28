-- Quick-add inbox: files uploaded via the "+" button before AI has matched them
-- to a person/bệnh án/lần khám. Once confirmed, the row here is deleted and the
-- file becomes a normal document (see confirmInboxItem in actions.ts).

create table public.inbox_items (
  id uuid primary key default gen_random_uuid(),
  status text not null default 'processing' check (status in ('processing', 'needs_review', 'failed')),
  uploaded_by uuid references auth.users on delete set null,
  extraction jsonb,
  error text,
  suggested_person_id uuid references public.people on delete set null,
  suggested_case_id uuid references public.cases on delete set null,
  suggested_is_new_case boolean not null default false,
  suggested_new_case_title text,
  suggested_visit_id uuid references public.visits on delete set null,
  created_at timestamptz not null default now()
);

create table public.inbox_files (
  id uuid primary key default gen_random_uuid(),
  inbox_item_id uuid not null references public.inbox_items on delete cascade,
  page_no int not null default 1,
  storage_path text not null unique,
  file_name text not null,
  mime_type text,
  size_bytes bigint,
  sha256 text not null unique,
  created_at timestamptz not null default now()
);
create index on public.inbox_files (inbox_item_id);

alter table public.inbox_items enable row level security;
alter table public.inbox_files enable row level security;
create policy "members only" on public.inbox_items
  for all to authenticated using ((select private.is_member())) with check ((select private.is_member()));
create policy "members only" on public.inbox_files
  for all to authenticated using ((select private.is_member())) with check ((select private.is_member()));
