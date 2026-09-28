-- Schema for the family medical records app.
-- Every table is readable/writable only by users listed in public.members.

create extension if not exists pgcrypto;

-- Accounts allowed to use the app (you + your partner). Add rows manually after creating the auth users.
create table public.members (
  user_id uuid primary key references auth.users on delete cascade,
  display_name text not null
);

create or replace function public.is_member()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (select 1 from public.members where user_id = auth.uid());
$$;

-- People whose records are stored.
create table public.people (
  id uuid primary key default gen_random_uuid(),
  full_name text not null,
  birth_date date,
  sex text check (sex in ('nam', 'nu', 'khac')),
  blood_type text,
  allergies text,
  chronic_conditions text,
  notes text,
  created_at timestamptz not null default now()
);

-- A case (bệnh án / đợt bệnh) groups visits about one illness.
create table public.cases (
  id uuid primary key default gen_random_uuid(),
  person_id uuid not null references public.people on delete cascade,
  title text not null,
  status text not null default 'dang_dieu_tri'
    check (status in ('dang_dieu_tri', 'theo_doi', 'da_khoi')),
  started_on date,
  ended_on date,
  notes text,
  created_at timestamptz not null default now()
);
create index on public.cases (person_id);

-- One trip to a doctor, lab or hospital. May or may not belong to a case.
create table public.visits (
  id uuid primary key default gen_random_uuid(),
  person_id uuid not null references public.people on delete cascade,
  case_id uuid references public.cases on delete set null,
  visit_date date not null,
  facility text,
  department text,
  doctor text,
  reason text,
  notes text,
  created_at timestamptz not null default now()
);
create index on public.visits (person_id, visit_date desc);
create index on public.visits (case_id);

-- A logical document (e.g. one lab report). Can be made of several files (pages/photos).
create table public.documents (
  id uuid primary key default gen_random_uuid(),
  visit_id uuid not null references public.visits on delete cascade,
  title text,
  doc_type text not null default 'other'
    check (doc_type in ('lab_result', 'imaging_report', 'prescription', 'discharge_summary',
                        'visit_note', 'invoice', 'other')),
  -- Phase 2 (AI extraction)
  extraction_status text not null default 'none'
    check (extraction_status in ('none', 'pending', 'needs_review', 'confirmed', 'failed')),
  raw_ai_json jsonb,
  uploaded_by uuid references auth.users on delete set null,
  created_at timestamptz not null default now()
);
create index on public.documents (visit_id);

create table public.document_files (
  id uuid primary key default gen_random_uuid(),
  document_id uuid not null references public.documents on delete cascade,
  page_no int not null default 1,
  storage_path text not null unique,
  file_name text not null,
  mime_type text,
  size_bytes bigint,
  sha256 text not null unique, -- rejects uploading the exact same file twice
  created_at timestamptz not null default now()
);
create index on public.document_files (document_id);

-- Canonical list of tests so results from different labs line up (Phase 2).
create table public.test_catalog (
  code text primary key,
  name_vi text not null,
  aliases text[] not null default '{}',
  standard_unit text,
  category text
);

-- One measured value, e.g. LDL-C = 4.2 mmol/L.
create table public.observations (
  id uuid primary key default gen_random_uuid(),
  visit_id uuid not null references public.visits on delete cascade,
  document_id uuid references public.documents on delete set null,
  test_code text references public.test_catalog on delete set null,
  raw_name text not null,
  value numeric,
  value_text text,
  unit text,
  ref_range_text text,
  ref_low numeric,
  ref_high numeric,
  flag text check (flag in ('normal', 'high', 'low', 'abnormal')),
  created_at timestamptz not null default now()
);
create index on public.observations (visit_id);
create index on public.observations (test_code);

create table public.medications (
  id uuid primary key default gen_random_uuid(),
  visit_id uuid not null references public.visits on delete cascade,
  name text not null,
  dose text,
  schedule text,
  duration_days int,
  notes text,
  created_at timestamptz not null default now()
);
create index on public.medications (visit_id);

-- Things to do: "Giảm cân 3-5kg", "Tái khám 15/11".
create table public.action_items (
  id uuid primary key default gen_random_uuid(),
  person_id uuid not null references public.people on delete cascade,
  visit_id uuid references public.visits on delete set null,
  content text not null,
  due_on date,
  done boolean not null default false,
  created_at timestamptz not null default now()
);
create index on public.action_items (person_id, done);

-- AI "what changed" summaries (Phase 3).
create table public.ai_summaries (
  id uuid primary key default gen_random_uuid(),
  person_id uuid not null references public.people on delete cascade,
  content text not null,
  input_snapshot jsonb,
  generated_at timestamptz not null default now()
);

-- Row level security: members only, everywhere.
do $$
declare t text;
begin
  foreach t in array array['people', 'cases', 'visits', 'documents', 'document_files', 'test_catalog',
                           'observations', 'medications', 'action_items', 'ai_summaries']
  loop
    execute format('alter table public.%I enable row level security', t);
    execute format(
      'create policy "members only" on public.%I for all to authenticated using (public.is_member()) with check (public.is_member())',
      t);
  end loop;
end $$;

alter table public.members enable row level security;
create policy "members can see members" on public.members
  for select to authenticated using (public.is_member());

-- Private storage bucket for original files.
insert into storage.buckets (id, name, public, file_size_limit)
values ('documents', 'documents', false, 52428800)
on conflict (id) do nothing;

create policy "members read documents" on storage.objects
  for select to authenticated using (bucket_id = 'documents' and public.is_member());
create policy "members upload documents" on storage.objects
  for insert to authenticated with check (bucket_id = 'documents' and public.is_member());
create policy "members delete documents" on storage.objects
  for delete to authenticated using (bucket_id = 'documents' and public.is_member());
