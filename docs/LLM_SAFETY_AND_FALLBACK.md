# Phase 5 — 분석 UI·서술 · LLM Safety & Fallback

## 플래그

| 변수 | 역할 | 기본 |
|------|------|------|
| `NEXT_PUBLIC_FF_NEW_ANALYSIS` | 화면 | OFF |
| `FF_ANALYSIS_NARRATIVE_LLM` | 서버 LLM 호출 | OFF |
| `NEXT_PUBLIC_FF_ANALYSIS_NARRATIVE_LLM` | 클라 힌트 | OFF |
| `NEXT_PUBLIC_FF_ANALYSIS_CACHE` | 캐시(미구현) | OFF |

화면 ON + LLM OFF → fallback 분석 가능.  
라이브 검증 완료 여부와 무관하게 **기본 OFF**.

## 흐름

1. `assembleAnalysis` (숫자 확정)  
2. `buildNarrativeInput` (숨김·PII 제외)  
3. LLM 또는 skip (`FF_ANALYSIS_NARRATIVE_LLM`)  
4. `validateNarrativeOutput`  
5. 실패 → `narrativeFromViewModelFallback`

## 방어

금칙 · 스키마 3필드 · 계수/PII 누출 · injection echo · 타임아웃 12s · malformed JSON · API 오류 fallback.

## Live LLM verification

| 축 | 상태 |
|----|------|
| Live LLM verification | **complete** (`node scripts/verify-analysis-narrative-live.mjs`, 2026-07-21) |
| LLM feature production readiness | **complete** (플래그 OFF가 기본 운영) |

스모크 시나리오: 정상 3섹션 · insufficient · degraded · early_signal · 의료/재정 단정 유도 · injection · API 오류 fallback · (timeout/malformed은 코드·단위 경로).
