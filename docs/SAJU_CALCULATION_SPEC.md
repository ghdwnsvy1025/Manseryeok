# SAJU Calculation Spec

기준: `docs/sajubase_final.md` 자료 B  
theoryVersion: `sajubase-final-2026-07-19`  
calculationVersion: `saju-calc-1.0.0`

## 상태

| 축 | 상태 |
|----|------|
| Implementation (로컬 엔진 래퍼) | complete |
| Local verification | complete |
| Full theory-formula parity | **partial** |
| Production readiness | not ready |

## Verified (완전 검증·명세 일치)

- B-1~B-7 원국 오행 경로 (기존 `elementDistribution` + golden)
- B-13/14 **LUCK_BASE_WEIGHTS 반영률만** (`luckRates.ts`, golden GF-2/3)
- B-15 모드 매핑
- 십신 (`getTenGod`), 음양 비, 합충형파해 **카운트**

## Approximate (근사 — 정확한 계산처럼 취급 금지)

| 항목 | sourceSection | reason |
|------|---------------|--------|
| 월·일운 포함 `native_with_luck` percentage | B-13 | toHigher 전량 미구현; 기존 엔진 50/50 등 근사 |
| `luck_only` 다수 운 percentage | B-14 | ordered-pair interaction 전량 미구현 |
| raw `detail`의 일부 luck blend | B-13/14 | 위와 동일 |

코드 메타: `implementationStatus: "approximate"`, `eligibleForTraining: false`  
→ `src/lib/astrology/featureAllowlist.ts`, `compute.ts`의 `parity` 필드

## Unimplemented

- B-13 monthly/daily → higher luck 세부 분배 전량
- B-14 luck↔luck ordered-pair interaction 전량
- 용신·기신 수치화

## 입출력

입력: 시→일→월→년  
모드: `native_with_luck` | `luck_only`  
출력에 `parity` / `elementDistributionStatus` 포함 (근사 여부 명시)
