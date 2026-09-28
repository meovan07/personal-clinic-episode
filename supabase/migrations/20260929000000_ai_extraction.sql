-- Phase 2: AI extraction from uploaded documents.

alter table public.documents
  add column summary text,
  add column extracted_at timestamptz,
  add column extraction_error text,
  add column reviewed_json jsonb; -- the user-corrected version of raw_ai_json

-- Keep what was printed on the paper next to the normalized (converted) value.
alter table public.observations
  add column raw_value text,
  add column raw_unit text;

-- Remember which document produced a row, so re-reviewing a document replaces its rows.
alter table public.medications
  add column document_id uuid references public.documents on delete cascade;
alter table public.action_items
  add column document_id uuid references public.documents on delete cascade;
create index on public.medications (document_id);
create index on public.action_items (document_id);
create index on public.observations (document_id);

-- Factor to multiply a value in `from_unit` by to get `standard_unit`.
create table public.unit_conversions (
  test_code text not null references public.test_catalog on delete cascade,
  from_unit text not null,
  factor numeric not null,
  primary key (test_code, from_unit)
);
alter table public.unit_conversions enable row level security;
create policy "members only" on public.unit_conversions
  for all to authenticated using ((select private.is_member())) with check ((select private.is_member()));

insert into public.test_catalog (code, name_vi, aliases, standard_unit, category) values
  -- Đường huyết
  ('GLUCOSE', 'Glucose (đường huyết)', '{glucose,glu,"đường huyết","đường máu","glucose máu","glucose đói","đường huyết lúc đói"}', 'mmol/L', 'Đường huyết'),
  ('HBA1C', 'HbA1c', '{hba1c,"a1c","hemoglobin a1c","hb a1c"}', '%', 'Đường huyết'),
  -- Mỡ máu
  ('CHOL', 'Cholesterol toàn phần', '{cholesterol,chol,"cholesterol toàn phần","total cholesterol","cholesterol tp"}', 'mmol/L', 'Mỡ máu'),
  ('TG', 'Triglycerid', '{triglycerid,triglyceride,triglycerides,tg}', 'mmol/L', 'Mỡ máu'),
  ('HDL', 'HDL-Cholesterol', '{hdl,"hdl-c","hdl-cholesterol","hdl cholesterol"}', 'mmol/L', 'Mỡ máu'),
  ('LDL', 'LDL-Cholesterol', '{ldl,"ldl-c","ldl-cholesterol","ldl cholesterol"}', 'mmol/L', 'Mỡ máu'),
  -- Gan
  ('AST', 'AST (GOT)', '{ast,got,sgot,"ast (got)","ast/got"}', 'U/L', 'Chức năng gan'),
  ('ALT', 'ALT (GPT)', '{alt,gpt,sgpt,"alt (gpt)","alt/gpt"}', 'U/L', 'Chức năng gan'),
  ('GGT', 'GGT', '{ggt,"gamma gt","γ-gt","gamma-gt"}', 'U/L', 'Chức năng gan'),
  ('BILI_T', 'Bilirubin toàn phần', '{"bilirubin toàn phần","bilirubin tp","total bilirubin","bil-t","t-bil"}', 'µmol/L', 'Chức năng gan'),
  ('BILI_D', 'Bilirubin trực tiếp', '{"bilirubin trực tiếp","direct bilirubin","bil-d","d-bil"}', 'µmol/L', 'Chức năng gan'),
  ('ALB', 'Albumin', '{albumin,alb}', 'g/L', 'Chức năng gan'),
  ('PROT', 'Protein toàn phần', '{"protein toàn phần","total protein",protein}', 'g/L', 'Chức năng gan'),
  -- Thận
  ('UREA', 'Urê', '{urê,ure,urea}', 'mmol/L', 'Chức năng thận'),
  ('CREA', 'Creatinin', '{creatinin,creatinine,crea,cre}', 'µmol/L', 'Chức năng thận'),
  ('EGFR', 'eGFR', '{egfr,"mức lọc cầu thận","độ lọc cầu thận"}', 'mL/min/1.73m²', 'Chức năng thận'),
  ('URIC', 'Acid uric', '{"acid uric","axit uric","uric acid",ua}', 'µmol/L', 'Chức năng thận'),
  -- Điện giải
  ('NA', 'Natri (Na+)', '{natri,na,"na+",sodium}', 'mmol/L', 'Điện giải'),
  ('K', 'Kali (K+)', '{kali,k,"k+",potassium}', 'mmol/L', 'Điện giải'),
  ('CL', 'Clo (Cl-)', '{clo,cl,"cl-",chloride}', 'mmol/L', 'Điện giải'),
  ('CA', 'Canxi toàn phần', '{canxi,calci,ca,calcium,"canxi toàn phần"}', 'mmol/L', 'Điện giải'),
  -- Công thức máu
  ('WBC', 'Bạch cầu (WBC)', '{wbc,"bạch cầu","số lượng bạch cầu"}', 'G/L', 'Công thức máu'),
  ('RBC', 'Hồng cầu (RBC)', '{rbc,"hồng cầu","số lượng hồng cầu"}', 'T/L', 'Công thức máu'),
  ('HGB', 'Huyết sắc tố (HGB)', '{hgb,hb,"huyết sắc tố",hemoglobin}', 'g/L', 'Công thức máu'),
  ('HCT', 'Hematocrit (HCT)', '{hct,hematocrit}', '%', 'Công thức máu'),
  ('MCV', 'MCV', '{mcv,"thể tích trung bình hồng cầu"}', 'fL', 'Công thức máu'),
  ('MCH', 'MCH', '{mch,"lượng hst trung bình hồng cầu"}', 'pg', 'Công thức máu'),
  ('MCHC', 'MCHC', '{mchc,"nồng độ hst trung bình hồng cầu"}', 'g/L', 'Công thức máu'),
  ('PLT', 'Tiểu cầu (PLT)', '{plt,"tiểu cầu","số lượng tiểu cầu"}', 'G/L', 'Công thức máu'),
  ('NEUT_PCT', 'Bạch cầu trung tính %', '{"neu%","neut%","trung tính %","bạch cầu trung tính %"}', '%', 'Công thức máu'),
  ('LYMPH_PCT', 'Bạch cầu lympho %', '{"lym%","lymph%","lympho %","bạch cầu lympho %"}', '%', 'Công thức máu'),
  -- Tuyến giáp
  ('TSH', 'TSH', '{tsh}', 'mIU/L', 'Tuyến giáp'),
  ('FT4', 'FT4', '{ft4,"free t4","t4 tự do"}', 'pmol/L', 'Tuyến giáp'),
  ('FT3', 'FT3', '{ft3,"free t3","t3 tự do"}', 'pmol/L', 'Tuyến giáp'),
  -- Khác
  ('CRP', 'CRP', '{crp,"crp định lượng","hs-crp","c-reactive protein"}', 'mg/L', 'Viêm'),
  ('FERRITIN', 'Ferritin', '{ferritin}', 'ng/mL', 'Sắt'),
  ('IRON', 'Sắt huyết thanh', '{"sắt huyết thanh",fe,iron,"sắt"}', 'µmol/L', 'Sắt'),
  ('VITD', 'Vitamin D (25-OH)', '{"vitamin d","25-oh vitamin d","25(oh)d","vit d"}', 'ng/mL', 'Vitamin'),
  ('VITB12', 'Vitamin B12', '{"vitamin b12","vit b12",b12}', 'pg/mL', 'Vitamin'),
  ('HBSAG', 'HBsAg (viêm gan B)', '{hbsag,"hbsag test nhanh","hbsag định tính"}', null, 'Miễn dịch'),
  ('ANTI_HCV', 'Anti-HCV (viêm gan C)', '{"anti-hcv","anti hcv","hcv ab"}', null, 'Miễn dịch'),
  ('HP', 'H. pylori', '{"h. pylori","h.pylori","helicobacter pylori","hp test",ure-test,"test hơi thở"}', null, 'Tiêu hóa'),
  -- Chỉ số cơ thể
  ('WEIGHT', 'Cân nặng', '{"cân nặng",weight}', 'kg', 'Chỉ số cơ thể'),
  ('HEIGHT', 'Chiều cao', '{"chiều cao",height}', 'cm', 'Chỉ số cơ thể'),
  ('BMI', 'BMI', '{bmi,"chỉ số khối cơ thể"}', 'kg/m²', 'Chỉ số cơ thể'),
  ('BP_SYS', 'Huyết áp tâm thu', '{"huyết áp tâm thu","ha tâm thu",systolic}', 'mmHg', 'Chỉ số cơ thể'),
  ('BP_DIA', 'Huyết áp tâm trương', '{"huyết áp tâm trương","ha tâm trương",diastolic}', 'mmHg', 'Chỉ số cơ thể'),
  ('PULSE', 'Mạch', '{mạch,pulse,"nhịp tim","heart rate"}', 'lần/phút', 'Chỉ số cơ thể')
