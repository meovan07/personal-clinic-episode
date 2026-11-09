-- Rollback for 20261109020000_recording_date.sql (never applied by the CLI).
-- Safe to drop: recorded_on is only a hint for AI matching; the confirmed date lives on the visit.
alter table public.inbox_items drop column recorded_on;
alter table public.documents drop column recorded_on;
