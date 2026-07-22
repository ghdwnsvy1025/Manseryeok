# Migration Strategy

개편 DB는 **additive-only**. 001–007 유지.  
Phase 2=`008` · Phase 3=`009` · Phase 4=`010`.  
**Phase 5:** 011 없음. **Phase 6 — 최종 QA·출시 준비:** 스키마 변경 없음.

> 마스터 Phase 8 = 저장소 Phase 6 QA (서두 대응만).

## 적용 순서

`001` → `002` → … → `007` → `008` → `009` → `010`

## 원격 상태 (2026-07-21 Phase 6 gate)

| 축 | 상태 |
|----|------|
| 008·009·010 present | **complete** |
| schema drift (필수 테이블) | **미검출** |
| diary_entries 보존 | **2** |
| 파괴적 DROP/ALTER | **없음** |
| App-wide | **pending** |

검증: `node scripts/verify-phase6-release-gate.mjs`

## 재실행·롤백

- 재실행: `IF NOT EXISTS` · `DROP POLICY IF EXISTS` · catalog `ON CONFLICT`
- 롤백: 신규 테이블만 수동 DROP 가능 — **자동 금지** (`ROLLBACK_RUNBOOK.md`)
- FK: personalization → auth.users; astrology vectors → snapshots; scores → journal_entries
- RLS: user_id = auth.uid() 패턴 (008–010)

## Phase 4–5 참고

- Phase 4 overall **complete** · training/RLS e2e 재확인 가능
- Phase 5 production readiness **complete** · 실시간 조립

## 원칙

1. DELETE/DROP/비가역 타입 변경 금지 (롤백 시 신규 테이블만)  
2. journal ≠ diary_entries  
3. personalization_* / analysis는 원본 조회만  
4. `auth.users.id` 재사용