on conflict (code) do nothing;

-- Common conversions between the units Vietnamese labs print (mg/dL is common at private labs).
insert into public.unit_conversions (test_code, from_unit, factor) values
  ('GLUCOSE', 'mg/dL', 0.0555),
  ('CHOL', 'mg/dL', 0.02586),
  ('HDL', 'mg/dL', 0.02586),
  ('LDL', 'mg/dL', 0.02586),
  ('TG', 'mg/dL', 0.01129),
  ('CREA', 'mg/dL', 88.4),
  ('URIC', 'mg/dL', 59.48),
  ('UREA', 'mg/dL', 0.1665),
  ('BILI_T', 'mg/dL', 17.1),
  ('BILI_D', 'mg/dL', 17.1),
  ('ALB', 'g/dL', 10),
  ('PROT', 'g/dL', 10),
  ('HGB', 'g/dL', 10),
  ('MCHC', 'g/dL', 10),
  ('CA', 'mg/dL', 0.2495),
  ('CRP', 'mg/dL', 10),
  ('WBC', '10^9/L', 1),
  ('WBC', 'K/µL', 1),
  ('WBC', 'K/uL', 1),
  ('PLT', '10^9/L', 1),
  ('PLT', 'K/µL', 1),
  ('PLT', 'K/uL', 1),
  ('RBC', '10^12/L', 1),
  ('RBC', 'M/µL', 1),
  ('RBC', 'M/uL', 1),
  ('VITD', 'nmol/L', 0.4006),
  ('IRON', 'µg/dL', 0.179),
  ('IRON', 'ug/dL', 0.179)
on conflict do nothing;
