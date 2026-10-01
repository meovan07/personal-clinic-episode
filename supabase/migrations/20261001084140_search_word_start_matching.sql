-- Search: match each typed word at the start of a word, not anywhere inside one
-- ("mo mau" must not find "hemoglobin" because of "he-mo-globin").

create or replace function public.search_records(q text)
returns table (
  kind text,
  id uuid,
  person_id uuid,
  person_name text,
  visit_id uuid,
  title text,
  detail text,
  tag text,           -- doc_type for documents, flag for observations, case status for cases
  happened_on date,
  approximate boolean -- true when found by typo-tolerant matching rather than exact words
)
language sql
stable
set search_path = ''
as $$
  -- Punctuation becomes spaces on both sides, so "(GPT)" or "LDL-C" split into plain words and the
  -- patterns below never contain LIKE wildcards.
  with terms as (
    select
      coalesce(array_agg(t), '{}') as words,
      coalesce(array_agg('% ' || t || '%'), '{}') as patterns  -- each word must start a word in the row
    from unnest(regexp_split_to_array(regexp_replace(private.normalize_text(q), '[^a-z0-9]+', ' ', 'g'), ' ')) as t
    where t <> ''
  ),
  rows as (
    select 'person' as kind, p.id, p.id as person_id, p.full_name as person_name, null::uuid as visit_id,
           p.full_name as title, concat_ws(' · ', p.allergies, p.chronic_conditions) as detail, null as tag,
           null::date as happened_on,
           concat_ws(' ', p.full_name, p.allergies, p.chronic_conditions, p.notes) as haystack
    from public.people p

    union all
    select 'case', c.id, c.person_id, p.full_name, null, c.title, c.notes, c.status, c.started_on,
           concat_ws(' ', c.title, c.notes, 'benh an',
                     case c.status when 'dang_dieu_tri' then 'dang dieu tri' when 'theo_doi' then 'theo doi'
                                   when 'da_khoi' then 'da khoi' end)
    from public.cases c join public.people p on p.id = c.person_id

    union all
    select 'visit', v.id, v.person_id, p.full_name, v.id, v.facility, concat_ws(' · ', v.department, v.doctor, v.reason),
           null, v.visit_date,
           concat_ws(' ', v.facility, v.department, v.doctor, v.reason, v.notes, 'lan kham')
    from public.visits v join public.people p on p.id = v.person_id

    union all
    select 'document', d.id, v.person_id, p.full_name, v.id, d.title, d.summary, d.doc_type, v.visit_date,
           concat_ws(' ', d.title, d.summary,
                     case d.doc_type
                       when 'lab_result' then 'ket qua xet nghiem'
                       when 'imaging_report' then 'chan doan hinh anh sieu am x-quang ct mri'
                       when 'prescription' then 'don thuoc'
                       when 'discharge_summary' then 'giay ra vien tom tat'
                       when 'visit_note' then 'phieu kham'
                       when 'vaccination_record' then 'tiem chung vac xin vaccine'
                       when 'invoice' then 'hoa don'
                     end)
    from public.documents d
    join public.visits v on v.id = d.visit_id
    join public.people p on p.id = v.person_id

    union all
    select 'observation', o.id, v.person_id, p.full_name, v.id, coalesce(tc.name_vi, o.raw_name),
           concat_ws(' ', coalesce(o.value::text, o.value_text), o.unit), o.flag, v.visit_date,
           concat_ws(' ', o.raw_name, tc.name_vi, tc.code, array_to_string(tc.aliases, ' '), tc.category,
                     array_to_string(tc.search_terms, ' '), 'xet nghiem chi so',
                     case o.flag when 'high' then 'cao bat thuong' when 'low' then 'thap bat thuong'
                                 when 'abnormal' then 'bat thuong' end)
    from public.observations o
    join public.visits v on v.id = o.visit_id
    join public.people p on p.id = v.person_id
    left join public.test_catalog tc on tc.code = o.test_code

    union all
    select 'medication', m.id, v.person_id, p.full_name, v.id, m.name, concat_ws(' · ', m.dose, m.schedule), null,
           v.visit_date,
           concat_ws(' ', m.name, m.schedule, m.notes, 'thuoc')
    from public.medications m
    join public.visits v on v.id = m.visit_id
    join public.people p on p.id = v.person_id

    union all
    select 'action_item', a.id, a.person_id, p.full_name, a.visit_id, a.content, a.notes,
           case when a.done then 'done' end, a.due_on,
           concat_ws(' ', a.content, a.notes, 'viec can lam', case when a.done then 'da xong' else 'chua xong' end)
    from public.action_items a join public.people p on p.id = a.person_id

    union all
    select 'vaccination', x.id, x.person_id, p.full_name, x.visit_id, x.vaccine_name,
           concat_ws(' · ', x.disease, x.dose_label, x.facility), null, x.given_on,
           concat_ws(' ', x.vaccine_name, x.disease, x.dose_label, x.facility, x.notes, 'tiem chung vac xin vaccine')
    from public.vaccinations x join public.people p on p.id = x.person_id
  ),
  normalized as (
    select r.*, ' ' || regexp_replace(private.normalize_text(r.haystack), '[^a-z0-9]+', ' ', 'g') || ' ' as norm
    from rows r
  ),
  exact as (
    select n.* from normalized n, terms
    where cardinality(terms.patterns) > 0 and n.norm like all (terms.patterns)
  ),
  -- Only when nothing matched exactly: every word must be similar to some word in the row.
  fuzzy as (
    select n.*, s.score from normalized n, terms,
      lateral (
        select min(extensions.word_similarity(w, n.norm)) as score from unnest(terms.words) as w
      ) s
    where cardinality(terms.words) > 0
      and not exists (select 1 from exact)
      and s.score >= 0.5
  )
  select kind, id, person_id, person_name, visit_id, title, detail, tag, happened_on, approximate
  from (
    select e.kind, e.id, e.person_id, e.person_name, e.visit_id, e.title, e.detail, e.tag, e.happened_on,
           false as approximate, 1.0::real as score
    from exact e
    union all
    select f.kind, f.id, f.person_id, f.person_name, f.visit_id, f.title, f.detail, f.tag, f.happened_on,
           true, f.score
    from fuzzy f
  ) results
  order by score desc, happened_on desc nulls last
  limit 200;
$$;
