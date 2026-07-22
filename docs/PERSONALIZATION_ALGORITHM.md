# Phase 4 — 개인화 Ridge MVP · Algorithm

> 마스터 §9 / 구현 Phase 6 대응. 명칭: **Phase 4 — 개인화 Ridge MVP**.  
> Phase 4 overall: **complete** (앱 전체 출시 pending).

## 세 층 분리 (유지)

1. **사주 계산 특징** — Phase 3 snapshot / allowlist  
2. **개인화 통계 모델** — Ridge (`trainCategoryModel` / `runPersonalizationTrainingPipeline`)  
3. **사용자 설명** — 통계 경향 문장만. LLM은 계수·예측 숫자를 만들지 않음 (서술 LLM은 다음 Phase)

## 학습 타깃·정규화

| 규칙 | 값 |
|------|-----|
| lookback | 최근 최대 60개 유효 |
| 반감기 | 30일 |
| std 하한 | 0.5 |
| z clamp | −2.5 … 2.5 |
| &lt;14 표본 | `(rawScore - 3)` fallback |
| low variance | 최근 14개 distinct ≤ 2 |

## 특징 게이트 (원격 감사 완료)

- `eligibleForTraining: true`만 학습  
- **approximate 오행이 행에 주입되면 학습 전체 거부** (`assertNoApproximateElementInjection`)  
- 원국 단독(`yinRatio`/`yangRatio`/`original_rate`) 금지  
- 상수 열 제거 · 학습 직전 `assertKeysAllowed`  
- 원격: 실제 저장 모델 `feature_keys` ⊆ 허용 후보 감사 완료 (빈 테이블 아님)

## Ridge·평가

- 순수 TS · λ=10 (n≥45 시 `[1,3,10,30]`) · 시간순 20% holdout · 셔플 금지  
- baseline MAE 미개선 → `degraded`/`insufficient_signal` · `predictionVisible: false`  
- 신뢰도 0–100 · 단계 cap

## 데이터 단계

| 유효 기록 | stage |
|-----------|--------|
| 0–13 | `insufficient_data` |
| 14–29 | `early_signal` |
| 30–89 | `active` |
| 90+ | `stable_candidate` |

## 재학습

+3 유효 · 7일 · calculation/featureSchema/allowlist/modelCode 변경 · `training_run_key` 멱등
