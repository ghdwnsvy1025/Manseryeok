-- 사주읽는밤 일기 — 오늘의 작은 약속 (2026-10-06, docs/design/00-톤.md v3.2 "팡 + 작은 약속")
--
-- 운세의 "하면 좋아요"(do) 한 줄이 그날의 약속. 쓰기 화면에서 지켰는지(kept) · 못 지켰는지(missed) · 해당 없음(na)을 함께 저장한다.
-- promise_text는 그날 약속한 문장 자체. 나중에 운세가 다시 계산돼 do가 바뀌어도 무엇을 약속했는지 남는다.
-- 포인트·연속일·배지 없음. 여러 번 실행해도 안전하다. 적용: Supabase Dashboard → SQL Editor에 붙여 넣고 Run.
-- 코드는 이 컬럼이 없어도 동작한다 (컬럼 없음 오류면 promise 없이 다시 저장·읽기).

begin;

alter table public.night_entries
  add column if not exists promise       text check (promise in ('kept', 'missed', 'na')),
  add column if not exists promise_text  text check (char_length(promise_text) <= 200);

commit;
