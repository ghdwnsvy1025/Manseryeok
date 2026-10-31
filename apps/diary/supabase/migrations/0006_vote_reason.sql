-- 사주카우 일기 — 운세 "아니에요"의 이유 (2026-10-31, ChatGPT 검토 반영)
--
-- "아니에요" 하나로는 엔진이 틀린 건지, 뻔했던 건지, 문장이 어색했던 건지 알 수 없다. 아니에요를 누르면 한 번만 고르는 이유:
--   content = 내용이 안 맞았어요 · obvious = 너무 뻔했어요 · awkward = 문장이 어색했어요. 고르지 않으면 null.
-- 점수 계산에는 쓰지 않는다(맞아요와 행복도는 다른 데이터). 다음 운세 글의 반복·문장 다듬기 참고와 운영 통계용.
-- 여러 번 실행해도 안전하다. 적용: Supabase Dashboard → SQL Editor에 붙여 넣고 Run.
-- 코드는 이 열이 없어도 동작한다 (열 없음 오류면 이유 없이 투표만 저장).

begin;

alter table public.night_fortune_feedback
  add column if not exists reason text check (reason is null or reason in ('content', 'obvious', 'awkward'));

commit;
