# SAJU Theory Integration

## Canonical Source

| 항목 | 값 |
|------|-----|
| 원문 | `docs/sajubase_final.md` |
| 생성일 | 2026-07-19 |
| theoryVersion | `sajubase-final-2026-07-19` |

원문을 `knowledge/saju/source/`에 중복 복사하지 않는다. README 포인터만 둔다.

## 분리 구조

### A. 계산 명세 (자료 B)

인덱스: `knowledge/saju/structured/calculation_rules.json`  
코드: `src/lib/saju/elementDistribution.ts`, `src/lib/astrology/luckRates.ts`, `src/lib/astrology/compute.ts`

### B. 해석 이론 (자료 A)

인덱스: `knowledge/saju/structured/interpretation_index.json`  
Phase 3: 인덱싱만. 최종 상담 문장 생성은 Phase 4+.

### C. 상담·안전 규칙

인덱스: `knowledge/saju/structured/safety_rules.json`  
규칙 ID: `C-1` … `C-6`

## 추적

모든 계산 결과는 `sourceRuleIds` / `theoryVersion` / `calculationVersion`을 남긴다.

## 일반 사주 상식

자료 A/B에 없는 판단 규칙은 도입하지 않았다.  
합충형파해 표는 기존 `interpretation/relations.ts`를 재사용하며, 해석 문장 생성에는 Phase 3에서 사용하지 않는다(카운트 특징만).
