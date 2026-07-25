-- 020: Seed verified public-domain Cicero quote (idempotent)
-- Embedding is optional; list fallback works without vector match.

insert into public.quote_library (
  quote_text_ko,
  original_text,
  author_name,
  work_title,
  publication_info,
  source_type,
  translator,
  language,
  themes_json,
  emotional_tone_json,
  suitable_states_json,
  unsuitable_states_json,
  rights_status,
  verification_status,
  attribution_confidence,
  active,
  reviewed_by,
  reviewed_at
)
select
  '삶이 있는 한 희망은 있다',
  'Dum spiro, spero',
  '키케로',
  '전통 귀속 격언',
  'Public domain Latin proverb traditionally attributed to Cicero; Korean app seed',
  'public_domain_tradition',
  'app_internal_ko',
  'ko',
  '["희망","회복","안정"]'::jsonb,
  '["차분","인정"]'::jsonb,
  '["지침","불안","슬픔"]'::jsonb,
  '[]'::jsonb,
  'public_domain',
  'reputable_secondary_verified',
  0.7,
  true,
  'migration-020',
  now()
where not exists (
  select 1 from public.quote_library q
  where q.quote_text_ko = '삶이 있는 한 희망은 있다'
    and q.author_name = '키케로'
);

-- Repair mojibake / incomplete prior seed rows
update public.quote_library
set
  quote_text_ko = '삶이 있는 한 희망은 있다',
  original_text = 'Dum spiro, spero',
  author_name = '키케로',
  work_title = '전통 귀속 격언',
  publication_info = 'Public domain Latin proverb traditionally attributed to Cicero; Korean app seed',
  rights_status = 'public_domain',
  verification_status = 'reputable_secondary_verified',
  attribution_confidence = 0.7,
  active = true,
  themes_json = '["희망","회복","안정"]'::jsonb,
  emotional_tone_json = '["차분","인정"]'::jsonb,
  suitable_states_json = '["지침","불안","슬픔"]'::jsonb,
  unsuitable_states_json = '[]'::jsonb,
  updated_at = now()
where author_name = '키케로'
   or quote_text_ko like '%희망%'
   or id = '5c2b8243-e552-4feb-b8d6-fb73758c3704';
