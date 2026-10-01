-- Phase 7: search across everything, ignoring Vietnamese diacritics ("duong huyet" finds "Đường huyết").

create extension if not exists unaccent with schema extensions;

-- Lowercase and strip diacritics. đ/Đ are separate letters (not accented d), so map them explicitly.
create or replace function private.normalize_text(t text)
returns text
language sql
immutable
parallel safe
set search_path = ''
as $$
  select lower(translate(extensions.unaccent('extensions.unaccent'::regdictionary, coalesce(t, '')), 'đĐ', 'dD'));
$$;
revoke execute on function private.normalize_text(text) from public, anon;
grant execute on function private.normalize_text(text) to authenticated;

-- Every word of `q` must appear somewhere in the row's searchable text.
-- SECURITY INVOKER (the default): row-level security still decides what the caller can see.
create or replace function public.search_records(q text)
returns table (
  kind text,
  id uuid,
  person_id uuid,
  person_name text,
  visit_id uuid,
  title text,
  detail text,
  tag text,        -- doc_type for documents, flag for observations, case status for cases
  happened_on date
)
language sql
stable
set search_path = ''
as $$
  with terms as (
    select coalesce(
      array_agg('%' || replace(replace(replace(t, '\', '\\'), '%', '\%'), '_', '\_') || '%'),
      '{}'
    ) as patterns
    from unnest(regexp_split_to_array(private.normalize_text(trim(q)), '\s+')) as t
    where t <> ''
  ),
  hits as (
    select 'person' as kind, p.id, p.id as person_id, p.full_name as person_name, null::uuid as visit_id,
           p.full_name as title, concat_ws(' · ', p.allergies, p.chronic_conditions) as detail, null as tag,
           null::date as happened_on,
           concat_ws(' ', p.full_name, p.allergies, p.chronic_conditions, p.notes) as haystack
    from public.people p

    union all
    select 'case', c.id, c.person_id, p.full_name, null, c.title, c.notes, c.status, c.started_on,
           concat_ws(' ', c.title, c.notes)
    from public.cases c join public.people p on p.id = c.person_id

    union all
    select 'visit', v.id, v.person_id, p.full_name, v.id, v.facility, concat_ws(' · ', v.department, v.doctor, v.reason),
           null, v.visit_date,
           concat_ws(' ', v.facility, v.department, v.doctor, v.reason, v.notes)
    from public.visits v join public.people p on p.id = v.person_id

    union all
    select 'document', d.id, v.person_id, p.full_name, v.id, d.title, d.summary, d.doc_type, v.visit_date,
           concat_ws(' ', d.title, d.summary)
    from public.documents d
    join public.visits v on v.id = d.visit_id
    join public.people p on p.id = v.person_id

    union all
    select 'observation', o.id, v.person_id, p.full_name, v.id, coalesce(tc.name_vi, o.raw_name),
           concat_ws(' ', coalesce(o.value::text, o.value_text), o.unit), o.flag, v.visit_date,
           concat_ws(' ', o.raw_name, tc.name_vi, tc.code, array_to_string(tc.aliases, ' '))
    from public.observations o
    join public.visits v on v.id = o.visit_id
    join public.people p on p.id = v.person_id
    left join public.test_catalog tc on tc.code = o.test_code

    union all
    select 'medication', m.id, v.person_id, p.full_name, v.id, m.name, concat_ws(' · ', m.dose, m.schedule), null,
           v.visit_date,
           concat_ws(' ', m.name, m.schedule, m.notes)
    from public.medications m
    join public.visits v on v.id = m.visit_id
    join public.people p on p.id = v.person_id

    union all
    select 'action_item', a.id, a.person_id, p.full_name, a.visit_id, a.content, a.notes,
           case when a.done then 'done' end, a.due_on,
           concat_ws(' ', a.content, a.notes)
    from public.action_items a join public.people p on p.id = a.person_id

    union all
    select 'vaccination', x.id, x.person_id, p.full_name, x.visit_id, x.vaccine_name,
           concat_ws(' · ', x.disease, x.dose_label, x.facility), null, x.given_on,
           concat_ws(' ', x.vaccine_name, x.disease, x.dose_label, x.facility, x.notes)
    from public.vaccinations x join public.people p on p.id = x.person_id
  )
  select h.kind, h.id, h.person_id, h.person_name, h.visit_id, h.title, h.detail, h.tag, h.happened_on
  from hits h, terms
  where cardinality(terms.patterns) > 0
    and private.normalize_text(h.haystack) like all (terms.patterns)
  order by h.happened_on desc nulls last
  limit 200;
$$;
revoke execute on function public.search_records(text) from public, anon;
grant execute on function public.search_records(text) to authenticated;
