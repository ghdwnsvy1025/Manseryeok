-- 022: 회상 신뢰도 — 해당 날짜를 "처음" 기록한 시각
-- updated_at은 수정할 때마다 바뀌므로 회상 지연 계산에 쓸 수 없다.
-- 기존 행은 created_at으로 백필한다 (최초 저장 시각에 가장 가까운 값).

alter table public.journal_entries
  add column if not exists first_recorded_at timestamptz;

update public.journal_entries
  set first_recorded_at = created_at
  where first_recorded_at is null;

alter table public.journal_entries
  alter column first_recorded_at set default now();

comment on column public.journal_entries.first_recorded_at is
  '해당 entry_date를 최초로 기록한 시각. 회상 지연(=first_recorded_at - entry_date) 계산용. 재저장 시 갱신 금지';

create index if not exists journal_entries_first_recorded_at_idx
  on public.journal_entries (user_id, first_recorded_at);
