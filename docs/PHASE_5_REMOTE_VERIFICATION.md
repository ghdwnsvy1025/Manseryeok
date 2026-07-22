# Phase 5 — 분석 UI·서술 · Remote Verification

일자: 2026-07-21

## 명령

```bash
node scripts/verify-analysis-remote-e2e.mjs
FF_ANALYSIS_NARRATIVE_LLM=true node scripts/verify-analysis-narrative-live.mjs
```

## 인증

우선순위:

1. `TEST_USER_A/B_EMAIL` + `PASSWORD`
2. `TEST_USER_A/B_JWT`
3. `SUPABASE_SERVICE_ROLE_KEY`로 **ephemeral** 테스트 사용자 생성 → 실행 후 `deleteUser` (이번 실행 전용)

운영 사용자·`diary_entries`는 변경하지 않음.

## 원격 e2e가 검증하는 것

- 카테고리 선호 · journal · category_scores · tags
- astrology snapshot + verified feature vector
- personalization model · metrics · predictions
- daily / weekly / monthly assembler
- prediction 숨김 정책
- narrative 입력 개인정보·원문·계수 감사
- approximate 특징 미포함
- 교차 사용자 격리 · 비로그인 fallback · 빈 데이터 fallback
- LLM OFF deterministic fallback
- cleanup + 행 수 전후 (`diary_entries` 불변)

## 최근 통과 증거 (요약)

| 항목 | 결과 |
|------|------|
| `remoteAnalysisIntegrationVerification` | complete |
| `deterministicProductionPath` | complete |
| `phase5ProductionReadinessWithLlmDisabled` | complete |
| `liveLlmVerification` | complete (별도 스크립트) |
| `llmFeatureProductionReadiness` | complete |
| `phase5ProductionReadiness` | complete |
| `appWideProductionReadiness` | **pending** |
| `diary_entries` | 전후 2 유지 |

## Feature flag (운영 기본)

| 플래그 | 기본 | 비고 |
|--------|------|------|
| `NEXT_PUBLIC_FF_NEW_ANALYSIS` | OFF | 화면 |
| `FF_ANALYSIS_NARRATIVE_LLM` | OFF | 서버 LLM |
| `NEXT_PUBLIC_FF_ANALYSIS_NARRATIVE_LLM` | OFF | 클라 힌트 |

라이브 검증 완료와 무관하게 **기본 OFF** 유지. ON은 배포 시 명시적 설정.

## Feature flag 조합

| 조합 | 기대 |
|------|------|
| A. 분석 OFF | 내비·화면 비노출 |
| B. 분석 ON + LLM OFF | 일·주·월 + 결정론적 문장, LLM 미호출 |
| C. 분석 ON + LLM ON | 구조화 입력만 · 스키마·금칙·fallback |

## Cleanup

`runId` / `MARKER`로 생성한 journal·scores·tags·snapshots·vectors·models·metrics·predictions만 삭제. ephemeral 사용자도 삭제.
