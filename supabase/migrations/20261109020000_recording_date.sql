-- Recording date of an uploaded audio file (from the file's lastModified), a hint for AI matching.
alter table public.inbox_items add column recorded_on date;
alter table public.documents add column recorded_on date;

comment on column public.inbox_items.recorded_on is 'Recording date from the uploaded file, a hint for AI matching';
comment on column public.documents.recorded_on is 'Recording date from the uploaded file, a hint for AI matching';
