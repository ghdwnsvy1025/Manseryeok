-- Phase check-in v2: 행복도 0~10 · 복수 기분 · 핵심/도메인 JSON · 질문/피드백 테이블(골격)
-- additive-first. 기존 journal_entries / category_scores 유지.
-- 적용·롤백: 플래그 NEXT_PUBLIC_FF_CHECKIN_V2 OFF 후 컬럼은 무시 가능.

-- 행복도 0~10 (레거시 overall_satisfaction 1~10과 병행)
alter table public.journal_entries
  add column if not exists happiness_score smallint;

alter table public.journal_entries
  drop constraint if exists journal_entries_happiness_score_check;

alter table public.journal_entries
  add constraint journal_entries_happiness_score_check
  check (
    happiness_score is null
    or (happiness_score between 0 and 10)
  );

comment on column public.journal_entries.happiness_score is
  '체크인 v2 행복도 0-10 (레거시 overall_satisfaction과 병행)';

-- 복수 기분 (최대 3은 앱 검증)
alter table public.journal_entries
  add column if not exists mood_labels jsonb not null default '[]'::jsonb;

comment on column public.journal_entries.mood_labels is
  '체크인 v2 기분 배열 (예: ["기쁨","평온"]). mood_label은 첫 항목 호환용';

-- 핵심 4 서열 원본
alter table public.journal_entries
  add column if not exists core_states jsonb;

comment on column public.journal_entries.core_states is
  '체크인 v2 핵심 상태 {code:{ordinal:1-5|null,isNotApplicable:bool}}';

-- 조건부 생활영역 (하루 ≤2)
alter table public.journal_entries
  add column if not exists domain_scores jsonb;

comment on column public.journal_entries.domain_scores is
  '체크인 v2 조건부 도메인 [{code,ordinal,isNotApplicable}]';

-- 체크인 스키마 표시 (2 = v2 UI)
alter table public.journal_entries
  add column if not exists checkin_version integer;

comment on column public.journal_entries.checkin_version is
  '1=레거시 에디터, 2=체크인 v2';

-- overall_satisfaction: 0 허용 (행복도 0 매핑/호환). 기존 1~10 데이터 유지.
alter table public.journal_entries
  drop constraint if exists journal_entries_overall_satisfaction_check;

alter table public.journal_entries
  add constraint journal_entries_overall_satisfaction_check
  check (
    overall_satisfaction is null
    or (overall_satisfaction between 0 and 10)
  );

comment on column public.journal_entries.overall_satisfaction is
  '하루 만족도/행복도 호환 0-10 (레거시 UI는 1-10)';

update public.journal_entries
set schema_version = greatest(coalesce(schema_version, 1), 4)
where checkin_version = 2 or happiness_score is not null;

-- 오늘의 질문 저장 (이후 엔진이 채움)
create table if not exists public.daily_questions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  question_date date not null,
  question_text text not null default '',
  keyword_codes jsonb not null default '[]'::jsonb,
  evidence jsonb not null default '{}'::jsonb,
  confidence double precision,
  model_version text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, question_date)
);

create index if not exists daily_questions_user_date_idx
  on public.daily_questions (user_id, question_date desc);

-- 질문 피드백 / 작성 유도 이벤트
create table if not exists public.question_feedback_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  question_id uuid references public.daily_questions(id) on delete set null,
  question_date date not null,
  event_type text not null,
  rating smallint,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint question_feedback_events_type_check
    check (event_type in (
      'shown',
      'fit_good',
      'fit_bad',
      'led_to_write',
      'skipped',
      'dismissed'
    )),
  constraint question_feedback_events_rating_check
    check (rating is null or (rating between 1 and 5))
);

create index if not exists question_feedback_events_user_date_idx
  on public.question_feedback_events (user_id, question_date desc);

alter table public.daily_questions enable row level security;
alter table public.question_feedback_events enable row level security;

drop policy if exists "Users own daily_questions" on public.daily_questions;
create policy "Users own daily_questions"
  on public.daily_questions
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "Users own question_feedback_events"
  on public.question_feedback_events;
create policy "Users own question_feedback_events"
  on public.question_feedback_events
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
