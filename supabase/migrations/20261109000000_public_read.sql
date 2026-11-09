-- Read-only feeds for the public pages (docs/features/public-read-access).
-- Tables and the storage bucket stay members-only: no RLS or storage policy changes here.
-- Anon (no session) reads exactly what the person, visit and case pages show, through these
-- SECURITY DEFINER functions, one id at a time. Each returns NULL when the id does not exist.
-- Never returned: inbox_*, chat_*, agent_*, members, push_subscriptions, AI extraction
-- internals (extraction_error, raw_ai_json, reviewed_json), or storage_path (except public_file,
-- which is only called server-side to download one visit file).

-- Person page, tabs Tổng quan and Lần khám. Open to-dos are included only when they have a due
-- date (the attention list); the to-do list itself is not part of this feed.
create or replace function public.public_person(p_id uuid)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'id', p.id,
    'full_name', p.full_name,
    'birth_date', p.birth_date,
    'sex', p.sex,
    'blood_type', p.blood_type,
    'allergies', p.allergies,
    'chronic_conditions', p.chronic_conditions,
    'cases', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'id', c.id,
          'person_id', c.person_id,
          'title', c.title,
          'status', c.status,
          'started_on', c.started_on,
          'ended_on', c.ended_on,
          'visits', jsonb_build_array(jsonb_build_object(
            'count', (select count(*) from public.visits v where v.case_id = c.id)))
        ) order by c.started_on desc
      )
      from public.cases c where c.person_id = p.id
    ), '[]'::jsonb),
    'visits', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'id', v.id,
          'person_id', v.person_id,
          'visit_date', v.visit_date,
          'facility', v.facility,
          'reason', v.reason,
          'cases', (select jsonb_build_object('title', c.title) from public.cases c where c.id = v.case_id),
          'documents', jsonb_build_array(jsonb_build_object(
            'count', (select count(*) from public.documents d where d.visit_id = v.id)))
        ) order by v.visit_date desc nulls last
      )
      from public.visits v where v.person_id = p.id
    ), '[]'::jsonb),
    'observations', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'visit_id', o.visit_id,
          'test_code', o.test_code,
          'raw_name', o.raw_name,
          'value', o.value,
          'value_text', o.value_text,
          'unit', o.unit,
          'raw_unit', o.raw_unit,
          'ref_range_text', o.ref_range_text,
          'flag', o.flag,
          'test_catalog', (
            select jsonb_build_object('name_vi', t.name_vi, 'category', t.category)
            from public.test_catalog t where t.code = o.test_code)
        ) order by o.created_at
      )
      from public.observations o
      join public.visits v on v.id = o.visit_id
      where v.person_id = p.id
    ), '[]'::jsonb),
    'latest_summary', (
      select jsonb_build_object('id', s.id, 'content', s.content, 'generated_at', s.generated_at)
      from public.ai_summaries s where s.person_id = p.id
      order by s.generated_at desc limit 1
    ),
    'older_summary_count', greatest((select count(*) from public.ai_summaries s where s.person_id = p.id) - 1, 0),
    -- For the attention list (src/lib/calendar-data.ts): ordered by given_on, undated first.
    'vaccinations', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'id', x.id,
          'person_id', x.person_id,
          'vaccine_name', x.vaccine_name,
          'disease', x.disease,
          'dose_label', x.dose_label,
          'given_on', x.given_on,
          'next_due_on', x.next_due_on
        ) order by x.given_on asc nulls first
      )
      from public.vaccinations x where x.person_id = p.id
    ), '[]'::jsonb),
    -- Open to-dos with a due date only, for the attention list.
    'todos', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'id', a.id,
          'person_id', a.person_id,
          'visit_id', a.visit_id,
          'content', a.content,
          'due_on', a.due_on
        ) order by a.due_on asc nulls last
      )
      from public.action_items a
      where a.person_id = p.id and not a.done and a.due_on is not null
    ), '[]'::jsonb)
  )
  from public.people p
  where p.id = p_id;
$$;

