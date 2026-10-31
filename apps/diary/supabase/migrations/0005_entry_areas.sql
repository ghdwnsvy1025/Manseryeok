-- 사주카우 일기 — 영역별 행복도·기분 제한 풀기·내일의 나에게 쪽지 (2026-10-31, 사용자 결정)
--
-- areas: 여섯 영역(work·money·health·family·love·people)을 1~5로. 매긴 영역만 들어간다. 하루 행복도(happiness)는
--        서버가 매긴 영역 평균 × 2를 반올림해 함께 저장한다(1~10, 이전 기록과 같은 열). 이전 기록은 areas가 null.
-- moods: "3개까지" 제한을 푼다(기분 45개 — 넉넉히 60).
-- tomorrow_note: "내일의 나에게" 한 줄(100자). 다음 날 오늘 화면 위에 펼쳐진다. 약속(promise) 열은 지난 기록용으로 그대로 둔다.
-- 여러 번 실행해도 안전하다. 적용: Supabase Dashboard → SQL Editor에 붙여 넣고 Run.
-- 코드는 이 열이 없어도 동작한다 (열 없음 오류면 areas·쪽지 없이 다시 저장·읽기 — 영역 점수만 버려진다).

begin;

alter table public.night_entries drop constraint if exists night_entries_moods_check;
alter table public.night_entries add constraint night_entries_moods_check check (cardinality(moods) <= 60);

alter table public.night_entries
  add column if not exists areas          jsonb check (areas is null or jsonb_typeof(areas) = 'object'),
  add column if not exists tomorrow_note  text  check (char_length(tomorrow_note) <= 100);

commit;
