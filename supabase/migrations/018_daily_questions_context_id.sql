-- 018: daily_questions ↔ daily_insight_contexts 연결
-- 질문·운세가 동일 날짜의 context_id를 공유하도록 FK 추가

alter table public.daily_questions
  add column if not exists context_id uuid
    references public.daily_insight_contexts(id) on delete set null;

alter table public.daily_questions
  add column if not exists scoring_version text;

alter table public.daily_questions
  add column if not exists data_cutoff_at timestamptz;

create index if not exists daily_questions_context_id_idx
  on public.daily_questions (context_id);

comment on column public.daily_questions.context_id is
  '당일 DailyInsightContext id — 운세(daily_fortunes.context_id)와 공유';
