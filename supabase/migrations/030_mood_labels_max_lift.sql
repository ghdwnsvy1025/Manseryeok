-- 030: 기분 라벨 최대 3개 (앱 MAX_MOODS=3과 동일)
alter table public.journal_entries
  drop constraint if exists journal_entries_mood_labels_max_len;

alter table public.journal_entries
  drop constraint if exists journal_entries_mood_labels_max_3;

alter table public.journal_entries
  add constraint journal_entries_mood_labels_max_3
  check (
    mood_labels is null
    or (
      jsonb_typeof(mood_labels) = 'array'
      and jsonb_array_length(mood_labels) <= 3
    )
  );

comment on constraint journal_entries_mood_labels_max_3 on public.journal_entries is
  '체크인 v2: 기분 최소 0(레거시)·앱 저장 시 1~3개';
