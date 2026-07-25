-- 023: 질문 피드백 적합도 3단계
-- 2단계(맞아요/별로예요)는 "그저 그래요"를 표현할 수 없어 애매한 경우
-- 응답을 안 하거나 한쪽으로 쏠린다. fit_neutral을 허용한다.

alter table public.question_feedback_events
  drop constraint if exists question_feedback_events_type_check;

alter table public.question_feedback_events
  add constraint question_feedback_events_type_check
  check (event_type in (
    'shown',
    'fit_good',
    'fit_neutral',
    'fit_bad',
    'led_to_write',
    'skipped',
    'dismissed'
  ));

comment on constraint question_feedback_events_type_check
  on public.question_feedback_events is
  '적합도 3단계(fit_good/fit_neutral/fit_bad) + 노출·작성·건너뜀·이탈 이벤트';
