# SAJU Snapshot Spec

## 상태

| 축 | 상태 |
|----|------|
| Implementation | complete |
| Local verification | complete |
| Remote migration | **complete** |
| Schema verification | **complete** |
| Cross-user RLS | **complete** (`rls_1784630715103_54e56b`) |
| Phase 3 overall | **complete** |
| Phase 4 readiness | **ready** |
| App-wide launch | not claimed |

## 테이블

- `astrology_profiles` — `saju_profiles` 참조 캐시
- `astrology_snapshots` — 날짜×모드×버전 스냅샷
- `astrology_feature_vectors` — 숫자 벡터 (snapshot 1:1)

## 유일성

`(user_id, local_date, calculation_mode, calculation_version, feature_schema_version)`  
버전 변경 시 **새 행**. 과거 스냅샷 덮어쓰기 금지.

## 생성

`ensureAstrologySnapshot` — 멱등, 실패 시 일기 유지.  
Flag: `NEXT_PUBLIC_FF_SAJU_SNAPSHOT` (기본 OFF)

## 근사 표시

`structuredFeatures.elementDistributionStatus` / `parity.approximateSections`  
근사 percentage는 Phase 4 allowlist에서 학습 제외.

## 재계산 전략

코드: `src/lib/astrology/recompute.ts`

1. 공식 변경 → 새 `calculationVersion` 발행  
2. 벡터 키/의미 변경 → 새 `featureSchemaVersion`  
3. 기존 스냅샷 **보존** (DELETE/UPDATE로 덮어쓰기 금지)  
4. 날짜 범위: `buildDateRangeRecomputeCommand`  
5. 사용자별: `buildUserRecomputeCommand`  
6. journal 원본 **불변** (`journalImmutable: true`)  
7. Ridge 모델은 `ModelSnapshotVersionRef`로 학습 시 버전 추적  
8. 구버전은 `deprecateOlderVersions` 메타로 deprecated 표시 (행 삭제 아님)

대규모 재계산은 이 단계에서 실행하지 않음.
