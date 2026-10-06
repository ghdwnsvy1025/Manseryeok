-- 사주읽는밤 일기 — 익명 시작 (2026-10-06, docs/ANON_START.md)
--
-- Google 연결 안내 카드를 몇 번 보여 줬는지 기억한다. 첫 저장 뒤 한 번, 기록 7건째 한 번.
-- 여러 번 실행해도 안전하다. 적용: Supabase Dashboard → SQL Editor에 붙여 넣고 Run.
-- 코드는 이 컬럼이 없어도 동작한다 (읽기 실패 시 0으로 본다). 적용 전에는 안내 카드가 저장할 때마다 다시 보일 수 있다.

begin;

alter table public.night_profiles
  add column if not exists link_prompted_at   timestamptz,
  add column if not exists link_prompt_count  smallint not null default 0;

commit;
