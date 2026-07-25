-- Ensure category_scores A scale is 1~10 (013 may be missing on remote)
-- Verified: raw_score=8 currently fails category_scores_raw_score_check → still 1~5

-- 012 columns (idempotent)
alter table public.category_scores
  add column if not exists user_score smallint;

alter table public.category_scores
  add column if not exists ai_score double precision;

alter table public.category_scores
  add column if not exists final_score double precision;

-- Drop old checks
alter table public.category_scores
  drop constraint if exists category_scores_raw_score_check;

alter table public.category_scores
  drop constraint if exists category_scores_user_score_check;

alter table public.category_scores
  drop constraint if exists category_scores_ai_score_check;

alter table public.journal_entries
  drop constraint if exists journal_entries_overall_satisfaction_check;

-- Rescale legacy 1~5 → 1~10 only when the table still looks like old scale
-- (no values above 5 yet)
do $$
declare
  max_raw smallint;
begin
  select max(raw_score) into max_raw from public.category_scores;
  if max_raw is null or max_raw <= 5 then
    update public.category_scores
    set
      raw_score = case
        when raw_score is null then null
        when raw_score between 1 and 5
          then round(1 + (raw_score - 1) * 9.0 / 4)::smallint
        else raw_score
      end,
      user_score = case
        when user_score is null then raw_score
        when user_score between 1 and 5
          then round(1 + (user_score - 1) * 9.0 / 4)::smallint
        else user_score
      end,
      ai_score = case
        when ai_score is null then null
        when ai_score >= 1 and ai_score <= 5
          then round(1 + (ai_score - 1) * 9.0 / 4)
        else ai_score
      end,
      final_score = case
        when final_score is null then null
        when final_score >= 1 and final_score <= 5
          then round((1 + (final_score - 1) * 9.0 / 4)::numeric, 1)
        else final_score
      end;
  end if;

  -- overall_satisfaction: only rescale if still <=5 max
  if (select coalesce(max(overall_satisfaction), 0) from public.journal_entries) <= 5 then
    update public.journal_entries
    set overall_satisfaction = case
      when overall_satisfaction is null then null
      when overall_satisfaction between 1 and 5
        then round(1 + (overall_satisfaction - 1) * 9.0 / 4)::smallint
      else overall_satisfaction
    end;
  end if;
end $$;

-- Backfill user/final from raw when null
update public.category_scores
set user_score = raw_score
where user_score is null and raw_score is not null;

update public.category_scores
set final_score = coalesce(final_score, user_score, raw_score)
where final_score is null
  and coalesce(user_score, raw_score) is not null
  and is_not_applicable = false;

-- New checks: scores 1~10, overall 0~10 (happiness compatibility)
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
    or (overall_satisfaction between 0 and 10)
  );

comment on column public.category_scores.raw_score is 'user_score 동기화 1-10';
comment on column public.category_scores.user_score is '사용자 직접 입력 1-10';
comment on column public.category_scores.ai_score is 'AI 추출 1-10';
comment on column public.journal_entries.overall_satisfaction is
  '하루 만족도/행복도 호환 0-10';
