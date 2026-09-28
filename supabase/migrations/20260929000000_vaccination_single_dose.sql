-- The AI's general knowledge of whether this vaccine is normally a single dose (not a
-- prediction about this specific patient) - filled at extraction time, editable on review.
alter table public.vaccinations add column typically_single_dose boolean;
