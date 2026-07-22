# Phase 5 — 분석 UI·서술 · Narrative Policy

## 세 층

| 층 | sourceType | 출처 |
|----|------------|------|
| 명리 이론상 | `saju_theory` | verified snapshot / 이론 요약 |
| 내 기록상 | `personal_records` | journal 집계 + 노출 허용 시 모델 요약 |
| 실천 제안 | `combined_suggestion` | 위 두 층의 안전한 생활 제안 |

이론을 개인 결과처럼, 상관을 원인처럼 쓰지 않음.

## 노출 금지 → LLM 미전달

`predictionVisible !== true`, degraded / insufficient_*, baseline 미개선,  
approximate·unknown·금지 키, 버전 불일치, validation 부족, confidence 하한 미만,  
early_signal(확정 방향 대신 초기 관찰만).

## 금지·허용 문장

금지: 반드시/확정 예언, 사고·죽음·파산·진단, 투자·대출 단정, 원인 확정.  
허용: 가능성, 관찰된 경향, 데이터 부족, 수면·휴식·식사·가벼운 활동.

## 검증

- 단위: `validateNarrativeOutput` · `assertNarrativeInputSafe` · 실패 시 ViewModel fallback
- 원격: `verify-analysis-remote-e2e.mjs` (privacy audit)
- 라이브: `verify-analysis-narrative-live.mjs` — **complete** (2026-07-21); 운영 기본 플래그는 OFF
