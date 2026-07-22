-- Phase 3: 사주 프로필 캐시·날짜별 스냅샷·특징 벡터 (additive only)
-- 기존 diary_entries / journal_* / saju_profiles 파괴 변경 없음
-- 적용·검증·롤백: docs/MIGRATION_STRATEGY.md § Phase 3

-- 원국 정적 캐시 (원본은 saju_profiles 참조)
create table if not exists public.astrology_profiles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  saju_profile_id uuid references public.saju_profiles(id) on delete set null,
  birth_date_time timestamptz,
  birth_timezone text not null default 'Asia/Seoul',
  birth_location jsonb,
  calendar_calculation_version text not null,
  original_pillars jsonb not null,
  original_element_distribution jsonb not null,
  day_master text not null,
  month_branch text not null,
  day_branch text not null,
  static_feature_payload jsonb not null default '{}'::jsonb,
  theory_version text not null,
  feature_schema_version text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists astrology_profiles_user_saju_uidx
  on public.astrology_profiles (user_id, saju_profile_id);

create index if not exists astrology_profiles_user_idx
  on public.astrology_profiles (user_id);

-- 날짜별 사주 특징 스냅샷 (버전별 병존 — 조용한 덮어쓰기 금지)
create table if not exists public.astrology_snapshots (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  profile_id uuid references public.astrology_profiles(id) on delete set null,
  local_date date not null,
  timezone text not null default 'Asia/Seoul',
  calculation_mode text not null,
  luck_context jsonb not null default '{}'::jsonb,
  raw_calculation_payload jsonb not null default '{}'::jsonb,
  element_distribution jsonb not null,
  ten_god_features jsonb not null default '{}'::jsonb,
  relation_features jsonb not null default '{}'::jsonb,
  structured_features jsonb not null default '{}'::jsonb,
  calculation_version text not null,
  theory_version text not null,
  feature_schema_version text not null,
  status text not null default 'ready',
  error_message text,
  retryable boolean not null default false,
  created_at timestamptz not null default now(),
  constraint astrology_snapshots_mode_check
    check (calculation_mode in ('native_with_luck', 'luck_only')),
  constraint astrology_snapshots_status_check
    check (status in ('ready', 'failed', 'pending'))
);

create unique index if not exists astrology_snapshots_idempotent_uidx
  on public.astrology_snapshots (
    user_id,
    local_date,
    calculation_mode,
    calculation_version,
    feature_schema_version
  );

create index if not exists astrology_snapshots_user_date_idx
  on public.astrology_snapshots (user_id, local_date desc);

-- 숫자형 특징 벡터 (계산 JSON과 분리)
create table if not exists public.astrology_feature_vectors (
  id uuid primary key default gen_random_uuid(),
  snapshot_id uuid not null references public.astrology_snapshots(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  local_date date not null,
  calculation_mode text not null,
  vector jsonb not null,
  feature_schema_version text not null,
  calculation_version text not null,
  created_at timestamptz not null default now(),
  constraint astrology_feature_vectors_mode_check
    check (calculation_mode in ('native_with_luck', 'luck_only'))
);

create index if not exists astrology_feature_vectors_user_date_idx
  on public.astrology_feature_vectors (user_id, local_date desc);

create unique index if not exists astrology_feature_vectors_snapshot_uidx
  on public.astrology_feature_vectors (snapshot_id);

-- RLS
alter table public.astrology_profiles enable row level security;
alter table public.astrology_snapshots enable row level security;
alter table public.astrology_feature_vectors enable row level security;

drop policy if exists "Users manage own astrology_profiles" on public.astrology_profiles;
create policy "Users manage own astrology_profiles"
  on public.astrology_profiles for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "Users manage own astrology_snapshots" on public.astrology_snapshots;
create policy "Users manage own astrology_snapshots"
  on public.astrology_snapshots for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "Users manage own astrology_feature_vectors" on public.astrology_feature_vectors;
create policy "Users manage own astrology_feature_vectors"
  on public.astrology_feature_vectors for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
