# Phase 4 — 개인화 Ridge MVP · Evaluation

> Phase 4 overall: **complete**. 빈 테이블 감사가 아닌 **실제 저장 모델** 기준 원격 감사 완료.

## Baseline vs Ridge

| 지표 | 용도 |
|------|------|
| baseline MAE | 가중평균(z≈0) 기준 |
| Ridge MAE | holdout 예측 |
| MAE improvement | baseline − ridge (&gt;0 이득) |
| direction accuracy / Spearman | 보조 |

Ridge ≤ baseline → `degraded`/`insufficient_signal` · `predictionVisible: false`.

## 신뢰도

가중치: volume 0.20 · coverage 0.15 · variation 0.10 · recency 0.10 · validation 0.30 · stability 0.15.  
밴드: insufficient / low / medium / high / very_high. **very_high ≠ 확정 예언**.

## 원격 검증 계층

| 계층 | 명령 | 비고 |
|------|------|------|
| 스키마·보존 | `verify-personalization-010.mjs` | `modelsScanned: 0`만으로 allowlist complete 금지 |
| 교차 RLS | `verify-rls-personalization-010.mjs` | 실제 insert 후 격리 |
| 학습 파이프라인 + 저장 모델 allowlist | `verify-personalization-training-e2e.mjs` | **complete** |

## 단위 테스트

`src/__tests__/personalization/ridgeMvp.test.ts` — 정규화·allowlist·Ridge·평가·버전·원본 불변.
