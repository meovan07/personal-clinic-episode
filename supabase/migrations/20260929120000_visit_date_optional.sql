-- The date of a visit isn't always known upfront: you might upload a document
-- before filling in the form, and let AI extraction supply the date from the
-- document itself (same as it already backfills facility/department/doctor).
alter table public.visits alter column visit_date drop not null;
