-- Search for non-medical users:
-- 1. Everyday Vietnamese words per test ("mỡ máu" finds LDL, "men gan" finds ALT), kept apart from
--    `aliases` because aliases are used to match printed test names during extraction.
-- 2. Typo tolerance: when the exact search finds nothing, fall back to trigram word similarity
--    ("cholestrol", "duong huyt", "medlab") and flag those rows as approximate.

create extension if not exists pg_trgm with schema extensions;

alter table public.test_catalog add column search_terms text[] not null default '{}';

-- Written without diacritics: they are only ever compared against normalized text.
update public.test_catalog t set search_terms = v.terms
from (values
  ('GLUCOSE',   '{tieu duong,dai thao duong,duong mau,duong trong mau}'::text[]),
  ('HBA1C',     '{tieu duong,dai thao duong,duong mau,duong huyet trung binh 3 thang}'),
  ('CHOL',      '{mo mau,mau nhiem mo,lipid,tim mach}'),
  ('TG',        '{mo mau,mau nhiem mo,lipid,tim mach}'),
  ('HDL',       '{mo mau,mo tot,lipid,tim mach}'),
  ('LDL',       '{mo mau,mo xau,lipid,tim mach}'),
  ('AST',       '{men gan,gan nhiem mo,viem gan,gan}'),
  ('ALT',       '{men gan,gan nhiem mo,viem gan,gan}'),
  ('GGT',       '{men gan,gan nhiem mo,ruou bia,gan}'),
  ('BILI_T',    '{vang da,mat,gan}'),
  ('BILI_D',    '{vang da,mat,gan}'),
  ('ALB',       '{dam,dinh duong,gan}'),
  ('PROT',      '{dam,dinh duong}'),
  ('UREA',      '{than,suy than}'),
  ('CREA',      '{than,suy than}'),
  ('EGFR',      '{than,suy than,loc than}'),
  ('URIC',      '{gout,gut,thong phong,dau khop}'),
  ('NA',        '{dien giai,muoi}'),
  ('K',         '{dien giai}'),
  ('CL',        '{dien giai}'),
  ('CA',        '{dien giai,xuong,loang xuong}'),
  ('WBC',       '{nhiem trung,viem,mien dich}'),
  ('RBC',       '{thieu mau,mau}'),
  ('HGB',       '{thieu mau,mau}'),
  ('HCT',       '{thieu mau,mau}'),
  ('MCV',       '{thieu mau,mau}'),
  ('MCH',       '{thieu mau,mau}'),
  ('MCHC',      '{thieu mau,mau}'),
  ('PLT',       '{dong mau,chay mau,sot xuat huyet}'),
  ('NEUT_PCT',  '{nhiem trung,nhiem khuan,viem}'),
  ('LYMPH_PCT', '{nhiem trung,virus,viem}'),
  ('TSH',       '{tuyen giap,cuong giap,suy giap,buou co}'),
  ('FT4',       '{tuyen giap,cuong giap,suy giap,buou co}'),
  ('FT3',       '{tuyen giap,cuong giap,suy giap,buou co}'),
  ('CRP',       '{viem,nhiem trung}'),
  ('FERRITIN',  '{thieu sat,thieu mau,sat}'),
  ('IRON',      '{thieu sat,thieu mau}'),
  ('VITD',      '{xuong,canxi,loang xuong}'),
  ('VITB12',    '{thieu mau,than kinh}'),
  ('HBSAG',     '{viem gan b,gan}'),
  ('ANTI_HCV',  '{viem gan c,gan}'),
  ('HP',        '{da day,vi khuan hp,loet da day,dau bung}'),
  ('WEIGHT',    '{beo phi,thua can,giam can}'),
  ('HEIGHT',    '{}'),
  ('BMI',       '{beo phi,thua can,giam can,can nang}'),
  ('BP_SYS',    '{huyet ap,cao huyet ap,tang huyet ap,tim mach}'),
  ('BP_DIA',    '{huyet ap,cao huyet ap,tang huyet ap,tim mach}'),
  ('PULSE',     '{nhip tim,tim}')
) as v(code, terms)
where t.code = v.code;

-- The return type gains `approximate`, so the function must be dropped and recreated.
drop function public.search_records(text);

create function public.search_records(q text)
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
  with terms as (
    select
      coalesce(array_agg(t), '{}') as words,
      coalesce(array_agg('%' || replace(replace(replace(t, '\', '\\'), '%', '\%'), '_', '\_') || '%'), '{}') as patterns
    from unnest(regexp_split_to_array(private.normalize_text(trim(q)), '\s+')) as t
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
    select r.*, private.normalize_text(r.haystack) as norm from rows r
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
revoke execute on function public.search_records(text) from public, anon;
grant execute on function public.search_records(text) to authenticated;
