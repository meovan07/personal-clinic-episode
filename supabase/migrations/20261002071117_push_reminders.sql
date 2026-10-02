-- Web Push reminders.
-- Each browser/phone where a member turns notifications on stores its push subscription here.
-- A daily Vercel Cron job (signed out, no Supabase admin key) reads what it needs through
-- public.reminder_feed(), which only answers to a token whose SHA-256 hash is in private.cron_tokens.

create table public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  user_agent text,
  created_at timestamptz not null default now()
);
create index on public.push_subscriptions (user_id);

alter table public.push_subscriptions enable row level security;

-- Each member manages only their own devices.
create policy "own subscriptions" on public.push_subscriptions
  for all to authenticated
  using ((select private.is_member()) and user_id = (select auth.uid()))
  with check ((select private.is_member()) and user_id = (select auth.uid()));

-- Hashes of tokens allowed to call the feed functions below. The token itself lives only in Vercel's
-- environment (CRON_SECRET); its hash is inserted outside of migrations so it isn't in git.
create table private.cron_tokens (
  name text primary key,
  token_sha256 text not null
);
-- Not reachable through the API (private schema), and locked down anyway: only the functions below,
-- running as the table owner, read it.
alter table private.cron_tokens enable row level security;

create function private.valid_cron_token(p_token text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from private.cron_tokens
    where token_sha256 = encode(extensions.digest(coalesce(p_token, ''), 'sha256'), 'hex')
  );
$$;

-- Everything the daily reminder job needs, and nothing more: devices to notify, names, open to-dos
-- with a due date, and vaccination doses (to work out which next dose is still pending).
create function public.reminder_feed(p_token text)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not private.valid_cron_token(p_token) then
    raise exception 'invalid token' using errcode = '42501';
  end if;
  return jsonb_build_object(
    'subscriptions', coalesce((
      select jsonb_agg(jsonb_build_object('endpoint', s.endpoint, 'p256dh', s.p256dh, 'auth', s.auth))
      from public.push_subscriptions s
      where exists (select 1 from public.members m where m.user_id = s.user_id)
    ), '[]'::jsonb),
    'todos', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', a.id, 'content', a.content, 'due_on', a.due_on, 'visit_id', a.visit_id,
        'person_id', a.person_id, 'people', jsonb_build_object('full_name', p.full_name)))
      from public.action_items a join public.people p on p.id = a.person_id
      where not a.done and a.due_on is not null
    ), '[]'::jsonb),
    'vaccinations', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', v.id, 'vaccine_name', v.vaccine_name, 'disease', v.disease, 'dose_label', v.dose_label,
        'given_on', v.given_on, 'next_due_on', v.next_due_on, 'person_id', v.person_id,
        'people', jsonb_build_object('full_name', p.full_name))
        order by v.given_on nulls first)
      from public.vaccinations v join public.people p on p.id = v.person_id
    ), '[]'::jsonb)
  );
end;
$$;

-- Removes a subscription the push service reported as gone (the user revoked permission or reinstalled).
create function public.forget_push_subscription(p_token text, p_endpoint text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not private.valid_cron_token(p_token) then
    raise exception 'invalid token' using errcode = '42501';
  end if;
  delete from public.push_subscriptions where endpoint = p_endpoint;
end;
$$;

revoke all on function private.valid_cron_token(text) from public, anon, authenticated;
revoke all on function public.reminder_feed(text) from public, authenticated;
revoke all on function public.forget_push_subscription(text, text) from public, authenticated;
grant execute on function public.reminder_feed(text) to anon;
grant execute on function public.forget_push_subscription(text, text) to anon;
