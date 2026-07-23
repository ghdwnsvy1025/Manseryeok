-- Phase A: user/ai/final 점수 분리 + journal XP (날짜당 1회)
-- 기존 raw_score 는 user_score 와 동기화 유지 (하위 호환)

alter table public.category_scores
  add column if not exists user_score smallint,
  add column if not exists ai_score double precision,
  add column if not exists final_score double precision;

alter table public.journal_entries
  add column if not exists xp_granted boolean not null default false,
  add column if not exists xp_awarded integer not null default 0;

-- 기존 데이터 백필: user/final = raw_score
update public.category_scores
set user_score = raw_score
where user_score is null;

update public.category_scores
set final_score = raw_score
where final_score is null
  and is_not_applicable = false
  and raw_score is not null;

alter table public.category_scores
  drop constraint if exists category_scores_user_score_check;

alter table public.category_scores
  add constraint category_scores_user_score_check
  check (user_score is null or (user_score between 1 and 5));

alter table public.category_scores
  drop constraint if exists category_scores_ai_score_check;

alter table public.category_scores
  add constraint category_scores_ai_score_check
  check (ai_score is null or (ai_score >= 1 and ai_score <= 5));

alter table public.category_scores
  drop constraint if exists category_scores_final_na_check;

alter table public.category_scores
  add constraint category_scores_final_na_check
  check (
    (is_not_applicable = true and final_score is null)
    or (is_not_applicable = false)
  );

comment on column public.category_scores.user_score is '사용자 직접 입력 1-5';
comment on column public.category_scores.ai_score is 'AI 추출 1-5 (원본 보관)';
comment on column public.category_scores.final_score is '통계·학습용 최종 A (평균 또는 한쪽)';
comment on column public.journal_entries.xp_granted is '해당 날짜 최초 저장 시 XP 지급 여부';
comment on column public.journal_entries.xp_awarded is '지급된 XP (수정 시 유지)';
