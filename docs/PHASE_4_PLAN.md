# Phase 4 Plan — 개인화 Ridge MVP

> **구현 전 계획서** → 구현 보고는 `docs/PHASE_4_IMPLEMENTATION.md`  
> 마스터 대응: §9 / 구현 Phase **6**. 명칭은 항상 **Phase 4 — 개인화 Ridge MVP**.

## 마스터 프롬프트 매핑

이 저장소 대화의 **Phase 4** = 개인화·Ridge·신뢰도 (마스터 문서 §9 / 구현 Phase **6**).  
마스터 문서의 “Phase 4: 일기 UI”는 필요 시 병행·후속으로 다루되, 본 계획의 핵심은 개인화 MVP다.

## 목표

사용자·카테고리별로 **검증된(verified) 사주 특징만** 입력으로 Ridge를 학습하고,  
기준선보다 나쁠 때 예측을 숨기며, 신뢰도와 버전을 함께 제공한다.  
**원본 journal 행은 수정하지 않는다.**

## 필수 요구 (체크)

1. **Allowlist만 Ridge 입력** — `featureAllowlist.ts` / `featureMatrix.ts`
2. **approximate 특징 학습 제외**
3. **표본 구간:** 0–13 / 14–29 / 30–89 / 90+
4. **사용자·카테고리별 기준선**
5. **시간순 holdout** + baseline MAE 비교
6. **모델 MAE ≥ baseline MAE → 예측 숨김**
7. **신뢰도 0–100**
8. **모델·특징·스냅샷 버전 추적**
9. **journal 원본 불변**
10. **테스트·문서**

## 아키텍처

```
journal scores (불변)
    + astrology feature vectors (allowlist keys only)
        → train Ridge per (userId, categoryKey)
        → compare MAE vs baseline
        → persist model artifact + metrics + versions
        → UI: 요약 또는 숨김 + 신뢰도 (/journal/stats)
```

플래그: `NEXT_PUBLIC_FF_PERSONALIZATION_TRAIN` / `_DISPLAY` (기본 OFF).

## Phase 4 완료 조건

- [x] allowlist-only 학습
- [x] approximate 제외·주입 거부
- [x] 4개 표본 구간
- [x] 기준선·시간순 검증·열등 숨김·신뢰도
- [x] journal 원본 불변
- [x] additive 010 · RLS
- [x] 원격 스키마·보존·교차 RLS
- [x] 원격 학습 스모크 · **실제 저장 모델** allowlist 감사
- [x] Phase 4 production readiness / overall **complete**
- App-wide production readiness: **pending**

## 다음 단계

구현 자동 진행 없음. 계획: **`docs/PHASE_5_PLAN.md`** (Phase 5 — 분석 UI·서술 · 마스터 Phase 7).
