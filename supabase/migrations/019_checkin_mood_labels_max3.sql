-- 019: 체크인 mood_labels 최대 3개 DB 방어
-- (앱 validateCheckInSave와 병행 — 클라이언트 우회 차단)

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
  '체크인 v2: 기분 최대 3개';
