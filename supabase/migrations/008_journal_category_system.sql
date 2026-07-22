-- Phase 2: 신규 일기(journal) 시스템 — additive only
-- 기존 diary_entries / user_profiles / saju_profiles 는 변경·삭제하지 않음.
-- 적용·검증·롤백: docs/MIGRATION_STRATEGY.md § Phase 2

-- 카테고리 카탈로그 (시스템 seed)
create table if not exists public.category_catalog (
  code text primary key,
  name text not null,
  question text not null,
  meaning text not null,
  sort_order integer not null default 0,
  is_active boolean not null default true,
  is_system boolean not null default true,
  schema_version integer not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 사건 태그 카탈로그
create table if not exists public.event_tag_catalog (
  tag_code text primary key,
  name text not null,
  sort_order integer not null default 0,
  is_active boolean not null default true,
  is_system boolean not null default true,
  schema_version integer not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 사용자 카테고리 선호
create table if not exists public.user_category_preferences (
  user_id uuid not null references auth.users(id) on delete cascade,
  category_code text not null references public.category_catalog(code),
  enabled boolean not null default true,
  sort_order integer not null default 0,
  enabled_at timestamptz,
  disabled_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, category_code)
);

create index if not exists user_category_preferences_user_idx
  on public.user_category_preferences (user_id, enabled, sort_order);

-- 신규 일기 (기존 diary_entries 와 분리)
create table if not exists public.journal_entries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  entry_date date not null,
  user_timezone text not null default 'Asia/Seoul',
  content text not null default '',
  overall_satisfaction smallint,
  mood_label text,
  main_event_text text,
  source text not null default 'new_diary',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, entry_date),
  constraint journal_entries_overall_satisfaction_check
    check (overall_satisfaction is null or (overall_satisfaction between 1 and 5)),
  constraint journal_entries_source_check
    check (source in ('new_diary', 'legacy_import'))
);

create index if not exists journal_entries_user_date_idx
  on public.journal_entries (user_id, entry_date desc);

-- 카테고리 점수 (해당 없음 = raw_score null + is_not_applicable true)
create table if not exists public.category_scores (
  id uuid primary key default gen_random_uuid(),
  entry_id uuid not null references public.journal_entries(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  category_code text not null references public.category_catalog(code),
  raw_score smallint,
  is_not_applicable boolean not null default false,
  normalized_z double precision,
  normalization_version text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (entry_id, category_code),
  constraint category_scores_raw_score_check
    check (raw_score is null or (raw_score between 1 and 5)),
  constraint category_scores_na_consistency_check
    check (
      (is_not_applicable = true and raw_score is null)
      or (is_not_applicable = false)
    )
);

create index if not exists category_scores_user_category_idx
  on public.category_scores (user_id, category_code);

-- 일기–태그 관계
create table if not exists public.journal_entry_tags (
  entry_id uuid not null references public.journal_entries(id) on delete cascade,
  tag_code text not null references public.event_tag_catalog(tag_code),
  user_id uuid not null references auth.users(id) on delete cascade,
  source text not null default 'user',
  confirmed_by_user boolean not null default true,
  valence smallint,
  intensity smallint,
  agency text,
  created_at timestamptz not null default now(),
  primary key (entry_id, tag_code),
  constraint journal_entry_tags_source_check
    check (source in ('user', 'ai_suggested', 'legacy_import'))
);

-- RLS
alter table public.category_catalog enable row level security;
alter table public.event_tag_catalog enable row level security;
alter table public.user_category_preferences enable row level security;
alter table public.journal_entries enable row level security;
alter table public.category_scores enable row level security;
alter table public.journal_entry_tags enable row level security;

-- 카탈로그: 인증 사용자 읽기
drop policy if exists "Authenticated read category_catalog" on public.category_catalog;
create policy "Authenticated read category_catalog"
  on public.category_catalog for select
  to authenticated
  using (true);

drop policy if exists "Authenticated read event_tag_catalog" on public.event_tag_catalog;
create policy "Authenticated read event_tag_catalog"
  on public.event_tag_catalog for select
  to authenticated
  using (true);

drop policy if exists "Users manage own category prefs" on public.user_category_preferences;
create policy "Users manage own category prefs"
  on public.user_category_preferences for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "Users manage own journal_entries" on public.journal_entries;
create policy "Users manage own journal_entries"
  on public.journal_entries for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "Users manage own category_scores" on public.category_scores;
create policy "Users manage own category_scores"
  on public.category_scores for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "Users manage own journal_entry_tags" on public.journal_entry_tags;
create policy "Users manage own journal_entry_tags"
  on public.journal_entry_tags for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- Seed categories (idempotent)
insert into public.category_catalog (code, name, question, meaning, sort_order, is_system)
values
  ('emotional_balance', '감정·만족도', '오늘 감정은 편안하고 안정적이었나요?', '감정 안정과 만족', 1, true),
  ('energy', '에너지·활력', '오늘 몸과 마음에 움직일 힘이 있었나요?', '활력과 활동성', 2, true),
  ('recovery_sleep', '수면·회복', '오늘 충분히 쉬고 회복되었다고 느끼나요?', '수면과 회복', 3, true),
  ('physical_condition', '건강·신체 상태', '오늘 몸의 컨디션은 어땠나요?', '신체 체감 상태', 4, true),
  ('focus_execution', '집중·실행력', '계획한 일을 집중해서 실행했나요?', '집중, 결정, 마무리', 5, true),
  ('work_study', '일·학업 성과', '오늘 일이나 공부의 결과에 만족하나요?', '생산, 성취, 평가', 6, true),
  ('relationship', '관계·연애', '오늘 사람들과의 관계는 원만했나요?', '가족, 친구, 연애, 직장 관계', 7, true),
  ('finance_resource', '재정·소비', '오늘 돈과 자원을 잘 관리했다고 느끼나요?', '수입, 지출, 현실 관리', 8, true),
  ('change_opportunity', '변화·기회', '오늘 새로운 시도나 변화의 기회가 있었나요?', '시작, 이동, 새 만남', 9, true)
on conflict (code) do update set
  name = excluded.name,
  question = excluded.question,
  meaning = excluded.meaning,
  sort_order = excluded.sort_order,
  updated_at = now();

insert into public.event_tag_catalog (tag_code, name, sort_order, is_system)
values
  ('new_start', '새로운 시작', 1, true),
  ('achievement', '성과·칭찬', 2, true),
  ('conflict', '갈등', 3, true),
  ('meeting', '소개·만남', 4, true),
  ('income', '수입', 5, true),
  ('big_spend', '큰 지출', 6, true),
  ('exercise', '운동', 7, true),
  ('illness', '질병·통증', 8, true),
  ('travel', '여행·이동', 9, true),
  ('mistake', '실수·사고', 10, true),
  ('decision', '계약·결정', 11, true),
  ('rest', '휴식', 12, true),
  ('learning', '학습', 13, true),
  ('work_pressure', '업무 압박', 14, true),
  ('family', '가족', 15, true)
on conflict (tag_code) do update set
  name = excluded.name,
  sort_order = excluded.sort_order,
  updated_at = now();
