# SAJU Feature Schema

featureSchemaVersion: `saju-feature-mvp-1.0.0`  
featureCatalogVersion: `saju-feature-catalog-1.0.0`

## 상태

| 축 | 상태 |
|----|------|
| Implementation | complete |
| Local verification | complete |
| Phase 4 training readiness | **conditional** (allowlist만) |
| Production readiness | not ready |

## 원칙

- `raw_calculation_payload`와 `vector` 분리
- 근사 특징을 verified처럼 학습에 넣지 않음
- Ridge는 `getTrainingFeatureVector()` / allowlist만 사용

## MVP 벡터 필드

| 필드 | 기본 자격 |
|------|-----------|
| wood/fire/earth/metal/water | verified **조건부** (근사 percentage면 approximate) |
| yinRatio / yangRatio | verified |
| axis* / tenGod_* | verified |
| rel_* | verified |
| luck_*_rate / original_rate | verified (반영률 공식) |

## 메타데이터

각 특징 카탈로그 항목:

```ts
{
  key,
  implementationStatus: "verified" | "approximate",
  sourceSection,
  approximationReason?: string,
  eligibleForTraining: boolean,
  eligibleForUserInterpretation: boolean
}
```

코드: `src/lib/astrology/featureAllowlist.ts`

## Phase 4 계약

1. `pickTrainingFeatures(vector, context)`만 Ridge 입력  
2. `eligibleForTraining !== true` 키는 기본 제외  
3. 스냅샷 raw JSON을 피처로 직접 사용 금지  
4. 모델 학습 시 사용한 `calculationVersion` + `featureSchemaVersion` 기록