-- Visit page: the visit with its person and case, documents and files (no storage_path),
-- medications, to-dos, results and vaccinations.
create or replace function public.public_visit(p_id uuid)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'id', v.id,
    'person_id', v.person_id,
    'case_id', v.case_id,
    'visit_date', v.visit_date,
    'facility', v.facility,
    'department', v.department,
    'doctor', v.doctor,
    'reason', v.reason,
    'notes', v.notes,
    'people', (select jsonb_build_object('full_name', p.full_name) from public.people p where p.id = v.person_id),
    'cases', (select jsonb_build_object('id', c.id, 'title', c.title) from public.cases c where c.id = v.case_id),
    'documents', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'id', d.id,
          'title', d.title,
          'doc_type', d.doc_type,
          'created_at', d.created_at,
          -- The page only shows the summary of confirmed documents.
          'summary', case when d.extraction_status = 'confirmed' then d.summary end,
          'document_files', coalesce((
            select jsonb_agg(
              jsonb_build_object(
                'id', f.id,
                'page_no', f.page_no,
                'file_name', f.file_name,
                'mime_type', f.mime_type
              ) order by f.page_no
            )
            from public.document_files f where f.document_id = d.id
          ), '[]'::jsonb)
        ) order by d.created_at
      )
      from public.documents d where d.visit_id = v.id
    ), '[]'::jsonb),
    'medications', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'id', m.id,
          'visit_id', m.visit_id,
          'name', m.name,
          'dose', m.dose,
          'schedule', m.schedule,
          'duration_days', m.duration_days,
          'notes', m.notes
        ) order by m.created_at
      )
      from public.medications m where m.visit_id = v.id
    ), '[]'::jsonb),
    'action_items', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'id', a.id,
          'content', a.content,
          'due_on', a.due_on,
          'done', a.done,
          'visit_id', a.visit_id,
          'notes', a.notes
        ) order by a.created_at
      )
      from public.action_items a where a.visit_id = v.id
    ), '[]'::jsonb),
    'observations', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'id', o.id,
          'test_code', o.test_code,
          'raw_name', o.raw_name,
          'value', o.value,
          'value_text', o.value_text,
          'unit', o.unit,
          'raw_value', o.raw_value,
          'raw_unit', o.raw_unit,
          'ref_range_text', o.ref_range_text,
          'flag', o.flag,
          'test_catalog', (
            select jsonb_build_object('name_vi', t.name_vi)
            from public.test_catalog t where t.code = o.test_code)
        ) order by o.created_at
      )
      from public.observations o where o.visit_id = v.id
    ), '[]'::jsonb),
    'vaccinations', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'id', x.id,
          'vaccine_name', x.vaccine_name,
          'disease', x.disease,
          'dose_label', x.dose_label,
          'given_on', x.given_on,
          'next_due_on', x.next_due_on
        ) order by x.given_on asc nulls first
      )
      from public.vaccinations x where x.visit_id = v.id
    ), '[]'::jsonb)
  )
  from public.visits v
  where v.id = p_id;
$$;

-- Case page: the case with its person, its visits, the results measured in those visits,
-- and the open to-dos attached to those visits.
create or replace function public.public_case(p_id uuid)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'id', c.id,
    'person_id', c.person_id,
    'title', c.title,
    'status', c.status,
    'started_on', c.started_on,
    'ended_on', c.ended_on,
    'notes', c.notes,
    'people', (select jsonb_build_object('full_name', p.full_name) from public.people p where p.id = c.person_id),
    'visits', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'id', v.id,
          'visit_date', v.visit_date,
          'facility', v.facility,
          'reason', v.reason,
          'documents', jsonb_build_array(jsonb_build_object(
            'count', (select count(*) from public.documents d where d.visit_id = v.id)))
        ) order by v.visit_date desc nulls last
      )
      from public.visits v where v.case_id = c.id
    ), '[]'::jsonb),
    'observations', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'visit_id', o.visit_id,
          'test_code', o.test_code,
          'raw_name', o.raw_name,
          'value', o.value,
          'value_text', o.value_text,
          'unit', o.unit,
          'raw_unit', o.raw_unit,
          'ref_range_text', o.ref_range_text,
          'flag', o.flag,
          'test_catalog', (
            select jsonb_build_object('name_vi', t.name_vi, 'category', t.category)
            from public.test_catalog t where t.code = o.test_code)
        ) order by o.created_at
      )
      from public.observations o
      join public.visits v on v.id = o.visit_id
      where v.case_id = c.id
    ), '[]'::jsonb),
    'action_items', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'id', a.id,
          'content', a.content,
          'due_on', a.due_on,
          'done', a.done,
          'visit_id', a.visit_id,
          'notes', a.notes
        ) order by a.due_on asc nulls last
      )
      from public.action_items a
      join public.visits v on v.id = a.visit_id
      where v.case_id = c.id and not a.done
    ), '[]'::jsonb)
  )
  from public.cases c
  where c.id = p_id;
$$;

-- One visit file's storage path and type, for the server route that streams it to anon.
-- Only document_files of a document that belongs to a visit; inbox_files are never read.
create or replace function public.public_file(p_id uuid)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object('storage_path', f.storage_path, 'mime_type', f.mime_type)
  from public.document_files f
  join public.documents d on d.id = f.document_id
  where f.id = p_id and d.visit_id is not null;
$$;

revoke all on function public.public_person(uuid) from public;
revoke all on function public.public_visit(uuid) from public;
revoke all on function public.public_case(uuid) from public;
revoke all on function public.public_file(uuid) from public;
grant execute on function public.public_person(uuid) to anon, authenticated;
grant execute on function public.public_visit(uuid) to anon, authenticated;
grant execute on function public.public_case(uuid) to anon, authenticated;
grant execute on function public.public_file(uuid) to anon, authenticated;
