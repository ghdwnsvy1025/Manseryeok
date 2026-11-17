-- 사주읽는밤 일기 — 오늘 있었던 일(상태값) (2026-11-14, 사용자 결정)
--
-- states: 그날 "있었던 일". 영역 점수(areas, 평가)와 달리 묘사라서 별일 없는 날에도 고를 수 있다.
--   { pace: 1~3, people: 1~3, express: 1~3, money: 1~3, duty: 1~3, mind: 1~3, tags: ["fight", "treat", …] }
--   pace = 하루의 속도(공통). people·express·money·duty·mind = 십신 다섯 갈래(비겁·식상·재성·관성·인성)에 하나씩.
--   고른 축만 들어간다. tags는 갈래별 세부 낱말 키. 뜻과 순서는 src/lib/entry.ts STATE_AXES.
--   이전 기록은 null. 영역 점수(areas)·기분(moods)은 그대로 둔다.
-- 여러 번 실행해도 안전하다. 적용: Supabase Dashboard → SQL Editor에 붙여 넣고 Run.
-- 코드는 이 열이 없어도 동작한다 (열 없음 오류면 states 없이 다시 저장·읽기 — 상태값만 버려진다).

begin;

alter table public.night_entries
  add column if not exists states jsonb check (states is null or jsonb_typeof(states) = 'object');

commit;
