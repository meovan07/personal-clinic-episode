-- Free-text context the user adds themselves, e.g. clarifying who "chồng" is or which test,
-- separate from the short AI-polished `content` line.
alter table public.action_items add column notes text;
