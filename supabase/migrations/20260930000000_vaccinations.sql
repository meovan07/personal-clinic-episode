-- Phase 5: Sổ tiêm chủng (vaccination history per person).
-- Rows come from confirmed vaccination certificates (document_id set) or are added by hand (document_id null).

alter table public.documents drop constraint documents_doc_type_check;
alter table public.documents add constraint documents_doc_type_check
  check (doc_type in ('lab_result', 'imaging_report', 'prescription', 'discharge_summary',
                      'visit_note', 'vaccination_record', 'invoice', 'other'));

create table public.vaccinations (
  id uuid primary key default gen_random_uuid(),
  person_id uuid not null references public.people on delete cascade,
  visit_id uuid references public.visits on delete set null,
  -- Re-confirming a document replaces its rows, same as medications/observations.
  document_id uuid references public.documents on delete cascade,
  vaccine_name text not null,         -- as printed, e.g. "Vaxigrip Tetra", "Gardasil 9"
  disease text,                       -- what it protects against, in Vietnamese, e.g. "Cúm", "HPV"
  dose_label text,                    -- e.g. "Mũi 1", "Mũi 2", "Nhắc lại"
  given_on date,
  next_due_on date,
  lot_number text,
  facility text,
  notes text,
  created_at timestamptz not null default now()
);
create index on public.vaccinations (person_id, given_on desc);
create index on public.vaccinations (document_id);
create index on public.vaccinations (visit_id);

alter table public.vaccinations enable row level security;
create policy "members only" on public.vaccinations
  for all to authenticated using ((select private.is_member())) with check ((select private.is_member()));
