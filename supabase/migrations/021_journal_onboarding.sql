-- 021: 온보딩 6문항 프로필 (콜드스타트 개인 prior)
-- 사용자당 1행. answers는 원본, derived는 환산 결과(personalImportance/keywordPrior/baselines).

create table if not exists public.journal_onboarding_profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  onboarding_version text not null,
  answers jsonb not null default '{}'::jsonb,
  derived jsonb not null default '{}'::jsonb,
  completeness numeric(4,3) not null default 0,
  completed boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.journal_onboarding_profiles is
  '온보딩 6문항 응답 + 환산된 개인 prior. 데이터량 기반 동적 가중치의 콜드스타트 보정에 사용';
comment on column public.journal_onboarding_profiles.answers is
  '{questionId: [optionValue,...]} 원본 응답';
comment on column public.journal_onboarding_profiles.derived is
  'deriveOnboardingProfile 결과 {personalImportance, keywordPrior, baselines, ...}';

create index if not exists journal_onboarding_profiles_completed_idx
  on public.journal_onboarding_profiles (completed);

alter table public.journal_onboarding_profiles enable row level security;

drop policy if exists "Users own journal_onboarding_profiles"
  on public.journal_onboarding_profiles;
create policy "Users own journal_onboarding_profiles"
  on public.journal_onboarding_profiles for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);
