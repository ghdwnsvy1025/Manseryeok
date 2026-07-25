# 오늘의 운세 · 오늘의 명언/문장 확장

마스터 프롬프트(`docs/_fortune_quote_master_prompt_extract.md`) 구현 요약.

## 구현 순서 (§28) 상태

1. DailyInsightContext — `src/lib/journal/insight/`
2. 운세 영역 매핑 — `src/lib/journal/fortune/domains.ts`
3. 운세 점수 — `src/lib/journal/fortune/score.ts`
4. 운세 문장 + 안전 필터 — `src/lib/journal/todayFortune.ts`, `contentSafety.ts`
5–6. 홈/상세 UI — `TodayFortunePanel.tsx`
7. 노출 이벤트 — `src/lib/journal/exposure.ts`, `/api/content-exposure`
8. 명언 스키마 — migrations `015`, `016`(embedding)
9. 관리자 검수 — `/admin` + `/api/admin/quotes`
10–12. 명언 RAG/필터/선택 — `src/lib/journal/quote/*`
13. 오늘의 문장 — `todayQuote.ts`, templates
14. 저장 후 UI — `JournalSaveCompleteModal.tsx`
15. 피드백 — `/api/content-feedback`, `ContentFeedbackButtons`
16. 반복 방지 — 동일일 delivery 재사용, recent deliveries, template avoid-recent
17. 관리자 디버그 — 명언 패널 (운세 캐시 테이블 연동)
18. 테스트 — `quoteAndSafety.test.ts`, `dailyInsightFortune.test.ts`
19. 지표 — 노출/피드백 테이블 적재 (대시보드 UI는 후속)
20. 문서 — 본 파일 + `FEATURE_FLAGS.md`

## 플래그

| Flag | Env |
|------|-----|
| enable_daily_fortune | `NEXT_PUBLIC_FF_DAILY_FORTUNE_V2` |
| enable_fortune_details | `NEXT_PUBLIC_FF_FORTUNE_DETAILS` |
| enable_verified_quote | `NEXT_PUBLIC_FF_VERIFIED_QUOTE` |
| enable_quote_rag | `NEXT_PUBLIC_FF_QUOTE_RAG` |
| enable_original_daily_sentence | `NEXT_PUBLIC_FF_ORIGINAL_DAILY_SENTENCE` |
| enable_content_feedback | `NEXT_PUBLIC_FF_CONTENT_FEEDBACK` |
| enable_exposure_adjusted_evaluation | `NEXT_PUBLIC_FF_EXPOSURE_ADJUSTED_EVAL` |

## DB

- `015_daily_insight_fortune_quotes.sql` — 필수
- `016_quote_library_embedding.sql` — 명언 의미검색용 (SQL Editor 실행)

점검: `node scripts/verify-daily-insight-015.mjs`
