-- 028: 지인 베타 인앱 피드백
-- 일기 본문·이메일은 저장하지 않음. category + 짧은 message + path만.

create table if not exists public.beta_feedback (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  category text not null
    check (category in ('bug', 'awkward_copy', 'idea', 'other')),
  message text not null
    check (char_length(message) >= 1 and char_length(message) <= 500),
  path text not null default '/'
    check (char_length(path) <= 200),
  created_at timestamptz not null default now()
);

create index if not exists beta_feedback_created_at_idx
  on public.beta_feedback (created_at desc);

create index if not exists beta_feedback_user_id_idx
  on public.beta_feedback (user_id);

alter table public.beta_feedback enable row level security;

drop policy if exists "Users insert own beta_feedback" on public.beta_feedback;
create policy "Users insert own beta_feedback"
  on public.beta_feedback for insert
  with check (auth.uid() = user_id);

-- select/update/delete: 일반 유저 불가. 관리자는 service role API로 조회.

comment on table public.beta_feedback is
  '지인 베타 의견 제보 (버그·어색한 문장·제안). 본문/생일/이메일 미포함.';
