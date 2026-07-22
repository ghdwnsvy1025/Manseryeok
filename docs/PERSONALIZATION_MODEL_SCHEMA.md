# Phase 4 — 개인화 Ridge MVP · Model Schema

> 마이그레이션: `supabase/migrations/010_personalization_models.sql`  
> Remote migration / Schema / RLS: **complete** · Phase 4 overall: **complete**

## 테이블

### `personalization_models`

버전 병존(덮어쓰기 금지). `training_run_key` UNIQUE.  
필수 버전: `calculation_version`, `theory_version`, `feature_schema_version`, `model_version`, `allowlist_version`, `model_code_version`.

### `personalization_model_metrics`

baseline/ridge MAE, improvement, direction, spearman, sample counts, lambda.

### `personalization_predictions`

날짜별 예측 캐시 (`visible` = `prediction_visible` 규칙과 연동). journal과 분리.

## RLS

세 테이블 `auth.uid() = user_id`.  
교차·익명 차단: `verify-rls-personalization-010.mjs` + e2e에서 B→A 차단 재확인.

## 앱 매핑

| 개념 | 코드 |
|------|------|
| 인메모리 | `MemoryPersonalizationStorage` |
| 원격 | `SupabasePersonalizationStorage` / `persistModelMetrics` / `persistPredictions` |
| 파이프라인 | `runPersonalizationTrainingPipeline` |

## 불변

journal / diary_entries / astrology snapshot 원본을 모델 저장·삭제가 덮어쓰지 않음.
