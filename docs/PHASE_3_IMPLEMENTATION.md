# Phase 3 Implementation

> **Phase 3 overall: complete** (2026-07-21)  
> 범위: 사주 이론 기반 결정론적 계산 + 날짜별 특징 스냅샷 + 원격 스키마·RLS  
> Ridge/개인화: **미구현** → Phase 4 계획 (`docs/PHASE_4_PLAN.md`)  
> **주의:** 아래 `productionReady` / security gate는 **Phase 3 DB·RLS 범위**이며 앱 전체 출시 완료가 아님.

## 상태 분류 (정본)

| 축 | 상태 |
|----|------|
| Implementation | **complete** |
| Local verification | **complete** |
| Remote migration | **complete** |
| Existing data preservation | **complete** |
| Schema verification | **complete** |
| Cross-user RLS verification | **complete** |
| Phase 3 production security gate | **complete** |
| Phase 3 overall status | **complete** |
| Phase 4 readiness | **ready** |
| Full theory-formula parity (B-13/14 월·일운) | **partial** (근사·학습 제외 유지) |
| App-wide launch readiness | **not claimed** |

## 운영 검증 증거

### 스키마 (008·009)

| 항목 | 결과 |
|------|------|
| `verify-journal-008.mjs` | ok true |
| `verify-astrology-009.mjs` | ok true |
| category_catalog | 9 |
| event_tag_catalog | 15 |
| astrology 테이블·필수 컬럼 | 조회 성공 |

### 기존 데이터 보존

| 시점 | `diary_entries` |
|------|-----------------|
| 마이그레이션·RLS 테스트 전 | **2** |
| 테스트 후 | **2** |

### 교차 사용자 RLS (`verify-rls-cross-user.mjs`)

| 항목 | 값 |
|------|-----|
| runId | `rls_1784630715103_54e56b` |
| 로그인 A/B | 성공 · userId 서로 다름 |
| 자기 journal CRUD | 성공 |
| 자기 astrology profile/snapshot/vector | 성공 |
| 상대 journal 조회·수정·삭제 | **차단** |
| 상대 astrology 접근 | **차단** |
| 익명 journal·astrology | **차단** |
| 테스트 데이터 cleanup | **성공**, errors 없음 |
| failures | **0** |
| remoteRlsVerification | **complete** |
| ok | **true** |

검증한 시나리오 요약: 자기 접근(CRUD) · 교차 접근 차단 · 익명 접근 차단 · Legacy `diary_entries` 불변.

스크립트 출력의 `productionReady: true` = Phase 3 DB/RLS 게이트 통과. 전체 제품 출시 준비와 동일시하지 않음.

## Canonical / 근사 / 재계산

- 이론: `docs/sajubase_final.md` · manifest `knowledge/saju/manifests/versions.json`
- 근사 특징: `eligibleForTraining: false` (`featureAllowlist.ts`)
- 재계산: `src/lib/astrology/recompute.ts` (덮어쓰기 금지)

## 플래그

`NEXT_PUBLIC_FF_SAJU_SNAPSHOT` 기본 OFF.
