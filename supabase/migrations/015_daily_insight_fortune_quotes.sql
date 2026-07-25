-- Daily insight context + fortune persistence + content exposure (additive)
-- Quote library schema stub (2A: 등록 전엔 오늘의 문장만 사용)

-- 공통 컨텍스트 (체크인 전, 어제까지 데이터만)
create table if not exists public.daily_insight_contexts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  event_date date not null,
  timezone text not null default 'Asia/Seoul',
  data_cutoff_at timestamptz not null,
  context_json jsonb not null default '{}'::jsonb,
  confidence_json jsonb not null default '{}'::jsonb,
  engine_version text not null default 'insight-v1',
  created_at timestamptz not null default now(),
  unique (user_id, event_date)
);

create index if not exists daily_insight_contexts_user_date_idx
  on public.daily_insight_contexts (user_id, event_date desc);

-- 오늘의 운세
create table if not exists public.daily_fortunes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  event_date date not null,
  context_id uuid references public.daily_insight_contexts(id) on delete set null,
  overall_headline text not null default '',
  overall_summary text not null default '',
  overall_confidence double precision,
  scoring_version text not null default 'fortune-score-v1',
  prompt_version text,
  model_version text,
  data_cutoff_at timestamptz,
  generated_at timestamptz not null default now(),
  unique (user_id, event_date)
);

create index if not exists daily_fortunes_user_date_idx
  on public.daily_fortunes (user_id, event_date desc);

create table if not exists public.daily_fortune_sections (
  id uuid primary key default gen_random_uuid(),
  daily_fortune_id uuid not null references public.daily_fortunes(id) on delete cascade,
  domain_code text not null,
  headline text not null default '',
  summary text not null default '',
  opportunity text,
  caution text,
  action text,
  score double precision,
  confidence double precision,
  evidence_json jsonb not null default '[]'::jsonb,
  display_order integer not null default 0,
  unique (daily_fortune_id, domain_code)
);

-- 검증 명언 라이브러리 (시드 없이 스키마만 — 2A)
create table if not exists public.quote_library (
  id uuid primary key default gen_random_uuid(),
  quote_text_ko text not null,
  original_text text,
  author_name text,
  work_title text,
  publication_info text,
  source_url text,
  source_type text,
  translator text,
  language text not null default 'ko',
  themes_json jsonb not null default '[]'::jsonb,
  emotional_tone_json jsonb not null default '[]'::jsonb,
  suitable_states_json jsonb not null default '[]'::jsonb,
  unsuitable_states_json jsonb not null default '[]'::jsonb,
  rights_status text not null default 'review_required',
  verification_status text not null default 'unverified',
  attribution_confidence double precision not null default 0,
  reviewed_by text,
  reviewed_at timestamptz,
  active boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint quote_library_rights_check
    check (rights_status in (
      'public_domain', 'licensed', 'permission_granted',
      'internally_written', 'review_required', 'prohibited'
    )),
  constraint quote_library_verification_check
    check (verification_status in (
      'primary_source_verified', 'reputable_secondary_verified',
      'translation_verified', 'unverified', 'rejected'
    ))
);

create table if not exists public.daily_quote_deliveries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  event_date date not null,
  journal_entry_id uuid references public.journal_entries(id) on delete set null,
  quote_id uuid references public.quote_library(id) on delete set null,
  generated_original_text text,
  content_type text not null,
  selection_score double precision,
  selection_reasons_json jsonb not null default '{}'::jsonb,
  model_version text,
  delivered_at timestamptz not null default now(),
  constraint daily_quote_deliveries_type_check
    check (content_type in (
      'verified_quote', 'app_original_sentence', 'fallback_sentence'
    ))
);

create index if not exists daily_quote_deliveries_user_date_idx
  on public.daily_quote_deliveries (user_id, event_date desc);

-- 콘텐츠 노출 이벤트
create table if not exists public.content_exposure_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  event_date date not null,
  content_type text not null,
  content_id text,
  event_type text not null,
  occurred_at timestamptz not null default now(),
  metadata_json jsonb not null default '{}'::jsonb
);

create index if not exists content_exposure_events_user_date_idx
  on public.content_exposure_events (user_id, event_date desc, occurred_at desc);

-- 콘텐츠 피드백 (질문 외 운세·명언)
create table if not exists public.content_feedback (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  event_date date not null,
  content_type text not null,
  content_id text,
  rating text,
  saved boolean not null default false,
  shared boolean not null default false,
  reopened boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists content_feedback_user_date_idx
  on public.content_feedback (user_id, event_date desc);

alter table public.daily_insight_contexts enable row level security;
alter table public.daily_fortunes enable row level security;
alter table public.daily_fortune_sections enable row level security;
alter table public.quote_library enable row level security;
alter table public.daily_quote_deliveries enable row level security;
alter table public.content_exposure_events enable row level security;
alter table public.content_feedback enable row level security;

drop policy if exists "Users own daily_insight_contexts" on public.daily_insight_contexts;
create policy "Users own daily_insight_contexts"
  on public.daily_insight_contexts for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "Users own daily_fortunes" on public.daily_fortunes;
create policy "Users own daily_fortunes"
  on public.daily_fortunes for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "Users own daily_fortune_sections" on public.daily_fortune_sections;
create policy "Users own daily_fortune_sections"
  on public.daily_fortune_sections for all
  using (
    exists (
      select 1 from public.daily_fortunes f
      where f.id = daily_fortune_id and f.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.daily_fortunes f
      where f.id = daily_fortune_id and f.user_id = auth.uid()
    )
  );

-- 명언 라이브러리: 검증·권리 확인·활성 상태인 행만 인증 사용자에게 노출
drop policy if exists "Authenticated read quote_library" on public.quote_library;
create policy "Authenticated read quote_library"
  on public.quote_library for select
  using (
    auth.role() = 'authenticated'
    and active = true
    and verification_status in (
      'primary_source_verified',
      'reputable_secondary_verified',
      'translation_verified'
    )
    and rights_status in (
      'public_domain',
      'licensed',
      'permission_granted',
      'internally_written'
    )
  );

drop policy if exists "Users own daily_quote_deliveries" on public.daily_quote_deliveries;
create policy "Users own daily_quote_deliveries"
  on public.daily_quote_deliveries for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "Users own content_exposure_events" on public.content_exposure_events;
create policy "Users own content_exposure_events"
  on public.content_exposure_events for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "Users own content_feedback" on public.content_feedback;
create policy "Users own content_feedback"
  on public.content_feedback for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);
