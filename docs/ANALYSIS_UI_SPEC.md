# Phase 5 — 분석 UI·서술 · UI Spec

## 경로

| 경로 | 내용 |
|------|------|
| `/analysis` | 인덱스 |
| `/analysis/daily` | 일간 |
| `/analysis/weekly` | 주간 |
| `/analysis/monthly` | 월간 |

플래그: `NEXT_PUBLIC_FF_NEW_ANALYSIS` (기본 OFF) — `AnalysisGate`.

## 공통

세 층 섹션 분리 · 근거/신뢰도/제한 `<details>` · 상관≠인과 고지.  
원점수 vs 개인 기준선 라벨 구분.

## 일간

기준일 선택 · 해당일 일기 없으면 개인화 확정 표시 금지.

## 주간·월간

기록 일수 / 기대 일수 · 평균 원점수 · 기준선 · 태그 · 누락일(집계).

## LLM OFF

결정론적 fallback 본문 표시. 「서술 갱신」은 플래그/서버 설정에 따름.
