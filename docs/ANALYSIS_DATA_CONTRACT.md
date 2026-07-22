# Phase 5 — 분석 UI·서술 · Analysis Data Contract

## AnalysisViewModel

결정론적 조립 출력. 수치 누락은 `null` / `available: false`.

주요 필드: `periodType`, 기간, `categoryKey`, `dataStage`, `sampleCount`, `modelStatus`,  
`predictionVisible`, `modelExposureAllowed`, `confidence*`, `baselineSummary`,  
세 층(`astrologyTheoryLayer` / `personalRecordLayer` / `actionSuggestionLayer` + `sourceType`),  
`evidence`, `limitations`, `versionMetadata`, `hideReasons`.

**응답·UI에 `userId` 미포함.**

## AssembleInput

점수·태그·astrology snapshot·personalization model 스냅샷.  
LLM·네트워크 없음. 원격 로드: `loadRemoteAssembleInput` (세션 RLS, userId를 입력 객체에 넣지 않음).

모델 select 시 **coefficients 미조회**.

## AnalysisNarrativeInput

LLM 전용 최소 구조. **금지:** 일기 원문, 생년월일, 이름/이메일/userId, 계수, 토큰, 숨김 예측, approximate 특징.

**허용:** 기간, 카테고리 표시명, 표본 수, dataStage, confidenceBand(노출 허용 시), 반올림 기준선 차이, 이론/기록 요약, 제한사항, 안전 플래그.

`predictionVisible=false` / degraded / insufficient → 개인화 방향성·패턴 노트 미전달.

버전: `calculationVersion` · `theoryVersion` · `featureSchemaVersion` · `modelVersion`은 snapshot·model과 일치할 때만 노출 경로에서 사용.

코드: `src/lib/analysis/narrativeContract.ts` · `privacyAudit.ts`

## 원격 계약 감사

`node scripts/verify-analysis-remote-e2e.mjs` — narrative 입력 개인정보·원문·계수·approximate 감사 통과 (2026-07-21).
