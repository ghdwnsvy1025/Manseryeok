-- Journal A 척도 1~5 → 1~10
-- 기존 값: round(1 + (v-1)*9/4)

-- 제약 완화 후 스케일, 다시 1~10 제약

alter table public.category_scores
  drop constraint if exists category_scores_raw_score_check;

alter table public.category_scores
  drop constraint if exists category_scores_user_score_check;

alter table public.category_scores
  drop constraint if exists category_scores_ai_score_check;

alter table public.journal_entries
  drop constraint if exists journal_entries_overall_satisfaction_check;

-- raw / user / ai / final (1~5 구간에 있는 값만 변환; 이미 6+ 이면 유지)
update public.category_scores
set
  raw_score = case
    when raw_score is null then null
    when raw_score between 1 and 5 then round(1 + (raw_score - 1) * 9.0 / 4)::smallint
    else raw_score
  end,
  user_score = case
    when user_score is null then null
    when user_score between 1 and 5 then round(1 + (user_score - 1) * 9.0 / 4)::smallint
    else user_score
  end,
  ai_score = case
    when ai_score is null then null
    when ai_score >= 1 and ai_score <= 5 then round(1 + (ai_score - 1) * 9.0 / 4)
    else ai_score
  end,
  final_score = case
    when final_score is null then null
    when final_score >= 1 and final_score <= 5 then round((1 + (final_score - 1) * 9.0 / 4)::numeric, 1)
    else final_score
  end;

update public.journal_entries
set overall_satisfaction = case
  when overall_satisfaction is null then null
  when overall_satisfaction between 1 and 5
    then round(1 + (overall_satisfaction - 1) * 9.0 / 4)::smallint
  else overall_satisfaction
end;

alter table public.category_scores
  add constraint category_scores_raw_score_check
  check (raw_score is null or (raw_score between 1 and 10));

alter table public.category_scores
  add constraint category_scores_user_score_check
  check (user_score is null or (user_score between 1 and 10));

alter table public.category_scores
  add constraint category_scores_ai_score_check
  check (ai_score is null or (ai_score >= 1 and ai_score <= 10));

alter table public.journal_entries
  add constraint journal_entries_overall_satisfaction_check
  check (
    overall_satisfaction is null
    or (overall_satisfaction between 1 and 10)
  );

comment on column public.category_scores.user_score is '사용자 직접 입력 1-10';
comment on column public.category_scores.ai_score is 'AI 추출 1-10 (원본 보관)';
comment on column public.category_scores.raw_score is 'user_score 동기화 1-10';
comment on column public.journal_entries.overall_satisfaction is '하루 만족도 1-10';

-- journal_entries에는 원래 schema_version이 없음 (카탈로그 테이블에만 있었음)
alter table public.journal_entries
  add column if not exists schema_version integer not null default 1;

update public.journal_entries
set schema_version = greatest(coalesce(schema_version, 1), 3);

comment on column public.journal_entries.schema_version is '클라이언트/스케일 마이그레이션용 (3 = A 점수 1-10)';
